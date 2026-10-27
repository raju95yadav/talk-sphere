const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  clearNotification,
  clearAllNotifications,
  restoreNotification,
  deleteNotification,
  clearHistory,
  deleteAllNotifications,
  claimInvite,
  connectInviteUser
} = require('../controllers/notificationController');

router.use(protect);

router.get('/', getNotifications);
router.post('/claim-invite', claimInvite);
router.post('/connect-invite', connectInviteUser);
router.put('/read-all', markAllAsRead);
router.put('/clear-all', clearAllNotifications);
router.put('/:id/read', markAsRead);
router.put('/:id/clear', clearNotification);
router.put('/:id/restore', restoreNotification);

router.delete('/history', clearHistory);
router.delete('/all', deleteAllNotifications);
router.delete('/:id', deleteNotification);
router.delete('/', deleteAllNotifications);

module.exports = router;
