const crypto = require('crypto');
const logger = require('../utils/logger');

// Environment configurations with production defaults
const TURN_SECRET = process.env.TURN_STATIC_SECRET || process.env.COTURN_STATIC_SECRET || 'talksphere_turn_secret_2026_super_secure_key';
const TURN_HOST = process.env.TURN_HOST || '127.0.0.1';
const TURN_PORT = process.env.TURN_PORT || 3478;
const TURNS_PORT = process.env.TURNS_PORT || 5349;

// Default STUN servers
const DEFAULT_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

/**
 * Generate ephemeral HMAC-SHA1 Coturn credentials [B-10]
 * Implements the TURN REST API time-windowed credential mechanism.
 *
 * @param {string} userId - User identifier
 * @param {number} [ttlSeconds=86400] - Credential lifetime in seconds (default: 24h)
 * @returns {object} { username, credential, ttl, expiry }
 */
const generateTurnCredentials = (userId, ttlSeconds = 86400) => {
  const expiryTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiryTimestamp}:${userId}`;

  const hmac = crypto.createHmac('sha1', TURN_SECRET);
  hmac.update(username);
  const credential = hmac.digest('base64');

  return {
    username,
    credential,
    ttl: ttlSeconds,
    expiry: new Date(expiryTimestamp * 1000)
  };
};

/**
 * Get complete ICE servers configuration with STUN and ephemeral TURN credentials [B-10]
 *
 * @param {string} userId - Authenticated user ID
 * @returns {Array<object>} ICE servers array suitable for RTCPeerConnection
 */
const getIceServers = (userId = 'guest') => {
  try {
    const { username, credential } = generateTurnCredentials(userId);

    const turnServers = [
      // Fast path: UDP Relay
      {
        urls: [
          `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`,
          `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`
        ],
        username,
        credential
      },
      // Secure fallback: TLS / TURNS over TCP port 5349 (circumvents restrictive corporate firewalls)
      {
        urls: [
          `turns:${TURN_HOST}:${TURNS_PORT}?transport=tcp`
        ],
        username,
        credential
      }
    ];

    return [
      ...DEFAULT_STUN_SERVERS,
      ...turnServers
    ];
  } catch (err) {
    logger.warn('TURN_CREDENTIAL_ERROR', `Failed to generate TURN credentials: ${err.message}. Falling back to STUN.`);
    return DEFAULT_STUN_SERVERS;
  }
};

module.exports = {
  generateTurnCredentials,
  getIceServers,
  DEFAULT_STUN_SERVERS
};

