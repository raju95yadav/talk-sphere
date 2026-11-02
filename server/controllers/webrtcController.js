const { getIceServers } = require('../services/turnService');
const { generateLiveKitToken } = require('../services/livekitService');
const logger = require('../utils/logger');

/**
 * 1. Fetch Dynamic ICE Servers with Ephemeral Coturn Credentials [B-10]
 * GET /api/webrtc/ice-servers
 */
exports.getIceServersController = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id || 'guest';
    const iceServers = getIceServers(userId);

    res.json({
      success: true,
      iceServers
    });
  } catch (err) {
    logger.error('WEBRTC_ICE_SERVERS_ERROR', err.message || err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate ICE servers',
      error: err.message
    });
  }
};

/**
 * 2. Issue LiveKit SFU Access Token for Multi-Party Video / Audio Rooms [B-09]
 * POST /api/webrtc/token
 */
exports.getLiveKitTokenController = async (req, res) => {
  try {
    const userId = req.user?._id?.toString() || req.user?.id;
    const userName = req.user?.name || req.user?.username || 'User';
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({
        success: false,
        message: 'roomName is required for SFU room token generation.'
      });
    }

    const tokenData = await generateLiveKitToken({
      userId,
      userName,
      roomName
    });

    res.json({
      success: true,
      ...tokenData
    });
  } catch (err) {
    logger.error('WEBRTC_SFU_TOKEN_ERROR', err.message || err);
    res.status(500).json({
      success: false,
      message: 'Failed to generate SFU room token',
      error: err.message
    });
  }
};

