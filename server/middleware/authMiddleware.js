const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Dedicated load-test secret constant (Strictly forbidden in production)
const LOAD_TEST_JWT_SECRET = 'talksphere-isolated-load-test-secret-do-not-use-in-prod';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // 1. Synthetic Load-Test Token Guardrail
      // Proactively detect if token was signed using the load-test secret
      try {
        const testDecoded = jwt.verify(token, LOAD_TEST_JWT_SECRET);
        if (testDecoded) {
          // Synthetic tokens are strictly rejected in production environments
          if (process.env.NODE_ENV === 'production') {
            return res.status(401).json({
              message: 'Not authorized: Synthetic load-test credentials strictly forbidden in production'
            });
          }
          // In non-production testing, allow if ALLOW_SYNTHETIC_TOKENS is explicitly enabled
          if (process.env.ALLOW_SYNTHETIC_TOKENS === 'true') {
            req.user = {
              _id: testDecoded.id,
              id: testDecoded.id,
              username: testDecoded.username || 'load_test_user',
              email: testDecoded.email || 'load_test@talksphere.internal',
              isSynthetic: true
            };
            return next();
          } else {
            return res.status(401).json({
              message: 'Not authorized: Synthetic load-test token rejected'
            });
          }
        }
      } catch (testErr) {
        // Not a load-test secret token; proceed to production verification
      }

      // 2. Strict Verification against Production JWT_SECRET
      if (!process.env.JWT_SECRET) {
        console.error('FATAL CONFIG: JWT_SECRET environment variable is missing.');
        return res.status(500).json({ message: 'Authentication service configuration error' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Reject any token flagged as synthetic in production
      if (decoded.isSyntheticLoadTest && process.env.NODE_ENV === 'production') {
        return res.status(401).json({
          message: 'Not authorized: Synthetic load-test credentials strictly forbidden in production'
        });
      }

      req.user = await User.findById(decoded.id).select('-otp');
      
      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }
      
      return next();
    } catch (error) {
      if (error.name !== 'TokenExpiredError') {
        console.error('Auth Error:', error.message);
      }
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect, LOAD_TEST_JWT_SECRET };
