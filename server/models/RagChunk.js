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

module.exports = mongoose.model('RagChunk', ragChunkSchema);

