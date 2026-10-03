const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createAndSendNotification } = require('../utils/notify');

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(60)
      .populate('sender', 'name username avatar email')
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: userId,
      isRead: false
    });

    res.json({
      notifications,
      unreadCount
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ message: 'Failed to retrieve notifications' });
  }
};

// PUT /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ success: true, notification });
  } catch (error) {
    console.error('markAsRead error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};

// PUT /api/notifications/read-all
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('markAllAsRead error:', error);
    res.status(500).json({ message: 'Failed to mark all as read' });
  }
};

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user._id
    });
    res.json({ success: true, message: 'Notification removed' });
  } catch (error) {
    console.error('deleteNotification error:', error);
    res.status(500).json({ message: 'Failed to delete notification' });
  }
};

// DELETE /api/notifications
exports.clearAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ success: true, message: 'All notifications cleared' });
  } catch (error) {
    console.error('clearAllNotifications error:', error);
    res.status(500).json({ message: 'Failed to clear notifications' });
  }
};

// POST /api/notifications/claim-invite
exports.claimInvite = async (req, res) => {
  try {
    const { ref } = req.body;
    if (!ref) {
      return res.status(400).json({ message: 'Referral code or handle required' });
    }

    const cleanRef = String(ref).trim().replace(/^@/, '');
    if (!cleanRef) {
      return res.status(400).json({ message: 'Invalid referral code' });
    }

    // Try finding the inviter by username, email, or _id
    const queryConditions = [
      { username: { $regex: new RegExp(`^${cleanRef}$`, 'i') } },
      { email: cleanRef.toLowerCase() }
    ];

    if (mongoose.Types.ObjectId.isValid(cleanRef)) {
      queryConditions.push({ _id: cleanRef });
    }

    const inviter = await User.findOne({ $or: queryConditions });

    if (!inviter) {
      return res.status(404).json({ message: 'Inviter not found' });
    }

    // Cannot invite yourself
    if (inviter._id.equals(req.user._id)) {
      return res.json({ message: 'Cannot claim your own referral' });
    }

    const io = req.app.get('io');
    const joiningUser = await User.findById(req.user._id);

    // Check if an invite notification already exists between these users
    const existingNotification = await Notification.findOne({
      recipient: inviter._id,
      sender: req.user._id,
      type: 'invite_joined'
    });

    if (!existingNotification) {
      // Create high-priority notification for the inviter
      await createAndSendNotification(io, {
        recipientId: inviter._id,
        senderId: req.user._id,
        type: 'invite_joined',
        title: '🤝 New Friend Joined via Your Link!',
        message: `${joiningUser.name || joiningUser.username || 'A friend'} (@${joiningUser.username || 'user'}) joined TalkSphere using your invite link and wants to connect! Please connect ASAP.`,
        data: {
          senderId: req.user._id.toString(),
          senderName: joiningUser.name || joiningUser.username,
          senderUsername: joiningUser.username,
          senderAvatar: joiningUser.avatar,
          senderEmail: joiningUser.email
        },
        actionType: 'connect_chat'
      });

      // Also create welcome notification for the newly joined user
      await createAndSendNotification(io, {
        recipientId: req.user._id,
        senderId: inviter._id,
        type: 'invite_joined',
        title: '✨ Welcome to TalkSphere!',
        message: `You joined through ${inviter.name || inviter.username}'s invite link. Tap to start chatting with them.`,
        data: {
          senderId: inviter._id.toString(),
          senderName: inviter.name || inviter.username,
          senderUsername: inviter.username,
          senderAvatar: inviter.avatar
        },
        actionType: 'connect_chat'
      });
    }

    res.json({
      success: true,
      message: 'Invite claimed successfully',
      inviter: {
        id: inviter._id,
        name: inviter.name,
        username: inviter.username,
        avatar: inviter.avatar
      }
    });
  } catch (error) {
    console.error('claimInvite error:', error);
    res.status(500).json({ message: 'Failed to process invite referral' });
  }
};

// POST /api/notifications/connect-invite
// Connects both users mutually as contacts and marks the notification as handled
exports.connectInviteUser = async (req, res) => {
  try {
    const { notificationId, targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    const currentUserId = req.user._id;
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    const currentUser = await User.findById(currentUserId);

    // Mutual contact connection: add target to current user's contacts
    const currentContactsStr = (currentUser.contacts || []).map(c => c.toString());
    if (!currentContactsStr.includes(targetUserId.toString())) {
      currentUser.contacts.push(targetUser._id);
      await currentUser.save();
    }

    // Add current user to target's contacts
    const targetContactsStr = (targetUser.contacts || []).map(c => c.toString());
    if (!targetContactsStr.includes(currentUserId.toString())) {
      targetUser.contacts.push(currentUser._id);
      await targetUser.save();
    }

    // Mark notification as done and read
    if (notificationId) {
      await Notification.findByIdAndUpdate(notificationId, {
        actionDone: true,
        isRead: true
      });
    }

    // Notify target user via socket so their chat and contact list update immediately
    const io = req.app.get('io');
    if (io) {
      io.to(targetUserId.toString()).emit('new_friend_request', {
        sender: {
          id: currentUser._id,
          _id: currentUser._id,
          username: currentUser.username,
          name: currentUser.name,
          avatar: currentUser.avatar,
          phoneNumber: currentUser.phoneNumber
        }
      });
    }

    res.json({
      success: true,
      message: 'Successfully connected with user!',
      contact: {
        id: targetUser._id,
        _id: targetUser._id,
        name: targetUser.name || targetUser.email,
        username: targetUser.username,
        avatar: targetUser.avatar,
        phoneNumber: targetUser.phoneNumber,
        email: targetUser.email
      }
    });
  } catch (error) {
    console.error('connectInviteUser error:', error);
    res.status(500).json({ message: 'Failed to connect users' });
  }
};
