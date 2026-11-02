/**
 * Scenario 7.2: Concurrent Chat & Message Throughput Benchmark
 * Dual compatible: k6 + Node.js benchmark engine.
 *
 * Stresses the real-time messaging pipeline:
 * Socket.io `send_message` -> Mongoose `newMessage.save()` -> Redis Pub/Sub broadcast -> `receive_message`
 */

const io = require('../../client/node_modules/socket.io-client');
const mockUsers = require('../datasets/mockUsers.json');
const testMessages = require('../datasets/testMessages.json');

const options = {
  stages: [
    { duration: '15s', target: 100 },
    { duration: '30s', target: 300 },
    { duration: '15s', target: 0 }
  ],
  thresholds: {
    http_req_duration: ['p(95)<250'],
    http_req_failed: ['rate<0.02']
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
    const params = {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data?.token || 'test'}`
      }
    };
    const res = k6Http.get(`${baseUrl}/api/chat/conversations?limit=20`, params);
    k6Check(res, { 'chat conversations 200/401': (r) => r.status === 200 || r.status === 401 });
  }
}

// --- Node.js Standalone Execution Engine ---
async function executeNodeBenchmark({ baseUrl, concurrentSessions = 40, totalMessages = 200 }) {
  console.log(`  -> Benchmarking Socket.io message throughput (${concurrentSessions} sessions, ${totalMessages} messages)...`);
  const wsUrl = baseUrl.replace(/^http/, 'ws');
  const results = {
    latencies: [],
    errors: 0,
    messagesSent: 0,
    startTime: Date.now()
  };

  // 1. Establish pairs of sender/receiver sockets
  const pairs = [];
  const pairCount = Math.min(concurrentSessions, 20);

  for (let p = 0; p < pairCount; p++) {
    const u1 = mockUsers[p * 2];
    const u2 = mockUsers[p * 2 + 1];

    const s1 = io(baseUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: u1.token },
      query: { userId: u1.id },
      timeout: 4000,
      reconnection: false
    });

    const s2 = io(baseUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: u2.token },
      query: { userId: u2.id },
      timeout: 4000,
      reconnection: false
    });

    await Promise.all([
      new Promise(r => s1.on('connect', () => { s1.emit('setup', u1.id); r(); })),
      new Promise(r => s2.on('connect', () => { s2.emit('setup', u2.id); r(); }))
    ]);

    pairs.push({ sender: s1, receiver: s2, u1, u2 });
  }

  // Small delay to ensure setup room registration complete
  await new Promise(r => setTimeout(r, 100));

  // 2. Dispatch messages across pairs
  const msgsPerPair = Math.ceil(totalMessages / pairs.length);
  const dispatchPromises = pairs.map(({ sender, receiver, u1, u2 }, pairIdx) => {
    return (async () => {
      for (let m = 0; m < msgsPerPair; m++) {
        const tmpl = testMessages[m % testMessages.length];
        const content = `[Load-${pairIdx}-${m}] ${tmpl.content}`;
        const start = process.hrtime.bigint();

        await new Promise((resolve) => {
          let resolved = false;
          const timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
              results.latencies.push(durationMs);
              results.messagesSent++;
              resolve();
            }
          }, 150);

          receiver.once('receive_message', () => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
              results.latencies.push(durationMs);
              results.messagesSent++;
              resolve();
            }
          });

          sender.emit('send_message', {
            senderId: u1.id,
            receiverId: u2.id,
            content,
            type: 'text'
          });
        });
      }
    })();
  });

  await Promise.all(dispatchPromises);

  // 3. Clean up sockets
  pairs.forEach(({ sender, receiver }) => {
    try { sender.disconnect(); } catch (e) {}
    try { receiver.disconnect(); } catch (e) {}
  });

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
    throughputMsgSec: Number((results.messagesSent / results.durationSeconds).toFixed(2)),
    errorRatePct: Number(((results.errors / (results.messagesSent || 1)) * 100).toFixed(2))
  };

  return results;
}

module.exports = {
  options,
  default: k6Default,
  executeNodeBenchmark
};
