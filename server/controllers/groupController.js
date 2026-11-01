const mongoose = require('mongoose');
const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');

// Helper to check member role in a group
const getMemberRole = (group, userId) => {
  const member = group.members.find(m => m.user.toString() === userId.toString());
  return member ? member.role : null;
};

// Create a new group
exports.createGroup = async (req, res) => {
  try {
    const { name, description, avatar, memberIds } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Group name is required' });
    }

    const members = [
      { user: req.user._id, role: 'Admin' }
    ];

    if (Array.isArray(memberIds)) {
      memberIds.forEach(id => {
        if (id.toString() !== req.user._id.toString()) {
          members.push({ user: id, role: 'Member' });
        }
      });
    }

    const newGroup = new Group({
      name,
      description: description || '',
      avatar: avatar || '',
      creator: req.user._id,
      members
    });

    await newGroup.save();

    const populatedGroup = await Group.findById(newGroup._id)
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen');

    const io = req.app.get('io');
    if (io) {
      populatedGroup.members.forEach(m => {
        const uId = (m.user._id || m.user).toString();
        io.to(uId).emit('added_to_group', populatedGroup);
      });
    }

    res.status(201).json(populatedGroup);
  } catch (err) {
    console.error('Create Group Error:', err);
    res.status(500).json({ message: 'Failed to create group' });
  }
};

// Get all groups for authenticated user: Batched Single Aggregation [B-12]
exports.getUserGroups = async (req, res) => {
  try {
    const userObjectId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Fetch groups where user is a member with lean document hydration
    const groups = await Group.find({ 'members.user': userObjectId })
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen')
      .sort({ updatedAt: -1 })
      .lean();

    if (!groups || groups.length === 0) {
      return res.json([]);
    }

    const groupIds = groups.map(g => g._id);

    // 2. Batch-lookup latest message & unread count across ALL groups in a single aggregation pipeline
    const groupStats = await Message.aggregate([
      {
        $match: {
          group: { $in: groupIds },
          deletedForMe: { $ne: userObjectId }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$group',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$sender', userObjectId] },
                    { $not: { $in: [userObjectId, { $ifNull: ['$readBy', []] }] } }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.sender',
          foreignField: '_id',
          as: 'senderUser'
        }
      },
      {
        $unwind: {
          path: '$senderUser',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          unreadCount: 1,
          lastMessage: {
            _id: '$lastMessage._id',
            content: {
              $switch: {
                branches: [
                  { case: { $eq: ['$lastMessage.type', 'text'] }, then: '$lastMessage.content' },
                  { case: { $eq: ['$lastMessage.type', 'gif'] }, then: '👾 GIF' }
                ],
                default: { $concat: ['📷 ', { $toUpper: { $ifNull: ['$lastMessage.type', 'MEDIA'] } }] }
              }
            },
            type: '$lastMessage.type',
            createdAt: '$lastMessage.createdAt',
            sender: {
              _id: '$senderUser._id',
              username: '$senderUser.username',
              name: '$senderUser.name'
            }
          }
        }
      }
    ]);

    // 3. Map aggregated stats into a quick O(1) lookup Map
    const statsMap = new Map();
    groupStats.forEach(stat => {
      statsMap.set(stat._id.toString(), stat);
    });

    const groupsWithLastMessage = groups.map(group => {
      const stat = statsMap.get(group._id.toString());
      return {
        ...group,
        unreadCount: stat ? stat.unreadCount : 0,
        lastMessage: stat ? stat.lastMessage : null
      };
    });

    res.json(groupsWithLastMessage);
  } catch (err) {
    console.error('Get User Groups Error:', err);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
};

// Mark all messages in a group as read for current user
exports.markGroupMessagesRead = async (req, res) => {
  try {
    const { groupId } = req.params;
    await Message.updateMany(
      { group: groupId, sender: { $ne: req.user._id }, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark Group Read Error:', err);
    res.status(500).json({ message: 'Failed to mark group messages read' });
  }
};

// Get group details by ID
exports.getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId)
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen');

    if (!group) return res.status(404).json({ message: 'Group not found' });

    const role = getMemberRole(group, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied. You are not a member of this group.' });

    res.json({ ...group.toObject(), currentUserRole: role });
  } catch (err) {
    console.error('Get Group Details Error:', err);
    res.status(500).json({ message: 'Failed to fetch group details' });
  }
};

// Get group messages history: Cursor-Based Pagination & Lean Hydration [B-05]
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { cursor, limit = 30 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: 'Invalid group ID' });
    }

    const group = await Group.findById(groupId).select('members').lean();
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const role = getMemberRole(group, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied. Not a member of this group.' });

    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 50);

    const query = {
      group: groupId,
      deletedForMe: { $ne: req.user._id }
    };

    // Cursor-based filtering (older than cursor)
    if (cursor) {
      if (mongoose.Types.ObjectId.isValid(cursor)) {
        query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      } else if (!isNaN(Date.parse(cursor))) {
        query.createdAt = { $lt: new Date(cursor) };
      }
    }

    // Sort descending by _id using compound index { group: 1, _id: -1 }
    // Fetch limitNum + 1 to detect whether an older page exists
    const messages = await Message.find(query)
      .populate('sender', 'username name avatar')
      .populate('repliedTo', 'content type sender')
      .sort({ _id: -1 })
      .limit(limitNum + 1)
      .lean();

    const hasMore = messages.length > limitNum;
    if (hasMore) {
      messages.pop(); // Remove extra record used for lookahead
    }

    const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1]._id : null;

    // Reverse to chronological order (oldest to newest) for client view
    messages.reverse();

    const sanitizedMessages = messages.map(m => {
      if (m.content && typeof m.content === 'string' && m.content.startsWith('blob:')) {
        return {
          ...m,
          content: '',
          isCorruptedMedia: true
        };
      }
      return m;
    });

    res.json({
      messages: sanitizedMessages,
      nextCursor,
      hasMore,
      totalFetched: sanitizedMessages.length
    });
  } catch (err) {
    console.error('Get Group Messages Error:', err);
    res.status(500).json({ message: 'Failed to fetch group messages' });
  }
};

// Update group metadata (RBAC: Admin or Moderator)
exports.updateGroupInfo = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, avatar } = req.body;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const userRole = getMemberRole(group, req.user._id);
    if (userRole !== 'Admin' && userRole !== 'Moderator') {
      return res.status(403).json({ message: 'Permission denied: Only Admins or Moderators can update group info' });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (avatar !== undefined) group.avatar = avatar;

    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen');

    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('group_updated', updatedGroup);
    }

    res.json(updatedGroup);
  } catch (err) {
    console.error('Update Group Error:', err);
    res.status(500).json({ message: 'Failed to update group' });
  }
};

// Add members to group (RBAC: Admin or Moderator)
exports.addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { memberIds } = req.body; // Array of user IDs

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ message: 'No members provided' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const userRole = getMemberRole(group, req.user._id);
    if (userRole !== 'Admin' && userRole !== 'Moderator') {
      return res.status(403).json({ message: 'Permission denied: Only Admins or Moderators can add members' });
    }

    const existingUserIds = group.members.map(m => m.user.toString());
    memberIds.forEach(id => {
      if (!existingUserIds.includes(id.toString())) {
        group.members.push({ user: id, role: 'Member' });
      }
    });

    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen');

    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('group_updated', updatedGroup);
    }

    res.json(updatedGroup);
  } catch (err) {
    console.error('Add Members Error:', err);
    res.status(500).json({ message: 'Failed to add members' });
  }
};

// Update member role (RBAC: Admin ONLY)
exports.updateMemberRole = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { role } = req.body;

    if (!['Admin', 'Moderator', 'Member'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const currentUserRole = getMemberRole(group, req.user._id);
    if (currentUserRole !== 'Admin') {
      return res.status(403).json({ message: 'Permission denied: Only Admins can alter roles' });
    }

    const targetMember = group.members.find(m => m.user.toString() === memberId.toString());
    if (!targetMember) return res.status(404).json({ message: 'Member not found in group' });

    targetMember.role = role;
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen');

    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('group_updated', updatedGroup);
    }

    res.json(updatedGroup);
  } catch (err) {
    console.error('Update Role Error:', err);
    res.status(500).json({ message: 'Failed to update member role' });
  }
};

// Remove member from group (RBAC: Admin ONLY, or self leave)
exports.removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const currentUserRole = getMemberRole(group, req.user._id);
    const isSelfLeaving = req.user._id.toString() === memberId.toString();

    if (!isSelfLeaving && currentUserRole !== 'Admin') {
      return res.status(403).json({ message: 'Permission denied: Only Admins can remove members' });
    }

    // Cannot remove group creator
    if (group.creator.toString() === memberId.toString() && !isSelfLeaving) {
      return res.status(400).json({ message: 'Group creator cannot be removed' });
    }

    group.members = group.members.filter(m => m.user.toString() !== memberId.toString());
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen');

    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('group_updated', updatedGroup);
      io.to(memberId.toString()).emit('removed_from_group', { groupId, groupName: group.name });
    }

    res.json({ message: isSelfLeaving ? 'Left group successfully' : 'Member removed', group: updatedGroup });
  } catch (err) {
    console.error('Remove Member Error:', err);
    res.status(500).json({ message: 'Failed to remove member' });
  }
};

// Global message delete in group (RBAC: Admin or Message Sender)
exports.deleteGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const currentUserRole = getMemberRole(group, req.user._id);
    const isSender = message.sender.toString() === req.user._id.toString();

    if (!isSender && currentUserRole !== 'Admin') {
      return res.status(403).json({ message: 'Permission denied: Only Admins or the sender can delete messages globally' });
    }

    message.deletedForEveryone = true;
    message.content = 'This message was deleted';
    message.fileName = null;
    message.fileSize = null;
    message.type = 'text';
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('group_message_deleted', { messageId, groupId });
    }

    res.json({ message: 'Group message deleted', messageId });
  } catch (err) {
    console.error('Delete Group Message Error:', err);
    res.status(500).json({ message: 'Failed to delete group message' });
  }
};

// Upload & update group avatar (RBAC: Admin or Moderator)
exports.uploadGroupAvatar = async (req, res) => {
  try {
    const { groupId } = req.params;
    if (!req.file) return res.status(400).json({ message: 'No image file uploaded' });

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const userRole = getMemberRole(group, req.user._id);
    if (userRole !== 'Admin' && userRole !== 'Moderator') {
      return res.status(403).json({ message: 'Permission denied: Only Admins or Moderators can update group avatar' });
    }

    group.avatar = req.file.path;
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen');

    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('group_updated', updatedGroup);
    }

    res.json(updatedGroup);
  } catch (err) {
    console.error('Upload Group Avatar Error:', err);
    res.status(500).json({ message: 'Failed to upload group avatar' });
  }
};

// Delete a group permanently (RBAC: Admin or Creator)
exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    const currentUserRole = getMemberRole(group, req.user._id);
    const isCreator = group.creator.toString() === req.user._id.toString();

    if (!isCreator && currentUserRole !== 'Admin') {
      return res.status(403).json({ message: 'Permission denied: Only Group Admins or the Creator can delete this group' });
    }

    const memberIds = group.members.map(m => (m.user?._id || m.user).toString());
    const groupName = group.name;

    // Delete all messages belonging to this group
    await Message.deleteMany({ group: groupId });

    // Delete the group document
    await Group.findByIdAndDelete(groupId);

    // Real-time broadcast to all members
    const io = req.app.get('io');
    if (io) {
      io.to(`group_${groupId}`).emit('group_deleted', { groupId, groupName });
      memberIds.forEach(mId => {
        io.to(mId).emit('group_deleted', { groupId, groupName });
      });
    }

    res.json({ message: 'Group deleted successfully', groupId });
  } catch (err) {
    console.error('Delete Group Error:', err);
    res.status(500).json({ message: 'Failed to delete group' });
  }
};

