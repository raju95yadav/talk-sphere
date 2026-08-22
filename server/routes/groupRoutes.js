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
  deleteGroupMessage
} = require('../controllers/groupController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', createGroup);
router.get('/', getUserGroups);
router.get('/:groupId', getGroupDetails);
router.get('/:groupId/messages', getGroupMessages);
router.patch('/:groupId', updateGroupInfo);
router.post('/:groupId/members', addMembers);
router.patch('/:groupId/members/:memberId/role', updateMemberRole);
router.delete('/:groupId/members/:memberId', removeMember);
router.delete('/:groupId/messages/:messageId', deleteGroupMessage);

module.exports = router;
