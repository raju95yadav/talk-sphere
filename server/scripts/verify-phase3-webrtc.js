/**
 * Verification Script for Phase 3: Network and WebRTC Fallback Infrastructure Cleanup
 *
 * Tests:
 * 1. Backend ICE Provisioning & Ephemeral TURN Generation (turnService.js & webrtcController.js)
 * 2. Production Strict Enforcement (Zero silent degradation to STUN in production)
 * 3. Frontend CallContext Architecture & Dynamic Provisioning (CallContext.jsx)
 * 4. ICE State Monitoring, Graceful Failure & ICE Restart Recovery
 * 5. Secret Key & Bundle Leak Audit
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

console.log('\n============================================================');
console.log('--- PHASE 3: WEBRTC & ICE FALLBACK INFRASTRUCTURE CLEANUP ---');
console.log('============================================================\n');

const turnService = require('../services/turnService');
const callContextPath = path.resolve(__dirname, '../../client/src/context/CallContext.jsx');
const callContextContent = fs.readFileSync(callContextPath, 'utf8');

// ---------------------------------------------------------------------
// TEST GROUP 1: BACKEND DYNAMIC TURN GENERATION & TTL
// ---------------------------------------------------------------------
console.log('--- 1. Backend Dynamic TURN Generation & TTL (turnService.js) ---');

runTest('Generates ephemeral HMAC-SHA1 TURN credentials with short TTL (2h / 7200s)', () => {
  const userId = 'user_test_99';
  const creds = turnService.generateTurnCredentials(userId, 7200);

  assert(creds.username, 'Must include username');
  assert(creds.credential, 'Must include HMAC credential');
  assert.strictEqual(creds.ttl, 7200, 'TTL must be 7200s (2h)');
  assert(creds.username.endsWith(`:${userId}`), `Username must end with userId: ${creds.username}`);

  const timestampPart = parseInt(creds.username.split(':')[0], 10);
  const now = Math.floor(Date.now() / 1000);
  assert(timestampPart >= now + 7100 && timestampPart <= now + 7300, 'Timestamp must be ~2h in the future');
});

runTest('getIceServers produces valid RTCIceServer array with STUN, UDP TURN, and TURNS TLS', () => {
  const iceServers = turnService.getIceServers('user_test_99', 7200);
  assert(Array.isArray(iceServers), 'Must return an array of ice servers');

  // Check STUN
  const stunEntry = iceServers.find(s => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some(u => u.startsWith('stun:'));
  });
  assert(stunEntry, 'Must include STUN server');

  // Check TURN UDP / TCP
  const turnUdpEntry = iceServers.find(s => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some(u => u.startsWith('turn:') && u.includes('transport=udp'));
  });
  assert(turnUdpEntry, 'Must include TURN UDP relay fast path');
  assert(turnUdpEntry.username && turnUdpEntry.credential, 'TURN UDP must have ephemeral credentials');

  // Check TURNS TLS
  const turnsEntry = iceServers.find(s => {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return urls.some(u => u.startsWith('turns:'));
  });
  assert(turnsEntry, 'Must include secure TURNS TLS fallback (port 5349)');
  assert(turnsEntry.username && turnsEntry.credential, 'TURNS must have ephemeral credentials');
});

// ---------------------------------------------------------------------
// TEST GROUP 2: PRODUCTION STRICT BOUNDARIES & ZERO SILENT STUN DEGRADATION
// ---------------------------------------------------------------------
console.log('\n--- 2. Production Strict Boundaries & Error Propagation ---');

runTest('Production rejects execution and throws error if TURN_SECRET is missing', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.TURN_SECRET;
  const originalStatic = process.env.TURN_STATIC_SECRET;
  const originalCoturn = process.env.COTURN_STATIC_SECRET;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.TURN_SECRET;
    delete process.env.TURN_STATIC_SECRET;
    delete process.env.COTURN_STATIC_SECRET;

    let threw = false;
    try {
      turnService.getIceServers('test_prod');
    } catch (e) {
      threw = true;
      assert(e.message.includes('TURN_SECRET is not configured'), 'Error message must specify missing TURN_SECRET');
    }
    assert(threw, 'In production, getIceServers must throw when TURN_SECRET is absent');
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalSecret) process.env.TURN_SECRET = originalSecret;
    if (originalStatic) process.env.TURN_STATIC_SECRET = originalStatic;
    if (originalCoturn) process.env.COTURN_STATIC_SECRET = originalCoturn;
  }
});

// ---------------------------------------------------------------------
// TEST GROUP 3: FRONTEND CALLCONTEXT REFACTORING
// ---------------------------------------------------------------------
console.log('\n--- 3. Frontend CallContext Architecture (CallContext.jsx) ---');

runTest('Eliminated DEFAULT_ICE_SERVERS constant from production bundle path', () => {
  assert(!callContextContent.includes('const DEFAULT_ICE_SERVERS ='), 'DEFAULT_ICE_SERVERS must not be defined in CallContext');
  assert(!callContextContent.includes('dynamicIceServersRef.current || DEFAULT_ICE_SERVERS'), 'Must not fall back to DEFAULT_ICE_SERVERS');
});

runTest('hasTurnServer helper strictly validates presence of turn: / turns: and credentials', () => {
  // Extract hasTurnServer from CallContext.jsx
  const funcMatch = callContextContent.match(/export const hasTurnServer = ([\s\S]*?\n\};)/);
  assert(funcMatch, 'hasTurnServer must be exported in CallContext.jsx');

  let hasTurnServer;
  eval(`hasTurnServer = ${funcMatch[1]}`);

  // STUN-only configuration -> MUST FAIL
  const stunOnly = [{ urls: ['stun:stun.l.google.com:19302'] }];
  assert.strictEqual(hasTurnServer(stunOnly), false, 'STUN-only must evaluate to false');

  // Missing credentials -> MUST FAIL
  const turnNoCreds = [{ urls: ['turn:relay.example.com:3478'] }];
  assert.strictEqual(hasTurnServer(turnNoCreds), false, 'TURN without credentials must evaluate to false');

  // Valid TURN -> MUST PASS
  const validTurn = [
    { urls: ['stun:stun.l.google.com:19302'] },
    { urls: ['turn:relay.example.com:3478?transport=udp'], username: 'usr', credential: 'pwd' }
  ];
  assert.strictEqual(hasTurnServer(validTurn), true, 'Valid TURN config must evaluate to true');

  // Valid TURNS -> MUST PASS
  const validTurns = [
    { urls: ['turns:relay.example.com:5349?transport=tcp'], username: 'usr', credential: 'pwd' }
  ];
  assert.strictEqual(hasTurnServer(validTurns), true, 'Valid TURNS config must evaluate to true');
});

runTest('fetchIceServers enforces TURN presence in production and dispatches user toast on failure', () => {
  assert(callContextContent.includes('import.meta.env.PROD && !containsTurn'), 'Must verify containsTurn in PROD');
  assert(callContextContent.includes('Unable to establish a secure call relay. Please check network/service availability.'), 'Must use exact user-facing error message');
  assert(callContextContent.includes('dynamicIceServersRef.current = null'), 'Must nullify dynamic cache on prod failure');
});

runTest('startCall and answerCall fetch fresh dynamic ICE before peer connection creation', () => {
  assert(callContextContent.includes('fetchIceServers()'), 'Must fetch dynamic ICE servers');
  assert(callContextContent.includes('toast.error(prepErr.message'), 'Must toast on call prep failure');
  assert(callContextContent.includes('resetCallState()'), 'Must abort and reset state if ICE prep fails');
});

runTest('Development allows DEV_FALLBACK_STUN_SERVERS with explicit warning', () => {
  assert(callContextContent.includes('DEV_FALLBACK_STUN_SERVERS'), 'DEV_FALLBACK_STUN_SERVERS must exist for offline dev');
  assert(callContextContent.includes('[WebRTC Dev Warning] Using fallback STUN-only configuration'), 'Must log warning in dev');
});

// ---------------------------------------------------------------------
// TEST GROUP 4: CONNECTION STATE MONITORING & ICE RESTARTS
// ---------------------------------------------------------------------
console.log('\n--- 4. ICE State Monitoring & ICE Restart ---');

runTest('Monitors both iceConnectionState and connectionState on RTCPeerConnection', () => {
  assert(callContextContent.includes('pc.oniceconnectionstatechange ='), 'Must hook oniceconnectionstatechange');
  assert(callContextContent.includes('pc.onconnectionstatechange ='), 'Must hook onconnectionstatechange');
});

runTest('Implements automatic ICE restart with pc.restartIce() on disconnection', () => {
  assert(callContextContent.includes('pc.restartIce'), 'Must check and invoke pc.restartIce');
  assert(callContextContent.includes('{ iceRestart: true }'), 'Must create renegotiation offer with iceRestart flag');
  assert(callContextContent.includes('isIceRestart: true'), 'Must transmit isIceRestart flag over signaling');
});

runTest('Handles incoming ICE restart renegotiation without dropping active call', () => {
  assert(callContextContent.includes('data.isIceRestart && pcRef.current && callStatus === \'connected\''), 'Must intercept ICE restart in handleIncomingCall');
  assert(callContextContent.includes('socket.emit(\'answer_call\', {'), 'Must transmit answer for ICE restart');
});

runTest('Disconnect grace timer terminates connection cleanly on persistent failure', () => {
  assert(callContextContent.includes('disconnectGraceTimeoutRef.current'), 'Must manage disconnect grace timer');
  assert(callContextContent.includes('Call dropped due to network connection failure'), 'Must display informative call dropped message');
});

// ---------------------------------------------------------------------
// TEST GROUP 5: SECURITY AUDIT & ZERO SECRET LEAKS
// ---------------------------------------------------------------------
console.log('\n--- 5. Security & Zero Secret Leaks ---');

runTest('No TURN credentials or private keys hardcoded in client source or client .env', () => {
  const clientEnvPath = path.resolve(__dirname, '../../client/.env');
  const clientEnv = fs.existsSync(clientEnvPath) ? fs.readFileSync(clientEnvPath, 'utf8') : '';
  assert(!clientEnv.includes('TURN_'), 'No TURN variables in client/.env');
  assert(!callContextContent.includes('talksphere_turn_secret_2026_super_secure_key'), 'No static secrets in client code');
});

// ---------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------
console.log('\n============================================================');
console.log(`TOTAL TESTS: ${totalTests}`);
console.log(`PASSED:      ${passedTests}`);
console.log(`FAILED:      ${totalTests - passedTests}`);
console.log('============================================================\n');

if (passedTests === totalTests) {
  console.log('SUCCESS: Phase 3 WebRTC & ICE Fallback Infrastructure Cleanup Verified!\n');
  process.exit(0);
} else {
  console.error('FAILURE: Some tests did not pass.\n');
  process.exit(1);
}

