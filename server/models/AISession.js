const mongoose = require('mongoose');

const aiSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  title: {
    type: String,
    default: 'New Chat',
    trim: true
  },
  modelPreference: {
    type: String,
    default: 'gemini-3.6-flash'
  },
  mode: {
    type: String,
    enum: ['general', 'rag'],
    default: 'general'
  },
  ragDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RagDocument',
    default: null
  },
  messages: [{
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    content: {
      type: String,
      default: ''
    },
    sources: [{
      chunkIndex: Number,
      documentTitle: String,
      snippet: String,
      similarity: Number
    }],
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, { timestamps: true });

module.exports = mongoose.model('AISession', aiSessionSchema);
