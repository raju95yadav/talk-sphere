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
    const { name, username, phoneNumber, age, address } = req.body;
    const user = await User.findById(req.user._id);

    if (username) {
      const existingUser = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (existingUser) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
      user.username = username;
    }
    if (name !== undefined) user.name = name;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (age !== undefined) user.age = age;
    if (address !== undefined) user.address = address;

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

    res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
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

exports.getAllUsers = async (req, res) => {
  try {
    const { search } = req.query;
    
    // Fetch current user to get their hiddenUsers array
    const currentUser = await User.findById(req.user._id).select('hiddenUsers');
    const hiddenList = currentUser?.hiddenUsers || [];
    
    // Exclude the current user and any users they have hidden
    let query = { 
      _id: { 
        $ne: req.user._id,
        $nin: hiddenList
      } 
    };

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('username name avatar isOnline lastSeen')
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
