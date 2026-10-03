const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const DeviceSession = require('../models/DeviceSession');
const { parseDeviceInfo } = require('../utils/deviceParser');

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
// Also cleans up older duplicate phantom sessions
// ─────────────────────────────────────────────────────────────
exports.getSessions = async (req, res) => {
  try {
    const rawSessions = await DeviceSession.find({ user: req.user._id })
      .sort({ lastActive: -1 })
      .lean();

    // Deduplicate phantom/redundant sessions that share the same browser, os, and deviceName/ip
    const seen = new Map();
    const uniqueSessions = [];
    const idsToDelete = [];

    for (const s of rawSessions) {
      // Grouping key: browser + os + (deviceName || ip)
      const key = `${s.browser}_${s.os}_${s.deviceName || s.ip}`;
      if (!seen.has(key)) {
        seen.set(key, s);
        uniqueSessions.push(s);
      } else {
        // Keep the more recently active one, flag old duplicate for deletion
        idsToDelete.push(s._id);
      }
    }

    if (idsToDelete.length > 0) {
      DeviceSession.deleteMany({ _id: { $in: idsToDelete } }).catch((e) =>
        console.warn('Error purging duplicate sessions:', e.message)
      );
    }

    res.json(uniqueSessions);
  } catch (err) {
    console.error('getSessions error:', err);
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/devices/register  –  Register or refresh current session
// ─────────────────────────────────────────────────────────────
exports.registerSession = async (req, res) => {
  try {
    const { sessionId, clientModel, customName } = req.body || {};
    const ua = req.headers['user-agent'] || '';
    const { browser, os, deviceType, deviceName } = parseDeviceInfo(ua, clientModel);
    const ip = getClientIP(req);

    if (!sessionId) {
      return res.status(400).json({ message: 'sessionId required' });
    }

    const updateData = {
      user: req.user._id,
      sessionId,
      browser,
      os,
      deviceType,
      deviceName,
      ip,
      lastActive: new Date(),
    };

    if (customName && customName.trim()) {
      updateData.customName = customName.trim();
    }

    const session = await DeviceSession.findOneAndUpdate(
      { user: req.user._id, sessionId },
      updateData,
      { upsert: true, new: true }
    );

    res.json({ message: 'Session registered', session });
  } catch (err) {
    console.error('registerSession error:', err);
    res.status(500).json({ message: 'Failed to register session' });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/devices/:sessionId/name  –  Set custom name for a device
// ─────────────────────────────────────────────────────────────
exports.updateSessionName = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { customName } = req.body || {};

    if (!customName || !customName.trim()) {
      return res.status(400).json({ message: 'Custom name cannot be empty' });
    }

    const session = await DeviceSession.findOneAndUpdate(
      { user: req.user._id, sessionId },
      { customName: customName.trim() },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ message: 'Device session not found' });
    }

    res.json({ message: 'Device name updated', session });
  } catch (err) {
    console.error('updateSessionName error:', err);
    res.status(500).json({ message: 'Failed to update device name' });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/devices/qr-token  –  Generate a fresh QR payload
// ─────────────────────────────────────────────────────────────
exports.generateQRToken = async (req, res) => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 60_000;

    pendingQRTokens.set(token, {
      userId: req.user._id.toString(),
      expiresAt,
    });

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
    const { qrToken, sessionId, clientModel } = req.body || {};

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

    pendingQRTokens.delete(qrToken);

    const ua = req.headers['user-agent'] || '';
    const { browser, os, deviceType, deviceName } = parseDeviceInfo(ua, clientModel);
    const ip = getClientIP(req);

    const session = await DeviceSession.findOneAndUpdate(
      { user: pending.userId, sessionId },
      {
        user: pending.userId,
        sessionId,
        browser,
        os,
        deviceType,
        deviceName,
        ip,
        lastActive: new Date()
      },
      { upsert: true, new: true }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(pending.userId).emit('device:linked', {
        session,
        message: `New device linked: ${deviceName || browser}`,
      });
    }

    res.json({ message: 'Device linked', session });
  } catch (err) {
    console.error('linkDevice error:', err);
    res.status(500).json({ message: 'Failed to link device' });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/devices/:sessionId  –  Log out one specific remote session
// ─────────────────────────────────────────────────────────────
exports.removeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    await DeviceSession.findOneAndDelete({ user: req.user._id, sessionId });

    // Notify the removed device specifically
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
// DELETE /api/devices/all  –  Log out ALL other sessions except current
// ─────────────────────────────────────────────────────────────
exports.removeAllSessions = async (req, res) => {
  try {
    const { currentSessionId } = req.body || {};

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
