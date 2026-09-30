const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const DeviceSession = require('../models/DeviceSession');

// ── Tiny UA parser (no dependency) ───────────────────────────
const parseUA = (ua = '') => {
  let browser = 'Browser';
  let os      = 'Unknown OS';

  if (/Edg\//i.test(ua))             browser = 'Edge';
  else if (/Chrome\//i.test(ua))     browser = 'Chrome';
  else if (/Firefox\//i.test(ua))    browser = 'Firefox';
  else if (/Safari\//i.test(ua))     browser = 'Safari';
  else if (/OPR\//i.test(ua))        browser = 'Opera';

  if (/Windows NT/i.test(ua))        os = 'Windows';
  else if (/Mac OS X/i.test(ua))     os = 'macOS';
  else if (/Android/i.test(ua))      os = 'Android';
  else if (/iPhone|iPad/i.test(ua))  os = 'iOS';
  else if (/Linux/i.test(ua))        os = 'Linux';

  return { browser, os };
};

const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'Unknown'
  );
};

// ── In-memory pending QR tokens (cleared after scan or expiry) ──
const pendingQRTokens = new Map();

// ─────────────────────────────────────────────────────────────
// GET /api/devices  –  List all sessions for the current user
// ─────────────────────────────────────────────────────────────
exports.getSessions = async (req, res) => {
  try {
    const sessions = await DeviceSession.find({ user: req.user._id })
      .sort({ lastActive: -1 })
      .lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/devices/register  –  Register the current session
// Called automatically on login / app boot
// ─────────────────────────────────────────────────────────────
exports.registerSession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const ua = req.headers['user-agent'] || '';
    const { browser, os } = parseUA(ua);
    const ip = getClientIP(req);

    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId required' });
    }

    // Upsert: create or refresh the session
    const session = await DeviceSession.findOneAndUpdate(
      { user: req.user._id, sessionId },
      {
        user: req.user._id,
        sessionId,
        browser,
        os,
        ip,
        lastActive: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Session registered', session });
  } catch (err) {
    console.error('registerSession error:', err);
    res.status(500).json({ message: 'Failed to register session' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/devices/qr-token  –  Generate a fresh QR payload
// ─────────────────────────────────────────────────────────────
exports.generateQRToken = async (req, res) => {
  try {
    // One-time token, 60-second TTL
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 60_000;

    pendingQRTokens.set(token, {
      userId:    req.user._id.toString(),
      expiresAt,
    });

    // Auto-cleanup after expiry
    setTimeout(() => pendingQRTokens.delete(token), 62_000);

    res.json({ qrToken: token, expiresAt });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate QR token' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/devices/link  –  Scan QR and link device
// ─────────────────────────────────────────────────────────────
exports.linkDevice = async (req, res) => {
  try {
    const { qrToken, sessionId } = req.body;

    if (!qrToken || !sessionId) {
      return res.status(400).json({ message: 'qrToken and sessionId required' });
    }

    const pending = pendingQRTokens.get(qrToken);
    if (!pending) {
      return res.status(400).json({ message: 'QR token invalid or expired' });
    }
    if (Date.now() > pending.expiresAt) {
      pendingQRTokens.delete(qrToken);
      return res.status(400).json({ message: 'QR token has expired' });
    }

    // Token consumed – remove it
    pendingQRTokens.delete(qrToken);

    const ua = req.headers['user-agent'] || '';
    const { browser, os } = parseUA(ua);
    const ip = getClientIP(req);

    const session = await DeviceSession.findOneAndUpdate(
      { user: pending.userId, sessionId },
      { user: pending.userId, sessionId, browser, os, ip, lastActive: new Date() },
      { upsert: true, new: true }
    );

    // Notify the scanning device via socket
    const io = req.app.get('io');
    if (io) {
      io.to(pending.userId).emit('device:linked', {
        session,
        message: 'New device linked successfully',
      });
    }

    res.json({ message: 'Device linked', session });
  } catch (err) {
    console.error('linkDevice error:', err);
    res.status(500).json({ message: 'Failed to link device' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/devices/:sessionId  –  Log out one session
// ─────────────────────────────────────────────────────────────
exports.removeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await DeviceSession.findOneAndDelete({ user: req.user._id, sessionId });

    // Notify the removed device
    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('device:removed', { sessionId });
    }

    res.json({ message: 'Session removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove session' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/devices  –  Log out ALL sessions except current
// ─────────────────────────────────────────────────────────────
exports.removeAllSessions = async (req, res) => {
  try {
    const { currentSessionId } = req.body;

    const query = { user: req.user._id };
    if (currentSessionId) {
      query.sessionId = { $ne: currentSessionId };
    }

    await DeviceSession.deleteMany(query);

    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('device:all_removed', { currentSessionId });
    }

    res.json({ message: 'All other sessions removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove all sessions' });
  }
};
