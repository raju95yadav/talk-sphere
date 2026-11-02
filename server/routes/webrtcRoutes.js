const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getIceServersController,
  getLiveKitTokenController
} = require('../controllers/webrtcController');

// Dynamic ICE servers endpoint with Coturn HMAC-SHA1 credentials [B-10]
router.get('/ice-servers', protect, getIceServersController);

// LiveKit SFU access token endpoint for O(N) multi-party rooms [B-09]
router.post('/token', protect, getLiveKitTokenController);

module.exports = router;

