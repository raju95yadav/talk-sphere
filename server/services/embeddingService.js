const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../utils/logger');
const { ragEmbeddingBreaker } = require('./circuitBreaker');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Runtime cache for verified embedding model
let verifiedEmbeddingModel = 'gemini-embedding-001';

// Query embedding cache to avoid redundant network calls for identical/repeated questions
const queryEmbeddingCache = new Map();

/**
 * Generate 768-dimensional embeddings using Gemini with smart caching & Circuit Breaker [B-16]
 *
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimensional float array
 */
const generateEmbedding = async (text) => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return new Array(768).fill(0);
  }

  return ragEmbeddingBreaker.execute(async () => {
    // Fast-path: use verified working model directly
    if (verifiedEmbeddingModel) {
      try {
        const model = genAI.getGenerativeModel({ model: verifiedEmbeddingModel });
        const res = await model.embedContent({
          content: { parts: [{ text }] },
          outputDimensionality: 768
        });
        if (res?.embedding?.values && res.embedding.values.length === 768) {
          return res.embedding.values;
        }
      } catch (cachedErr) {
        logger.warn('RAG_EMBEDDING_CACHED_FAIL', `Cached model ${verifiedEmbeddingModel} failed, re-probing...`);
        verifiedEmbeddingModel = null;
      }
    }

    // Primary: gemini-embedding-001 with outputDimensionality: 768
    try {
      const embedModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
      const res = await embedModel.embedContent({
        content: { parts: [{ text }] },
        outputDimensionality: 768
      });
      if (res?.embedding?.values && res.embedding.values.length === 768) {
        verifiedEmbeddingModel = 'gemini-embedding-001';
        return res.embedding.values;
      }
    } catch (err) {
      logger.warn('RAG_EMBEDDING_RETRY', `gemini-embedding-001: ${err.message}. Trying text-embedding-004 fallback...`);
    }

    // Fallback: text-embedding-004
    try {
      const fallbackModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const res = await fallbackModel.embedContent({
        content: { parts: [{ text }] },
        outputDimensionality: 768
      });
      if (res?.embedding?.values && res.embedding.values.length === 768) {
        verifiedEmbeddingModel = 'text-embedding-004';
        return res.embedding.values;
      }
    } catch (fallbackErr) {
      logger.error('RAG_EMBEDDING_FAILED', fallbackErr.message || fallbackErr);
      throw new Error(`Embedding generation failed: ${fallbackErr.message}`);
    }

    throw new Error('Could not obtain 768-dimensional embedding from Gemini');
  }, () => {
    // Graceful fallback: return zero vector if circuit breaker is OPEN
    return new Array(768).fill(0);
  });
};

/**
 * Get or compute cached query embedding
 *
 * @param {string} query
 * @returns {Promise<number[]>}
 */
const getQueryEmbedding = async (query) => {
  const cacheKey = (query || '').trim().toLowerCase();
  let emb = queryEmbeddingCache.get(cacheKey);
  if (!emb) {
    emb = await generateEmbedding(query);
    if (queryEmbeddingCache.size > 300) {
      queryEmbeddingCache.delete(queryEmbeddingCache.keys().next().value);
    }
    queryEmbeddingCache.set(cacheKey, emb);
  }
  return emb;
};

/**
 * Calculate cosine similarity between two vectors
 */
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

module.exports = {
  generateEmbedding,
  getQueryEmbedding,
  cosineSimilarity,
  genAI
};

