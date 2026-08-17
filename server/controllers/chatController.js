const User = require('../models/User');
const Message = require('../models/Message');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

// Contact Management
exports.addContact = async (req, res) => {
  try {
    const { phoneNumber, name: alias } = req.body;
    
    // Search by phone or email
    let contactUser = await User.findOne({ 
      $or: [
        { phoneNumber: phoneNumber },
        { email: phoneNumber } 
      ]
    });

    // If user not found, create a "Virtual Contact" for demo/testing purposes
    if (!contactUser) {
      console.log(`Creating virtual contact for ${phoneNumber}`);
      contactUser = new User({
        email: `${phoneNumber}@talksphere.local`, // Internal virtual email
        phoneNumber: phoneNumber,
        name: alias || 'Unknown Contact',
        isVerified: false
      });
      await contactUser.save();
    }

    if (contactUser._id.equals(req.user._id)) {
      return res.status(400).json({ message: 'You cannot add yourself' });
    }

    const user = await User.findById(req.user._id);
    if (user.contacts.includes(contactUser._id)) {
      return res.status(400).json({ message: 'Contact already added' });
    }

    user.contacts.push(contactUser._id);
    await user.save();

    // Broadcast new friend request/contact notification to the target user
    if (contactUser.isVerified) {
      const io = req.app.get('io');
      if (io) {
        io.to(contactUser._id.toString()).emit('new_friend_request', {
          sender: {
            id: req.user._id,
            username: req.user.username,
            name: req.user.name,
            avatar: req.user.avatar
          }
        });
      }
    }

    res.json({ 
      message: 'Connection Initialized', 
      contact: { 
        id: contactUser._id, 
        _id: contactUser._id, // Add both for compatibility
        name: contactUser.name || contactUser.email, 
        phoneNumber: contactUser.phoneNumber,
        avatar: contactUser.avatar 
      } 
    });
  } catch (error) {
    console.error('Add Contact Error:', error);
    res.status(500).json({ message: 'Error adding contact' });
  }
};

exports.getContacts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('contacts', 'name username email phoneNumber avatar');
    res.json(user.contacts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching contacts' });
  }
};

// Messaging
exports.getChatHistory = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id }
      ],
      deletedForMe: { $ne: req.user._id }
    })
    .populate('repliedTo', 'content type sender')
    .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history' });
  }
};

exports.searchMessages = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { query } = req.query;
    
    if (!query) return res.json([]);

    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: receiverId },
        { sender: receiverId, receiver: req.user._id }
      ],
      deletedForMe: { $ne: req.user._id },
      type: 'text',
      content: { $regex: query, $options: 'i' }
    })
    .populate('repliedTo', 'content type sender')
    .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Error searching messages' });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { type } = req.body; // 'me' or 'everyone'
    const message = await Message.findById(messageId);

    if (!message) return res.status(404).json({ message: 'Message not found' });
    
    // Allow either sender or receiver to "delete" (mark as deleted)
    if (!message.sender.equals(req.user._id) && !message.receiver.equals(req.user._id)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (type === 'me') {
      message.deletedForMe.push(req.user._id);
    } else {
      // delete for everyone only allowed by sender usually, but leaving it open based on existing logic
      message.deletedForEveryone = true;
      message.content = "This message was deleted";
      message.fileName = null;
      message.fileSize = null;
      message.type = 'text';
    }
    
    await message.save();

    res.json({ message: 'Message deleted', messageId });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting message' });
  }
};

exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const message = await Message.findById(messageId);

    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (!message.sender.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only sender can edit' });
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({ message: 'Message edited', content, messageId, editedAt: message.editedAt });
  } catch (error) {
    res.status(500).json({ message: 'Error editing message' });
  }
};

exports.getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
      deletedForMe: { $ne: userId }
    }).sort({ createdAt: -1 });

    const conversationMap = new Map();
    const unreadCounts = new Map();

    messages.forEach(msg => {
      const otherUser = msg.sender.toString() === userId.toString() ? msg.receiver.toString() : msg.sender.toString();
      
      if (!conversationMap.has(otherUser)) {
        conversationMap.set(otherUser, msg);
      }

      if (msg.receiver.toString() === userId.toString() && msg.status !== 'read') {
        unreadCounts.set(otherUser, (unreadCounts.get(otherUser) || 0) + 1);
      }
    });

    const conversationUserIds = Array.from(conversationMap.keys());
    const users = await User.find({ _id: { $in: conversationUserIds } })
      .select('username name avatar isOnline lastSeen');

    const conversations = users.map(user => {
      const lastMessage = conversationMap.get(user._id.toString());
      return {
        user,
        unreadCount: unreadCounts.get(user._id.toString()) || 0,
        lastMessage: {
          content: 
            lastMessage.type === 'image' ? '📷 Image' : 
            lastMessage.type === 'video' ? '🎥 Video' : 
            lastMessage.type === 'audio' ? '🎤 Voice Note' :
            lastMessage.type === 'file' || lastMessage.type === 'document' ? '📁 Document' : 
            lastMessage.content,
          createdAt: lastMessage.createdAt,
          sender: lastMessage.sender,
          status: lastMessage.status
        }
      };
    });

    conversations.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));

    res.json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching conversations' });
  }
};

exports.clearChat = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const userId = req.user._id;

    // Soft delete: Push userId into deletedForMe for all matching messages in this conversation
    await Message.updateMany(
      {
        $or: [
          { sender: userId, receiver: receiverId },
          { sender: receiverId, receiver: userId }
        ],
        deletedForMe: { $ne: userId }
      },
      {
        $push: { deletedForMe: userId }
      }
    );

    res.json({ message: 'Chat cleared successfully' });
  } catch (error) {
    console.error('Clear Chat Error:', error);
    res.status(500).json({ message: 'Error clearing chat' });
  }
};
