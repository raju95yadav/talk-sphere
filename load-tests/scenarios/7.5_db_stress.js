/**
 * Scenario 7.5: Database Stress & Cursor Pagination Benchmark
 * Validates MongoDB connection pool health, compound index performance,
 * and cursor-based pagination efficiency under heavy concurrent read/write load.
 */

const http = require('http');
const mockUsers = require('../datasets/mockUsers.json');

async function executeNodeBenchmark({ baseUrl, concurrentQueries = 100, iterationsPerWorker = 5 }) {
  console.log(`\n▶ [7.5 Database Stress] Benchmarking cursor pagination & connection pool (${concurrentQueries} workers x ${iterationsPerWorker} queries)...`);

  const results = {
    latencies: [],
    errors: 0,
    totalQueries: 0,
    startTime: Date.now()
  };

  const executeCursorQuery = (user, cursor = null) => {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      let queryPath = '/api/chat/conversations?limit=30';
      if (cursor) queryPath += `&cursor=${cursor}`;

      const url = new URL(queryPath, baseUrl);
      const req = http.get(url, {
        headers: {
          Authorization: `Bearer ${user.token}`,
          'User-Agent': 'TalkSphere-LoadTest/7.5'
        },
        timeout: 5000
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
          let nextCursor = null;
          try {
            const data = JSON.parse(body);
            nextCursor = data.nextCursor || null;
          } catch (e) {}
          resolve({ statusCode: res.statusCode, durationMs, nextCursor });
        });
      });

      req.on('error', (err) => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        resolve({ error: err.message, durationMs, statusCode: 0 });
      });

      req.on('timeout', () => req.destroy(new Error('Timeout')));
    });
  };

  const workers = [];
  for (let w = 0; w < concurrentQueries; w++) {
    const user = mockUsers[w % mockUsers.length];
    workers.push((async () => {
      let currentCursor = null;
      for (let i = 0; i < iterationsPerWorker; i++) {
        results.totalQueries++;
        const res = await executeCursorQuery(user, currentCursor);
        results.latencies.push(res.durationMs);
        if (res.statusCode >= 500 || res.statusCode === 0) {
          results.errors++;
        }
        currentCursor = res.nextCursor;
      }
    })());
  }

  await Promise.all(workers);

  results.durationSeconds = (Date.now() - results.startTime) / 1000;
  results.latencies.sort((a, b) => a - b);
  const count = results.latencies.length;

  results.stats = {
    totalQueries: results.totalQueries,
    p50: count > 0 ? results.latencies[Math.floor(count * 0.50)] : 0,
    p90: count > 0 ? results.latencies[Math.floor(count * 0.90)] : 0,
    p95: count > 0 ? results.latencies[Math.floor(count * 0.95)] : 0,
    p99: count > 0 ? results.latencies[Math.floor(count * 0.99)] : 0,
    throughputQps: Number((results.totalQueries / results.durationSeconds).toFixed(2)),
    errorRatePct: Number(((results.errors / results.totalQueries) * 100).toFixed(2))
  };

  return results;
}

module.exports = { executeNodeBenchmark };

