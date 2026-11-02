const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const logger = require('./logger');

// Connection options for resilient clustering & local fallback
const REDIS_URI = process.env.REDIS_URI || 'redis://127.0.0.1:6379';

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 5000,
  retryStrategy: (times) => {
    // Retry with capped exponential backoff up to 10 seconds
    const delay = Math.min(times * 500, 10000);
    return delay;
  }
};

let pubClient = null;
let subClient = null;
let redisClient = null;
let isRedisReady = false;

// In-memory fallback stores for when Redis server is offline / local development
const localSocketsMap = new Map(); // userId -> Set of socket IDs
const localActiveCallsMap = new Map(); // callKey -> call metadata
const localCallTimers = new Map(); // callKey -> local setTimeout ID

/**
 * Initializes Redis clients and mounts the Socket.io Redis adapter.
 * Falls back gracefully to in-memory mode if Redis is not reachable.
 *
 * @param {object} io - Socket.io Server instance
 * @returns {Promise<{ isRedisEnabled: boolean }>}
 */
const initRedis = async (io) => {
  try {
    pubClient = new Redis(REDIS_URI, redisOptions);
    subClient = new Redis(REDIS_URI, redisOptions);
    redisClient = new Redis(REDIS_URI, redisOptions);

    pubClient.on('error', (err) => {
      logger.warn('REDIS_PUB_ERROR', `Pub client warning: ${err.message}`);
    });

    subClient.on('error', (err) => {
      logger.warn('REDIS_SUB_ERROR', `Sub client warning: ${err.message}`);
    });

    redisClient.on('error', (err) => {
      logger.warn('REDIS_CLIENT_ERROR', `Redis client warning: ${err.message}`);
    });

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
    logger.info('REDIS_CLUSTER', `Connected to Redis at ${REDIS_URI}. Multi-node synchronization active.`);

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
    logger.warn(
      'REDIS_FALLBACK',
      `Redis connection unavailable (${err.message}). Falling back to in-memory adapter and stores.`
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
 * If return value === 1, the user has just transitioned to online.
 */
const addUserSocket = async (userId, socketId) => {
  const uId = userId.toString();

  if (isRedisReady && redisClient) {
    try {
      const socketKey = `presence:sockets:${uId}`;
      await redisClient.sadd(socketKey, socketId);
      await redisClient.hset('presence:online_users', uId, Date.now());
      const count = await redisClient.scard(socketKey);
      return count;
    } catch (e) {
      logger.warn('REDIS_ADD_SOCKET_FALLBACK', e.message);
    }
  }

  // In-Memory Fallback
  if (!localSocketsMap.has(uId)) {
    localSocketsMap.set(uId, new Set());
  }
  localSocketsMap.get(uId).add(socketId);
  return localSocketsMap.get(uId).size;
};

/**
 * Removes a socket connection for a user.
 * Returns the remaining number of active sockets for this user.
 * If return value === 0, the user has just transitioned to offline.
 */
const removeUserSocket = async (userId, socketId) => {
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
      logger.warn('REDIS_REMOVE_SOCKET_FALLBACK', e.message);
    }
  }

  // In-Memory Fallback
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
  const uId = userId.toString();

  if (isRedisReady && redisClient) {
    try {
      return await redisClient.scard(`presence:sockets:${uId}`);
    } catch (e) {
      // Fallback
    }
  }

  return localSocketsMap.get(uId)?.size || 0;
};

/**
 * Checks if a user is currently online
 */
const isUserOnline = async (userId) => {
  const uId = userId.toString();

  if (isRedisReady && redisClient) {
    try {
      return (await redisClient.hexists('presence:online_users', uId)) === 1;
    } catch (e) {
      // Fallback
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
  const cleanData = { ...callData, timeoutId: undefined }; // Don't serialize local timer handle

  if (isRedisReady && redisClient) {
    try {
      await redisClient.hset('presence:active_calls', key, JSON.stringify(cleanData));
    } catch (e) {
      logger.warn('REDIS_SAVE_CALL_FALLBACK', e.message);
    }
  }

  localActiveCallsMap.set(key, cleanData);
};

/**
 * Retrieves an active call by key
 */
const getActiveCall = async (key) => {
  if (isRedisReady && redisClient) {
    try {
      const raw = await redisClient.hget('presence:active_calls', key);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // Fallback
    }
  }

  return localActiveCallsMap.get(key) || null;
};

/**
 * Searches for any active call where the user is either caller or receiver
 */
const findCallByParticipant = async (userId) => {
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
    } catch (e) {
      // Fallback
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
      // Fallback
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
  const current = (await getActiveCall(key)) || {};
  const updated = { ...current, ...updates };

  if (isRedisReady && redisClient) {
    try {
      await redisClient.hset('presence:active_calls', key, JSON.stringify(updated));
    } catch (e) {
      // Fallback
    }
  }

  localActiveCallsMap.set(key, updated);
  return updated;
};

/**
 * Deletes an active call from the shared store and notifies all peer nodes to clear timers
 */
const removeActiveCall = async (key) => {
  clearLocalCallTimer(key);

  if (isRedisReady && redisClient) {
    try {
      await redisClient.hdel('presence:active_calls', key);
      publishClusterEvent('CALL_CLEARED', { key });
    } catch (e) {
      // Fallback
    }
  }

  localActiveCallsMap.delete(key);
};

/**
 * Returns current Redis connection and readiness status [Phase 6 - Step 6.4]
 */
const getRedisStatus = () => {
  return {
    isReady: isRedisReady && redisClient && redisClient.status === 'ready',
    status: redisClient ? redisClient.status : 'disconnected',
    uri: REDIS_URI.replace(/:[^:@]+@/, ':***@')
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
        // Fallback to disconnect if quit hangs
        try { client.disconnect(); } catch (e) {}
      }
    })
  );
  isRedisReady = false;
  logger.info('REDIS_CLOSED', 'All Redis cluster connections closed gracefully.');
};

module.exports = {
  initRedis,
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
  closeRedis
};

