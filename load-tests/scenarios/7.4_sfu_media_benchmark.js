/**
 * Scenario 7.4: LiveKit SFU Media Signaling & Multi-Party Token Benchmark
 * Validates token issuance throughput, cryptographic signing latency,
 * and computes client upstream/downstream bandwidth scaling metrics ($O(N)$ vs $O(N^2)$).
 */

const http = require('http');
const mockUsers = require('../datasets/mockUsers.json');

async function executeNodeBenchmark({ baseUrl, totalTokenRequests = 200, concurrentRooms = 10 }) {
  console.log(`\n▶ [7.4 SFU Media Benchmark] Stress-testing SFU token issuance (${totalTokenRequests} requests, ${concurrentRooms} rooms)...`);

  const results = {
    latencies: [],
    errors: 0,
    startTime: Date.now()
  };

  const requestToken = (user, roomName) => {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      const url = new URL(`/api/webrtc/token?room=${encodeURIComponent(roomName)}&username=${encodeURIComponent(user.username)}`, baseUrl);
      
      const req = http.get(url, {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'User-Agent': 'TalkSphere-LoadTest/7.4'
        },
        timeout: 4000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          resolve({ statusCode: res.statusCode, durationMs });
        });
      });

      req.on('error', (err) => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        resolve({ error: err.message, durationMs, statusCode: 0 });
      });

      req.on('timeout', () => req.destroy(new Error('Timeout')));
    });
  };

  const promises = [];
  for (let i = 0; i < totalTokenRequests; i++) {
    const user = mockUsers[i % mockUsers.length];
    const room = `bench_room_${i % concurrentRooms}`;
    promises.push((async () => {
      const res = await requestToken(user, room);
      results.latencies.push(res.durationMs);
      if (res.statusCode >= 500 || res.statusCode === 0) results.errors++;
    })());
  }

  await Promise.all(promises);

  results.durationSeconds = (Date.now() - results.startTime) / 1000;
  results.latencies.sort((a, b) => a - b);
  const count = results.latencies.length;

  results.stats = {
    totalRequests: totalTokenRequests,
    p50: count > 0 ? results.latencies[Math.floor(count * 0.50)] : 0,
    p95: count > 0 ? results.latencies[Math.floor(count * 0.95)] : 0,
    p99: count > 0 ? results.latencies[Math.floor(count * 0.99)] : 0,
    throughputRps: Number((totalTokenRequests / results.durationSeconds).toFixed(2)),
    errorRatePct: Number(((results.errors / totalTokenRequests) * 100).toFixed(2)),
    // Theoretical comparison: 10 participants
    meshStreamsPerClient: 9, // O(N-1) upstream + downstream for full mesh
    sfuStreamsPerClient: 1    // O(1) upstream + O(N-1) forwarded downstream
  };

  return results;
}

module.exports = { executeNodeBenchmark };

