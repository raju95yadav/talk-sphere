const assert = require('assert');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Set test environment secrets
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret123';
process.env.TURN_STATIC_SECRET = process.env.TURN_STATIC_SECRET || 'talksphere_turn_secret_2026_super_secure_key';
process.env.TURN_HOST = process.env.TURN_HOST || '127.0.0.1';
process.env.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'talksphere_api_key';
process.env.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'talksphere_api_secret_key_2026';
process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';

const { generateTurnCredentials, getIceServers } = require('../services/turnService');
const { generateLiveKitToken } = require('../services/livekitService');
const { getIceServersController, getLiveKitTokenController } = require('../controllers/webrtcController');

const runVerification = async () => {
  console.log('====================================================');
  console.log('   TALK SPHERE - PHASE 5 VERIFICATION SUITE         ');
  console.log('   WebRTC & Media Optimization (B-09, B-10)         ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const test = async (name, fn) => {
    totalTests++;
    try {
      await fn();
      console.log(`  [PASS] Test ${totalTests}: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  [FAIL] Test ${totalTests}: ${name}`);
      console.error(`         Error: ${err.message}\n`, err.stack);
    }
  };

  // TEST 1: Coturn Server Configuration File [B-10]
  await test('Coturn Configuration File Verification (docker/turn/turnserver.conf)', async () => {
    const configPath = path.join(__dirname, '../../docker/turn/turnserver.conf');
    assert(fs.existsSync(configPath), `Coturn config file must exist at ${configPath}`);
    const content = await fs.promises.readFile(configPath, 'utf-8');

    assert(content.includes('listening-port=3478'), 'Must listen on port 3478');
    assert(content.includes('tls-listening-port=5349'), 'Must listen on TLS port 5349');
    assert(content.includes('use-auth-secret'), 'Must enforce REST API dynamic auth secret');
    assert(content.includes('static-auth-secret='), 'Must specify static auth secret');
    assert(content.includes('min-port=49152') && content.includes('max-port=65535'), 'Must allocate UDP relay port range');
    assert(content.includes('stale-nonce'), 'Must support stale-nonce replay protection');
    console.log('         Coturn server configuration verified with TLS, port ranges, and REST auth secret.');
  });

  // TEST 2: Dynamic Ephemeral HMAC-SHA1 TURN Credentials Generation [B-10]
  await test('Ephemeral HMAC-SHA1 TURN Credentials Cryptographic Validity', async () => {
    const testUserId = 'user_997d8578';
    const ttl = 3600; // 1 hour
    const nowSec = Math.floor(Date.now() / 1000);

    const creds = generateTurnCredentials(testUserId, ttl);
    assert(creds.username, 'Must generate username');
    assert(creds.credential, 'Must generate credential');

    // Verify username structure: timestamp:userId
    const parts = creds.username.split(':');
    assert.strictEqual(parts.length, 2, 'Username must be timestamp:userId');
    const expiry = Number(parts[0]);
    assert(expiry >= nowSec + ttl - 5 && expiry <= nowSec + ttl + 5, 'Timestamp must match TTL offset');
    assert.strictEqual(parts[1], testUserId, 'Username suffix must match userId');

    // Recompute HMAC to verify cryptographic integrity
    const expectedHmac = crypto.createHmac('sha1', process.env.TURN_STATIC_SECRET)
      .update(creds.username)
      .digest('base64');
    assert.strictEqual(creds.credential, expectedHmac, 'Generated credential must match HMAC-SHA1 signature');
    console.log(`         Valid HMAC-SHA1 generated: ${creds.username} -> ${creds.credential.slice(0, 12)}...`);
  });

  // TEST 3: Full ICE Servers Array Generation (STUN, TURN UDP, TURN TCP, TURNS TLS) [B-10]
  await test('Complete ICE Servers Topology (STUN + TURN UDP/TCP + TURNS TLS)', async () => {
    const iceServers = getIceServers('user_123');
    assert(Array.isArray(iceServers), 'getIceServers must return an array');
    assert(iceServers.length >= 3, 'Must include STUN and multiple TURN transport variants');

    // Check STUN
    const stunEntry = iceServers.find(s => Array.isArray(s.urls) ? s.urls.some(u => u.startsWith('stun:')) : s.urls?.startsWith('stun:'));
    assert(stunEntry, 'Must include STUN server entry');

    // Check TURN UDP & TCP
    const turnEntry = iceServers.find(s => Array.isArray(s.urls) && s.urls.some(u => u.startsWith('turn:')));
    assert(turnEntry, 'Must include TURN entry with UDP/TCP transports');
    assert(turnEntry.username && turnEntry.credential, 'TURN entry must contain dynamic credentials');

    // Check TURNS (TLS)
    const turnsEntry = iceServers.find(s => Array.isArray(s.urls) && s.urls.some(u => u.startsWith('turns:')));
    assert(turnsEntry, 'Must include TURNS (port 5349 TLS) entry for corporate firewalls');
    console.log(`         Topology generated with ${iceServers.length} server groups including TURNS.`);
  });

  // TEST 4: LiveKit SFU Configuration & Multi-Service Compose [B-09]
  await test('LiveKit SFU Configuration & Compose Specification', async () => {
    const lkConfigPath = path.join(__dirname, '../../docker/livekit/livekit.yaml');
    const composePath = path.join(__dirname, '../../docker/docker-compose.media.yml');

    assert(fs.existsSync(lkConfigPath), 'LiveKit config must exist');
    assert(fs.existsSync(composePath), 'Media docker-compose must exist');

    const lkContent = await fs.promises.readFile(lkConfigPath, 'utf-8');
    const composeContent = await fs.promises.readFile(composePath, 'utf-8');

    assert(lkContent.includes('port: 7880'), 'LiveKit signaling must bind to 7880');
    assert(lkContent.includes('port_range_start: 50000'), 'RTC port range must start at 50000');
    assert(composeContent.includes('coturn:') && composeContent.includes('livekit:'), 'Docker compose must orchestrate Coturn and LiveKit SFU');
    console.log('         LiveKit SFU config and multi-service docker compose verified.');
  });

  // TEST 5: LiveKit SFU Access Token Generation with Video Grants [B-09]
  await test('LiveKit SFU Access Token Generation with Room Grants', async () => {
    const tokenResult = await generateLiveKitToken({
      userId: 'user_456',
      userName: 'Alice Engineer',
      roomName: 'group_tech_talk'
    });

    assert(tokenResult.token, 'Must return JWT token');
    assert(tokenResult.serverUrl, 'Must return SFU server URL');
    assert.strictEqual(tokenResult.roomName, 'group_tech_talk', 'Room name must match request');
    assert.strictEqual(tokenResult.identity, 'user_456', 'Identity must match user ID');

    // Verify JWT structure (header.payload.signature)
    const jwtParts = tokenResult.token.split('.');
    assert.strictEqual(jwtParts.length, 3, 'LiveKit token must be a valid 3-segment JWT');
    const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString('utf-8'));
    assert.strictEqual(payload.sub, 'user_456', 'JWT subject must equal user ID');
    assert(payload.video?.room === 'group_tech_talk', 'JWT video grant must include target room');
    assert(payload.video?.roomJoin === true, 'JWT video grant must permit room join');
    console.log(`         Signed SFU JWT Token successfully issued with video grants.`);
  });

  // TEST 6: WebRTC Express API Endpoints (GET /ice-servers & POST /token)
  await test('Express WebRTC Controllers Execution', async () => {
    // 1. Test getIceServersController
    let iceResData = null;
    const mockIceReq = { user: { _id: 'test_user_789' } };
    const mockIceRes = {
      json: (data) => { iceResData = data; },
      status: () => mockIceRes
    };
    await getIceServersController(mockIceReq, mockIceRes);
    assert(iceResData?.success, 'GET /api/webrtc/ice-servers must return success: true');
    assert(Array.isArray(iceResData?.iceServers), 'Must return iceServers array');

    // 2. Test getLiveKitTokenController
    let tokenResData = null;
    const mockTokenReq = {
      user: { _id: 'test_user_789', name: 'Test User' },
      body: { roomName: 'group_project_room' }
    };
    const mockTokenRes = {
      json: (data) => { tokenResData = data; },
      status: () => mockTokenRes
    };
    await getLiveKitTokenController(mockTokenReq, mockTokenRes);
    assert(tokenResData?.success, 'POST /api/webrtc/token must return success: true');
    assert(tokenResData?.token, 'Must return token string');
    assert.strictEqual(tokenResData?.roomName, 'group_project_room');
    console.log('         WebRTC controllers verified with HTTP 200 responses.');
  });

  console.log('\n====================================================');
  console.log(`   PHASE 5 VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    console.log('>>> ALL PHASE 5 (B-09, B-10) VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error(`>>> ${totalTests - passedTests} CHECKS FAILED!\n`);
    process.exit(1);
  }
};

runVerification().catch(err => {
  console.error('Phase 5 verification script crashed:', err);
  process.exit(1);
});

