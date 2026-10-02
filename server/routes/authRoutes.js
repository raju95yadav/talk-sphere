const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requestOTP, verifyOTP, refreshToken, logout, googleAuth } = require('../controllers/authController');
const { generateQR, checkQRStatus, scanQR, approveQR, claimQR } = require('../controllers/qrAuthController');
const { protect } = require('../middleware/authMiddleware');

// Rate limit for OTP requests (5 per 15 mins per IP)
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many OTP requests from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit for OTP verification attempts (10 per 15 mins per IP)
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many verification attempts from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/request-otp', otpRequestLimiter, requestOTP);
router.post('/verify-otp', otpVerifyLimiter, verifyOTP);
router.post('/google', googleAuth);
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

// QR Code Authentication & Device Linking Routes (WhatsApp-style)
router.post('/qr/generate', generateQR);
router.get('/qr/status/:qrToken', checkQRStatus);
router.post('/qr/scan', protect, scanQR);
router.post('/qr/approve', protect, approveQR);
router.post('/qr/claim', claimQR);

module.exports = router;
