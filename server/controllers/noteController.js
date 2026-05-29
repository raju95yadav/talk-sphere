const Note = require('../models/Note');
const User = require('../models/User');
const Message = require('../models/Message');

exports.getNotes = async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notes' });
  }
};

exports.createNote = async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const note = await Note.create({
      user: req.user._id,
      title,
      content
    });

    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('note_created', note);
    }

    res.status(201).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Error creating note' });
  }
};

exports.updateNote = async (req, res) => {
  try {
    const { title, content } = req.body;
    const note = await Note.findById(req.params.id);

    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    note.title = title !== undefined ? title : note.title;
    note.content = content !== undefined ? content : note.content;
    await note.save();

    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('note_updated', note);
    }

    res.status(200).json(note);
  } catch (error) {
    res.status(500).json({ message: 'Error updating note' });
  }
};

exports.deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) return res.status(404).json({ message: 'Note not found' });
    if (note.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const noteId = note._id;
    await note.deleteOne();

    const io = req.app.get('io');
    if (io) {
      io.to(req.user._id.toString()).emit('note_deleted', noteId);
    }

    res.status(200).json({ message: 'Note removed' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting note' });
  }
};

exports.shareNote = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Verify ownership
    if (note.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized to share this note' });
    }

    // Find target user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Create a copy for the target user
    const sharedNote = await Note.create({
      user: targetUserId,
      title: `[Shared] ${note.title}`,
      content: note.content
    });

    const io = req.app.get('io');
    if (io) {
      io.to(targetUserId.toString()).emit('note_created', sharedNote);
    }

    // Create chat notification message
    const newMessage = await Message.create({
      sender: req.user._id,
      receiver: targetUserId,
      content: `📝 Shared a note:\n\n**${note.title}**\n${note.content || ''}`,
      type: 'text',
      status: 'sent'
    });

    if (io) {
      const messageData = {
        _id: newMessage._id,
        sender: req.user._id.toString(),
        receiver: targetUserId.toString(),
        content: newMessage.content,
        type: newMessage.type,
        repliedTo: null,
        fileName: null,
        fileSize: null,
        isForwarded: false,
        createdAt: newMessage.createdAt,
        status: newMessage.status
      };
      io.to(targetUserId.toString()).emit('receive_message', messageData);
      io.to(req.user._id.toString()).emit('message_sent', messageData);
    }

    res.status(200).json({ message: 'Note shared successfully', sharedNote });
  } catch (error) {
    console.error('Share Note Error:', error);
    res.status(500).json({ message: 'Error sharing note' });
  }
};

