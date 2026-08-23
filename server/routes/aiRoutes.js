const express = require('express');
const router = express.Router();
const { 
  chatWithAI, 
  streamAIChat, 
  pingAI, 
  getAISessions, 
  createAISession, 
  updateAISession, 
  deleteAISession 
} = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

router.get('/ping', protect, pingAI);
router.post('/chat', protect, chatWithAI);
router.post('/stream', protect, streamAIChat);

// AI Sessions MongoDB CRUD Routes
router.get('/sessions', protect, getAISessions);
router.post('/sessions', protect, createAISession);
router.put('/sessions/:id', protect, updateAISession);
router.delete('/sessions/:id', protect, deleteAISession);

module.exports = router;


