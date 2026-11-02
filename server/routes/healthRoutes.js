const express = require('express');
const os = require('os');
const mongoose = require('mongoose');
const { getRedisStatus } = require('../utils/redis');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Liveness Probe: GET /api/health or GET /health
 * 
 * Verifies that the Node.js process is alive, unblocked, and accepting HTTP requests.
 * Used by container orchestrators (Kubernetes / Docker Compose) and reverse proxies.
 */
router.get('/', (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'UP',
    service: 'talksphere-backend',
    instance: process.env.INSTANCE_ID || os.hostname(),
    pid: process.pid,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: {
      rssMB: Number((mem.rss / (1024 * 1024)).toFixed(2)),
      heapUsedMB: Number((mem.heapUsed / (1024 * 1024)).toFixed(2)),
      heapTotalMB: Number((mem.heapTotal / (1024 * 1024)).toFixed(2))
    }
  });
});

/**
 * Readiness Probe: GET /api/health/ready or GET /health/ready
 * 
 * Deep dependency ping check verifying:
 * 1. Process is not in active draining / shutdown state
 * 2. MongoDB connection pool is responsive (ping command)
 * 3. Redis connection is active and responsive
 * 
 * Returns HTTP 200 if ready for live traffic, HTTP 503 if unhealthy or draining.
 */
router.get('/ready', async (req, res) => {
  // 1. Check if the instance is currently undergoing graceful termination
  if (req.app.get('isShuttingDown')) {
    return res.status(503).json({
      status: 'DRAINING',
      message: 'Server is shutting down; draining active connections and background jobs.',
      timestamp: new Date().toISOString()
    });
  }

  const checks = {
    mongodb: 'UNKNOWN',
    redis: 'UNKNOWN'
  };
  let isHealthy = true;

  // 2. Deep MongoDB connectivity check
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await Promise.race([
        mongoose.connection.db.admin().ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mongo ping timeout (2000ms)')), 2000))
      ]);
      checks.mongodb = 'UP';
    } else {
      checks.mongodb = `DISCONNECTED (readyState: ${mongoose.connection.readyState})`;
      isHealthy = false;
    }
  } catch (err) {
    checks.mongodb = `DOWN (${err.message})`;
    isHealthy = false;
  }

  // 3. Redis status check
  try {
    const redisStatus = getRedisStatus ? getRedisStatus() : { isReady: false, status: 'unknown' };
    checks.redis = redisStatus.isReady ? 'UP' : `DEGRADED (${redisStatus.status})`;
    // In dev or single-node fallback mode, Redis degraded is non-fatal if MONGODB is UP
    if (!redisStatus.isReady && process.env.NODE_ENV === 'production' && process.env.REQUIRE_REDIS === 'true') {
      isHealthy = false;
    }
  } catch (err) {
    checks.redis = `DOWN (${err.message})`;
  }

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json({
    status: isHealthy ? 'READY' : 'DEGRADED',
    instance: process.env.INSTANCE_ID || os.hostname(),
    checks,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

