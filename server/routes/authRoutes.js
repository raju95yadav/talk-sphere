const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requestOTP, verifyOTP, refreshToken, logout } = require('../controllers/authController');

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
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

module.exports = router;
