const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const DeviceSession = require('../models/DeviceSession');
const QRSession = require('../models/QRSession');
const { parseDeviceInfo } = require('../utils/deviceParser');

const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
};

// Extract user from Authorization header if present (optional auth helper)
const extractAuthUser = async (req) => {
  if (req.user) return req.user;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded && decoded.id) {
        return await User.findById(decoded.id).select('-otp');
      }
    } catch {
      // ignore token verification error in optional auth
    }
  }
  return null;
};

/**
 * POST /api/auth/qr/generate
 * Public or Protected: Generates a fresh QR token for linking and stores it in MongoDB
 */
exports.generateQR = async (req, res) => {
  try {
    const { sessionId, mode, clientModel } = req.body || {};
    const ua = req.headers['user-agent'] || '';
    const { browser, os, deviceType, deviceName } = parseDeviceInfo(ua, clientModel);
    const ip = getClientIP(req);

    const currentUser = await extractAuthUser(req);
    const qrToken = 'tsqr_' + crypto.randomBytes(24).toString('hex');
    const finalSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const expiresAt = new Date(Date.now() + 120_000); // 120s TTL (2 minutes)

    const session = await QRSession.create({
      qrToken,
      sessionId: finalSessionId,
      status: 'pending',
      browser,
      os,
      deviceName,
      deviceType,
      ip,
      expiresAt,
      userId: currentUser ? currentUser._id : null,
      token: null,
      refreshToken: null,
      user: null
    });

    res.json({
      success: true,
      qrToken: session.qrToken,
      sessionId: finalSessionId,
      expiresAt: session.expiresAt.getTime(),
      device: { browser, os, ip, deviceName, deviceType }
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

    const session = await QRSession.findOne({ qrToken });
    if (!session) {
      return res.json({ status: 'invalid', message: 'QR Code is expired or invalid' });
    }

    if (new Date() > new Date(session.expiresAt)) {
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

      return res.json({
        status: 'approved',
        token: session.token,
        refreshToken: session.refreshToken,
        user: session.user
      });
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

    const session = await QRSession.findOne({ qrToken });
    if (!session) {
      return res.status(404).json({ message: 'Invalid or expired QR code' });
    }

    if (new Date() > new Date(session.expiresAt)) {
      session.status = 'expired';
      await session.save();
      return res.status(400).json({ message: 'This QR code has expired' });
    }

    // Mark as scanned
    session.status = 'scanned';
    session.scannedByUserId = req.user._id;
    session.scannedByName = req.user.name || req.user.username || req.user.email || 'User';
    await session.save();

    res.json({
      success: true,
      status: 'scanned',
      device: {
        browser: session.browser,
        os: session.os,
        deviceName: session.deviceName || `${session.browser} on ${session.os}`,
        deviceType: session.deviceType || 'desktop',
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

    const session = await QRSession.findOne({ qrToken });
    if (!session) {
      return res.status(404).json({ message: 'QR session not found or already processed' });
    }

    if (new Date() > new Date(session.expiresAt)) {
      session.status = 'expired';
      await session.save();
      return res.status(400).json({ message: 'QR session has expired' });
    }

    if (!allow) {
      session.status = 'rejected';
      await session.save();
      return res.json({ success: true, status: 'rejected', message: 'Device connection declined' });
    }

    // Confirmed! Generate tokens for the desktop device
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
        deviceName: session.deviceName || `${session.browser} on ${session.os}`,
        deviceType: session.deviceType || 'desktop',
        ip: session.ip,
        lastActive: new Date(),
        isCurrentSession: false
      },
      { upsert: true, new: true }
    );

    const userData = {
      id: user._id.toString(),
      _id: user._id.toString(),
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      name: user.name,
      phoneNumber: user.phoneNumber,
      age: user.age,
      address: user.address
    };

    session.token = accessToken;
    session.refreshToken = refreshToken;
    session.user = userData;
    session.status = 'approved';
    await session.save();

    const io = req.app.get('io');
    if (io) {
      io.to(user._id.toString()).emit('device:linked', {
        session: newDeviceSession,
        message: `New device linked: ${session.deviceName || session.browser}`
      });
    }

    res.json({
      success: true,
      status: 'approved',
      message: `Device (${session.deviceName || session.browser}) linked successfully!`,
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

    const session = await QRSession.findOne({ qrToken });
    if (!session || !session.userId) {
      return res.status(400).json({ message: 'Invalid or expired QR code for login' });
    }

    if (new Date() > new Date(session.expiresAt)) {
      session.status = 'expired';
      await session.save();
      return res.status(400).json({ message: 'QR Code has expired' });
    }

    const user = await User.findById(session.userId);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt
    });

    const ua = req.headers['user-agent'] || '';
    const { browser, os, deviceType, deviceName } = parseDeviceInfo(ua);
    const ip = getClientIP(req);

    const targetSessionId = sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    await DeviceSession.findOneAndUpdate(
      { user: user._id, sessionId: targetSessionId },
      {
        user: user._id,
        sessionId: targetSessionId,
        browser,
        os,
        deviceName,
        deviceType,
        ip,
        lastActive: new Date(),
        isCurrentSession: true
      },
      { upsert: true, new: true }
    );

    session.status = 'approved';
    await session.save();

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
        id: user._id.toString(),
        _id: user._id.toString(),
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
