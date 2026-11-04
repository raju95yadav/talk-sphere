const { Queue } = require('bullmq');
const Redis = require('ioredis');
const logger = require('../utils/logger');

const REDIS_URI = process.env.REDIS_URI || 'redis://127.0.0.1:6379';

// Custom Queue Error class with 503 HTTP status
class QueueServiceUnavailableError extends Error {
  constructor(message = 'QueueServiceUnavailable: Redis connection is down. Unable to queue background job.') {
    super(message);
    this.name = 'QueueServiceUnavailable';
    this.statusCode = 503;
  }
}

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
 * Strictly checks Redis availability without silent fallback mocks in production.
 */
const initRagQueue = async () => {
  const connectionOptions = getRedisConnectionOptions();

  try {
    // Quick test connection to see if Redis is reachable before binding BullMQ
    const testClient = new Redis(connectionOptions);
    
    testClient.on('error', () => {
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

    if (process.env.NODE_ENV === 'production') {
      logger.error(
        'BULLMQ_INIT_ERROR',
        `FATAL: Redis not reachable for BullMQ in production (${err.message}). In-process fallbacks forbidden.`
      );
    } else {
      logger.warn(
        'BULLMQ_DEV_NOTICE',
        `Redis not reachable for BullMQ (${err.message}). Local fallback requires ALLOW_LOCAL_QUEUE_FALLBACK=true.`
      );
    }

    return { isBullMQActive: false, ragQueue: null };
  }
};

/**
 * Register a fallback worker handler for in-process async processing when explicitly allowed in dev.
 *
 * @param {Function} handler - async (jobData) => Promise<void>
 */
const registerFallbackHandler = (handler) => {
  fallbackWorkerHandler = handler;
};

/**
 * Enqueues a document ingestion job.
 * Production: Strictly requires an active BullMQ/Redis connection. Throws 503 on failure.
 * Development: Only allows in-memory worker if ALLOW_LOCAL_QUEUE_FALLBACK=true with visible warning.
 *
 * @param {object} jobData - { documentId, filePath, fileType, originalName, userId }
 * @returns {Promise<{ jobId: string, mode: 'bullmq' | 'local-fallback' }>}
 */
const addDocumentJob = async (jobData) => {
  if (isBullMQActive && ragQueue) {
    try {
      const job = await ragQueue.add('process-document', jobData);
      logger.info('QUEUE_JOB_ADDED', `Job ${job.id} enqueued to BullMQ for document ${jobData.documentId}`);
      return { jobId: String(job.id), mode: 'bullmq' };
    } catch (err) {
      logger.error('QUEUE_ADD_FAIL', `Failed adding job to BullMQ: ${err.message}`);
      if (process.env.NODE_ENV === 'production') {
        throw new QueueServiceUnavailableError(`QueueServiceUnavailable: Redis connection is down. Unable to queue background job. (${err.message})`);
      }
    }
  }

  // Production Guardrail: Never generate synthetic job IDs or fake successful queueing
  if (process.env.NODE_ENV === 'production') {
    logger.error('QUEUE_UNAVAILABLE_PROD', 'Rejected job dispatch: Redis/BullMQ is down in production environment.');
    throw new QueueServiceUnavailableError('QueueServiceUnavailable: Redis connection is down. Unable to queue background job.');
  }

  // Development-Only Boundary: Allow in-process worker ONLY if ALLOW_LOCAL_QUEUE_FALLBACK=true
  if (process.env.ALLOW_LOCAL_QUEUE_FALLBACK === 'true') {
    console.warn('[Dev Warning] Executing job via ephemeral in-memory worker. Jobs will be lost on process restart.');
    logger.warn('QUEUE_DEV_FALLBACK', 'Executing job via ephemeral in-memory worker (ALLOW_LOCAL_QUEUE_FALLBACK=true)');

    const localJobId = `local-${Date.now()}`;
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
          logger.error('FALLBACK_WORKER_ERROR', `Error in local fallback worker: ${workerErr.message}`);
        }
      } else {
        logger.error('NO_FALLBACK_HANDLER', 'No local fallback handler registered for RAG job processing');
      }
    });

    return { jobId: localJobId, mode: 'local-fallback' };
  }

  // Development without flag set: Fail explicitly so developer knows Redis is needed or flag must be set
  throw new QueueServiceUnavailableError(
    'QueueServiceUnavailable: Redis connection is down. Unable to queue background job. (To enable in-memory execution in dev, set ALLOW_LOCAL_QUEUE_FALLBACK=true)'
  );
};

/**
 * Closes BullMQ queue on graceful process shutdown
 */
const closeRagQueue = async () => {
  if (ragQueue) {
    try {
      await ragQueue.close();
      logger.info('BULLMQ_CLOSED', 'BullMQ "rag-document-queue" closed gracefully.');
    } catch (err) {
      logger.warn('BULLMQ_CLOSE_WARN', `Error closing BullMQ queue: ${err.message}`);
    }
    ragQueue = null;
    isBullMQActive = false;
  }
};

module.exports = {
  initRagQueue,
  addDocumentJob,
  registerFallbackHandler,
  closeRagQueue,
  QueueServiceUnavailableError,
  getRedisConnectionOptions
};
