const express = require('express');
const router = express.Router();
const multer = require('multer');
const { 
  addContact, 
  getContacts, 
  getChatHistory, 
  deleteMessage, 
  editMessage,
  getConversations,
  clearChat,
  searchMessages,
  getCallLogs
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');
const { chatMediaStorage } = require('../utils/cloudinary');
const uploadMedia = multer({ 
  storage: chatMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(protect);

router.post('/upload', (req, res) => {
  uploadMedia.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Transmission size exceeded (Max: 10MB)' });
      }
      return res.status(400).json({ message: `Upload Error: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ message: 'Secure Transmission Failed' });
    }

    if (!req.file) return res.status(400).json({ message: 'No file detected for transmission' });
    
    let type = 'file';
    if (req.file.mimetype.startsWith('image/')) type = 'image';
    else if (req.file.mimetype.startsWith('video/')) type = 'video';
    else if (req.file.mimetype.startsWith('audio/')) type = 'audio';
    else if (req.file.mimetype === 'application/pdf') type = 'file';
    
    res.json({ 
      url: req.file.path, 
      type,
      name: req.file.originalname,
      size: (req.file.size / 1024 / 1024).toFixed(2) + ' MB'
    });
  });
});

router.post('/contacts', addContact);
router.get('/contacts', getContacts);
router.get('/conversations', getConversations);
router.get('/call-logs', getCallLogs);
router.get('/history/:receiverId', getChatHistory);
router.get('/search/:receiverId', searchMessages);
router.patch('/message/:messageId', editMessage);
router.delete('/message/:messageId', deleteMessage);
router.delete('/clear/:receiverId', clearChat);

module.exports = router;
