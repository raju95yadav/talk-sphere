/**
 * ==============================================================================
 * TalkSphere Phase 5 Verification Suite:
 * Docker & Environment Credentials Sanitization & Production Guardrails
 * ==============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const runVerification = async () => {
  console.log('======================================================================');
  console.log('   TALK SPHERE - PHASE 5 CREDENTIALS & PRODUCTION GUARDRAILS SUITE     ');
  console.log('======================================================================\n');

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

  // ==========================================================================
  // 1. Docker Compose Sanitization Verification
  // ==========================================================================
  await test('docker-compose.yml has zero hardcoded static secrets', async () => {
    const dcPath = path.join(__dirname, '../../docker-compose.yml');
    assert(fs.existsSync(dcPath), 'docker-compose.yml must exist');
    const content = fs.readFileSync(dcPath, 'utf8');

    const bannedStrings = [
      'talksphere_turn_secret_2026_super_secure_key',
      'talksphere_api_key',
      'talksphere_api_secret_key_2026',
      'talksphere:talksphere_secret',
      'devkey',
      ':-talksphere'
    ];

    for (const banned of bannedStrings) {
      assert(!content.includes(banned), `docker-compose.yml must not contain banned string: "${banned}"`);
    }

    assert(content.includes('TURN_SHARED_SECRET=${TURN_SHARED_SECRET}'), 'coturn service must inject TURN_SHARED_SECRET');
    assert(content.includes('LIVEKIT_KEYS=${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}'), 'livekit service must inject LIVEKIT_KEYS via environment variables');
    console.log('         docker-compose.yml verified: All container services use variable interpolation.');
  });

  await test('docker/docker-compose.media.yml has zero hardcoded static secrets', async () => {
    const mediaDcPath = path.join(__dirname, '../../docker/docker-compose.media.yml');
    assert(fs.existsSync(mediaDcPath), 'docker/docker-compose.media.yml must exist');
    const content = fs.readFileSync(mediaDcPath, 'utf8');

    const bannedStrings = [
      'talksphere_api_key: talksphere_api_secret_key_2026',
      'talksphere:talksphere_secret'
    ];

    for (const banned of bannedStrings) {
      assert(!content.includes(banned), `docker-compose.media.yml must not contain banned string: "${banned}"`);
    }

    assert(content.includes('LIVEKIT_KEYS=${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}'), 'LiveKit service must inject dynamic credentials');
    console.log('         docker-compose.media.yml verified with environment-driven credentials.');
  });

  // ==========================================================================
  // 2. Coturn and LiveKit Configuration Files
  // ==========================================================================
  await test('docker/turn/turnserver.conf uses dynamic shared-secret auth only', async () => {
    const turnPath = path.join(__dirname, '../../docker/turn/turnserver.conf');
    assert(fs.existsSync(turnPath), 'turnserver.conf must exist');
    const content = fs.readFileSync(turnPath, 'utf8');

    assert(!content.match(/^user=/m), 'turnserver.conf must not contain static user= credentials');
    assert(!content.includes('talksphere:talksphere_secret'), 'turnserver.conf must not contain hardcoded credentials');
    assert(content.includes('use-auth-secret'), 'turnserver.conf must contain use-auth-secret');
    assert(content.includes('static-auth-secret=${TURN_SHARED_SECRET}'), 'turnserver.conf must interpolate TURN_SHARED_SECRET');
    console.log('         turnserver.conf verified with dynamic shared-secret authentication.');
  });

  await test('docker/livekit/livekit.yaml contains no static key dictionary', async () => {
    const lkPath = path.join(__dirname, '../../docker/livekit/livekit.yaml');
    assert(fs.existsSync(lkPath), 'livekit.yaml must exist');
    const content = fs.readFileSync(lkPath, 'utf8');

    assert(!content.includes('talksphere_api_key'), 'livekit.yaml must not contain static api keys');
    assert(!content.includes('talksphere_api_secret_key_2026'), 'livekit.yaml must not contain static secret keys');
    assert(content.includes('keys: {}'), 'livekit.yaml must use empty keys map (populated via env)');
    console.log('         livekit.yaml verified: Empty static keys map.');
  });

  // ==========================================================================
  // 3. LiveKit Config Module Guardrails
  // ==========================================================================
  await test('server/config/livekit.js validates production vs development credentials', async () => {
    const { getLiveKitConfig } = require('../config/livekit');

    // 1. Production with missing keys throws
    const origEnv = { ...process.env };
    try {
      process.env.NODE_ENV = 'production';
      delete process.env.LIVEKIT_API_KEY;
      delete process.env.LIVEKIT_API_SECRET;

      let threw = false;
      try {
        getLiveKitConfig();
      } catch (e) {
        threw = true;
        assert(e.message.includes('LIVEKIT_API_KEY and LIVEKIT_API_SECRET are strictly required'));
      }
      assert(threw, 'getLiveKitConfig must throw in production when keys are missing');

      // 2. Production with banned dev keys throws
      process.env.LIVEKIT_API_KEY = 'devkey';
      process.env.LIVEKIT_API_SECRET = 'secret';
      let threwBanned = false;
      try {
        getLiveKitConfig();
      } catch (e) {
        threwBanned = true;
        assert(e.message.includes('Banned development key'));
      }
      assert(threwBanned, 'getLiveKitConfig must throw in production when keys match banned dev keys');

      // 3. Development mode falls back gracefully
      process.env.NODE_ENV = 'development';
      delete process.env.LIVEKIT_API_KEY;
      delete process.env.LIVEKIT_API_SECRET;
      const devConfig = getLiveKitConfig();
      assert(devConfig.apiKey, 'Must return fallback apiKey in development');
      assert(devConfig.apiSecret, 'Must return fallback apiSecret in development');
    } finally {
      process.env = origEnv;
    }
    console.log('         LiveKit config guardrails verified under production and dev modes.');
  });

  // ==========================================================================
  // 4. Redis Connection Configuration & External Host Security
  // ==========================================================================
  await test('server/utils/redis.js parses REDIS_URL, TLS, and enforces password on external production hosts', async () => {
    const { getRedisConnectionConfig, RedisConnectionError } = require('../utils/redis');
    const origEnv = { ...process.env };

    try {
      // 1. Internal local Redis without password in production is allowed
      process.env.NODE_ENV = 'production';
      process.env.REDIS_URL = 'redis://redis:6379';
      const localCfg = getRedisConnectionConfig();
      assert.strictEqual(localCfg.host, 'redis');
      assert.strictEqual(localCfg.port, 6379);

      // 2. External host in production without password must throw RedisConnectionError
      process.env.REDIS_URL = 'redis://redis-cluster.prod.talksphere.cloud:6379';
      let threwAuth = false;
      try {
        getRedisConnectionConfig();
      } catch (e) {
        threwAuth = true;
        assert(e instanceof RedisConnectionError || e.name === 'RedisConnectionError');
        assert(e.message.includes('requires password authentication'));
      }
      assert(threwAuth, 'Must throw RedisConnectionError when external production Redis lacks password');

      // 3. External host with password and TLS (rediss://)
      process.env.REDIS_URL = 'rediss://:prod_secure_password_997d8578@redis-cluster.prod.talksphere.cloud:6380';
      const secureCfg = getRedisConnectionConfig();
      assert.strictEqual(secureCfg.host, 'redis-cluster.prod.talksphere.cloud');
      assert.strictEqual(secureCfg.port, 6380);
      assert.strictEqual(secureCfg.password, 'prod_secure_password_997d8578');
      assert(secureCfg.options.tls !== undefined, 'rediss:// protocol must enable TLS options');

      console.log('         Redis config parser verified with TLS and production password enforcement.');
    } finally {
      process.env = origEnv;
    }
  });

  // ==========================================================================
  // 5. Fail-Fast Environment Validator Guardrail
  // ==========================================================================
  await test('server/config/envValidator.js rejects missing and banned production credentials', async () => {
    const { validateEnv } = require('../config/envValidator');

    // 1. Missing secrets in production
    const prodEnvMissing = {
      NODE_ENV: 'production'
    };
    const res1 = validateEnv(prodEnvMissing, false);
    assert.strictEqual(res1.isValid, false);
    assert(res1.errors.some(e => e.includes('JWT_SECRET')));
    assert(res1.errors.some(e => e.includes('MONGODB_URI')));
    assert(res1.errors.some(e => e.includes('LIVEKIT_API_KEY')));
    assert(res1.errors.some(e => e.includes('TURN_SHARED_SECRET')));

    // 2. Insecure dev defaults in production
    const prodEnvInsecure = {
      NODE_ENV: 'production',
      JWT_SECRET: 'devkey', // < 32 chars and banned
      MONGODB_URI: 'http://insecure-host', // invalid protocol
      REDIS_URL: 'redis://127.0.0.1:6379',
      LIVEKIT_API_KEY: 'talksphere_api_key', // banned
      LIVEKIT_API_SECRET: 'secret', // banned
      TURN_SHARED_SECRET: 'talksphere_turn_dev_secret_2026' // banned
    };
    const res2 = validateEnv(prodEnvInsecure, false);
    assert.strictEqual(res2.isValid, false);
    assert(res2.errors.some(e => e.includes('at least 32 characters')));
    assert(res2.errors.some(e => e.includes('mongodb://')));
    assert(res2.errors.some(e => e.includes('development key')));
    assert(res2.errors.some(e => e.includes('development default secret')));

    // 3. Fully valid production environment
    const prodEnvValid = {
      NODE_ENV: 'production',
      JWT_SECRET: 'cryptographic_secure_jwt_token_entropy_key_32_characters_long_talksphere',
      MONGODB_URI: 'mongodb+srv://admin:secure_password_997d8578@cluster0.talksphere.net/production?retryWrites=true&w=majority',
      REDIS_URL: 'redis://redis:6379',
      LIVEKIT_API_KEY: 'prod_lk_key_talksphere_live_sfu_2026',
      LIVEKIT_API_SECRET: 'prod_lk_secret_talksphere_multi_party_audio_video_relay_key',
      TURN_SHARED_SECRET: 'prod_coturn_hmac_sha1_ephemeral_token_shared_secret_997d8578'
    };
    const res3 = validateEnv(prodEnvValid, false);
    assert.strictEqual(res3.isValid, true);
    assert.strictEqual(res3.errors.length, 0);

    // 4. Development mode passes with warnings
    const devEnv = {
      NODE_ENV: 'development'
    };
    const res4 = validateEnv(devEnv, false);
    assert.strictEqual(res4.isValid, true);
    assert(res4.warnings.length > 0, 'Development mode captures missing variables as non-fatal warnings');

    console.log('         Fail-fast environment validator verified across 4 scenario matrices.');
  });

  // ==========================================================================
  // 6. Documentation and Git / Docker Hygiene
  // ==========================================================================
  await test('Templates (.env.example) exist and contain only sanitized placeholders', async () => {
    const rootEnvEx = path.join(__dirname, '../../.env.example');
    const serverEnvEx = path.join(__dirname, '../.env.example');

    assert(fs.existsSync(rootEnvEx), 'Root .env.example must exist');
    assert(fs.existsSync(serverEnvEx), 'Server .env.example must exist');

    const rootContent = fs.readFileSync(rootEnvEx, 'utf8');
    const serverContent = fs.readFileSync(serverEnvEx, 'utf8');

    for (const content of [rootContent, serverContent]) {
      assert(!content.includes('talksphere_turn_secret_2026_super_secure_key'), 'No static secrets in .env.example');
      assert(!content.includes('talksphere_api_secret_key_2026'), 'No static secrets in .env.example');
      assert(content.includes('JWT_SECRET='), 'Must define JWT_SECRET placeholder');
      assert(content.includes('TURN_SHARED_SECRET='), 'Must define TURN_SHARED_SECRET placeholder');
      assert(content.includes('LIVEKIT_API_KEY='), 'Must define LIVEKIT_API_KEY placeholder');
    }
    console.log('         Sanitized placeholder templates verified in root and server/.');
  });

  await test('.gitignore and .dockerignore exclude .env.* and TLS certificates/keys', async () => {
    const gitignorePath = path.join(__dirname, '../../.gitignore');
    const dockerignorePath = path.join(__dirname, '../../.dockerignore');
    const serverDockerignorePath = path.join(__dirname, '../.dockerignore');

    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const dockerignore = fs.readFileSync(dockerignorePath, 'utf8');
    const serverDockerignore = fs.readFileSync(serverDockerignorePath, 'utf8');

    assert(gitignore.includes('.env.*') && gitignore.includes('*.pem') && gitignore.includes('*.key'), '.gitignore must ignore .env.* and TLS certificates');
    assert(dockerignore.includes('.env.*') && dockerignore.includes('*.pem') && dockerignore.includes('*.key'), '.dockerignore must ignore .env.* and TLS certificates');
    assert(serverDockerignore.includes('.env.*') && serverDockerignore.includes('*.pem') && serverDockerignore.includes('*.key'), 'server/.dockerignore must ignore .env.* and TLS certificates');

    console.log('         Git and Docker ignore configurations strictly verified.');
  });

  console.log('\n======================================================================');
  console.log(`   PHASE 5 VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('======================================================================\n');

  if (passedTests === totalTests) {
    console.log('>>> ALL PHASE 5 DOCKER & CREDENTIALS SANITIZATION CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.error('>>> SOME VERIFICATION CHECKS FAILED!\n');
    process.exit(1);
  }
};

runVerification().catch(err => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
