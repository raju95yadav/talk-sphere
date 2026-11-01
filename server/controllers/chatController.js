const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { createAndSendNotification } = require('../utils/notify');

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

        // Save persistent notification
        createAndSendNotification(io, {
          recipientId: contactUser._id,
          senderId: req.user._id,
          type: 'friend_request',
          title: '👤 New Contact Added',
          message: `${req.user.name || req.user.username || 'A user'} added you to their contacts.`,
          data: {
            senderId: req.user._id.toString(),
            senderName: req.user.name,
            senderUsername: req.user.username,
            senderAvatar: req.user.avatar
          },
          actionType: 'open_chat'
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

// Messaging: Cursor-Based Pagination for 1-on-1 Chats [B-04]
exports.getChatHistory = async (req, res) => {
  try {
    const { receiverId } = req.params;
    const { cursor, limit = 30 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: 'Invalid receiver ID' });
    }

    const userObjectId = new mongoose.Types.ObjectId(req.user._id);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 50);

    const query = {
      isGroup: false,
      $or: [
        { sender: userObjectId, receiver: receiverObjectId },
        { sender: receiverObjectId, receiver: userObjectId }
      ],
      deletedForMe: { $ne: userObjectId }
    };

    // If cursor is provided, fetch messages older than the cursor (_id or timestamp)
    if (cursor) {
      if (mongoose.Types.ObjectId.isValid(cursor)) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      } else if (!isNaN(Date.parse(cursor))) {
        query.createdAt = { $lt: new Date(cursor) };
      }
    }

    // Sort descending by _id to leverage compound index { sender: 1, receiver: 1, _id: -1 }
    // Fetch limitNum + 1 to detect whether an older page exists
    const messages = await Message.find(query)
      .populate('repliedTo', 'content type sender')
      .sort({ _id: -1 })
      .limit(limitNum + 1)
      .lean();

    const hasMore = messages.length > limitNum;
    if (hasMore) {
      messages.pop(); // Remove the extra record used for lookahead
    }

    // Cursor for fetching the next older page
    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1]._id : null;

    // Reverse to chronological order (oldest to newest) for client view
    messages.reverse();

    const sanitizedMessages = messages.map(m => {
      if (m.content && typeof m.content === 'string' && m.content.startsWith('blob:')) {
        return {
          ...m,
          content: '',
          isCorruptedMedia: true
        };
      }
      return m;
    });

    res.json({
      messages: sanitizedMessages,
      nextCursor,
      hasMore,
      totalFetched: sanitizedMessages.length
    });
  } catch (error) {
    console.error('Get Chat History Error:', error);
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

// Sidebar Conversation Loading: Single Optimized Aggregation Pipeline [B-11]
exports.getConversations = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user._id);

    const conversations = await Message.aggregate([
      // 1. Match only 1-on-1 messages involving the current user and not soft-deleted
      {
        $match: {
          isGroup: false,
          $or: [
            { sender: userObjectId },
            { receiver: userObjectId }
          ],
          deletedForMe: { $ne: userObjectId }
        }
      },
      // 2. Identify the other participant in the conversation
      {
        $addFields: {
          otherUser: {
            $cond: {
              if: { $eq: ['$sender', userObjectId] },
              then: '$receiver',
              else: '$sender'
            }
          }
        }
      },
      // 3. Sort messages by createdAt descending before grouping to guarantee the top message is newest
      {
        $sort: { createdAt: -1 }
      },
      // 4. Group by otherUser to get the latest message and calculate unread count in a single pass
      {
        $group: {
          _id: '$otherUser',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', userObjectId] },
                    { $ne: ['$status', 'read'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      // 5. Lookup the other user's profile card
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userData'
        }
      },
      {
        $unwind: '$userData'
      },
      // 6. Sort conversations by the latest message timestamp descending
      {
        $sort: { 'lastMessage.createdAt': -1 }
      },
      // 7. Project clean card data matching frontend contract
      {
        $project: {
          _id: 0,
          user: {
            _id: '$userData._id',
            username: '$userData.username',
            name: '$userData.name',
            avatar: '$userData.avatar',
            isOnline: '$userData.isOnline',
            lastSeen: '$userData.lastSeen'
          },
          unreadCount: '$unreadCount',
          lastMessage: {
            _id: '$lastMessage._id',
            content: {
              $switch: {
                branches: [
                  { case: { $eq: ['$lastMessage.type', 'call'] }, then: { $ifNull: ['$lastMessage.content', '📞 Call'] } },
                  { case: { $eq: ['$lastMessage.type', 'image'] }, then: '📷 Image' },
                  { case: { $eq: ['$lastMessage.type', 'video'] }, then: '🎥 Video' },
                  { case: { $eq: ['$lastMessage.type', 'audio'] }, then: '🎤 Voice Note' },
                  { case: { $eq: ['$lastMessage.type', 'gif'] }, then: '👾 GIF' },
                  { case: { $in: ['$lastMessage.type', ['file', 'document']] }, then: '📁 Document' }
                ],
                default: '$lastMessage.content'
              }
            },
            type: '$lastMessage.type',
            createdAt: '$lastMessage.createdAt',
            sender: '$lastMessage.sender',
            status: '$lastMessage.status'
          }
        }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Get Conversations Error:', error);
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

exports.getCallLogs = async (req, res) => {
  try {
    const callLogs = await Message.find({
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ],
      type: 'call',
      deletedForMe: { $ne: req.user._id }
    })
    .populate('sender', 'name username email avatar')
    .populate('receiver', 'name username email avatar')
    .sort({ createdAt: -1 });

    res.json(callLogs);
  } catch (error) {
    console.error('Get Call Logs Error:', error);
    res.status(500).json({ message: 'Error fetching call logs' });
  }
};
