const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Observability & Correlation ID Middleware [Phase 6 - Step 6.4]
 * 
 * - Injects / propagates distributed correlation ID (`X-Request-Id`)
 * - Measures high-resolution request execution latency (`process.hrtime.bigint`)
 * - Attaches `X-Response-Time` header
 * - Produces structured single-line JSON access logs
 * - Flags slow queries/requests exceeding SLA threshold (>500ms)
 */
const observabilityMiddleware = (req, res, next) => {
  // 1. Correlation ID: Extract incoming or generate unique UUID
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.requestId = requestId;
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  // 2. High-precision start timestamp
  const startTime = process.hrtime.bigint();

  // 3. Intercept writeHead to inject X-Response-Time header before headers are flushed
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    const elapsedNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(elapsedNs) / 1e6;
    res.setHeader('X-Response-Time', `${durationMs.toFixed(2)}ms`);
    return originalWriteHead.apply(this, args);
  };

  // 4. Access Logging upon HTTP response completion
  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startTime;
    const durationMs = Number((Number(elapsedNs) / 1e6).toFixed(2));
    const statusCode = res.statusCode;

    // Skip verbose logs for frequent health checks unless failing
    if (req.originalUrl === '/api/health' || req.originalUrl === '/health') {
      if (statusCode < 400) return;
    }

    const logContext = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      durationMs,
      contentLength: res.get('content-length') || 0,
      clientIp: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.get('user-agent') || 'unknown'
    };

    if (statusCode >= 500) {
      logger.error('HTTP_REQUEST_ERROR', `${req.method} ${logContext.url} -> ${statusCode} (${durationMs}ms)`, logContext);
    } else if (statusCode >= 400) {
      logger.warn('HTTP_REQUEST_CLIENT_ERR', `${req.method} ${logContext.url} -> ${statusCode} (${durationMs}ms)`, logContext);
    } else if (durationMs > 500) {
      logger.warn('HTTP_SLOW_REQUEST', `[SLOW >500ms] ${req.method} ${logContext.url} -> ${statusCode} (${durationMs}ms)`, logContext);
    } else {
      logger.info('HTTP_REQUEST', `${req.method} ${logContext.url} -> ${statusCode} (${durationMs}ms)`, logContext);
    }
  });

  next();
};

module.exports = observabilityMiddleware;

