const { AccessToken } = require('livekit-server-sdk');
const logger = require('../utils/logger');
const { getLiveKitConfig } = require('../config/livekit');

/**
 * Generate a cryptographically signed LiveKit SFU Access Token [B-09]
 * Grants multi-party room publishing and subscription permissions with O(N) forwarding.
 *
 * @param {object} options
 * @param {string} options.userId - Unique user identity
 * @param {string} options.userName - Display name
 * @param {string} options.roomName - SFU target room name
 * @param {boolean} [options.canPublish=true] - Whether client can publish media
 * @param {boolean} [options.canSubscribe=true] - Whether client can subscribe to tracks
 * @returns {Promise<{ token: string, serverUrl: string, roomName: string }>}
 */
const generateLiveKitToken = async ({
  userId,
  userName = 'Participant',
  roomName,
  canPublish = true,
  canSubscribe = true
}) => {
  if (!roomName) {
    throw new Error('Room name is required to generate LiveKit SFU access token');
  }

  const { apiKey, apiSecret, serverUrl } = getLiveKitConfig();

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId.toString(),
    name: userName || 'Participant',
    ttl: '2h' // 2-hour token window
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish,
    canSubscribe,
    canPublishData: true
  });

  const token = await at.toJwt();
  logger.info('LIVEKIT_TOKEN_ISSUED', `SFU access token issued for user ${userId} in room ${roomName}`);

  return {
    token,
    serverUrl,
    roomName,
    identity: userId.toString()
  };
};

module.exports = {
  generateLiveKitToken,
  getLiveKitConfig,
  get LIVEKIT_URL() {
    return getLiveKitConfig().serverUrl;
  },
  get LIVEKIT_API_KEY() {
    return getLiveKitConfig().apiKey;
  }
};

