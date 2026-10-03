const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: [
      'invite_joined',     // When someone joins using user's referral link
      'friend_request',    // When someone adds you to contacts
      'login_alert',       // Security alert for new device login
      'call_missed',       // Missed audio or video call
      'chat_message',      // Direct or group message ping
      'ai_alert',          // AI assistant summary or alert
      'system'             // System alerts, storage, settings
    ],
    default: 'system',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  actionType: {
    type: String,
    enum: ['none', 'connect_chat', 'view_devices', 'open_chat', 'open_ai', 'open_settings'],
    default: 'none'
  },
  actionDone: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
