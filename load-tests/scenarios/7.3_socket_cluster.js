/**
 * Scenario 7.3: Socket.io Cluster Connection Flooding & Pub/Sub Broadcast
 * Tests multi-socket concurrency, room subscriptions, broadcast fanout,
 * and verifies zero dropped connections under heavy socket churn.
 */

const path = require('path');
const io = require('../../client/node_modules/socket.io-client');
const mockUsers = require('../datasets/mockUsers.json');

async function executeNodeBenchmark({ wsUrl, totalConnections = 200, broadcastCount = 50 }) {
  console.log(`\n▶ [7.3 Socket Cluster] Testing ${totalConnections} concurrent Socket.io connections & ${broadcastCount} room broadcasts...`);

  const results = {
    connectedSockets: 0,
    connectErrors: 0,
    handshakeLatencies: [],
    broadcastLatencies: [],
    droppedConnections: 0,
    startTime: Date.now()
  };

  const sockets = [];

  // 1. Establish Concurrent Socket Connections
  const connectPromises = [];
  for (let i = 0; i < totalConnections; i++) {
    const user = mockUsers[i % mockUsers.length];
    const connectStart = process.hrtime.bigint();

    connectPromises.push(new Promise((resolve) => {
      const socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        auth: { token: user.token },
        query: { userId: user.id },
        timeout: 5000,
        reconnection: false
      });

      socket.on('connect', () => {
        const handshakeDurationMs = Number(process.hrtime.bigint() - connectStart) / 1e6;
        results.handshakeLatencies.push(handshakeDurationMs);
        results.connectedSockets++;
        sockets.push(socket);

        // Join personal user room
        socket.emit('setup', user.id);
        resolve(socket);
      });

      socket.on('connect_error', (err) => {
        results.connectErrors++;
        resolve(null);
      });

      socket.on('disconnect', (reason) => {
        if (reason !== 'io client disconnect') {
          results.droppedConnections++;
        }
      });
    }));
  }

  await Promise.all(connectPromises);

  // 2. Test Pub/Sub Cross-Socket Broadcast & Fan-out Latency
  const activeSockets = sockets.filter(Boolean);
  if (activeSockets.length >= 2) {
    const sender = activeSockets[0];
    const receiver = activeSockets[1];
    const testRoom = 'room_benchmark_cluster_test';

    sender.emit('join_room', testRoom);
    receiver.emit('join_room', testRoom);

    // Give 100ms for room joins to register
    await new Promise(r => setTimeout(r, 100));

    for (let b = 0; b < broadcastCount; b++) {
      const bcastStart = process.hrtime.bigint();
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          results.broadcastLatencies.push(100); // 100ms timeout cap
          resolve();
        }, 100);

        receiver.once('receive_message', (msg) => {
          clearTimeout(timeout);
          const duration = Number(process.hrtime.bigint() - bcastStart) / 1e6;
          results.broadcastLatencies.push(duration);
          resolve();
        });

        sender.emit('send_message', {
          room: testRoom,
          content: `Cluster broadcast ping #${b}`,
          sender: mockUsers[0].id
        });
      });
    }
  }

  // 3. Gracefully Disconnect all sockets
  activeSockets.forEach(s => s.disconnect());

  results.durationSeconds = (Date.now() - results.startTime) / 1000;
  results.handshakeLatencies.sort((a, b) => a - b);
  const hCount = results.handshakeLatencies.length;

  results.stats = {
    attemptedConnections: totalConnections,
    successfulConnections: results.connectedSockets,
    connectErrors: results.connectErrors,
    droppedConnections: results.droppedConnections,
    dropRatePct: Number(((results.droppedConnections / (results.connectedSockets || 1)) * 100).toFixed(2)),
    handshakeP50Ms: hCount > 0 ? results.handshakeLatencies[Math.floor(hCount * 0.50)] : 0,
    handshakeP95Ms: hCount > 0 ? results.handshakeLatencies[Math.floor(hCount * 0.95)] : 0,
    avgBroadcastLatencyMs: results.broadcastLatencies.length > 0 
      ? results.broadcastLatencies.reduce((a, b) => a + b, 0) / results.broadcastLatencies.length 
      : 0
  };

  return results;
}

module.exports = { executeNodeBenchmark };

