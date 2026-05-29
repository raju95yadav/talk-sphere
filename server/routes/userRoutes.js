const express = require('express');
const router = express.Router();
const { getProfile, updateAvatar, updateProfile, getUserStats, getAllUsers, hideUser } = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { upload } = require('../utils/cloudinary');

router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/stats', getUserStats);
router.get('/', getAllUsers);
router.post('/hide/:userId', hideUser);

// Protected route with error handling for avatar upload
router.post('/avatar', protect, (req, res, next) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      console.error('Multer/Cloudinary Error:', err);
      return res.status(500).json({ message: 'Upload failed: ' + err.message });
    }
    next();
  });
}, updateAvatar);

module.exports = router;
