const User = require('../models/User');
const Message = require('../models/Message');
const Note = require('../models/Note');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-otp');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload an image' });
    }

    const user = await User.findById(req.user._id);
    user.avatar = req.file.path; // Cloudinary URL
    await user.save();

    // Broadcast profile update
    const io = req.app.get('io');
    if (io) {
      io.emit('user_profile_updated', {
        userId: user._id,
        username: user.username,
        name: user.name,
        avatar: user.avatar
      });
    }

    res.json({ 
      message: 'Avatar updated successfully', 
      avatar: user.avatar 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating avatar' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, username, phoneNumber, age, address, bio } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (username !== undefined) {
      const trimmedUsername = username.trim();
      if (trimmedUsername && trimmedUsername !== user.username) {
        const existingUser = await User.findOne({ 
          username: { $regex: new RegExp(`^${trimmedUsername}$`, 'i') }, 
          _id: { $ne: req.user._id } 
        });
        if (existingUser) {
          return res.status(400).json({ message: 'Username is already taken' });
        }
        user.username = trimmedUsername;
      }
    }

    if (name !== undefined) user.name = typeof name === 'string' ? name.trim() : name;
    if (phoneNumber !== undefined) user.phoneNumber = typeof phoneNumber === 'string' ? phoneNumber.trim() : phoneNumber;
    if (age !== undefined) {
      user.age = (age === '' || age === null || isNaN(Number(age))) ? null : Number(age);
    }
    if (address !== undefined) user.address = typeof address === 'string' ? address.trim() : address;
    if (bio     !== undefined) user.bio     = typeof bio     === 'string' ? bio.trim().slice(0, 120) : bio;

    await user.save();

    // Broadcast profile update
    const io = req.app.get('io');
    if (io) {
      io.emit('user_profile_updated', {
        userId: user._id,
        username: user.username,
        name: user.name,
        avatar: user.avatar
      });
    }

    const updatedUser = user.toObject();
    delete updatedUser.otp;

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ message: error.message || 'Error updating profile' });
  }
};

exports.getUserStats = async (req, res) => {
  try {
    const messageCount = await Message.countDocuments({
      $or: [{ sender: req.user._id }, { receiver: req.user._id }]
    });
    const noteCount = await Note.countDocuments({ user: req.user._id });
    
    res.json({
      messages: messageCount,
      notes: noteCount
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    
    // Privacy protection: If search query is missing or empty, do not return any users
    if (!search || !search.trim()) {
      return res.json([]);
    }

    const queryStr = search.trim();
    
    // Fetch current user to get their hiddenUsers array
    const currentUser = await User.findById(req.user._id).select('hiddenUsers');
    const hiddenList = currentUser?.hiddenUsers || [];
    
    // Match exact username or exact email (case-insensitive)
    const exactRegex = new RegExp(`^${escapeRegex(queryStr)}$`, 'i');
    let query = { 
      _id: { 
        $ne: req.user._id,
        $nin: hiddenList
      },
      $or: [
        { username: exactRegex },
        { email: exactRegex }
      ]
    };

    const users = await User.find(query)
      .select('username name email avatar isOnline lastSeen')
      .limit(20);

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users' });
  }
};

exports.hideUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { hiddenUsers: userId }
    });

    res.json({ message: 'User removed successfully' });
  } catch (error) {
    console.error('Hide User Error:', error);
    res.status(500).json({ message: 'Error hiding user' });
  }
};

exports.updatePresenceStatus = async (req, res) => {
  try {
    const VALID_STATUSES = ['available', 'busy', 'away', 'in-a-call', 'do-not-disturb'];
    const { presenceStatus } = req.body;

    if (!presenceStatus || !VALID_STATUSES.includes(presenceStatus)) {
      return res.status(400).json({ message: 'Invalid presence status' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { presenceStatus },
      { new: true, select: '-otp' }
    );

    // Broadcast real-time status change via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('presence_status_change', {
        userId: user._id,
        presenceStatus: user.presenceStatus,
      });
    }

    res.json({ message: 'Presence status updated', presenceStatus: user.presenceStatus, user });
  } catch (error) {
    console.error('Presence Status Error:', error);
    res.status(500).json({ message: 'Error updating presence status' });
  }
};
