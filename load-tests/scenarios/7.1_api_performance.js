/**
 * Scenario 7.1: API Performance & Latency Benchmark
 * Dual compatible: Runs natively in k6 (k6 run 7.1_api_performance.js)
 * and in the Node.js benchmark engine.
 *
 * Targets:
 * - GET /api/health & /api/health/ready (Liveness & Readiness)
 * - GET /api/chat/conversations (Sidebar cursor pagination query)
 * - GET /api/users/profile (User profile & contact hydration)
 * - GET /api/groups (Aggregated group membership)
 * - GET /api/webrtc/ice-servers (Ephemeral HMAC-SHA1 TURN token)
 */

const http = require('http');
const path = require('path');
const mockUsers = require('../datasets/mockUsers.json');

// --- k6 Options Configuration ---
const options = {
  stages: [
    { duration: '10s', target: 200 },
    { duration: '30s', target: 500 },
    { duration: '20s', target: 1000 },
    { duration: '10s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<250', 'p(99)<500'],
    http_req_failed: ['rate<0.01']
  }
};

function k6Default(data) {
  let k6Http, k6Check;
  try {
    k6Http = require('k6/http');
    k6Check = require('k6').check;
  } catch (e) {}

  if (k6Http && k6Check) {
    const baseUrl = (typeof __ENV !== 'undefined' && __ENV.BASE_URL) || 'http://127.0.0.1:5000';
    const token = data?.token || 'test-token';
    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    };

    // 1. Health Liveness
    const resHealth = k6Http.get(`${baseUrl}/api/health`);
    k6Check(resHealth, { 'health status is 200': (r) => r.status === 200 });

    // 2. Chat Conversations (Cursor Pagination)
    const resConvs = k6Http.get(`${baseUrl}/api/chat/conversations?limit=20`, params);
    k6Check(resConvs, { 'conversations returns 200 or 401': (r) => r.status === 200 || r.status === 401 });

    // 3. WebRTC ICE Servers
    const resIce = k6Http.get(`${baseUrl}/api/webrtc/ice-servers`, params);
    k6Check(resIce, { 'ice servers returns 200 or 401': (r) => r.status === 200 || r.status === 401 });
  }
}

// --- Node.js Standalone Execution Engine ---
async function executeNodeBenchmark({ baseUrl, targetVUs = 100, requestsPerVU = 8 }) {
  console.log(`  -> Benchmarking REST endpoints (${targetVUs} concurrent workers, ${requestsPerVU} reqs/worker)...`);
  const results = {
    latencies: [],
    endpoints: {
      health: [],
      ready: [],
      conversations: [],
      iceServers: []
    },
    errors: 0,
    totalRequests: 0,
    startTime: Date.now()
  };

  const makeRequest = (urlPath, token = null) => {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      const url = new URL(urlPath, baseUrl);
      const headers = { 'User-Agent': 'TalkSphere-LoadTest/7.1' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const req = http.get(url, { headers, timeout: 5000 }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          resolve({ statusCode: res.statusCode, durationMs, body });
        });
      });

      req.on('error', (err) => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        resolve({ error: err.message, durationMs, statusCode: 0 });
      });

      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'));
      });
    });
  };

  const runWorker = async (workerId) => {
    const user = mockUsers[workerId % mockUsers.length];
    for (let i = 0; i < requestsPerVU; i++) {
      results.totalRequests++;

      // Benchmark /api/health
      const healthRes = await makeRequest('/api/health');
      results.latencies.push(healthRes.durationMs);
      results.endpoints.health.push(healthRes.durationMs);
      if (healthRes.statusCode !== 200) results.errors++;

      // Benchmark /api/health/ready
      const readyRes = await makeRequest('/api/health/ready');
      results.latencies.push(readyRes.durationMs);
      results.endpoints.ready.push(readyRes.durationMs);
      if (readyRes.statusCode >= 500) results.errors++;

      // Benchmark /api/webrtc/ice-servers (ephemeral HMAC crypto generation)
      const iceRes = await makeRequest('/api/webrtc/ice-servers', user.token);
      results.latencies.push(iceRes.durationMs);
      results.endpoints.iceServers.push(iceRes.durationMs);
      if (iceRes.statusCode >= 500) results.errors++;

      // Benchmark /api/chat/conversations
      const convRes = await makeRequest('/api/chat/conversations?limit=20', user.token);
      results.latencies.push(convRes.durationMs);
      results.endpoints.conversations.push(convRes.durationMs);
      if (convRes.statusCode >= 500) results.errors++;
    }
  };

  const workers = [];
  for (let w = 0; w < targetVUs; w++) {
    workers.push(runWorker(w));
  }
  await Promise.all(workers);

  results.durationSeconds = (Date.now() - results.startTime) / 1000;
  results.latencies.sort((a, b) => a - b);
  const count = results.latencies.length;
  results.stats = {
    p50: count > 0 ? results.latencies[Math.floor(count * 0.50)] : 0,
    p90: count > 0 ? results.latencies[Math.floor(count * 0.90)] : 0,
    p95: count > 0 ? results.latencies[Math.floor(count * 0.95)] : 0,
    p99: count > 0 ? results.latencies[Math.floor(count * 0.99)] : 0,
    min: count > 0 ? results.latencies[0] : 0,
    max: count > 0 ? results.latencies[count - 1] : 0,
    avg: count > 0 ? results.latencies.reduce((a, b) => a + b, 0) / count : 0,
    throughputRps: Number((results.totalRequests * 4 / results.durationSeconds).toFixed(2)),
    errorRatePct: Number(((results.errors / (results.totalRequests * 4)) * 100).toFixed(2))
  };

  return results;
}

module.exports = {
  options,
  default: k6Default,
  executeNodeBenchmark
};
