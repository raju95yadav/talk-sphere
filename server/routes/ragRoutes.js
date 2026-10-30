const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const {
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  clearRagHistory,
  streamRagQuery
} = require('../controllers/ragController');

// Multer memory storage with 25MB file size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

router.post('/upload', protect, upload.single('file'), uploadDocument);
router.get('/documents', protect, getDocuments);
router.get('/documents/:id', protect, getDocumentById);
router.delete('/documents/:id', protect, deleteDocument);
router.post('/clear-history', protect, clearRagHistory);
router.post('/stream', protect, streamRagQuery);

module.exports = router;

