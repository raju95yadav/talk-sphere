const fs = require('fs');
const path = require('path');
const { Worker } = require('bullmq');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const RagDocument = require('../models/RagDocument');
const RagChunk = require('../models/RagChunk');
const logger = require('../utils/logger');
const { generateEmbedding } = require('../services/embeddingService');
const {
  getRedisConnectionOptions,
  registerFallbackHandler,
  getIsBullMQActive
} = require('../config/queue');

let socketIO = null;
let bullmqWorker = null;

/**
 * Configure active Socket.io instance for real-time client status streaming [B-06]
 *
 * @param {object} io - Socket.io instance
 */
const setWorkerIO = (io) => {
  socketIO = io;
};

/**
 * Emit granular real-time progress update to the user's personal channel/room [B-06]
 *
 * @param {string} userId - Target user ID
 * @param {object} payload - { documentId, status, progress, currentChunk, totalChunks, error }
 */
const emitDocumentStatus = (userId, payload) => {
  if (!socketIO || !userId) return;

  const targetRoom = userId.toString();
  try {
    socketIO.to(targetRoom).emit('rag:document_status', payload);
    socketIO.to(`user:${targetRoom}`).emit('rag:document_status', payload);
    logger.info('RAG_SOCKET_EMIT', `Emitted status [${payload.status}] for doc ${payload.documentId} to user ${targetRoom}`);
  } catch (err) {
    logger.warn('RAG_SOCKET_EMIT_ERR', `Failed to emit socket status: ${err.message}`);
  }
};

/**
 * Text extraction from staged disk file (.pdf, .docx, .txt, .md)
 *
 * @param {string} filePath - Local disk path
 * @param {string} fileType - Format extension or MIME type
 * @returns {Promise<string>} Extracted plaintext
 */
const extractTextFromDiskFile = async (filePath, fileType) => {
  const normType = fileType.toLowerCase().replace(/^\./, '');

  if (normType.includes('pdf') || normType === 'pdf') {
    const fileBuffer = await fs.promises.readFile(filePath);
    if (typeof pdfParse === 'function') {
      const data = await pdfParse(fileBuffer);
      return data.text || '';
    }
    if (pdfParse && pdfParse.PDFParse) {
      const parser = new pdfParse.PDFParse({ data: fileBuffer });
      try {
        const result = await parser.getText();
        return result.text || '';
      } finally {
        if (typeof parser.destroy === 'function') {
          await parser.destroy();
        }
      }
    }
    throw new Error('PDF parsing library is unavailable');
  }

  if (normType.includes('word') || normType.includes('docx') || normType === 'docx') {
    const fileBuffer = await fs.promises.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value || '';
  }

  // Plain text / Markdown
  return await fs.promises.readFile(filePath, 'utf-8');
};

/**
 * Split plaintext into recursive overlapping chunks (~600 tokens / 800 chars with 150 overlap)
 *
 * @param {string} fullText
 * @param {number} chunkSize
 * @param {number} overlap
 * @returns {string[]}
 */
const chunkText = (fullText, chunkSize = 800, overlap = 150) => {
  if (!fullText) return [];
  const clean = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) return [];

  const paragraphs = clean.split(/\n\s*\n/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((current + '\n\n' + trimmed).length <= chunkSize) {
      current = current ? current + '\n\n' + trimmed : trimmed;
    } else {
      if (current) {
        chunks.push(current.trim());
        const overlapStart = Math.max(0, current.length - overlap);
        current = current.substring(overlapStart).trim();
      }

      if (trimmed.length > chunkSize) {
        let start = 0;
        while (start < trimmed.length) {
          const end = Math.min(start + chunkSize, trimmed.length);
          const slice = trimmed.substring(start, end).trim();
          if (slice.length > 20) {
            chunks.push(slice);
          }
          start += (chunkSize - overlap);
        }
        current = '';
      } else {
        current = current ? current + '\n\n' + trimmed : trimmed;
      }
    }
  }

  if (current && current.trim().length > 20) {
    chunks.push(current.trim());
  }

  if (chunks.length === 0 && clean.length > 0) {
    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + chunkSize, clean.length);
      const slice = clean.substring(start, end).trim();
      if (slice.length > 0) chunks.push(slice);
      start += (chunkSize - overlap);
    }
  }

  return chunks;
};

/**
 * Core asynchronous document ingestion pipeline [B-06]
 * Workflow:
 * 1. Status Update: 'parsing' (emit socket)
 * 2. Extraction & Chunking: extract text from disk -> unlink disk file immediately
 * 3. Status Update: 'indexing' (emit socket)
 * 4. Embedding Generation: batch chunks & invoke Gemini 768-dim embeddings
 * 5. Bulk Insert: write to 'ragchunks' collection via bulkWrite
 * 6. Completion: update 'RagDocument' status to 'ready' & set indexedAt
 *
 * @param {object} jobData - { documentId, filePath, fileType, originalName, userId }
 */
const processDocumentJob = async (jobData) => {
  const { documentId, filePath, fileType, originalName, userId } = jobData;
  logger.info('RAG_WORKER_START', `Processing doc ${documentId} (${originalName}) for user ${userId}`);

  try {
    // 1. Status Update -> "parsing"
    await RagDocument.findByIdAndUpdate(documentId, {
      status: 'parsing',
      error: null
    });
    emitDocumentStatus(userId, {
      documentId,
      status: 'parsing',
      progress: 20
    });

    // 2. Extraction from staged disk file
    let extractedText = '';
    try {
      extractedText = await extractTextFromDiskFile(filePath, fileType);
    } finally {
      // MANDATORY DISK CLEANUP: Unlink staged temp file immediately after text extraction [B-08]
      if (filePath) {
        try {
          await fs.promises.unlink(filePath);
          logger.info('RAG_TEMP_UNLINKED', `Unlinked temp file: ${filePath}`);
        } catch (unlinkErr) {
          if (unlinkErr.code !== 'ENOENT') {
            logger.warn('RAG_UNLINK_WARN', `Could not unlink ${filePath}: ${unlinkErr.message}`);
          }
        }
      }
    }

    if (!extractedText || !extractedText.trim()) {
      throw new Error('The uploaded document contains no readable text.');
    }

    // Chunk plaintext into recursive pieces
    const textChunks = chunkText(extractedText, 800, 150);
    if (textChunks.length === 0) {
      throw new Error('Failed to extract usable text chunks from document.');
    }

    // 3. Status Update -> "indexing"
    await RagDocument.findByIdAndUpdate(documentId, {
      status: 'indexing',
      totalChunks: textChunks.length
    });
    emitDocumentStatus(userId, {
      documentId,
      status: 'indexing',
      currentChunk: 0,
      totalChunks: textChunks.length,
      progress: 35
    });

    // 4. Embedding Generation in Batches
    const chunkDocs = [];
    const BATCH_SIZE = 4;

    for (let i = 0; i < textChunks.length; i += BATCH_SIZE) {
      const batch = textChunks.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (chunkContent, idx) => {
        const chunkIndex = i + idx;
        const embedding = await generateEmbedding(chunkContent);
        return {
          user: userId,
          document: documentId,
          chunkIndex,
          content: chunkContent,
          embedding,
          pageNumber: Math.floor(chunkIndex / 3) + 1,
          tokenCount: Math.round(chunkContent.length / 4),
          createdAt: new Date()
        };
      });

      const batchResults = await Promise.all(batchPromises);
      chunkDocs.push(...batchResults);

      const processedCount = Math.min(i + BATCH_SIZE, textChunks.length);
      const progressPercent = Math.min(95, Math.round(35 + (processedCount / textChunks.length) * 60));

      emitDocumentStatus(userId, {
        documentId,
        status: 'indexing',
        currentChunk: processedCount,
        totalChunks: textChunks.length,
        progress: progressPercent
      });

      if (i + BATCH_SIZE < textChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    // 5. Bulk Insert Chunks into MongoDB
    if (chunkDocs.length > 0) {
      const bulkOps = chunkDocs.map(chunk => ({
        insertOne: {
          document: chunk
        }
      }));
      await RagChunk.bulkWrite(bulkOps, { ordered: false });
    }

    // 6. Completion -> "ready"
    const now = new Date();
    await RagDocument.findByIdAndUpdate(documentId, {
      status: 'ready',
      totalChunks: chunkDocs.length,
      indexedAt: now,
      error: null
    });

    emitDocumentStatus(userId, {
      documentId,
      status: 'ready',
      totalChunks: chunkDocs.length,
      progress: 100
    });

    logger.info('RAG_WORKER_COMPLETE', `Document ${documentId} indexed successfully with ${chunkDocs.length} chunks`);
    return { success: true, totalChunks: chunkDocs.length };
  } catch (error) {
    logger.error('RAG_WORKER_ERROR', `Job failed for doc ${documentId}: ${error.message}`);

    // Mark document as failed
    await RagDocument.findByIdAndUpdate(documentId, {
      status: 'failed',
      error: error.message || 'Extraction failed'
    }).catch(() => {});

    emitDocumentStatus(userId, {
      documentId,
      status: 'failed',
      error: error.message || 'Extraction failed',
      progress: 0
    });

    // Ensure temp file is unlinked on error
    if (filePath) {
      try {
        await fs.promises.unlink(filePath);
      } catch (e) {}
    }

    throw error;
  }
};

/**
 * Start the BullMQ Worker listening to 'rag-document-queue' [B-06]
 *
 * @param {object} io - Socket.io instance
 */
const startRagWorker = async (io) => {
  if (io) setWorkerIO(io);

  // Register in-process fallback handler unconditionally
  registerFallbackHandler(processDocumentJob);

  const connectionOptions = getRedisConnectionOptions();

  try {
    bullmqWorker = new Worker(
      'rag-document-queue',
      async (job) => {
        logger.info('BULLMQ_WORKER_EXEC', `Worker executing job ${job.id}`);
        return await processDocumentJob(job.data);
      },
      {
        connection: connectionOptions,
        concurrency: 3 // Concurrency: 3 parallel document workers [B-06]
      }
    );

    bullmqWorker.on('completed', (job) => {
      logger.info('BULLMQ_JOB_COMPLETED', `Job ${job.id} completed successfully`);
    });

    bullmqWorker.on('failed', (job, err) => {
      logger.error('BULLMQ_JOB_FAILED', `Job ${job?.id} failed with error: ${err.message}`);
    });

    bullmqWorker.on('error', (err) => {
      // Suppress noisy error logs if Redis drops
      logger.warn('BULLMQ_WORKER_WARN', `Worker Redis connection notice: ${err.message}`);
    });

    logger.info('BULLMQ_WORKER_READY', 'BullMQ RAG Worker active with concurrency 3.');
  } catch (err) {
    logger.warn('BULLMQ_WORKER_FALLBACK', `Could not start BullMQ worker (${err.message}). In-process async fallback active.`);
  }
};

/**
 * Gracefully drains and closes the BullMQ worker
 */
const closeRagWorker = async () => {
  if (bullmqWorker) {
    try {
      await bullmqWorker.close();
      logger.info('BULLMQ_WORKER_CLOSED', 'BullMQ RAG Worker closed gracefully.');
    } catch (err) {
      logger.warn('BULLMQ_WORKER_CLOSE_WARN', `Error closing BullMQ worker: ${err.message}`);
    }
    bullmqWorker = null;
  }
};

module.exports = {
  startRagWorker,
  processDocumentJob,
  setWorkerIO,
  emitDocumentStatus,
  chunkText,
  closeRagWorker
};

