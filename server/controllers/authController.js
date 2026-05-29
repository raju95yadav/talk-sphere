const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Generate cryptographically secure OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Configure Nodemailer with connection pooling and standard SMTP config variables
const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false', // default to true if secure port 465
   family: 4,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  maxConnections: 5,
  maxMessages: 100,
  rateLimit: 10, // max 10 emails per second
  connectionTimeout: 10000, // 10s
  socketTimeout: 10000 // 10s
});

// Resilient email sender with retry logic
const sendMailWithRetry = async (mailOptions, retries = 3, delayMs = 1000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      console.error(`Email send attempt ${attempt} failed: ${error.message}`);
      if (attempt === retries) throw error;
      // Wait with exponential-like backoff
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
};

exports.requestOTP = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ message: 'Email is required' });

    let user = await User.findOne({ email });
    const now = new Date();

    // Cooldown check: 60 seconds
    if (user && user.otp && user.otp.lastRequestedAt) {
      const timePassed = now - user.otp.lastRequestedAt;
      if (timePassed < 60 * 1000) {
        const secondsLeft = Math.ceil((60 * 1000 - timePassed) / 1000);
        return res.status(429).json({ 
          message: `Please wait ${secondsLeft} seconds before requesting a new OTP` 
        });
      }
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    
    // Hash the OTP code using bcrypt before saving to DB
    const hashedOtp = await bcrypt.hash(otp, 10);

    if (!user) {
      const defaultUsername = email.split('@')[0] + Math.floor(1000 + Math.random() * 9000);
      user = new User({ 
        email, 
        username: defaultUsername,
        name: email.split('@')[0]
      });
    }

    user.otp = { 
      code: hashedOtp, 
      expiresAt, 
      failedAttempts: 0, 
      lastRequestedAt: now 
    };
    await user.save();

    const isEmailConfigured = process.env.EMAIL_USER && 
                              process.env.EMAIL_PASS && 
                              !process.env.EMAIL_USER.includes('your_email');

    if (isEmailConfigured) {
      try {
        const mailOptions = {
          from: `"Talk Sphere" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Talk Sphere - Your Login OTP',
          text: `Your OTP is ${otp}. It will expire in 10 minutes.`
        };
        await sendMailWithRetry(mailOptions);
        console.log(`OTP sent successfully to ${email}`);
        return res.status(200).json({ message: 'OTP sent successfully to your email' });
      } catch (mailError) {
        console.error('--- NODEMAILER ERROR ---');
        console.error(`Message: ${mailError.message}`);
        console.error('------------------------');
        
        // Throw 500 error in production to notify users of delivery failure
        if (process.env.NODE_ENV === 'production') {
          return res.status(500).json({ message: 'Failed to deliver OTP email. Please try again later.' });
        } else {
          // Dev Mode fallback
          console.log(`FALLBACK (DEV ONLY): OTP for ${email}: ${otp}`);
          return res.status(200).json({ 
            message: 'Failed to send email. Fallback OTP printed in server console.',
            fallback: true
          });
        }
      }
    } else {
      console.log('--- DEVELOPMENT MODE ---');
      console.log(`OTP for ${email}: ${otp}`);
      console.log('------------------------');
      return res.status(200).json({ message: 'OTP generated (Check server console if email not configured)' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error sending OTP' });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ message: 'Email and OTP are required' });

    const user = await User.findOne({ email });
    if (!user || !user.otp || !user.otp.code) {
      return res.status(400).json({ message: 'No active OTP found for this email. Please request a new one.' });
    }

    // Expiration check
    if (new Date() > user.otp.expiresAt) {
      user.otp = undefined;
      await user.save();
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Verify OTP using bcrypt
    const isMatch = await bcrypt.compare(code, user.otp.code);
    if (!isMatch) {
      user.otp.failedAttempts += 1;
      
      if (user.otp.failedAttempts >= 5) {
        user.otp = undefined; // lock/expire OTP
        await user.save();
        return res.status(400).json({ message: 'Too many failed attempts. This OTP has been invalidated.' });
      }
      
      await user.save();
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    // Clear OTP and set verified status
    user.otp = undefined;
    user.isVerified = true;
    await user.save();

    // Sign Access Token (15 minutes) and Refresh Token (7 days)
    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Store Refresh Token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await RefreshToken.create({
      token: refreshToken,
      user: user._id,
      expiresAt
    });

    // Send HTTP-Only Cookie with Refresh Token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({
      token: accessToken,
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
    console.error(error);
    res.status(500).json({ message: 'Error verifying OTP' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return res.status(200).json({ token: null, user: null, message: 'Refresh token is required' });
    }

    // Check if refreshToken exists in DB
    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
      return res.status(200).json({ token: null, user: null, message: 'Invalid or expired session' });
    }

    // Verify token validity
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
      // If token verification fails (e.g. invalid signature/expired), clear from DB
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(200).json({ token: null, user: null, message: 'Token failed verification' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(200).json({ token: null, user: null, message: 'User not found' });
    }

    // Generate new Access Token
    const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '15m' });

    res.status(200).json({
      token: accessToken,
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
    console.error('Refresh Token Error:', error);
    res.status(500).json({ message: 'Error refreshing token' });
  }
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    let userId = null;
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (err) {
        // Refresh token might be expired or failed verification, check database to find the user
        const storedToken = await RefreshToken.findOne({ token: refreshToken });
        if (storedToken) {
          userId = storedToken.user;
        }
      }
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    // Clear HTTP-Only Cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    // Broadcast logout event to all active socket connections for this user (multi-tab/device sync)
    if (userId) {
      const io = req.app.get('io');
      if (io) {
        io.to(userId.toString()).emit('session_invalidated', { reason: 'logout' });
      }
    }

    res.status(200).json({ message: 'Session terminated successfully' });
  } catch (error) {
    console.error('Logout Error:', error);
    res.status(500).json({ message: 'Error logging out' });
  }
};
