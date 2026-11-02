const { AccessToken } = require('livekit-server-sdk');
const logger = require('../utils/logger');

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'talksphere_api_key';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'talksphere_api_secret_key_2026';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';

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

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
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
    serverUrl: LIVEKIT_URL,
    roomName,
    identity: userId.toString()
  };
};

module.exports = {
  generateLiveKitToken,
  LIVEKIT_URL,
  LIVEKIT_API_KEY
};

