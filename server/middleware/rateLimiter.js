const rateLimit = require('express-rate-limit');

/**
 * Custom Key Generator:
 * Uses authenticated User ID if available, otherwise falls back to Client IP.
 * Prevents NAT IP collisions where multiple users share a router/office IP.
 */
const userOrIpKeyGenerator = (req) => {
  return req.user?._id?.toString() || req.ip || 'unknown';
};

/**
 * 1. AI Assistant Rate Limiter (Step 3.3 [B-14])
 * 15 requests per 1-minute window per user/IP.
 */
const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15, // 15 requests per window
  standardHeaders: 'draft-7', // RateLimit-* headers
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: 'AI query rate limit exceeded. Please wait a moment before sending more prompts.',
      retryAfter
    });
  }
});

/**
 * 2. RAG Document Ingestion Rate Limiter (Step 3.4 [B-14])
 * 5 document uploads per 15-minute window per user.
 */
const ragUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 uploads per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: 'Document upload limit exceeded. You can upload up to 5 documents every 15 minutes.',
      retryAfter
    });
  }
});

/**
 * 3. RAG Q&A Queries Rate Limiter (Step 3.4 [B-14])
 * 20 queries per 1-minute window per user.
 */
const ragQueryLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 queries per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: 'RAG query rate limit exceeded. Max 20 queries per minute.',
      retryAfter
    });
  }
});

/**
 * 4. Chat Media Uploads Rate Limiter (Step 3.5 [B-14])
 * 10 uploads per 1-minute window per user.
 */
const chatUploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 uploads per window
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  validate: { keyGeneratorIpFallback: false },
  handler: (req, res, next, options) => {
    const retryAfter = Math.ceil(options.windowMs / 1000);
    res.status(429).json({
      success: false,
      message: 'Chat media upload limit exceeded. Max 10 uploads per minute.',
      retryAfter
    });
  }
});

module.exports = {
  aiChatLimiter,
  ragUploadLimiter,
  ragQueryLimiter,
  chatUploadLimiter
};
