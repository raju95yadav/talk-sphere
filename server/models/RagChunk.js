const mongoose = require('mongoose');

const ragChunkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  document: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RagDocument',
    required: true,
    index: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    required: true
  },
  pageNumber: {
    type: Number,
    default: 1
  },
  tokenCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ragChunkSchema.index({ user: 1, document: 1 });
ragChunkSchema.index({ document: 1, chunkIndex: 1 });

/**
 * Native MongoDB Atlas Vector Search index definition [B-07]
 * To enable on MongoDB Atlas:
 * 1. Navigate to Atlas Database Deployments -> Atlas Search -> JSON Editor
 * 2. Target Database & Collection: talksphere.ragchunks
 * 3. Create Search Index with name: "vector_index"
 */
ragChunkSchema.statics.vectorIndexDefinition = {
  fields: [
    {
      type: "vector",
      path: "embedding",
      numDimensions: 768,
      similarity: "cosine"
    },
    {
      type: "filter",
      path: "document"
    },
    {
      type: "filter",
      path: "user"
    }
  ]
};

module.exports = mongoose.model('RagChunk', ragChunkSchema);
