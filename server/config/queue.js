const { Queue } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URI = process.env.REDIS_URI || 'redis://127.0.0.1:6379';

// Parse Redis URI to configuration options
const getRedisConnectionOptions = () => {
  try {
    const url = new URL(REDIS_URI);
    return {
      host: url.hostname || '127.0.0.1',
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      username: url.username || undefined,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      connectTimeout: 3000,
      retryStrategy: (times) => {
        // Capped backoff up to 5s
        return Math.min(times * 500, 5000);
      }
    };
  } catch (err) {
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 3000
    };
  }
};

let ragQueue = null;
let isBullMQActive = false;
let fallbackWorkerHandler = null;

// Default job options with exponential backoff & history pruning [B-06]
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  },
  removeOnComplete: {
    count: 100
  },
  removeOnFail: {
    count: 200
  }
};

/**
 * Initializes the BullMQ RAG document queue.
 * Detects Redis availability and gracefully falls back to in-process async queue if Redis is offline.
 */
const initRagQueue = async () => {
  const connectionOptions = getRedisConnectionOptions();

  try {
    // Quick test connection to see if Redis is reachable before binding BullMQ
    const testClient = new Redis(connectionOptions);
    
    testClient.on('error', (err) => {
      // Suppress noisy ECONNREFUSED logs during initial probe
    });

    await Promise.race([
      testClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis ping timeout')), 2500))
    ]);

    testClient.disconnect();

    // Redis is reachable -> initialize BullMQ queue
    ragQueue = new Queue('rag-document-queue', {
      connection: connectionOptions,
      defaultJobOptions
    });

    isBullMQActive = true;
    logger.info('BULLMQ_QUEUE', 'BullMQ "rag-document-queue" initialized and connected to Redis.');
    return { isBullMQActive: true, ragQueue };
  } catch (err) {
    isBullMQActive = false;
    ragQueue = null;
    logger.warn(
      'BULLMQ_FALLBACK',
      `Redis not reachable for BullMQ (${err.message}). Using resilient in-process async job queue fallback.`
    );
    return { isBullMQActive: false, ragQueue: null };
  }
};

/**
 * Register a fallback worker handler for in-process async processing when Redis is offline.
 *
 * @param {Function} handler - async (jobData) => Promise<void>
 */
const registerFallbackHandler = (handler) => {
  fallbackWorkerHandler = handler;
};

/**
 * Enqueues a document ingestion job.
 * If Redis / BullMQ is active, submits to 'rag-document-queue'.
 * If offline, dispatches to the fallback worker asynchronously via setImmediate.
 *
 * @param {object} jobData - { documentId, filePath, fileType, originalName, userId }
 * @returns {Promise<{ jobId: string, mode: 'bullmq' | 'fallback' }>}
 */
const addDocumentJob = async (jobData) => {
  if (isBullMQActive && ragQueue) {
    try {
      const job = await ragQueue.add('process-document', jobData);
      logger.info('QUEUE_JOB_ADDED', `Job ${job.id} enqueued to BullMQ for document ${jobData.documentId}`);
      return { jobId: job.id, mode: 'bullmq' };
    } catch (err) {
      logger.warn('QUEUE_ADD_FAIL', `Failed adding to BullMQ (${err.message}), falling back to in-process worker.`);
    }
  }

  // Resilient in-process async fallback (does not block HTTP thread)
  const syntheticJobId = `job-fallback-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  setImmediate(async () => {
    if (!fallbackWorkerHandler) {
      try {
        const { processDocumentJob } = require('../workers/ragWorker');
        fallbackWorkerHandler = processDocumentJob;
      } catch (e) {}
    }

    if (fallbackWorkerHandler) {
      try {
        await fallbackWorkerHandler(jobData);
      } catch (workerErr) {
        logger.error('FALLBACK_WORKER_ERROR', `Error in fallback worker: ${workerErr.message}`);
      }
    } else {
      logger.error('NO_FALLBACK_HANDLER', 'No fallback handler registered for RAG job processing');
    }
  });

  return { jobId: syntheticJobId, mode: 'fallback' };
};

module.exports = {
  initRagQueue,
  addDocumentJob,
  registerFallbackHandler,
  getRedisConnectionOptions,
  getIsBullMQActive: () => isBullMQActive,
  getRagQueue: () => ragQueue
};
