const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const User = require('./models/User');
const ApiError = require('./utils/ApiError');
const logger = require('./utils/logger');
const errorMiddleware = require('./middleware/errorMiddleware');

dotenv.config();

const app = express();
const server = http.createServer(app);

const clientOrigin = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Attach socket.io server instance to app
app.set('io', io);

// Middleware
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
app.use(cors({
  origin: clientOrigin,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// DB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('--- MONGODB CONNECTION ERROR ---');
    console.error(`Message: ${error.message}`);
    console.error('Tip: Check if your MONGODB_URI in .env is correct.');
    console.error('If your password contains special characters like #, @, or $, they must be URL encoded.');
    console.error('---------------------------------');
    // Don't exit here to allow server to start for other routes, 
    // but in production you might want to process.exit(1)
  }
};

connectDB();

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

app.get('/', (req, res) => {
  res.send('Talk Sphere API is running');
});

// Online Users Mapping (User ID string -> Set of Socket IDs)
const onlineUsers = new Map();

// JWT Authentication Middleware for Sockets
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    console.warn(`Socket connection rejected: No token provided (socket ID: ${socket.id})`);
    return next(new Error('Authentication error: No token provided'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch (err) {
    console.warn(`Socket connection rejected: Invalid or expired token (socket ID: ${socket.id})`);
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id, 'User ID:', socket.userId);

  socket.on('join', async (userId) => {
    if (!userId) return;
    
    try {
      // Validate userId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.warn(`Invalid socket join attempt with non-ObjectId: ${userId}`);
        return;
      }

      // Security check: ensure socket.userId matches the requested join room ID
      if (socket.userId.toString() !== userId.toString()) {
        console.warn(`Unauthorized join attempt: Socket userId (${socket.userId}) tried to join room (${userId})`);
        return;
      }

      socket.join(userId);
      
      // Update multi-tab connection set
      if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
      }
      onlineUsers.get(userId).add(socket.id);
      
      console.log(`>>> Socket Connection: User ${userId} joined room. Total tabs: ${onlineUsers.get(userId).size}`);
      
      // Only mark online and emit change if this is their first connection
      if (onlineUsers.get(userId).size === 1) {
        await User.findByIdAndUpdate(userId, { isOnline: true });
        io.emit('user_status_change', { userId, isOnline: true });
        console.log(`User ${userId} is now online`);
      }
      
      // Auto-deliver pending messages (WhatsApp behavior)
      const undeliveredMessages = await Message.find({ receiver: userId, status: 'sent' });
      if (undeliveredMessages.length > 0) {
        await Message.updateMany(
          { receiver: userId, status: 'sent' },
          { status: 'delivered' }
        );
        
        // Notify senders about the delivery
        undeliveredMessages.forEach(msg => {
          io.to(msg.sender.toString()).emit('status_update', { messageId: msg._id, status: 'delivered' });
        });
      }
      // Join all group rooms the user belongs to
      const Group = require('./models/Group');
      const userGroups = await Group.find({ 'members.user': userId }).select('_id');
      userGroups.forEach(g => {
        socket.join(`group_${g._id}`);
      });
    } catch (err) {
      console.error('Error in socket join handler:', err.message || err);
    }
  });

  socket.on('send_message', async (data) => {
    const { senderId, receiverId, content, type, repliedTo, fileName, fileSize, isForwarded, tempId } = data;
    const finalSenderId = senderId || socket.userId;
    
    if (!finalSenderId) return console.error('No sender ID provided for message');

    try {
      const newMessage = new Message({
        sender: finalSenderId,
        receiver: receiverId,
        content,
        type: type || 'text',
        repliedTo: repliedTo || null,
        fileName,
        fileSize,
        isForwarded: isForwarded || false
      });
      await newMessage.save();

      // Populate replied message if exists
      let populatedMessage = await Message.findById(newMessage._id)
        .populate('repliedTo', 'content type sender');

      const sender = await User.findById(finalSenderId).select('name username avatar');
      const messageData = {
        _id: newMessage._id,
        tempId: tempId || null, // Echo back tempId to match client optimistic state
        sender: finalSenderId,
        senderName: sender?.username || sender?.name || 'User',
        senderAvatar: sender?.avatar,
        receiver: receiverId,
        content,
        type: newMessage.type,
        repliedTo: populatedMessage.repliedTo,
        fileName: newMessage.fileName,
        fileSize: newMessage.fileSize,
        isForwarded: newMessage.isForwarded,
        createdAt: newMessage.createdAt,
        status: newMessage.status,
        reactions: []
      };

      io.to(receiverId).emit('receive_message', messageData);
      io.to(finalSenderId).emit('message_sent', messageData);
    } catch (err) {
      console.error('Socket Message Error:', err);
    }
  });

  socket.on('react_to_message', async (data) => {
    const { messageId, emoji, userId, receiverId } = data;
    try {
      const message = await Message.findById(messageId);
      if (message) {
        // Remove existing reaction from this user if any
        message.reactions = message.reactions.filter(r => r.user.toString() !== userId);
        // Add new reaction
        message.reactions.push({ user: userId, emoji });
        await message.save();
        
        io.to(receiverId).emit('message_reaction', { messageId, reactions: message.reactions });
        io.to(userId).emit('message_reaction', { messageId, reactions: message.reactions });
      }
    } catch (err) {
      console.error('Reaction Error:', err);
    }
  });

  socket.on('disconnect', async () => {
    const userId = socket.userId?.toString();
    
    if (userId) {
      // Clean up any active call in progress for this disconnected user
      for (const [key, call] of activeCalls.entries()) {
        if (call.caller === userId || call.receiver === userId) {
          console.log(`[WebRTC] User ${userId} disconnected during active call (key: ${key})`);
          if (call.timeoutId) {
            clearTimeout(call.timeoutId);
            call.timeoutId = null;
          }
          activeCalls.delete(key);

          const otherPeerId = call.caller === userId ? call.receiver : call.caller;
          if (otherPeerId) {
            io.to(otherPeerId).emit('call_ended');
          }

          if (call.answered && call.answeredTime) {
            const duration = Math.max(1, Math.round((Date.now() - call.answeredTime) / 1000));
            await createCallLogMessage(call.caller, call.receiver, call.callType, 'completed', duration);
          } else {
            await createCallLogMessage(call.caller, call.receiver, call.callType, 'missed', 0);
          }
        }
      }
    }

    if (userId && onlineUsers.has(userId)) {
      const userSockets = onlineUsers.get(userId);
      userSockets.delete(socket.id);
      
      console.log(`Socket disconnected: ${socket.id} for User ${userId}. Remaining tabs: ${userSockets.size}`);
      
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { 
          isOnline: false, 
          lastSeen 
        });
        
        io.emit('user_status_change', { 
          userId, 
          isOnline: false, 
          lastSeen 
        });
        
        console.log(`User ${userId} disconnected and is now offline`);
      }
    }
  });

  socket.on('message_delivered', async ({ messageId, senderId }) => {
    try {
      await Message.findByIdAndUpdate(messageId, { status: 'delivered' });
      io.to(senderId).emit('status_update', { messageId, status: 'delivered' });
    } catch (err) {
      console.error('Delivered Status Error:', err);
    }
  });

  socket.on('mark_read', async ({ messageIds, senderId, receiverId }) => {
    try {
      await Message.updateMany(
        { _id: { $in: messageIds }, status: { $ne: 'read' } },
        { status: 'read' }
      );
      io.to(senderId).emit('messages_read', { messageIds, receiverId });
    } catch (err) {
      console.error('Read Status Error:', err);
    }
  });

  socket.on('edit_message', async (data) => {
    const { messageId, content, receiverId } = data;
    try {
      const message = await Message.findByIdAndUpdate(messageId, { 
        content, 
        isEdited: true,
        editedAt: new Date()
      }, { new: true });
      if (message) {
        io.to(receiverId).emit('message_edited', { messageId, content, editedAt: message.editedAt });
      }
    } catch (err) {
      console.error('Edit Message Error:', err);
    }
  });

  socket.on('delete_message', async (data) => {
    const { messageId, receiverId, type } = data;
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      if (type === 'me') {
        message.deletedForMe.push(socket.userId);
        await message.save();
        // Tell the sender's client to remove it from their view
        // The receiver doesn't need to know
      } else {
        message.deletedForEveryone = true;
        message.content = 'This message was deleted';
        message.fileName = null;
        message.fileSize = null;
        message.type = 'text';
        await message.save();
        io.to(receiverId).emit('message_deleted', { messageId, type: 'everyone' });
      }
    } catch (err) {
      console.error('Delete Message Error:', err);
    }
  });

  socket.on('typing', ({ receiverId }) => {
    io.to(receiverId).emit('typing', { senderId: socket.userId });
  });

  socket.on('stop_typing', ({ receiverId }) => {
    io.to(receiverId).emit('stop_typing', { senderId: socket.userId });
  });

  // Group Socket Handlers
  socket.on('join_group_room', ({ groupId }) => {
    if (groupId) socket.join(`group_${groupId}`);
  });

  socket.on('leave_group_room', ({ groupId }) => {
    if (groupId) socket.leave(`group_${groupId}`);
  });

  socket.on('send_group_message', async (data) => {
    const { groupId, content, type, repliedTo, fileName, fileSize, isForwarded, tempId } = data;
    const finalSenderId = socket.userId;
    if (!finalSenderId || !groupId) return console.error('Missing sender or groupId');

    try {
      const newMessage = new Message({
        sender: finalSenderId,
        group: groupId,
        isGroup: true,
        content,
        type: type || 'text',
        repliedTo: repliedTo || null,
        fileName,
        fileSize,
        isForwarded: isForwarded || false
      });
      await newMessage.save();

      let populatedMessage = await Message.findById(newMessage._id)
        .populate('repliedTo', 'content type sender');

      const sender = await User.findById(finalSenderId).select('name username avatar');
      const messageData = {
        _id: newMessage._id,
        tempId: tempId || null,
        sender: {
          _id: sender._id,
          username: sender?.username || sender?.name || 'User',
          name: sender?.name || 'User',
          avatar: sender?.avatar
        },
        groupId,
        content,
        type: newMessage.type,
        repliedTo: populatedMessage.repliedTo,
        fileName: newMessage.fileName,
        fileSize: newMessage.fileSize,
        isForwarded: newMessage.isForwarded,
        createdAt: newMessage.createdAt,
        status: 'sent',
        reactions: []
      };

      socket.to(`group_${groupId}`).emit('receive_group_message', messageData);
      socket.emit('group_message_sent', messageData);
    } catch (err) {
      console.error('Socket Group Message Error:', err);
    }
  });

  socket.on('group_typing', ({ groupId }) => {
    socket.to(`group_${groupId}`).emit('group_typing', { groupId, senderId: socket.userId });
  });

  socket.on('group_stop_typing', ({ groupId }) => {
    socket.to(`group_${groupId}`).emit('group_stop_typing', { groupId, senderId: socket.userId });
  });

  socket.on('react_to_group_message', async (data) => {
    const { messageId, groupId, emoji, userId } = data;
    try {
      const message = await Message.findById(messageId);
      if (message) {
        message.reactions = message.reactions.filter(r => r.user.toString() !== userId);
        message.reactions.push({ user: userId, emoji });
        await message.save();
        
        io.to(`group_${groupId}`).emit('group_message_reaction', { messageId, groupId, reactions: message.reactions });
      }
    } catch (err) {
      console.error('Group Reaction Error:', err);
    }
  });

  socket.on('edit_group_message', async (data) => {
    const { messageId, groupId, content } = data;
    try {
      const message = await Message.findByIdAndUpdate(messageId, { 
        content, 
        isEdited: true,
        editedAt: new Date()
      }, { new: true });
      if (message) {
        io.to(`group_${groupId}`).emit('group_message_edited', { messageId, groupId, content, editedAt: message.editedAt });
      }
    } catch (err) {
      console.error('Edit Group Message Error:', err);
    }
  });

  socket.on('delete_group_message', async (data) => {
    const { messageId, groupId, type } = data;
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      if (type === 'me') {
        message.deletedForMe.push(socket.userId);
        await message.save();
      } else {
        message.deletedForEveryone = true;
        message.content = 'This message was deleted';
        message.fileName = null;
        message.fileSize = null;
        message.type = 'text';
        await message.save();
        io.to(`group_${groupId}`).emit('group_message_deleted', { messageId, groupId, type: 'everyone' });
      }
    } catch (err) {
      console.error('Delete Group Message Error:', err);
    }
  });

  // Active Calls tracking Map (Session key -> Call metadata)
  const activeCalls = new Map();

  const getUserIdStr = (userObj) => {
    if (!userObj) return null;
    if (typeof userObj === 'string') return userObj;
    if (userObj._id) return userObj._id.toString();
    if (userObj.id) return userObj.id.toString();
    return userObj.toString();
  };

  const createCallLogMessage = async (senderId, receiverId, callType, callStatus, duration = 0) => {
    try {
      const formattedType = callType === 'video' ? 'Video Call' : 'Voice Call';
      let content = '';
      if (callStatus === 'missed') {
        content = `Missed ${formattedType}`;
      } else if (callStatus === 'declined') {
        content = `Declined ${formattedType}`;
      } else {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        const durationStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
        content = `${formattedType} • ${durationStr}`;
      }

      const newMessage = new Message({
        sender: senderId,
        receiver: receiverId,
        content,
        type: 'call',
        callDetails: {
          callType,
          status: callStatus,
          duration
        }
      });

      await newMessage.save();

      const populatedLog = await Message.findById(newMessage._id)
        .populate('sender', 'name username email avatar')
        .populate('receiver', 'name username email avatar');

      const messageData = {
        _id: newMessage._id,
        sender: senderId,
        senderName: populatedLog?.sender?.username || populatedLog?.sender?.name || 'User',
        senderAvatar: populatedLog?.sender?.avatar,
        receiver: receiverId,
        content,
        type: 'call',
        callDetails: newMessage.callDetails,
        createdAt: newMessage.createdAt,
        status: newMessage.status,
        reactions: []
      };

      io.to(receiverId.toString()).emit('receive_message', messageData);
      io.to(senderId.toString()).emit('message_sent', messageData);

      // Emit real-time call log update to both caller and receiver
      if (populatedLog) {
        io.to(senderId.toString()).emit('receive_call_log', populatedLog);
        io.to(receiverId.toString()).emit('receive_call_log', populatedLog);
        io.to(senderId.toString()).emit('receive-call-log', populatedLog);
        io.to(receiverId.toString()).emit('receive-call-log', populatedLog);
        io.to(senderId.toString()).emit('update-call-history', populatedLog);
        io.to(receiverId.toString()).emit('update-call-history', populatedLog);
      }
    } catch (err) {
      console.error('Error logging call message:', err);
    }
  };

  // WebRTC Signaling Handlers
  socket.on('call_user', (data) => {
    const { userToCall, signalData, from, callerName, callerAvatar, callType } = data;
    const callerId = getUserIdStr(from) || socket.userId?.toString();
    const receiverId = getUserIdStr(userToCall);

    console.log(`[WebRTC] Incoming call signal from ${callerId} to ${receiverId} (${callType})`);
    
    if (!callerId || !receiverId) return;

    // Check if target user is already engaged in another call
    let isTargetBusy = false;
    for (const [_, activeCall] of activeCalls.entries()) {
      if (activeCall.caller === receiverId || activeCall.receiver === receiverId) {
        isTargetBusy = true;
        break;
      }
    }

    if (isTargetBusy) {
      console.log(`[WebRTC] Target user ${receiverId} is busy on another call`);
      socket.emit('user_busy', { message: 'User is on another call' });
      return;
    }

    const key = `${callerId}_${receiverId}`;
    
    // Set 35-second ringing timeout (only fires if NOT answered)
    const timeoutId = setTimeout(async () => {
      const currentCall = activeCalls.get(key);
      if (currentCall && !currentCall.answered) {
        console.log(`[WebRTC] Call timed out (35s) for key ${key}`);
        activeCalls.delete(key);
        io.to(callerId).emit('call_timeout');
        io.to(receiverId).emit('call_timeout');
        await createCallLogMessage(currentCall.caller, currentCall.receiver, currentCall.callType, 'missed', 0);
      }
    }, 35000);

    activeCalls.set(key, {
      caller: callerId,
      receiver: receiverId,
      callType: callType || 'video',
      startTime: Date.now(),
      answered: false,
      answeredTime: null,
      timeoutId
    });

    io.to(receiverId).emit('incoming_call', {
      signal: signalData,
      from: callerId,
      callerName,
      callerAvatar,
      callType
    });

    io.to(`group_${receiverId}`).emit('incoming_call', {
      signal: signalData,
      from: callerId,
      callerName,
      callerAvatar,
      callType
    });
  });

  socket.on('answer_call', (data) => {
    const { to, signal } = data;
    const calleeId = socket.userId?.toString();
    const callerId = getUserIdStr(to);

    console.log(`[WebRTC] Call answered by ${calleeId} for caller ${callerId}`);
    
    // Search active calls by matching caller and receiver pair
    for (const [key, call] of activeCalls.entries()) {
      if (
        (call.caller === callerId && call.receiver === calleeId) ||
        (call.caller === calleeId && call.receiver === callerId)
      ) {
        call.answered = true;
        call.answeredTime = Date.now();
        if (call.timeoutId) {
          clearTimeout(call.timeoutId);
          call.timeoutId = null;
        }
        console.log(`[WebRTC] 35s ringing timeout successfully cleared for active call key: ${key}`);
      }
    }

    // Dismiss incoming call modal on other tabs of the recipient
    if (calleeId) socket.to(calleeId).emit('dismiss_incoming_call');

    if (callerId) {
      io.to(callerId).emit('call_accepted', { signal });
      io.to(callerId).emit('call-accepted', { signal });
      io.to(callerId).emit('call_answered', { signal });
      io.to(callerId).emit('call-answered', { signal });
    }
  });

  socket.on('ice_candidate', (data) => {
    const { to, candidate } = data;
    const targetId = getUserIdStr(to);
    if (targetId) io.to(targetId).emit('ice_candidate', { candidate });
  });

  socket.on('end_call', async (data) => {
    const { to } = data;
    if (!to) return;

    const currentId = socket.userId?.toString();
    const targetId = getUserIdStr(to);

    console.log(`[WebRTC] Call ended signal sent between ${currentId} and ${targetId}`);
    if (targetId) io.to(targetId).emit('call_ended');

    for (const [key, call] of activeCalls.entries()) {
      if (
        (call.caller === currentId && call.receiver === targetId) ||
        (call.caller === targetId && call.receiver === currentId)
      ) {
        if (call.timeoutId) {
          clearTimeout(call.timeoutId);
          call.timeoutId = null;
        }
        activeCalls.delete(key);

        if (call.answered && call.answeredTime) {
          const duration = Math.max(1, Math.round((Date.now() - call.answeredTime) / 1000));
          await createCallLogMessage(call.caller, call.receiver, call.callType, 'completed', duration);
        } else {
          await createCallLogMessage(call.caller, call.receiver, call.callType, 'missed', 0);
        }
      }
    }
  });

  socket.on('reject_call', async (data) => {
    const { to } = data;
    if (!to) return;

    const currentId = socket.userId?.toString();
    const targetId = getUserIdStr(to);

    console.log(`[WebRTC] Call rejected signal sent between ${currentId} and ${targetId}`);
    if (targetId) io.to(targetId).emit('call_rejected');
    
    if (currentId) socket.to(currentId).emit('dismiss_incoming_call');

    for (const [key, call] of activeCalls.entries()) {
      if (
        (call.caller === currentId && call.receiver === targetId) ||
        (call.caller === targetId && call.receiver === currentId)
      ) {
        if (call.timeoutId) {
          clearTimeout(call.timeoutId);
          call.timeoutId = null;
        }
        activeCalls.delete(key);
        await createCallLogMessage(call.caller, call.receiver, call.callType, 'declined', 0);
      }
    }
  });

  socket.on('toggle_media', (data) => {
    const { to, isMuted, isVideoOff } = data;
    const targetId = getUserIdStr(to);
    if (targetId) {
      io.to(targetId).emit('peer_media_toggle', { isMuted, isVideoOff });
    }
  });
});

// 404 Undefined Route Handler
app.use((req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`, 'EXPRESS_ROUTER'));
});

// Global Error Handler Middleware (Must be registered after all routes)
app.use(errorMiddleware);

// Process Exception & Rejection Handlers
process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED_PROMISE_REJECTION', reason.message || 'Unhandled Promise Rejection', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT_EXCEPTION', err.message || 'Uncaught Exception', err);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info('EXPRESS_SERVER', `Server running on port ${PORT}`);
});
