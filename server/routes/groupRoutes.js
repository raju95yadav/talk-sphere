const express = require('express');
const router = express.Router();
const {
  createGroup,
  getUserGroups,
  getGroupDetails,
  getGroupMessages,
  updateGroupInfo,
  addMembers,
  updateMemberRole,
  removeMember,
  deleteGroupMessage,
  uploadGroupAvatar,
  markGroupMessagesRead
} = require('../controllers/groupController');
const { protect } = require('../middleware/authMiddleware');
const multer = require('multer');
const { chatMediaStorage } = require('../utils/cloudinary');
const uploadMedia = multer({ 
  storage: chatMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(protect);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/:groupId', getGroupDetails);
router.get('/:groupId/messages', getGroupMessages);
router.put('/:groupId/read', markGroupMessagesRead);
router.patch('/:groupId', updateGroupInfo);
router.post('/:groupId/avatar', uploadMedia.single('avatar'), uploadGroupAvatar);
router.post('/:groupId/members', addMembers);
router.patch('/:groupId/members/:memberId/role', updateMemberRole);
router.delete('/:groupId/members/:memberId', removeMember);
router.delete('/:groupId/messages/:messageId', deleteGroupMessage);

module.exports = router;
