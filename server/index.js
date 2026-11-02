const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const Message = require('./models/Message');
const User = require('./models/User');
const ApiError = require('./utils/ApiError');
const logger = require('./utils/logger');
const errorMiddleware = require('./middleware/errorMiddleware');
const { createAndSendNotification } = require('./utils/notify');
const {
  initRedis,
  addUserSocket,
  removeUserSocket,
  getUserSocketCount,
  isUserOnline,
  saveActiveCall,
  getActiveCall,
  findCallByParticipant,
  findAllCallsForUser,
  updateActiveCall,
  removeActiveCall,
  setLocalCallTimer,
  clearLocalCallTimer,
  closeRedis
} = require('./utils/redis');
const { broadcastUserPresence } = require('./utils/presence');
const observabilityMiddleware = require('./middleware/observabilityMiddleware');
const healthRoutes = require('./routes/healthRoutes');
const { initRagQueue, closeRagQueue } = require('./config/queue');
const { startRagWorker, closeRagWorker } = require('./workers/ragWorker');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
].filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Attach socket.io server instance to app
app.set('io', io);

// Mount Redis cluster adapter and pub/sub synchronization
initRedis(io).catch((err) => {
  logger.warn('REDIS_INIT_FAIL', `Redis adapter initialization error: ${err.message}`);
});

// Initialize BullMQ RAG Queue & Background Workers [B-06]
initRagQueue().then(() => {
  startRagWorker(io);
}).catch((err) => {
  logger.warn('RAG_QUEUE_INIT_WARN', `RAG Queue startup warning: ${err.message}`);
  startRagWorker(io);
});

// Observability Middleware: Distributed Correlation ID & Performance Latency Tracing [Phase 6 - Step 6.4]
app.use(observabilityMiddleware);

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Liveness & Readiness Health Probes [Phase 6 - Step 6.3]
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);

// DB Connection with tuned connection pooling for high-concurrency resilience
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 50,              // Maintain up to 50 active socket connections
      minPoolSize: 10,              // Pre-warm pool with 10 connections for rapid burst handling
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of default 30s to fail fast
      socketTimeoutMS: 45000,       // Close idle sockets after 45s
    });
    console.log(`MongoDB Connected: ${conn.connection.host} (Pool Size: 10-50 connections)`);
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
app.use('/api/auth',    require('./routes/authRoutes'));
app.use('/api/notes',   require('./routes/noteRoutes'));
app.use('/api/users',   require('./routes/userRoutes'));
app.use('/api/chat',    require('./routes/chatRoutes'));
app.use('/api/groups',  require('./routes/groupRoutes'));
app.use('/api/ai',      require('./routes/aiRoutes'));
app.use('/api/rag',     require('./routes/ragRoutes'));
app.use('/api/devices',       require('./routes/deviceRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/webrtc',        require('./routes/webrtcRoutes'));

app.get('/', (req, res) => {
  res.send('Talk Sphere API is running');
});

// Helper: Extract user ID string
const getUserIdStr = (userObj) => {
  if (!userObj) return null;
  if (typeof userObj === 'string') return userObj;
  if (userObj._id) return userObj._id.toString();
  if (userObj.id) return userObj.id.toString();
  return userObj.toString();
};

// Hoisted Helper: Create and persist call log message across cluster instances [B-03]
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
      senderName: populatedLog?.sender?.name || populatedLog?.sender?.username || 'User',
      senderUsername: populatedLog?.sender?.username || '',
      senderAvatar: populatedLog?.sender?.avatar,
      receiver: receiverId,
      content,
      type: 'call',
      callDetails: newMessage.callDetails,
      createdAt: newMessage.createdAt,
      status: newMessage.status,
      reactions: []
    };

    // Emit to both receiver and sender so active chat view updates immediately
    io.to(receiverId.toString()).emit('receive_message', messageData);
    io.to(senderId.toString()).emit('receive_message', messageData);
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

    // If missed or declined call, trigger a notification for the receiver
    if (callStatus === 'missed' || callStatus === 'declined') {
      const callerName = populatedLog?.sender?.name || populatedLog?.sender?.username || 'A contact';
      createAndSendNotification(io, {
        recipientId: receiverId,
        senderId,
        type: 'call_missed',
        title: `Missed ${formattedType}`,
        message: `You missed a ${callType} call from ${callerName}.`,
        data: {
          callerId: senderId,
          callType,
          callerName,
          callerAvatar: populatedLog?.sender?.avatar
        },
        actionType: 'open_chat'
      });
    }
  } catch (err) {
    console.error('Error logging call message:', err);
  }
};

// JWT Authentication Middleware for Sockets (With Production Synthetic Isolation)
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    console.warn(`Socket connection rejected: No token provided (socket ID: ${socket.id})`);
    return next(new Error('Authentication error: No token provided'));
  }
  
  try {
    // 1. Synthetic Load-Test Token Guardrail
    try {
      const testDecoded = jwt.verify(token, 'talksphere-isolated-load-test-secret-do-not-use-in-prod');
      if (testDecoded) {
        if (process.env.NODE_ENV === 'production') {
          return next(new Error('Authentication error: Synthetic load-test credentials strictly forbidden in production'));
        }
        if (process.env.ALLOW_SYNTHETIC_TOKENS === 'true') {
          socket.userId = testDecoded.id;
          socket.isSynthetic = true;
          return next();
        }
      }
    } catch (testErr) {}

    // 2. Strict Verification against Production JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.isSyntheticLoadTest && process.env.NODE_ENV === 'production') {
      return next(new Error('Authentication error: Synthetic load-test credentials strictly forbidden in production'));
    }

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
      socket.join(`user:${userId}`);
      
      // Update multi-tab connection set via Redis store [B-01, B-04]
      const totalTabs = await addUserSocket(userId, socket.id);
      
      console.log(`>>> Socket Connection: User ${userId} joined room. Total tabs: ${totalTabs}`);
      
      // Only mark online and emit change if this is their first connection across any cluster instance
      if (totalTabs === 1) {
        await User.findByIdAndUpdate(userId, { isOnline: true });
        await broadcastUserPresence(io, userId, true);
        console.log(`User ${userId} is now online (scoped presence broadcast)`);
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
    const { senderId, receiverId, content, type, repliedTo, fileName, fileSize, isForwarded, tempId, gifPayload } = data;
    const finalSenderId = senderId || socket.userId;
    
    if (!finalSenderId) return console.error('No sender ID provided for message');

    // Prevent saving client-local blob: URLs into the database
    if (content && typeof content === 'string' && content.startsWith('blob:')) {
      console.warn('Rejected send_message with client-local blob URL from', finalSenderId);
      socket.emit('message_error', { tempId, message: 'Invalid media URL. Please re-upload the file.' });
      return;
    }

    try {
      const newMessage = new Message({
        sender: finalSenderId,
        receiver: receiverId,
        content: content || (type === 'gif' ? (gifPayload?.url || 'GIF') : ''),
        type: type || 'text',
        gifPayload: gifPayload || null,
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
        senderName: sender?.name || sender?.username || 'User',
        senderUsername: sender?.username || '',
        senderAvatar: sender?.avatar,
        receiver: receiverId,
        content: newMessage.content,
        type: newMessage.type,
        gifPayload: newMessage.gifPayload,
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
      // Remove socket session from Redis/in-memory store [B-01, B-04]
      const remainingSocketsCount = await removeUserSocket(userId, socket.id);

      // Clean up any active call in progress for this disconnected user [B-03]
      const userCalls = await findAllCallsForUser(userId, socket.id);
      for (const { key, call } of userCalls) {
        const isCallSocket = (call.callerSocketId === socket.id || call.receiverSocketId === socket.id);
        const isUserParticipant = (call.caller === userId || call.receiver === userId);

        if (isCallSocket || (isUserParticipant && remainingSocketsCount === 0)) {
          console.log(`[WebRTC] Socket ${socket.id} (User ${userId}) disconnected during active call (key: ${key})`);
          await removeActiveCall(key);

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

      console.log(`Socket disconnected: ${socket.id} for User ${userId}. Remaining tabs: ${remainingSocketsCount}`);

      // If user has no active sockets remaining across all clusters, mark offline [B-02]
      if (remainingSocketsCount === 0) {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, { 
          isOnline: false, 
          lastSeen 
        });
        
        await broadcastUserPresence(io, userId, false, lastSeen);
        console.log(`User ${userId} disconnected and is now offline (scoped presence broadcast)`);
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
    const { groupId, content, type, repliedTo, fileName, fileSize, isForwarded, tempId, gifPayload } = data;
    const finalSenderId = socket.userId;
    if (!finalSenderId || !groupId) return console.error('Missing sender or groupId');

    // Prevent saving client-local blob: URLs into the database
    if (content && typeof content === 'string' && content.startsWith('blob:')) {
      console.warn('Rejected send_group_message with client-local blob URL from', finalSenderId);
      socket.emit('message_error', { tempId, message: 'Invalid media URL. Please re-upload the file.' });
      return;
    }

    try {
      const newMessage = new Message({
        sender: finalSenderId,
        group: groupId,
        isGroup: true,
        content: content || (type === 'gif' ? (gifPayload?.url || 'GIF') : ''),
        type: type || 'text',
        gifPayload: gifPayload || null,
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
        content: newMessage.content,
        type: newMessage.type,
        gifPayload: newMessage.gifPayload,
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

  // WebRTC Signaling Handlers (Cluster-coordinated via Redis store) [B-03]
  socket.on('call_user', async (data) => {
    const { userToCall, signalData, from, callerName, callerAvatar, callType } = data || {};
    const callerId = getUserIdStr(from) || socket.userId?.toString();
    const receiverId = getUserIdStr(userToCall);

    console.log(`[WebRTC] Incoming call signal from ${callerId} to ${receiverId} (${callType})`);
    
    if (!callerId || !receiverId) return;

    // Check if target user is already engaged in another call across any cluster node
    const activeCall = await findCallByParticipant(receiverId);
    if (activeCall) {
      console.log(`[WebRTC] Target user ${receiverId} is busy on another call`);
      socket.emit('user_busy', { message: 'User is on another call' });
      return;
    }

    const key = `${callerId}_${receiverId}`;
    
    // Clear any previous call state for this pair if it exists
    await removeActiveCall(key);

    // Set 35-second ringing timeout (only fires if call is NOT answered)
    const timeoutId = setTimeout(async () => {
      const currentCall = await getActiveCall(key);
      if (currentCall && !currentCall.answered) {
        console.log(`[WebRTC] Call timed out (35s) for key ${key}`);
        await removeActiveCall(key);
        io.to(callerId).emit('call_timeout');
        io.to(receiverId).emit('call_timeout');
        await createCallLogMessage(currentCall.caller, currentCall.receiver, currentCall.callType, 'missed', 0);
      }
    }, 35000);

    setLocalCallTimer(key, timeoutId);

    await saveActiveCall(key, {
      caller: callerId,
      receiver: receiverId,
      callerSocketId: socket.id,
      receiverSocketId: null,
      callType: callType || 'video',
      startTime: Date.now(),
      answered: false,
      answeredTime: null
    });

    io.to(receiverId).emit('incoming_call', {
      signal: signalData,
      from: callerId,
      callerName,
      callerAvatar,
      callType
    });
  });

  socket.on('answer_call', async (data) => {
    const { to, signal, from } = data || {};
    const calleeId = getUserIdStr(from) || socket.userId?.toString();
    const callerId = getUserIdStr(to);

    console.log(`[WebRTC] Call answered by callee ${calleeId} for caller ${callerId}`);
    
    // Search active calls by matching caller and receiver pair and clear ringing timeout immediately
    const matched = await findAllCallsForUser(callerId);
    for (const { key, call } of matched) {
      const matchPair = (call.caller === callerId && call.receiver === calleeId) ||
                        (call.caller === calleeId && call.receiver === callerId);
      const matchCaller = (call.caller === callerId || call.receiver === callerId);
      const matchCallee = calleeId && (call.caller === calleeId || call.receiver === calleeId);

      if (matchPair || matchCaller || matchCallee) {
        clearLocalCallTimer(key);
        await updateActiveCall(key, {
          answered: true,
          answeredTime: Date.now(),
          receiverSocketId: socket.id
        });
        console.log(`[WebRTC] 35s ringing timeout successfully cleared for active call key: ${key}`);
      }
    }

    // Dismiss incoming call modal on other tabs of the recipient
    if (calleeId) socket.to(calleeId).emit('dismiss_incoming_call');

    // Emit single canonical event to caller with remote answer signal
    if (callerId) {
      io.to(callerId).emit('call_accepted', { signal, from: calleeId });
    }
  });

  socket.on('ice_candidate', (data) => {
    const { to, candidate } = data || {};
    const targetId = getUserIdStr(to);
    if (targetId && candidate) io.to(targetId).emit('ice_candidate', { candidate });
  });

  socket.on('end_call', async (data) => {
    const { to, from } = data || {};
    if (!to) return;

    const currentId = getUserIdStr(from) || socket.userId?.toString();
    const targetId = getUserIdStr(to);

    console.log(`[WebRTC] Call ended signal sent between ${currentId} and ${targetId}`);
    if (targetId) io.to(targetId).emit('call_ended');

    const matched = await findAllCallsForUser(targetId);
    for (const { key, call } of matched) {
      const matchPair = (call.caller === currentId && call.receiver === targetId) ||
                        (call.caller === targetId && call.receiver === currentId);
      const matchTarget = (call.caller === targetId || call.receiver === targetId);
      const matchCurrent = currentId && (call.caller === currentId || call.receiver === currentId);

      if (matchPair || matchTarget || matchCurrent) {
        await removeActiveCall(key);

        if (call.answered) {
          const duration = call.answeredTime ? Math.max(1, Math.round((Date.now() - call.answeredTime) / 1000)) : 1;
          await createCallLogMessage(call.caller, call.receiver, call.callType, 'completed', duration);
        } else {
          await createCallLogMessage(call.caller, call.receiver, call.callType, 'missed', 0);
        }
      }
    }
  });

  socket.on('reject_call', async (data) => {
    const { to, from } = data || {};
    if (!to) return;

    const currentId = getUserIdStr(from) || socket.userId?.toString();
    const targetId = getUserIdStr(to);

    console.log(`[WebRTC] Call rejected signal sent between ${currentId} and ${targetId}`);
    if (targetId) io.to(targetId).emit('call_rejected');
    
    if (currentId) socket.to(currentId).emit('dismiss_incoming_call');

    const matched = await findAllCallsForUser(targetId);
    for (const { key, call } of matched) {
      const matchPair = (call.caller === currentId && call.receiver === targetId) ||
                        (call.caller === targetId && call.receiver === currentId);
      const matchTarget = (call.caller === targetId || call.receiver === targetId);
      const matchCurrent = currentId && (call.caller === currentId || call.receiver === currentId);

      if (matchPair || matchTarget || matchCurrent) {
        await removeActiveCall(key);
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

  // LiveKit SFU Multi-Party Group Call Broadcast [B-09]
  socket.on('group_call_started', (data) => {
    const { groupId, roomName, callType, from, callerName } = data || {};
    if (groupId) {
      console.log(`[WebRTC] Group SFU call initiated in group_${groupId} by ${callerName} (${from})`);
      socket.to(`group_${groupId}`).emit('incoming_group_call', {
        groupId,
        roomName,
        callType,
        from,
        callerName
      });
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

// Graceful Process Lifecycle Termination (Zero-Downtime Rolling Updates) [Phase 6 - Step 6.4]
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  app.set('isShuttingDown', true);

  logger.warn('PROCESS_TERMINATION', `Received ${signal}. Initiating graceful connection draining and teardown...`);

  // Fallback safety timeout: 10s maximum wait before forced exit
  const forceExitTimer = setTimeout(() => {
    logger.error('SHUTDOWN_TIMEOUT', 'Graceful shutdown timed out after 10000ms. Forcing process exit.');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    // 1. Stop accepting new HTTP requests
    await new Promise((resolve) => {
      server.close((err) => {
        if (err) logger.warn('SERVER_CLOSE_WARN', `HTTP server close notice: ${err.message}`);
        else logger.info('HTTP_SERVER_CLOSED', 'HTTP server stopped accepting new incoming requests.');
        resolve();
      });
    });

    // 2. Drain active Socket.io connections gracefully
    await new Promise((resolve) => {
      io.close((err) => {
        if (err) logger.warn('SOCKET_CLOSE_WARN', `Socket.io close notice: ${err.message}`);
        else logger.info('SOCKET_SERVER_CLOSED', 'Socket.io connections drained and closed.');
        resolve();
      });
    });

    // 3. Drain BullMQ background workers & queue instances
    await closeRagWorker();
    await closeRagQueue();

    // 4. Close Mongoose connection pool cleanly
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close(false);
      logger.info('MONGOOSE_CLOSED', 'Mongoose connection pool drained and closed.');
    }

    // 5. Close Redis clients (pub, sub, and data)
    await closeRedis();

    logger.info('SHUTDOWN_COMPLETE', 'All subsystem resources cleanly released. Graceful exit (0).');
    process.exit(0);
  } catch (shutdownErr) {
    logger.error('SHUTDOWN_ERROR', `Error during graceful shutdown: ${shutdownErr.message}`, shutdownErr);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info('EXPRESS_SERVER', `Server running on port ${PORT}`);
});
