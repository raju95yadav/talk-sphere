const Notification = require('../models/Notification');

/**
 * Creates a notification document in MongoDB and dispatches a real-time
 * Socket.IO event to the recipient room.
 *
 * @param {object} io - Socket.io instance
 * @param {object} options
 * @param {string|ObjectId} options.recipientId - Target user ID
 * @param {string|ObjectId} [options.senderId] - Optional sender user ID
 * @param {string} options.type - One of 'invite_joined', 'friend_request', 'login_alert', 'call_missed', 'chat_message', 'ai_alert', 'system'
 * @param {string} options.title - Notification header
 * @param {string} options.message - Human-readable detail
 * @param {object} [options.data] - Contextual metadata (IDs, device info, etc.)
 * @param {string} [options.actionType] - Action key: 'connect_chat' | 'view_devices' | 'open_chat' | 'open_ai' | 'none'
 */
const createAndSendNotification = async (io, {
  recipientId,
  senderId = null,
  type = 'system',
  title,
  message,
  data = {},
  actionType = 'none'
}) => {
  try {
    if (!recipientId || !title || !message) {
      console.warn('[notify] Missing required notification fields:', { recipientId, title });
      return null;
    }

    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId || undefined,
      type,
      title,
      message,
      data,
      actionType,
      isRead: false
    });

    const populated = await Notification.findById(notification._id)
      .populate('sender', 'name username avatar email')
      .lean();

    if (io) {
      const recipientRoom = recipientId.toString();
      io.to(recipientRoom).emit('new_notification', populated);
      console.log(`[notify] Emitted '${type}' notification to user room: ${recipientRoom}`);
    }

    return populated;
  } catch (error) {
    console.error('[notify] Failed to create/send notification:', error.message);
    return null;
  }
};

module.exports = {
  createAndSendNotification
};
