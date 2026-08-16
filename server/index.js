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


});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
