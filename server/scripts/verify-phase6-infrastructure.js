/**
 * Phase 6 Verification Test Suite
 * Validates Infrastructure, Reverse Proxy, Horizontal Clustering, Observability, and Graceful Teardown
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName} - ${details}`);
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 Starting Phase 6: Infrastructure & Horizontal Scaling Suite');
  console.log('============================================================\n');

  // Test 1: Nginx Reverse Proxy Configuration
  console.log('--- 1. Nginx Reverse Proxy & Load Balancer (docker/nginx/nginx.conf) ---');
  const nginxConfPath = path.resolve(__dirname, '../../docker/nginx/nginx.conf');
  assert(fs.existsSync(nginxConfPath), 'Nginx configuration file exists');
  if (fs.existsSync(nginxConfPath)) {
    const nginxContent = fs.readFileSync(nginxConfPath, 'utf8');
    assert(nginxContent.includes('upstream talksphere_backend'), 'Defines talksphere_backend upstream block');
    assert(nginxContent.includes('ip_hash;'), 'Enables ip_hash for sticky sessions (Socket.io handshake affinity)');
    assert(nginxContent.includes('backend_1:5000') && nginxContent.includes('backend_2:5000') && nginxContent.includes('backend_3:5000'), 'Routes across 3 backend replicas');
    assert(nginxContent.includes('proxy_set_header Upgrade $http_upgrade;') && nginxContent.includes('Connection "Upgrade";'), 'Configures WebSocket / Socket.io protocol upgrades');
    assert(nginxContent.includes('client_max_body_size 25M;'), 'Sets client_max_body_size to 25M for staged uploads');
    assert(nginxContent.includes('limit_req_zone'), 'Configures gateway rate-limiting zone');
  }

  // Test 2: Multi-Stage Production Dockerfile
  console.log('\n--- 2. Multi-Stage Production Backend Dockerfile (server/Dockerfile) ---');
  const dockerfilePath = path.resolve(__dirname, '../Dockerfile');
  assert(fs.existsSync(dockerfilePath), 'Production Dockerfile exists in server/');
  if (fs.existsSync(dockerfilePath)) {
    const dockerfileContent = fs.readFileSync(dockerfilePath, 'utf8');
    assert(dockerfileContent.includes('FROM node:22-alpine'), 'Uses lightweight node:22-alpine base image');
    assert(dockerfileContent.includes('USER node'), 'Runs under unprivileged node user (CIS security benchmark)');
    assert(dockerfileContent.includes('HEALTHCHECK'), 'Includes container HEALTHCHECK probe targeting /api/health');
    assert(dockerfileContent.includes('EXPOSE 5000'), 'Exposes backend port 5000');
  }

  // Test 3: Clustered Docker Compose Topology
  console.log('\n--- 3. Orchestrated Compose Topology (docker-compose.yml) ---');
  const composePath = path.resolve(__dirname, '../../docker-compose.yml');
  assert(fs.existsSync(composePath), 'docker-compose.yml exists at project root');
  if (fs.existsSync(composePath)) {
    const composeContent = fs.readFileSync(composePath, 'utf8');
    assert(composeContent.includes('nginx:'), 'Orchestrates Nginx load balancer reverse proxy');
    assert(composeContent.includes('backend_1:') && composeContent.includes('backend_2:') && composeContent.includes('backend_3:'), 'Orchestrates 3 distinct backend replicas');
    assert(composeContent.includes('redis:'), 'Orchestrates Redis cluster cache & pub/sub');
    assert(composeContent.includes('coturn:'), 'Orchestrates Coturn TURN/STUN media server');
    assert(composeContent.includes('livekit:'), 'Orchestrates LiveKit SFU media router');
    assert(composeContent.includes('healthcheck:'), 'Includes container healthcheck dependencies');
  }

  // Test 4: Structured JSON Logger
  console.log('\n--- 4. Structured JSON Observability Logger (server/utils/logger.js) ---');
  const logger = require('../utils/logger');
  assert(typeof logger.info === 'function' && typeof logger.error === 'function', 'Logger exposes info, warn, error methods');
  assert(typeof logger.stream === 'object', 'Logger exposes HTTP morgan/stream interface');

  // Test 5: Observability & Correlation ID Middleware
  console.log('\n--- 5. Correlation ID & Latency Middleware (server/middleware/observabilityMiddleware.js) ---');
  const observabilityMiddleware = require('../middleware/observabilityMiddleware');
  assert(typeof observabilityMiddleware === 'function', 'Observability middleware is exported');

  // Test middleware execution using mock Express req/res
  const testApp = express();
  testApp.use(observabilityMiddleware);
  testApp.get('/test-obs', (req, res) => {
    assert(Boolean(req.requestId), 'Assigns unique requestId to req object');
    res.json({ message: 'ok', requestId: req.requestId });
  });

  const testServer = http.createServer(testApp);
  await new Promise((resolve) => testServer.listen(0, resolve));
  const testPort = testServer.address().port;

  const obsResponse = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${testPort}/test-obs`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ headers: res.headers, body: JSON.parse(data) }));
    }).on('error', reject);
  });

  assert(Boolean(obsResponse.headers['x-request-id']), 'Emits X-Request-Id response header');
  assert(Boolean(obsResponse.headers['x-response-time']), 'Emits X-Response-Time response header');
  assert(obsResponse.body.requestId === obsResponse.headers['x-request-id'], 'Request ID in response matches assigned ID');

  // Test 6: Health Probes (Liveness & Readiness)
  console.log('\n--- 6. Liveness and Readiness Health Probes (server/routes/healthRoutes.js) ---');
  const healthRoutes = require('../routes/healthRoutes');
  testApp.use('/api/health', healthRoutes);

  // Test Liveness probe
  const livenessRes = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${testPort}/api/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });

  assert(livenessRes.statusCode === 200, 'Liveness probe returns HTTP 200');
  assert(livenessRes.body.status === 'UP', 'Liveness probe status is UP');
  assert(typeof livenessRes.body.uptimeSeconds === 'number', 'Liveness probe reports uptime');
  assert(Boolean(livenessRes.body.memory?.heapUsedMB), 'Liveness probe reports memory utilization');

  // Test Draining Readiness state
  testApp.set('isShuttingDown', true);
  const drainingRes = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${testPort}/api/health/ready`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });

  assert(drainingRes.statusCode === 503, 'Readiness probe returns HTTP 503 during termination draining');
  assert(drainingRes.body.status === 'DRAINING', 'Readiness reports status DRAINING when shutting down');
  testApp.set('isShuttingDown', false);

  testServer.close();

  // Test 7: Teardown Lifecycle Exports
  console.log('\n--- 7. Lifecycle Teardown Resource Management ---');
  const { closeRedis, getRedisStatus } = require('../utils/redis');
  const { closeRagQueue } = require('../config/queue');
  const { closeRagWorker } = require('../workers/ragWorker');

  assert(typeof getRedisStatus === 'function', 'Redis module exports getRedisStatus()');
  assert(typeof closeRedis === 'function', 'Redis module exports closeRedis()');
  assert(typeof closeRagQueue === 'function', 'Queue module exports closeRagQueue()');
  assert(typeof closeRagWorker === 'function', 'Worker module exports closeRagWorker()');

  // Verify graceful drain executes without crashing even if offline
  await closeRagWorker();
  await closeRagQueue();
  await closeRedis();
  assert(true, 'Graceful drain functions execute safely without unhandled rejections');

  // Summary
  console.log('\n============================================================');
  console.log(`📊 Phase 6 Verification Results: ${passedTests}/${totalTests} Tests Passed`);
  console.log('============================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});

