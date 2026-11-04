const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const logger = require('./logger');

// Custom Redis Error class for distributed state failures
class RedisConnectionError extends Error {
  constructor(message = 'Redis connection is down. Distributed operation unavailable.') {
    super(message);
    this.name = 'RedisConnectionError';
    this.statusCode = 503;
  }
}

// Connection options for resilient clustering
/**
 * Resolves Redis connection options from environment variables.
 * Supports:
 * - REDIS_URL or REDIS_URI (e.g. rediss://:password@host:6380, redis://host:6379)
 * - REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_USERNAME, REDIS_TLS
 * Enforces that in production, if connected to an external host (not localhost, 127.0.0.1, or redis container),
 * password authentication is required.
 */
const getRedisConnectionConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const rawUri = process.env.REDIS_URL || process.env.REDIS_URI;

  let host = process.env.REDIS_HOST;
  let port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined;
  let password = process.env.REDIS_PASSWORD;
  let username = process.env.REDIS_USERNAME;
  let tls = process.env.REDIS_TLS === 'true' ? {} : undefined;
  let finalUri = rawUri;

  if (rawUri) {
    try {
      const parsed = new URL(rawUri);
      host = parsed.hostname;
      port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'rediss:' ? 6380 : 6379);
      if (parsed.password) password = decodeURIComponent(parsed.password);
      if (parsed.username) username = decodeURIComponent(parsed.username);
      if (parsed.protocol === 'rediss:') {
        tls = tls || {};
      }
    } catch (e) {
      if (logger && logger.warn) {
        logger.warn('REDIS_URI_PARSE_ERROR', `Unable to parse REDIS_URL/REDIS_URI: ${e.message}`);
      }
    }
  } else {
    host = host || '127.0.0.1';
    port = port || 6379;
    finalUri = `redis://${host}:${port}`;
  }

  // Security Check for external production instances
  const internalHosts = ['localhost', '127.0.0.1', 'redis', 'talksphere-redis'];
  const isExternalHost = host && !internalHosts.includes(host.toLowerCase());

  if (isProduction && isExternalHost && !password) {
    const errorMsg = `REDIS_AUTH_ERROR: External production Redis host "${host}" requires password authentication.`;
    if (logger && logger.error) {
      logger.error('REDIS_AUTH_ERROR', errorMsg);
    }
    throw new RedisConnectionError(errorMsg);
  }

  const options = {
    host: host || '127.0.0.1',
    port: port || 6379,
    password: password || undefined,
    username: username || undefined,
    tls: tls,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    connectTimeout: 5000,
    retryStrategy: (times) => Math.min(times * 500, 10000)
  };

  return {
    uri: finalUri || `redis://${host}:${port}`,
    options,
    host,
    port,
    password,
    tls
  };
};

let pubClient = null;
let subClient = null;
let redisClient = null;
let isRedisReady = false;

// In-memory fallback stores strictly for development/test mode
const localSocketsMap = new Map(); // userId -> Set of socket IDs
const localActiveCallsMap = new Map(); // callKey -> call metadata
const localCallTimers = new Map(); // callKey -> local setTimeout ID

/**
 * Enforce that Redis is online in production.
 * Throws 503 RedisConnectionError if called in production while Redis is disconnected.
 */
const ensureRedisConnected = (operationName) => {
  if (process.env.NODE_ENV === 'production') {
    if (!isRedisReady || !redisClient || redisClient.status !== 'ready') {
      const msg = `RedisConnectionError: Redis is disconnected. Distributed operation "${operationName}" refused in production.`;
      logger.error('REDIS_PROD_ENFORCEMENT', msg);
      throw new RedisConnectionError(msg);
    }
  }
};

/**
 * Attach connection lifecycle events for observability and auto-reconnection
 */
const bindLifecycleEvents = (client, name) => {
  client.on('connect', () => {
    logger.info(`REDIS_${name}_CONNECT`, `Redis ${name} client connected.`);
  });

  client.on('ready', () => {
    logger.info(`REDIS_${name}_READY`, `Redis ${name} client ready to process commands.`);
    if (name === 'MAIN') isRedisReady = true;
  });

  client.on('reconnecting', (delay) => {
    logger.warn(`REDIS_${name}_RECONNECT`, `Redis ${name} client reconnecting in ${delay}ms...`);
  });

  client.on('error', (err) => {
    logger.error(`REDIS_${name}_ERROR`, `Redis ${name} client error: ${err.message}`);
  });

  client.on('close', () => {
    logger.warn(`REDIS_${name}_CLOSE`, `Redis ${name} client connection closed.`);
    if (name === 'MAIN') isRedisReady = false;
  });
};

/**
 * Initializes Redis clients and mounts the Socket.io Redis adapter.
 * Production: Strict check. Throws RedisConnectionError if connection fails.
 * Development: Falls back to in-memory mode with visible warning.
 *
 * @param {object} io - Socket.io Server instance
 * @returns {Promise<{ isRedisEnabled: boolean }>}
 */
const initRedis = async (io) => {
  try {
    const { uri, options } = getRedisConnectionConfig();
    pubClient = new Redis(options);
    subClient = new Redis(options);
    redisClient = new Redis(options);

    bindLifecycleEvents(pubClient, 'PUB');
    bindLifecycleEvents(subClient, 'SUB');
    bindLifecycleEvents(redisClient, 'MAIN');

    // Attempt connection with 3-second timeout
    await Promise.race([
      Promise.all([
        pubClient.connect(),
        subClient.connect(),
        redisClient.connect()
      ]),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timed out after 3000ms')), 3000))
    ]);

    isRedisReady = true;
    logger.info('REDIS_CLUSTER', `Connected to Redis at ${uri.replace(/:[^:@]+@/, ':***@')}. Multi-node synchronization active.`);

    // Mount @socket.io/redis-adapter
    if (io) {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('SOCKET_IO_ADAPTER', 'Socket.io Redis adapter successfully mounted for horizontal scaling.');
    }

    // Subscribe to cross-instance internal cluster coordination channel
    await subClient.subscribe('talksphere:cluster:events', (err) => {
      if (err) logger.warn('REDIS_SUB_CHANNEL_WARN', err.message);
    });

    subClient.on('message', (channel, message) => {
      if (channel === 'talksphere:cluster:events') {
        try {
          const { event, payload } = JSON.parse(message);
          handleClusterEvent(event, payload);
        } catch (e) {
          // Ignore malformed cluster messages
        }
      }
    });

    return { isRedisEnabled: true };
  } catch (err) {
    isRedisReady = false;

    if (process.env.NODE_ENV === 'production') {
      logger.error('REDIS_PROD_INIT_FAIL', `FATAL: Redis connection failed in production: ${err.message}`);
      throw new RedisConnectionError(`Redis connection unavailable in production: ${err.message}`);
    }

    // Development Environment Boundary
    console.warn('[Dev Warning] Redis not detected. Falling back to local Map instances. Multi-instance clustering will not function.');
    logger.warn(
      'REDIS_FALLBACK',
      `Redis connection unavailable (${err.message}). Falling back to in-memory adapter and stores in development.`
    );
    return { isRedisEnabled: false };
  }
};

/**
 * Publishes an event to all backend container instances via Redis Pub/Sub
 */
const publishClusterEvent = (event, payload) => {
  if (isRedisReady && pubClient) {
    try {
      pubClient.publish('talksphere:cluster:events', JSON.stringify({ event, payload }));
    } catch (e) {
      logger.warn('REDIS_PUBLISH_ERROR', e.message);
    }
  }
};

/**
 * Handles incoming events from peer backend instances
 */
const handleClusterEvent = (event, payload) => {
  if (event === 'CALL_CLEARED' && payload?.key) {
    const timer = localCallTimers.get(payload.key);
    if (timer) {
      clearTimeout(timer);
      localCallTimers.delete(payload.key);
      logger.info('CLUSTER_CALL_TIMER_CLEARED', `Cross-node ringing timer cleared for key: ${payload.key}`);
    }
  }
};

// ==========================================
// 1. PRESENCE OPERATIONS (User -> Sockets)
// ==========================================

/**
 * Registers a socket connection for a user.
 * Returns the total number of active sockets for this user.
 */
const addUserSocket = async (userId, socketId) => {
  ensureRedisConnected('addUserSocket');
  const uId = userId.toString();

  if (isRedisReady && redisClient) {
    try {
      const socketKey = `presence:sockets:${uId}`;
      await redisClient.sadd(socketKey, socketId);
      await redisClient.hset('presence:online_users', uId, Date.now());
      const count = await redisClient.scard(socketKey);
      return count;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`addUserSocket failed in production: ${e.message}`);
      }
      logger.warn('REDIS_ADD_SOCKET_FALLBACK', e.message);
    }
  }

  // Development In-Memory Fallback
  if (!localSocketsMap.has(uId)) {
    localSocketsMap.set(uId, new Set());
  }
  localSocketsMap.get(uId).add(socketId);
  return localSocketsMap.get(uId).size;
};

/**
 * Removes a socket connection for a user.
 * Returns the remaining number of active sockets for this user.
 */
const removeUserSocket = async (userId, socketId) => {
  ensureRedisConnected('removeUserSocket');
  const uId = userId.toString();

  if (isRedisReady && redisClient) {
    try {
      const socketKey = `presence:sockets:${uId}`;
      await redisClient.srem(socketKey, socketId);
      const remaining = await redisClient.scard(socketKey);

      if (remaining === 0) {
        await redisClient.hdel('presence:online_users', uId);
        await redisClient.del(socketKey);
      }
      return remaining;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`removeUserSocket failed in production: ${e.message}`);
      }
      logger.warn('REDIS_REMOVE_SOCKET_FALLBACK', e.message);
    }
  }

  // Development In-Memory Fallback
  if (localSocketsMap.has(uId)) {
    const set = localSocketsMap.get(uId);
    set.delete(socketId);
    if (set.size === 0) {
      localSocketsMap.delete(uId);
      return 0;
    }
    return set.size;
  }
  return 0;
};

/**
 * Returns the active socket count for a user across all clusters
 */
const getUserSocketCount = async (userId) => {
  ensureRedisConnected('getUserSocketCount');
  const uId = userId.toString();

  if (isRedisReady && redisClient) {
    try {
      return await redisClient.scard(`presence:sockets:${uId}`);
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`getUserSocketCount failed in production: ${e.message}`);
      }
    }
  }

  return localSocketsMap.get(uId)?.size || 0;
};

/**
 * Checks if a user is currently online
 */
const isUserOnline = async (userId) => {
  ensureRedisConnected('isUserOnline');
  const uId = userId.toString();

  if (isRedisReady && redisClient) {
    try {
      return (await redisClient.hexists('presence:online_users', uId)) === 1;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`isUserOnline failed in production: ${e.message}`);
      }
    }
  }

  return (localSocketsMap.get(uId)?.size || 0) > 0;
};

// ==========================================
// 2. ACTIVE CALLS COORDINATION [B-03]
// ==========================================

/**
 * Sets local ringing timer for a call key
 */
const setLocalCallTimer = (key, timerId) => {
  if (localCallTimers.has(key)) {
    clearTimeout(localCallTimers.get(key));
  }
  localCallTimers.set(key, timerId);
};

/**
 * Clears local ringing timer for a call key
 */
const clearLocalCallTimer = (key) => {
  const timer = localCallTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    localCallTimers.delete(key);
  }
};

/**
 * Registers an active call in the shared store
 */
const saveActiveCall = async (key, callData) => {
  ensureRedisConnected('saveActiveCall');
  const cleanData = { ...callData, timeoutId: undefined };

  if (isRedisReady && redisClient) {
    try {
      await redisClient.hset('presence:active_calls', key, JSON.stringify(cleanData));
      return;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`saveActiveCall failed in production: ${e.message}`);
      }
      logger.warn('REDIS_SAVE_CALL_FALLBACK', e.message);
    }
  }

  localActiveCallsMap.set(key, cleanData);
};

/**
 * Retrieves an active call by key
 */
const getActiveCall = async (key) => {
  ensureRedisConnected('getActiveCall');

  if (isRedisReady && redisClient) {
    try {
      const raw = await redisClient.hget('presence:active_calls', key);
      if (raw) return JSON.parse(raw);
      return null;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`getActiveCall failed in production: ${e.message}`);
      }
    }
  }

  return localActiveCallsMap.get(key) || null;
};

/**
 * Searches for any active call where the user is either caller or receiver
 */
const findCallByParticipant = async (userId) => {
  ensureRedisConnected('findCallByParticipant');
  const uId = userId.toString();

  if (isRedisReady && redisClient) {
    try {
      const all = await redisClient.hgetall('presence:active_calls');
      for (const [key, raw] of Object.entries(all || {})) {
        try {
          const call = JSON.parse(raw);
          if (call.caller === uId || call.receiver === uId) {
            return { key, call };
          }
        } catch (e) {}
      }
      return null;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`findCallByParticipant failed in production: ${e.message}`);
      }
    }
  }

  for (const [key, call] of localActiveCallsMap.entries()) {
    if (call.caller === uId || call.receiver === uId) {
      return { key, call };
    }
  }

  return null;
};

/**
 * Searches and returns all active calls currently matching a user
 */
const findAllCallsForUser = async (userId, socketId = null) => {
  ensureRedisConnected('findAllCallsForUser');
  const uId = userId.toString();
  const matched = [];

  if (isRedisReady && redisClient) {
    try {
      const all = await redisClient.hgetall('presence:active_calls');
      for (const [key, raw] of Object.entries(all || {})) {
        try {
          const call = JSON.parse(raw);
          const isCallSocket = socketId && (call.callerSocketId === socketId || call.receiverSocketId === socketId);
          const isUserParticipant = call.caller === uId || call.receiver === uId;
          if (isCallSocket || isUserParticipant) {
            matched.push({ key, call });
          }
        } catch (e) {}
      }
      return matched;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`findAllCallsForUser failed in production: ${e.message}`);
      }
    }
  }

  for (const [key, call] of localActiveCallsMap.entries()) {
    const isCallSocket = socketId && (call.callerSocketId === socketId || call.receiverSocketId === socketId);
    const isUserParticipant = call.caller === uId || call.receiver === uId;
    if (isCallSocket || isUserParticipant) {
      matched.push({ key, call });
    }
  }

  return matched;
};

/**
 * Updates call metadata across all instances
 */
const updateActiveCall = async (key, updates) => {
  ensureRedisConnected('updateActiveCall');
  const current = (await getActiveCall(key)) || {};
  const updated = { ...current, ...updates };

  if (isRedisReady && redisClient) {
    try {
      await redisClient.hset('presence:active_calls', key, JSON.stringify(updated));
      return updated;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`updateActiveCall failed in production: ${e.message}`);
      }
    }
  }

  localActiveCallsMap.set(key, updated);
  return updated;
};

/**
 * Deletes an active call from the shared store and notifies all peer nodes to clear timers
 */
const removeActiveCall = async (key) => {
  ensureRedisConnected('removeActiveCall');
  clearLocalCallTimer(key);

  if (isRedisReady && redisClient) {
    try {
      await redisClient.hdel('presence:active_calls', key);
      publishClusterEvent('CALL_CLEARED', { key });
      return;
    } catch (e) {
      if (process.env.NODE_ENV === 'production') {
        throw new RedisConnectionError(`removeActiveCall failed in production: ${e.message}`);
      }
    }
  }

  localActiveCallsMap.delete(key);
};

/**
 * Returns current Redis connection and readiness status [Phase 6 - Step 6.4]
 */
const getRedisStatus = () => {
  let displayUri = 'redis://127.0.0.1:6379';
  try {
    const { uri } = getRedisConnectionConfig();
    displayUri = uri.replace(/:[^:@]+@/, ':***@');
  } catch (e) {
    displayUri = 'configured-unreachable';
  }

  return {
    isReady: isRedisReady && redisClient && redisClient.status === 'ready',
    status: redisClient ? redisClient.status : 'disconnected',
    uri: displayUri
  };
};

/**
 * Cleanly drains and closes all Redis connections on graceful process termination
 */
const closeRedis = async () => {
  const clients = [pubClient, subClient, redisClient].filter(Boolean);
  await Promise.all(
    clients.map(async (client) => {
      try {
        await client.quit();
      } catch (err) {
        try { client.disconnect(); } catch (e) {}
      }
    })
  );
  isRedisReady = false;
  logger.info('REDIS_CLOSED', 'All Redis cluster connections closed gracefully.');
};

module.exports = {
  initRedis,
  getRedisConnectionConfig,
  publishClusterEvent,
  addUserSocket,
  removeUserSocket,
  getUserSocketCount,
  isUserOnline,
  setLocalCallTimer,
  clearLocalCallTimer,
  saveActiveCall,
  getActiveCall,
  findCallByParticipant,
  findAllCallsForUser,
  updateActiveCall,
  removeActiveCall,
  getRedisStatus,
  closeRedis,
  RedisConnectionError
};
