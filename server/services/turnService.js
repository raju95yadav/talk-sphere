const crypto = require('crypto');
const logger = require('../utils/logger');

const BANNED_TURN_SECRETS = [
  'devkey',
  'secret',
  'talksphere_secret',
  'talksphere_turn_dev_secret_2026',
  'talksphere_turn_secret_2026_super_secure_key'
];

/**
 * Resolve TURN secret key from environment
 */
const getTurnSecret = () => {
  const secret = process.env.TURN_SHARED_SECRET || process.env.TURN_SECRET || process.env.TURN_STATIC_SECRET || process.env.COTURN_STATIC_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TURN_SECRET is not configured in production environment.');
    }
    return 'talksphere_turn_dev_secret_2026';
  }

  if (process.env.NODE_ENV === 'production' && BANNED_TURN_SECRETS.includes(secret.toLowerCase())) {
    throw new Error('Insecure development default detected in TURN_SHARED_SECRET during production.');
  }

  return secret;
};

// Default STUN servers grouped in standard RTCIceServer format
const DEFAULT_STUN_SERVERS = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302'
    ]
  }
];

/**
 * Generate ephemeral HMAC-SHA1 Coturn credentials [B-10]
 * Implements the TURN REST API time-windowed credential mechanism.
 *
 * @param {string} userId - User identifier
 * @param {number} [ttlSeconds=7200] - Credential lifetime in seconds (default: 2 hours)
 * @returns {object} { username, credential, ttl, expiry }
 */
const generateTurnCredentials = (userId, ttlSeconds = 7200) => {
  const secret = getTurnSecret();
  const expiryTimestamp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiryTimestamp}:${userId}`;

  const hmac = crypto.createHmac('sha1', secret);
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
 * @param {number} [ttlSeconds=7200] - Ephemeral token lifetime (default: 2 hours)
 * @returns {Array<object>} ICE servers array suitable for RTCPeerConnection
 */
const getIceServers = (userId = 'guest', ttlSeconds = 7200) => {
  try {
    const { username, credential } = generateTurnCredentials(userId, ttlSeconds);

    const turnHost = process.env.TURN_HOST || '127.0.0.1';
    const turnPort = process.env.TURN_PORT || 3478;
    const turnsPort = process.env.TURNS_PORT || 5349;

    let turnServers = [];

    if (process.env.TURN_SERVER_URLS) {
      // Allow custom comma-separated list of TURN endpoints from env
      const customUrls = process.env.TURN_SERVER_URLS.split(',').map(u => u.trim()).filter(Boolean);
      turnServers.push({
        urls: customUrls,
        username,
        credential
      });
    } else {
      turnServers = [
        // Fast path: UDP Relay & TCP fallback
        {
          urls: [
            `turn:${turnHost}:${turnPort}?transport=udp`,
            `turn:${turnHost}:${turnPort}?transport=tcp`
          ],
          username,
          credential
        },
        // Secure fallback: TLS / TURNS over TCP port 5349 (circumvents restrictive corporate firewalls)
        {
          urls: [
            `turns:${turnHost}:${turnsPort}?transport=tcp`
          ],
          username,
          credential
        }
      ];
    }

    return [
      ...DEFAULT_STUN_SERVERS,
      ...turnServers
    ];
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('TURN_CREDENTIAL_ERROR', `Failed to generate TURN credentials in production: ${err.message}`);
      throw err; // Strict in production: never degrade silently to STUN
    }

    logger.warn('TURN_CREDENTIAL_ERROR', `Failed to generate TURN credentials: ${err.message}. Dev fallback to STUN.`);
    return DEFAULT_STUN_SERVERS;
  }
};

module.exports = {
  generateTurnCredentials,
  getIceServers,
  DEFAULT_STUN_SERVERS
};
