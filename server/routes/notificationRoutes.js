const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  claimInvite,
  connectInviteUser
} = require('../controllers/notificationController');

router.use(protect);

router.get('/', getNotifications);
router.post('/claim-invite', claimInvite);
router.post('/connect-invite', connectInviteUser);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/all', clearAllNotifications);
router.delete('/:id', deleteNotification);
router.delete('/', clearAllNotifications);

module.exports = router;
