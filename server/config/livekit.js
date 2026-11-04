const logger = require('../utils/logger');

const BANNED_DEV_KEYS = [
  'devkey',
  'secret',
  'talksphere_api_key',
  'talksphere_api_secret_key_2026',
  'talksphere_secret'
];

/**
 * Validates and retrieves LiveKit credentials.
 * In production:
 *   - Both LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be provided.
 *   - Neither can match known development/insecure fallback strings.
 * In development / test:
 *   - Falls back gracefully with warning if keys are missing or using dev defaults.
 *
 * @returns {{ apiKey: string, apiSecret: string, serverUrl: string }}
 */
const getLiveKitConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const serverUrl = process.env.LIVEKIT_URL || (isProduction ? 'wss://livekit.talksphere.com' : 'ws://127.0.0.1:7880');

  if (isProduction) {
    if (!apiKey || !apiSecret) {
      const errorMsg = 'LIVEKIT_CONFIG_ERROR: LIVEKIT_API_KEY and LIVEKIT_API_SECRET are strictly required in production.';
      if (logger && logger.error) {
        logger.error('LIVEKIT_CONFIG_ERROR', errorMsg);
      }
      throw new Error(errorMsg);
    }

    if (BANNED_DEV_KEYS.includes(apiKey.toLowerCase()) || BANNED_DEV_KEYS.includes(apiSecret.toLowerCase())) {
      const errorMsg = 'LIVEKIT_CONFIG_ERROR: Banned development key detected in LIVEKIT_API_KEY or LIVEKIT_API_SECRET during production.';
      if (logger && logger.error) {
        logger.error('LIVEKIT_CONFIG_ERROR', errorMsg);
      }
      throw new Error(errorMsg);
    }

    return { apiKey, apiSecret, serverUrl };
  }

  // Development / Test mode
  if (!apiKey || !apiSecret) {
    if (logger && logger.warn) {
      logger.warn('LIVEKIT_DEV_CONFIG', 'LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set. Using local development fallback keys.');
    }
  }

  return {
    apiKey: apiKey || 'devkey_local_dev',
    apiSecret: apiSecret || 'secret_local_dev_key_only_for_testing',
    serverUrl
  };
};

module.exports = {
  getLiveKitConfig,
  BANNED_DEV_KEYS
};

