const User = require('../models/User');
const Group = require('../models/Group');
const logger = require('./logger');

/**
 * Retrieves the set of socket room IDs (contact user IDs + group room IDs)
 * that should receive status and profile updates for a given user.
 *
 * @param {string|ObjectId} userId
 * @returns {Promise<Set<string>>} Target rooms to notify
 */
const getTargetRoomsForUser = async (userId) => {
  const targetRooms = new Set();
  const userIdStr = userId.toString();

  try {
    // 1. Fetch current user's contact list
    const currentUser = await User.findById(userId).select('contacts').lean();
    if (currentUser?.contacts) {
      currentUser.contacts.forEach((cid) => {
        if (cid) targetRooms.add(cid.toString());
      });
    }

    // 2. Fetch users who have this user in their contacts
    const mutualContacts = await User.find({ contacts: userId }).select('_id').lean();
    if (mutualContacts) {
      mutualContacts.forEach((u) => {
        if (u._id) targetRooms.add(u._id.toString());
      });
    }

    // 3. Fetch all group rooms the user belongs to
    const userGroups = await Group.find({ 'members.user': userId }).select('_id').lean();
    if (userGroups) {
      userGroups.forEach((g) => {
        if (g._id) targetRooms.add(`group_${g._id}`);
      });
    }

    // Exclude own user room from broadcast targets
    targetRooms.delete(userIdStr);
  } catch (err) {
    logger.error('GET_TARGET_ROOMS_ERROR', err.message || err);
  }

  return targetRooms;
};

/**
 * Broadcasts user presence (online/offline status) specifically to mutual contacts
 * and group rooms, eliminating global broadcast storms.
 *
 * @param {object} io - Socket.io server instance
 * @param {string|ObjectId} userId - User whose status changed
 * @param {boolean} isOnline - True if online, false if offline
 * @param {Date|string} [lastSeen] - Optional last seen timestamp
 */
const broadcastUserPresence = async (io, userId, isOnline, lastSeen = null) => {
  if (!io || !userId) return;

  const payload = {
    userId: userId.toString(),
    isOnline,
    lastSeen: lastSeen || new Date()
  };

  try {
    const targetRooms = await getTargetRoomsForUser(userId);

    targetRooms.forEach((roomId) => {
      io.to(roomId).emit('user_status_change', payload);
    });

    logger.info(
      'PRESENCE_SCOPED_BROADCAST',
      `User ${userId} status (${isOnline ? 'online' : 'offline'}) sent to ${targetRooms.size} scoped rooms.`
    );
  } catch (err) {
    logger.error('BROADCAST_PRESENCE_ERROR', err.message || err);
  }
};

/**
 * Broadcasts user profile updates (name, username, avatar) specifically to
 * mutual contacts and group rooms.
 *
 * @param {object} io - Socket.io server instance
 * @param {object} user - User object containing updated fields
 */
const broadcastUserProfileUpdate = async (io, user) => {
  if (!io || !user) return;

  const userId = user._id || user.id;
  if (!userId) return;

  const payload = {
    userId: userId.toString(),
    username: user.username,
    name: user.name,
    avatar: user.avatar
  };

  try {
    const targetRooms = await getTargetRoomsForUser(userId);

    targetRooms.forEach((roomId) => {
      io.to(roomId).emit('user_profile_updated', payload);
    });

    logger.info(
      'PROFILE_SCOPED_BROADCAST',
      `User ${userId} profile update sent to ${targetRooms.size} scoped rooms.`
    );
  } catch (err) {
    logger.error('BROADCAST_PROFILE_ERROR', err.message || err);
  }
};

module.exports = {
  getTargetRoomsForUser,
  broadcastUserPresence,
  broadcastUserProfileUpdate
};

