const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { ragUpload } = require('../middleware/ragUpload');
const { ragUploadLimiter, ragQueryLimiter } = require('../middleware/rateLimiter');
const {
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  clearRagHistory,
  streamRagQuery
} = require('../controllers/ragController');

// RAG Routes with disk staging and tiered rate limiting [B-08, B-14]
router.post('/upload', protect, ragUploadLimiter, ragUpload.single('file'), uploadDocument);
router.get('/documents', protect, getDocuments);
router.get('/documents/:id', protect, getDocumentById);
router.delete('/documents/:id', protect, deleteDocument);
router.post('/clear-history', protect, clearRagHistory);
router.post('/stream', protect, ragQueryLimiter, streamRagQuery);

module.exports = router;

