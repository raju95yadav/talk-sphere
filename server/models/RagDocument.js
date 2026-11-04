const mongoose = require('mongoose');

const ragDocumentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  originalName: { type: String, required: true },
  fileType: { type: String, enum: ['pdf', 'docx', 'txt', 'md'], required: true },
  fileSize: { type: Number, required: true },
  totalChunks: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['queued', 'parsing', 'indexing', 'ready', 'failed', 'FAILED', 'QUEUED', 'PARSING', 'INDEXING', 'READY'],
    default: 'queued',
    index: true
  },
  error: { type: String, default: null },
  processingError: { type: String, default: null },
  failedAt: { type: Date, default: null },
  indexedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('RagDocument', ragDocumentSchema);
