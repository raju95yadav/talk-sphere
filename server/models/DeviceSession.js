const mongoose = require('mongoose');

const deviceSessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
  },
  browser: { type: String, default: 'Unknown Browser' },
  os:      { type: String, default: 'Unknown OS' },
  deviceName: { type: String, default: '' },
  customName: { type: String, default: '' },
  deviceType: { type: String, default: 'desktop' }, // 'mobile' | 'tablet' | 'desktop'
  clientModel: { type: String, default: '' },
  ip:      { type: String, default: '' },
  city:    { type: String, default: '' },
  country: { type: String, default: '' },
  lastActive: { type: Date, default: Date.now },
  isCurrentSession: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('DeviceSession', deviceSessionSchema);
