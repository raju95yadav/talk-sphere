const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  username: {
    type: String,
    trim: true,
    unique: true,
    sparse: true // Allows multiple users to have no username initially if needed, though they get one in OTP
  },
  name: {
    type: String,
    trim: true
  },
  phoneNumber: {
    type: String,
    trim: true
  },
  age: {
    type: Number
  },
  address: {
    type: String,
    trim: true,
    default: ''
  },
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  hiddenUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  otp: {
    code: String,
    expiresAt: Date,
    failedAttempts: {
      type: Number,
      default: 0
    },
    lastRequestedAt: Date
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  avatar: {
    type: String,
    default: ''
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

userSchema.index({ phoneNumber: 1 });

module.exports = mongoose.model('User', userSchema);
