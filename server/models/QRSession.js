const mongoose = require('mongoose');

const qrSessionSchema = new mongoose.Schema({
  qrToken: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'scanned', 'approved', 'rejected', 'expired'],
    default: 'pending',
  },
  browser: { type: String, default: 'Desktop Browser' },
  os:      { type: String, default: 'Computer' },
  ip:      { type: String, default: '127.0.0.1' },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // Automatically removed by MongoDB after expiresAt
  },
  scannedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  scannedByName: { type: String, default: '' },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  token:        { type: String, default: null },
  refreshToken: { type: String, default: null },
  user:         { type: Object, default: null },
}, { timestamps: true });

module.exports = mongoose.model('QRSession', qrSessionSchema);
