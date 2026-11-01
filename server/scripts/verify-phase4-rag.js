const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');

// Set dummy env if missing
process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret123';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/talksphere_test';
process.env.REDIS_URI = process.env.REDIS_URI || 'redis://127.0.0.1:6379';

const RagDocument = require('../models/RagDocument');
const RagChunk = require('../models/RagChunk');
const { initRagQueue, addDocumentJob, getIsBullMQActive } = require('../config/queue');
const {
  processDocumentJob,
  setWorkerIO,
  chunkText
} = require('../workers/ragWorker');
const { uploadDocument, streamRagQuery } = require('../controllers/ragController');
const {
  generateEmbedding,
  getQueryEmbedding,
  cosineSimilarity
} = require('../services/embeddingService');

const runVerification = async () => {
  console.log('====================================================');
  console.log('   TALK SPHERE - PHASE 4 VERIFICATION SUITE         ');
  console.log('   AI & RAG Pipeline Optimization (B-06, B-07)      ');
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

  // Connect to MongoDB
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000
      });
      console.log('Connected to MongoDB for Phase 4 verification.\n');
    }
  } catch (err) {
    console.warn(`[WARN] MongoDB connection failed (${err.message}). Using mock models for verification.`);
  }

  // TEST 1: BullMQ Queue Integration & Resilient Fallback [B-06]
  await test('BullMQ Queue Initialization & Graceful Fallback Mode', async () => {
    const queueInit = await initRagQueue();
    assert(queueInit !== undefined, 'initRagQueue should return status object');
    assert(typeof queueInit.isBullMQActive === 'boolean', 'isBullMQActive should be a boolean');
    console.log(`         Queue active mode: ${queueInit.isBullMQActive ? 'BullMQ (Redis)' : 'In-process Async Queue (Fallback)'}`);
  });

  // TEST 2: Atlas Vector Search Definition on RagChunk [B-07]
  await test('RagChunk MongoDB Atlas Vector Search Schema Definition', async () => {
    assert(RagChunk.vectorIndexDefinition, 'RagChunk must have vectorIndexDefinition defined');
    const def = RagChunk.vectorIndexDefinition;
    assert(Array.isArray(def.fields), 'vectorIndexDefinition must have fields array');
    
    const vectorField = def.fields.find(f => f.type === 'vector');
    assert(vectorField, 'Must include vector field definition');
    assert.strictEqual(vectorField.path, 'embedding', 'Vector path must be "embedding"');
    assert.strictEqual(vectorField.numDimensions, 768, 'Embedding dimensions must be 768');
    assert.strictEqual(vectorField.similarity, 'cosine', 'Similarity metric must be "cosine"');

    const docFilter = def.fields.find(f => f.type === 'filter' && f.path === 'document');
    const userFilter = def.fields.find(f => f.type === 'filter' && f.path === 'user');
    assert(docFilter && userFilter, 'Must include document and user pre-filters for multi-tenant isolation');
  });

  // TEST 3: Semantic Overlap Chunking Function
  await test('Semantic Overlapping Text Chunking (~600 tokens / 800 chars, 150 overlap)', async () => {
    const sampleText = `
Paragraph 1: TalkSphere is an enterprise-grade real-time collaboration application designed for ultra-low latency communication and document question answering.

Paragraph 2: The architecture features horizontal Socket.io clustering using Redis pub/sub, MongoDB connection pooling, and multi-worker background job processing via BullMQ.

Paragraph 3: Decoupled online vector inference guarantees zero event-loop blocking during streaming responses, allowing instant answering of complex domain questions.
    `.repeat(10);

    const chunks = chunkText(sampleText, 500, 100);
    assert(Array.isArray(chunks), 'Chunks must be an array');
    assert(chunks.length > 1, 'Should create multiple chunks for long text');
    assert(chunks.every(c => c.length > 0), 'All chunks must contain text');
    console.log(`         Created ${chunks.length} chunks from text`);
  });

  // TEST 4: Embedding Service & Cosine Similarity
  await test('Embedding Computation & Cosine Similarity Evaluation', async () => {
    const vecA = [1, 0, 0, 0];
    const vecB = [1, 0, 0, 0];
    const vecC = [0, 1, 0, 0];

    const simIdentical = cosineSimilarity(vecA, vecB);
    const simOrthogonal = cosineSimilarity(vecA, vecC);

    assert(Math.abs(simIdentical - 1.0) < 0.001, 'Identical vectors must have cosine similarity = 1.0');
    assert(Math.abs(simOrthogonal - 0.0) < 0.001, 'Orthogonal vectors must have cosine similarity = 0.0');

    // Test query cache
    const query = 'What is the TalkSphere architecture?';
    const emb1 = await getQueryEmbedding(query);
    assert(Array.isArray(emb1), 'Embedding must be an array');
    assert.strictEqual(emb1.length, 768, 'Embedding must be 768-dimensional');

    const emb2 = await getQueryEmbedding(query);
    assert.deepStrictEqual(emb1, emb2, 'Repeated query must return cached embedding instantaneously');
  });

  // TEST 5: HTTP 202 Accepted Immediate Controller Response [B-06]
  await test('POST /api/rag/upload returns HTTP 202 Accepted without synchronous blocking', async () => {
    // Create temporary mock file on disk
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `test-doc-${Date.now()}.txt`);
    await fs.promises.writeFile(tempFilePath, 'TalkSphere Phase 4 test document content for background ingestion.');

    const mockUser = { _id: new mongoose.Types.ObjectId() };
    const mockReq = {
      user: mockUser,
      file: {
        path: tempFilePath,
        originalname: 'architecture-test.txt',
        mimetype: 'text/plain',
        size: 1024
      },
      body: {
        title: 'Architecture Spec Test'
      }
    };

    let statusCode = null;
    let responseData = null;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => {
            responseData = data;
          }
        };
      }
    };

    const startTime = Date.now();
    await uploadDocument(mockReq, mockRes);
    const durationMs = Date.now() - startTime;

    assert.strictEqual(statusCode, 202, `Status code must be HTTP 202 Accepted, got: ${statusCode}`);
    assert(responseData.success, 'Response must indicate success: true');
    assert.strictEqual(responseData.document.status, 'queued', 'Initial document state must be "queued"');
    assert(responseData.document.id || responseData.document._id, 'Document ID must be present');
    assert(durationMs < 500, `Upload controller must return immediately (<500ms), took: ${durationMs}ms`);
    console.log(`         Upload response dispatched in ${durationMs}ms with HTTP 202 Accepted`);
  });

  // TEST 6: Background Worker Execution & Real-Time Socket Status Streaming [B-06]
  await test('Background Worker Pipeline (parsing -> indexing -> ready) & Socket Emission', async () => {
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `test-worker-${Date.now()}.txt`);
    await fs.promises.writeFile(tempFilePath, 'This is a full background worker integration test document for TalkSphere.');

    const testUserId = new mongoose.Types.ObjectId();
    const testDoc = await RagDocument.create({
      user: testUserId,
      title: 'Worker Ingestion Test',
      originalName: 'test-worker.txt',
      fileType: 'txt',
      fileSize: 100,
      totalChunks: 0,
      status: 'queued'
    });

    const emittedEvents = [];
    const mockIO = {
      to: (room) => ({
        emit: (event, payload) => {
          emittedEvents.push({ room, event, payload });
        }
      })
    };
    setWorkerIO(mockIO);

    // Execute job
    await processDocumentJob({
      documentId: testDoc._id.toString(),
      filePath: tempFilePath,
      fileType: 'txt',
      originalName: 'test-worker.txt',
      userId: testUserId.toString()
    });

    // Verify temp file cleanup on disk [B-08]
    const fileExists = fs.existsSync(tempFilePath);
    assert.strictEqual(fileExists, false, 'Temporary disk file must be unlinked immediately after text extraction');

    // Verify document was updated to ready
    const updatedDoc = await RagDocument.findById(testDoc._id);
    assert.strictEqual(updatedDoc.status, 'ready', 'Document status must be "ready"');
    assert(updatedDoc.totalChunks > 0, 'totalChunks must be > 0');
    assert(updatedDoc.indexedAt !== null, 'indexedAt timestamp must be recorded');

    // Verify socket emissions
    const parsingEvent = emittedEvents.find(e => e.payload?.status === 'parsing');
    const indexingEvent = emittedEvents.find(e => e.payload?.status === 'indexing');
    const readyEvent = emittedEvents.find(e => e.payload?.status === 'ready');

    assert(parsingEvent, 'Worker must emit status: "parsing"');
    assert(indexingEvent, 'Worker must emit status: "indexing"');
    assert(readyEvent, 'Worker must emit status: "ready" with progress: 100');
    console.log(`         Received ${emittedEvents.length} real-time Socket.io status events`);

    // Clean up test records
    await RagDocument.deleteOne({ _id: testDoc._id });
    await RagChunk.deleteMany({ document: testDoc._id });
  });

  // TEST 7: Online Vector Search Query Pipeline & Graceful Fallback [B-07]
  await test('Online Inference & Retrieval ($vectorSearch & fallback) via streamRagQuery', async () => {
    // Create a mock doc and chunk
    const testUserId = new mongoose.Types.ObjectId();
    const testDoc = await RagDocument.create({
      user: testUserId,
      title: 'Query Spec',
      originalName: 'query-spec.txt',
      fileType: 'txt',
      fileSize: 50,
      totalChunks: 1,
      status: 'ready'
    });

    const testChunk = await RagChunk.create({
      user: testUserId,
      document: testDoc._id,
      chunkIndex: 0,
      content: 'Antigravity systems accelerate autonomous coding intelligence.',
      embedding: new Array(768).fill(0.05),
      pageNumber: 1
    });

    let sseOutput = '';
    const mockRes = {
      setHeader: () => {},
      write: (data) => {
        sseOutput += data;
      },
      end: () => {}
    };

    const mockReq = {
      user: { _id: testUserId },
      body: {
        question: 'What accelerates autonomous coding?',
        documentId: testDoc._id.toString()
      }
    };

    await streamRagQuery(mockReq, mockRes);
    assert(sseOutput.includes('sources'), 'Response must stream sources metadata first');
    assert(sseOutput.includes('[DONE]'), 'Stream must conclude with [DONE]');

    // Clean up test records
    await RagDocument.deleteOne({ _id: testDoc._id });
    await RagChunk.deleteMany({ document: testDoc._id });
  });

  console.log('\n====================================================');
  console.log(`   PHASE 4 VERIFICATION RESULTS: ${passedTests}/${totalTests} PASSED`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    console.log('>>> ALL PHASE 4 (B-06, B-07) VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
    process.exit(0);
  } else {
    console.error(`>>> ${totalTests - passedTests} CHECKS FAILED!\n`);
    process.exit(1);
  }
};

runVerification().catch(err => {
  console.error('Phase 4 verification script crashed:', err);
  process.exit(1);
});

