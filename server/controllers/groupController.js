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

// Get all groups for authenticated user
exports.getUserGroups = async (req, res) => {
  try {
    const groups = await Group.find({ 'members.user': req.user._id })
      .populate('creator', 'username name avatar')
      .populate('members.user', 'username name avatar isOnline lastSeen')
      .sort({ updatedAt: -1 });

    // Attach last message & unread count for each group
    const groupsWithLastMessage = await Promise.all(
      groups.map(async (group) => {
        const lastMsg = await Message.findOne({ group: group._id, deletedForMe: { $ne: req.user._id } })
          .sort({ createdAt: -1 })
          .populate('sender', 'username name');

        const unreadCount = await Message.countDocuments({
          group: group._id,
          sender: { $ne: req.user._id },
          readBy: { $ne: req.user._id },
          deletedForMe: { $ne: req.user._id }
        });

        return {
          ...group.toObject(),
          unreadCount,
          lastMessage: lastMsg ? {
            _id: lastMsg._id,
            content: lastMsg.type === 'text' ? lastMsg.content : `📷 ${lastMsg.type.toUpperCase()}`,
            type: lastMsg.type,
            sender: lastMsg.sender,
            createdAt: lastMsg.createdAt
          } : null
        };
      })
    );

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

// Get group messages history
exports.getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);

    if (!group) return res.status(404).json({ message: 'Group not found' });

    const role = getMemberRole(group, req.user._id);
    if (!role) return res.status(403).json({ message: 'Access denied. Not a member of this group.' });

    const messages = await Message.find({
      group: groupId,
      deletedForMe: { $ne: req.user._id }
    })
    .populate('sender', 'username name avatar')
    .populate('repliedTo', 'content type sender')
    .sort({ createdAt: 1 });

    res.json(messages);
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
