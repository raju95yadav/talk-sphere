const logger = require('../utils/logger');

const BANNED_DEV_SECRETS = new Set([
  'devkey',
  'secret',
  'talksphere_secret',
  'talksphere_api_key',
  'talksphere_api_secret_key_2026',
  'talksphere_turn_secret_2026_super_secure_key',
  'talksphere_turn_dev_secret_2026',
  'your_jwt_secret',
  'default_secret',
  'changeme',
  'password',
  '123456'
]);

/**
 * Validates environment variables for production security and integrity.
 * Halts process startup (exit code 1) in production if any validation fails.
 * Emits warnings in development/test.
 *
 * @param {object} [env=process.env] - Environment object to test
 * @param {boolean} [shouldExit=true] - Whether to call process.exit(1) on failure in production
 * @returns {{ isValid: boolean, errors: string[], warnings: string[] }}
 */
const validateEnv = (env = process.env, shouldExit = true) => {
  const isProduction = env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  // 1. JWT_SECRET
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET is missing or empty.');
  } else {
    if (BANNED_DEV_SECRETS.has(jwtSecret.toLowerCase())) {
      errors.push(`JWT_SECRET cannot be a known insecure default value ("${jwtSecret}").`);
    }
    if (jwtSecret.length < 32) {
      errors.push(`JWT_SECRET must be at least 32 characters in length for cryptographic security (got ${jwtSecret.length}).`);
    }
  }

  // 2. MONGODB_URI
  const mongoUri = env.MONGODB_URI;
  if (!mongoUri) {
    errors.push('MONGODB_URI is missing or empty.');
  } else if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    errors.push('MONGODB_URI must begin with "mongodb://" or "mongodb+srv://".');
  }

  // 3. REDIS_URL / REDIS_URI / REDIS_HOST
  const redisUri = env.REDIS_URL || env.REDIS_URI || env.REDIS_HOST;
  if (!redisUri) {
    errors.push('REDIS_URL or REDIS_URI is missing or empty.');
  }

  // 4. LIVEKIT_API_KEY & LIVEKIT_API_SECRET
  const livekitKey = env.LIVEKIT_API_KEY;
  const livekitSecret = env.LIVEKIT_API_SECRET;
  if (!livekitKey) {
    errors.push('LIVEKIT_API_KEY is missing or empty.');
  } else if (BANNED_DEV_SECRETS.has(livekitKey.toLowerCase())) {
    errors.push(`LIVEKIT_API_KEY cannot be a known development key ("${livekitKey}").`);
  }

  if (!livekitSecret) {
    errors.push('LIVEKIT_API_SECRET is missing or empty.');
  } else if (BANNED_DEV_SECRETS.has(livekitSecret.toLowerCase())) {
    errors.push('LIVEKIT_API_SECRET cannot be a known development secret.');
  }

  // 5. TURN_SHARED_SECRET
  const turnSecret = env.TURN_SHARED_SECRET || env.TURN_SECRET || env.TURN_STATIC_SECRET;
  if (!turnSecret) {
    errors.push('TURN_SHARED_SECRET (or TURN_SECRET) is missing or empty.');
  } else if (BANNED_DEV_SECRETS.has(turnSecret.toLowerCase())) {
    errors.push('TURN_SHARED_SECRET cannot be a known development default secret.');
  }

  const isValid = errors.length === 0;

  if (isProduction) {
    if (!isValid) {
      const header = '================ [CRITICAL] PRODUCTION ENVIRONMENT VALIDATION FAILED ================';
      const footer = '=====================================================================================';
      const formattedErrors = errors.map(e => ` - [VIOLATION] ${e}`).join('\n');
      const fullMessage = `\n${header}\n${formattedErrors}\nHalting server startup immediately to prevent credential leaks or insecure deployment.\n${footer}\n`;

      console.error(fullMessage);
      if (logger && logger.error) {
        logger.error('ENV_VALIDATION_FAILURE', fullMessage);
      }

      if (shouldExit) {
        process.exit(1);
      }
    } else {
      if (logger && logger.info) {
        logger.info('ENV_VALIDATION_SUCCESS', 'Production environment configuration validated successfully.');
      }
    }
  } else {
    // In development mode, capture violations as warnings
    if (!isValid) {
      warnings.push(...errors);
      if (logger && logger.warn) {
        logger.warn('ENV_DEV_WARNING', `Development environment running with ${warnings.length} unconfigured secrets. Non-production defaults active.`);
      }
    }
  }

  return {
    isValid: isProduction ? isValid : true,
    errors,
    warnings
  };
};

module.exports = {
  validateEnv,
  BANNED_DEV_SECRETS
};

