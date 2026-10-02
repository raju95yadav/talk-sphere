const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const DeviceSession = require('../models/DeviceSession');

// ── In-memory active QR sessions ─────────────────────────────
// Map: qrToken -> sessionData
const qrSessions = new Map();

// Parse User-Agent
const parseUA = (ua = '') => {
  let browser = 'Browser';
  let os = 'Unknown OS';

  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua)) browser = 'Safari';
  else if (/OPR\//i.test(ua)) browser = 'Opera';

  if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { browser, os };
};

const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
};

// Periodic cleanup of expired tokens every 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of qrSessions.entries()) {
    if (now > data.expiresAt + 10_000) {
      qrSessions.delete(token);
    }
  }
}, 30_000);

/**
 * POST /api/auth/qr/generate
 * Public or Protected: Generates a fresh QR token for linking
 */
exports.generateQR = async (req, res) => {
  try {
    const { sessionId, mode } = req.body || {};
    const ua = req.headers['user-agent'] || '';
    const { browser, os } = parseUA(ua);
    const ip = getClientIP(req);

    const qrToken = 'tsqr_' + crypto.randomBytes(24).toString('hex');
    const finalSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const expiresAt = Date.now() + 90_000; // 90s TTL

    // If an authenticated user is generating this from Linked Devices (mode === 'show'):
    const existingUserId = req.user ? req.user._id.toString() : null;

    qrSessions.set(qrToken, {
      qrToken,
      sessionId: finalSessionId,
      status: 'pending',
      browser,
      os,
      ip,
      createdAt: Date.now(),
      expiresAt,
      userId: existingUserId,
      token: null,
      refreshToken: null,
      user: null
    });

    res.json({
      success: true,
      qrToken,
      sessionId: finalSessionId,
      expiresAt,
      device: { browser, os, ip }
    });
  } catch (error) {
    console.error('Error generating QR token:', error);
    res.status(500).json({ message: 'Failed to generate QR token' });
  }
};

/**
 * GET /api/auth/qr/status/:qrToken
 * Public: Polled by the client displaying the QR code
 */
exports.checkQRStatus = async (req, res) => {
  try {
    const { qrToken } = req.params;
    if (!qrToken) return res.status(400).json({ message: 'qrToken is required' });

    const session = qrSessions.get(qrToken);
    if (!session) {
      return res.json({ status: 'invalid', message: 'QR Code is expired or invalid' });
    }

    if (Date.now() > session.expiresAt) {
      qrSessions.delete(qrToken);
      return res.json({ status: 'expired', message: 'QR Code has expired' });
    }

    if (session.status === 'approved') {
      if (session.refreshToken) {
        res.cookie('refreshToken', session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000
        });
      }

      const responsePayload = {
        status: 'approved',
        token: session.token,
        refreshToken: session.refreshToken,
        user: session.user
      };

      qrSessions.delete(qrToken);
      return res.json(responsePayload);
    }

    res.json({
      status: session.status,
      scannedByName: session.scannedByName || null
    });
  } catch (error) {
    console.error('Error checking QR status:', error);
    res.status(500).json({ message: 'Error checking QR status' });
  }
};

/**
 * POST /api/auth/qr/scan
 * Protected: Called by user's phone/device when its camera scans a QR code
 */
exports.scanQR = async (req, res) => {
  try {
    const { qrToken } = req.body;
    if (!qrToken) return res.status(400).json({ message: 'qrToken is required' });

    const session = qrSessions.get(qrToken);
    if (!session) {
      return res.status(404).json({ message: 'Invalid or expired QR code' });
    }

    if (Date.now() > session.expiresAt) {
      qrSessions.delete(qrToken);
      return res.status(400).json({ message: 'This QR code has expired' });
    }

    // Mark as scanned
    session.status = 'scanned';
    session.scannedByUserId = req.user._id.toString();
    session.scannedByName = req.user.name || req.user.username || req.user.email;

    res.json({
      success: true,
      status: 'scanned',
      device: {
        browser: session.browser,
        os: session.os,
        ip: session.ip,
        createdAt: session.createdAt
      }
    });
  } catch (error) {
    console.error('Error in scanQR:', error);
    res.status(500).json({ message: 'Failed to process QR code' });
  }
};

/**
 * POST /api/auth/qr/approve
 * Protected: User gives permission ('allow: true' or 'allow: false') on their phone to link the target device
 */
exports.approveQR = async (req, res) => {
  try {
    const { qrToken, allow } = req.body;
    if (!qrToken) return res.status(400).json({ message: 'qrToken is required' });

    const session = qrSessions.get(qrToken);
    if (!session) {
      return res.status(404).json({ message: 'QR session not found or already processed' });
    }

    if (Date.now() > session.expiresAt) {
      qrSessions.delete(qrToken);
      return res.status(400).json({ message: 'QR session has expired' });
    }

    if (!allow) {
      session.status = 'rejected';
      return res.json({ success: true, status: 'rejected', message: 'Device connection declined' });
    }

    // Confirmed! Generate tokens for the desktop device
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt
    });

    const newDeviceSession = await DeviceSession.findOneAndUpdate(
      { user: user._id, sessionId: session.sessionId },
      {
        user: user._id,
        sessionId: session.sessionId,
        browser: session.browser,
        os: session.os,
        ip: session.ip,
        lastActive: new Date(),
        isCurrentSession: false
      },
      { upsert: true, new: true }
    );

    session.token = accessToken;
    session.refreshToken = refreshToken;
    session.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      name: user.name,
      phoneNumber: user.phoneNumber,
      age: user.age,
      address: user.address
    };
    session.status = 'approved';

    const io = req.app.get('io');
    if (io) {
      io.to(user._id.toString()).emit('device:linked', {
        session: newDeviceSession,
        message: `New device linked: ${session.browser} on ${session.os}`
      });
    }

    res.json({
      success: true,
      status: 'approved',
      message: `Device (${session.browser} on ${session.os}) linked successfully!`,
      session: newDeviceSession
    });
  } catch (error) {
    console.error('Error in approveQR:', error);
    res.status(500).json({ message: 'Failed to approve device connection' });
  }
};

/**
 * POST /api/auth/qr/claim
 * Public: When an unauthenticated device scans a QR code generated by an authenticated device
 */
exports.claimQR = async (req, res) => {
  try {
    const { qrToken, sessionId } = req.body;
    if (!qrToken) return res.status(400).json({ message: 'qrToken is required' });

    const session = qrSessions.get(qrToken);
    if (!session || !session.userId) {
      return res.status(400).json({ message: 'Invalid or expired QR code for login' });
    }

    if (Date.now() > session.expiresAt) {
      qrSessions.delete(qrToken);
      return res.status(400).json({ message: 'QR Code has expired' });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt
    });

    const ua = req.headers['user-agent'] || '';
    const { browser, os } = parseUA(ua);
    const ip = getClientIP(req);

    const targetSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    await DeviceSession.findOneAndUpdate(
      { user: user._id, sessionId: targetSessionId },
      {
        user: user._id,
        sessionId: targetSessionId,
        browser,
        os,
        ip,
        lastActive: new Date(),
        isCurrentSession: true
      },
      { upsert: true, new: true }
    );

    // Consume QR session
    qrSessions.delete(qrToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token: accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        name: user.name,
        phoneNumber: user.phoneNumber,
        age: user.age,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Error in claimQR:', error);
    res.status(500).json({ message: 'Failed to complete QR login' });
  }
};
