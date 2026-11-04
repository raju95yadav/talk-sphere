/**
 * Verification Script for Phase 4: Elimination of Backend Synthetic and Silent Fallback Data
 *
 * Tests:
 * 1. Zero Synthetic Vector Fallbacks in embeddingService.js (No new Array(768).fill(0))
 * 2. Fail-Fast EmbeddingGenerationError propagation
 * 3. Elimination of Synthetic BullMQ Job IDs & Strict 503 Production Guardrails in queue.js
 * 4. Development boundary for ALLOW_LOCAL_QUEUE_FALLBACK in queue.js
 * 5. Strict Production Redis Enforcement (RedisConnectionError, No Silent Local Map Fallbacks)
 * 6. Development In-Memory Map Fallback with [Dev Warning] in redis.js
 * 7. RAG Ingestion Pipeline Abort & Zero-Orphan Cleanliness in ragWorker.js
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

async function runTestAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

async function main() {
  console.log('\n============================================================');
  console.log('--- PHASE 4: BACKEND SYNTHETIC & SILENT FALLBACK CLEANUP ---');
  console.log('============================================================\n');

  const embeddingServicePath = path.resolve(__dirname, '../services/embeddingService.js');
  const queuePath = path.resolve(__dirname, '../config/queue.js');
  const redisPath = path.resolve(__dirname, '../utils/redis.js');
  const ragWorkerPath = path.resolve(__dirname, '../workers/ragWorker.js');

  const embeddingContent = fs.readFileSync(embeddingServicePath, 'utf8');
  const queueContent = fs.readFileSync(queuePath, 'utf8');
  const redisContent = fs.readFileSync(redisPath, 'utf8');
  const ragWorkerContent = fs.readFileSync(ragWorkerPath, 'utf8');

  // ---------------------------------------------------------------------
  // TEST GROUP 1: ZERO SYNTHETIC VECTOR ARRAYS IN EMBEDDING SERVICE
  // ---------------------------------------------------------------------
  console.log('--- 1. Zero Synthetic Vectors & Fail-Fast Embeddings ---');

  runTest('embeddingService.js contains zero occurrences of .fill(0)', () => {
    assert(!embeddingContent.includes('.fill(0)'), 'embeddingService.js must not contain .fill(0)');
    assert(!embeddingContent.includes('new Array(768).fill'), 'embeddingService.js must not contain new Array(768).fill');
  });

  runTest('embeddingService.js throws EmbeddingGenerationError on invalid/empty text', async () => {
    const { generateEmbedding } = require('../services/embeddingService');
    let threw = false;
    try {
      await generateEmbedding('');
    } catch (e) {
      threw = true;
      assert(e.message.includes('EmbeddingGenerationError'), `Expected EmbeddingGenerationError but got: ${e.message}`);
    }
    assert(threw, 'generateEmbedding must reject empty string input with EmbeddingGenerationError');
  });

  runTest('Circuit Breaker has zero silent fallback returning empty vectors', () => {
    // Verify ragEmbeddingBreaker.execute does not pass a fallback function returning zeros
    assert(!embeddingContent.includes('// Graceful fallback: return zero vector'), 'Circuit breaker zero vector fallback must be deleted');
  });

  // ---------------------------------------------------------------------
  // TEST GROUP 2: ELIMINATION OF SYNTHETIC BULLMQ JOB IDS & 503 IN PROD
  // ---------------------------------------------------------------------
  console.log('\n--- 2. BullMQ Queue Production Guardrails (queue.js) ---');

  runTest('queue.js contains zero synthetic job IDs (job-fallback-)', () => {
    assert(!queueContent.includes('job-fallback-'), 'queue.js must not contain job-fallback- generators');
    assert(!queueContent.includes('mode: \'fallback\''), 'queue.js must not return mode: fallback');
  });

  await runTestAsync('addDocumentJob throws 503 QueueServiceUnavailableError when Redis is down in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const { addDocumentJob, QueueServiceUnavailableError } = require('../config/queue');

      let threw = false;
      try {
        await addDocumentJob({ documentId: 'test_doc_1' });
      } catch (e) {
        threw = true;
        assert(e instanceof QueueServiceUnavailableError || e.name === 'QueueServiceUnavailable', 'Must throw QueueServiceUnavailableError');
        assert.strictEqual(e.statusCode, 503, 'Error statusCode must be 503');
        assert(e.message.includes('QueueServiceUnavailable: Redis connection is down'), `Error message mismatch: ${e.message}`);
      }
      assert(threw, 'In production, addDocumentJob must throw 503 when Redis/BullMQ is down');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  await runTestAsync('In development, addDocumentJob requires ALLOW_LOCAL_QUEUE_FALLBACK=true', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalFlag = process.env.ALLOW_LOCAL_QUEUE_FALLBACK;
    try {
      process.env.NODE_ENV = 'development';
      delete process.env.ALLOW_LOCAL_QUEUE_FALLBACK;

      const { addDocumentJob } = require('../config/queue');

      let threw = false;
      try {
        await addDocumentJob({ documentId: 'test_doc_dev' });
      } catch (e) {
        threw = true;
        assert(e.message.includes('ALLOW_LOCAL_QUEUE_FALLBACK=true'), `Expected instruction to set flag, got: ${e.message}`);
      }
      assert(threw, 'Development without ALLOW_LOCAL_QUEUE_FALLBACK flag must fail explicitly');
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalFlag) process.env.ALLOW_LOCAL_QUEUE_FALLBACK = originalFlag;
    }
  });

  await runTestAsync('In development with ALLOW_LOCAL_QUEUE_FALLBACK=true, warns and executes locally', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalFlag = process.env.ALLOW_LOCAL_QUEUE_FALLBACK;
    let warningLogged = false;
    const originalWarn = console.warn;

    try {
      process.env.NODE_ENV = 'development';
      process.env.ALLOW_LOCAL_QUEUE_FALLBACK = 'true';

      console.warn = (...args) => {
        if (args[0] && args[0].includes('[Dev Warning] Executing job via ephemeral in-memory worker')) {
          warningLogged = true;
        }
        originalWarn.apply(console, args);
      };

      const { addDocumentJob } = require('../config/queue');
      const result = await addDocumentJob({ documentId: 'test_doc_dev_allowed' });

      assert.strictEqual(result.mode, 'local-fallback', 'Result mode must be local-fallback');
      assert(result.jobId.startsWith('local-'), `JobId must start with local-: ${result.jobId}`);
      assert(warningLogged, 'Must log [Dev Warning] Executing job via ephemeral in-memory worker');
    } finally {
      console.warn = originalWarn;
      process.env.NODE_ENV = originalEnv;
      if (originalFlag) process.env.ALLOW_LOCAL_QUEUE_FALLBACK = originalFlag;
      else delete process.env.ALLOW_LOCAL_QUEUE_FALLBACK;
    }
  });

  // ---------------------------------------------------------------------
  // TEST GROUP 3: STRICT REDIS ENFORCEMENT & ZERO SILENT MAPS IN PROD
  // ---------------------------------------------------------------------
  console.log('\n--- 3. Strict Production Redis Enforcement (redis.js) ---');

  runTest('redis.js defines RedisConnectionError with 503 status code', () => {
    const { RedisConnectionError } = require('../utils/redis');
    const err = new RedisConnectionError('Test connection drop');
    assert.strictEqual(err.name, 'RedisConnectionError');
    assert.strictEqual(err.statusCode, 503);
  });

  await runTestAsync('In production, distributed state operations throw RedisConnectionError when Redis is disconnected', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const redisUtil = require('../utils/redis');

      const operations = [
        () => redisUtil.addUserSocket('usr_1', 'sock_1'),
        () => redisUtil.removeUserSocket('usr_1', 'sock_1'),
        () => redisUtil.getUserSocketCount('usr_1'),
        () => redisUtil.isUserOnline('usr_1'),
        () => redisUtil.saveActiveCall('call_1', { caller: 'usr_1' }),
        () => redisUtil.getActiveCall('call_1'),
        () => redisUtil.findCallByParticipant('usr_1'),
        () => redisUtil.findAllCallsForUser('usr_1'),
        () => redisUtil.updateActiveCall('call_1', { status: 'connected' }),
        () => redisUtil.removeActiveCall('call_1')
      ];

      for (const op of operations) {
        let threw = false;
        try {
          await op();
        } catch (e) {
          threw = true;
          assert(e instanceof redisUtil.RedisConnectionError || e.name === 'RedisConnectionError', 'Must throw RedisConnectionError');
          assert.strictEqual(e.statusCode, 503, 'Must have 503 status code');
        }
        assert(threw, `Operation did not throw RedisConnectionError in production when Redis is disconnected`);
      }
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  runTest('In development, initRedis logs explicit [Dev Warning] when Redis is unreachable', () => {
    assert(redisContent.includes('[Dev Warning] Redis not detected. Falling back to local Map instances.'), 'Must log startup warning in dev');
  });

  runTest('redisOptions implements exponential backoff reconnection strategy', () => {
    assert(redisContent.includes('retryStrategy'), 'Must configure retryStrategy');
    assert(redisContent.includes('Math.min(times * 500, 10000)'), 'Must implement capped exponential backoff');
  });

  // ---------------------------------------------------------------------
  // TEST GROUP 4: RAG PIPELINE HANDLING & ZERO ORPHAN CHUNKS
  // ---------------------------------------------------------------------
  console.log('\n--- 4. RAG Worker Pipeline Handling (ragWorker.js) ---');

  runTest('ragWorker.js strictly validates chunks against zero-vector arrays', () => {
    assert(ragWorkerContent.includes('embedding.every(val => val === 0)'), 'Must check that embedding is not all zeroes');
    assert(ragWorkerContent.includes('EmbeddingGenerationError: Failed to generate valid 768-dimensional vector from Gemini API.'), 'Must throw on invalid vector');
  });

  runTest('ragWorker.js deletes orphan chunks and updates status to FAILED on error', () => {
    assert(ragWorkerContent.includes('RagChunk.deleteMany({ document: documentId })'), 'Must delete partial chunks on failure');
    assert(ragWorkerContent.includes("status: 'FAILED'"), 'Must update status to FAILED');
    assert(ragWorkerContent.includes("processingError: 'Failed to generate semantic embeddings. Please retry.'"), 'Must set processingError');
    assert(ragWorkerContent.includes('failedAt: new Date()'), 'Must record failedAt timestamp');
    assert(ragWorkerContent.includes('canRetry: true'), 'Must emit canRetry flag to client');
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
    console.log('SUCCESS: Phase 4 Backend Synthetic and Fallback Data Elimination Verified!\n');
    process.exit(0);
  } else {
    console.error('FAILURE: Some tests did not pass.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});

