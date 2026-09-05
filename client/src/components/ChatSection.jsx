import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, MoreHorizontal, Send, User, ArrowLeft, Search, Plus, Edit3, Trash2, Download, Loader2, Globe, Smile, X, Trash, Paperclip, FileText, Reply, Play, Check, CheckCheck, Clock, Mic, Pause, Forward, RefreshCw, Phone, Video, Users, Shield, ShieldCheck, Crown, LogOut, Settings, UserPlus, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import { useSocketStatus } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import WaveSurfer from 'wavesurfer.js';
import { useTheme } from '../context/ThemeContext';


const emojis = ['❤️', '👍', '😂', '😮', '😢', '🔥', '👏', '🎉'];

const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

const AudioPlayer = ({ src }) => {
  const containerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const [currentTime, setCurrentTime] = useState('0:00');
  const [isReady, setIsReady] = useState(false);
  const { isDarkMode } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.25)',
      progressColor: isDarkMode ? '#00F0FF' : '#ff0055',
      cursorColor: 'transparent',
      barWidth: 2,
      barRadius: 2,
      barGap: 2,
      height: 36,
      url: src
    });

    wavesurfer.on('ready', () => {
      const dur = wavesurfer.getDuration();
      setDuration(formatTime(dur));
      setIsReady(true);
    });

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(formatTime(wavesurfer.getCurrentTime()));
    });

    wavesurfer.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime('0:00');
    });

    wavesurfer.on('error', (err) => {
      if (err?.name === 'AbortError') return;
      console.warn('WaveSurfer error:', err);
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [src, isDarkMode]);

  const togglePlayPause = () => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.playPause();
      setIsPlaying(wavesurferRef.current.isPlaying());
    }
  };

  return (
    <div className="flex items-center gap-3 w-full min-w-[220px] max-w-[280px] p-1">
      <button 
        onClick={togglePlayPause} 
        disabled={!isReady}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isReady ? 'bg-accent-primary text-white hover:scale-105 shadow-lg shadow-accent-primary/20' : 'dark:bg-white/10 dark:text-white/30 bg-black/10 text-black/20 cursor-not-allowed'}`}
      >
        {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="ml-1 fill-current" />}
      </button>
      <div className="flex-1 flex flex-col justify-center">
        <div ref={containerRef} className="w-full" />
        <div className="flex justify-between mt-1.5 px-0.5">
          <span className="text-[9px] font-bold opacity-70 tracking-widest">{currentTime}</span>
          <span className="text-[9px] font-bold opacity-40 tracking-widest">{duration}</span>
        </div>
      </div>
    </div>
  );
};

const ChatSection = () => {
  const { user, token } = useAuth();
  const socket = useSocket();
  const { isConnected } = useSocketStatus();
  const { startCall, callStatus } = useCall();
  const [selectedContact, setSelectedContact] = useState(null);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupSearchResults, setGroupSearchResults] = useState([]);

  const handleGroupUserSearch = async (val) => {
    setGroupSearchQuery(val);
    if (!val || !val.trim()) {
      setGroupSearchResults([]);
      return;
    }
    try {
      const res = await apiClient.get(`/api/users?search=${encodeURIComponent(val.trim())}`);
      setGroupSearchResults(res.data);
    } catch (err) {
      console.error('Group user search failed');
    }
  };
  const [isUploading, setIsUploading] = useState(false);
  const [view, setView] = useState('transmissions'); 
  const [editingMessage, setEditingMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedPdf, setSelectedPdf] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatuses, setTypingStatuses] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [tick, setTick] = useState(0);

  // Group Chats & RBAC States
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [showAddGroupMemberModal, setShowAddGroupMemberModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupAvatar, setNewGroupAvatar] = useState('');
  const [newGroupMemberIds, setNewGroupMemberIds] = useState([]);
  const [addMemberSelectedIds, setAddMemberSelectedIds] = useState([]);
  const [groupTypingUsers, setGroupTypingUsers] = useState({});
  const selectedGroupRef = useRef(null);
  const groupAvatarInputRef = useRef(null);

  const handleGroupAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedGroup) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const res = await apiClient.post(`/api/groups/${selectedGroup._id}/avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSelectedGroup(res.data);
      setGroups(prev => prev.map(g => (g._id || g.id)?.toString() === res.data._id?.toString() ? res.data : g));
      toast.success('Group Profile Picture Updated!');
    } catch (err) {
      toast.error('Failed to update group avatar');
    }
  };

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);
  
  // Reference tick to satisfy linter for forced updates
  const _tickRef = tick;
  const typingTimeoutRef = useRef(null);
  const isEmittingTypingRef = useRef(false);
  const selectedContactRef = useRef(null);
  const scrollRef = useRef();
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const [activeMobileMenuMessage, setActiveMobileMenuMessage] = useState(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchTimeoutRef = useRef(null);
  const isTouchMovedRef = useRef(false);

  const handleTouchStart = (e, msg) => {
    if (msg.deletedForEveryone) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isTouchMovedRef.current = false;

    touchTimeoutRef.current = setTimeout(() => {
      if (!isTouchMovedRef.current) {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        setActiveMobileMenuMessage(msg);
      }
    }, 500);
  };

  const handleTouchMove = (e) => {
    if (!touchTimeoutRef.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartRef.current.x);
    const diffY = Math.abs(touch.clientY - touchStartRef.current.y);

    if (diffX > 10 || diffY > 10) {
      isTouchMovedRef.current = true;
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
      touchTimeoutRef.current = null;
    }
  };

  // Dynamic offline last seen text helper
  const getPresenceText = (contact) => {
    if (contact.isOnline) return 'online';
    if (!contact.lastSeen) return 'offline';
    
    const diffMs = new Date() - new Date(contact.lastSeen);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'last seen just now';
    if (diffMins < 60) return `last seen ${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `last seen ${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'last seen yesterday';
    return `last seen ${diffDays} days ago`;
  };

  // Timer to force re-render time durations dynamically every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Request browser notification permissions
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  const currentUserId = user?._id || user?.id;

  const fetchConversations = async () => {
    try {
      const res = await apiClient.get('/api/chat/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Failed to fetch conversations');
    }
  };

  const fetchAllUsers = async () => {
    try {
      const res = await apiClient.get('/api/users');
      setAllUsers(res.data);
    } catch (err) {
      console.error('Failed to fetch users');
    }
  };

  const fetchHistory = async (receiverId) => {
    try {
      const res = await apiClient.get(`/api/chat/history/${receiverId}`);
      const history = res.data.map(m => ({
        ...m,
        isSent: (m.sender?._id || m.sender).toString() === currentUserId?.toString()
      }));
      setChatHistory(history);

      // Mark unread messages as read
      const unreadIds = history
        .filter(m => !m.isSent && m.status !== 'read')
        .map(m => m._id);
      
      if (unreadIds.length > 0) {
        socket?.emit('mark_read', { messageIds: unreadIds, senderId: receiverId, receiverId: currentUserId });
      }
    } catch (err) {
      console.error('Failed to fetch history');
    }
  };

  const handleSearch = async (val) => {
    setSearchQuery(val);
    if (!val || !val.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiClient.get(`/api/users?search=${encodeURIComponent(val.trim())}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Search failed');
    }
  };

  const handleMessageSearch = async (val) => {
    setMessageSearchQuery(val);
    if (val.trim() === '') {
      setMessageSearchResults(null);
      return;
    }
    try {
      const res = await apiClient.get(`/api/chat/search/${selectedContact._id}?query=${val}`);
      const history = res.data.map(m => ({
        ...m,
        isSent: (m.sender?._id || m.sender).toString() === currentUserId?.toString()
      }));
      setMessageSearchResults(history);
    } catch (err) {
      console.error('Message search failed', err);
    }
  };
  const getCurrentUserGroupRole = (group) => {
    if (!group || !group.members || !currentUserId) return 'Member';
    const m = group.members.find(mem => (mem.user?._id || mem.user).toString() === currentUserId.toString());
    return m ? m.role : 'Member';
  };

  const getOnlineGroupMembersCount = (group) => {
    if (!group || !group.members) return 0;
    return group.members.filter(m => {
      const u = m.user;
      if (!u) return false;
      const memId = (u._id || u).toString();
      return u.isOnline || conversations.some(c => c.user._id?.toString() === memId && c.user.isOnline);
    }).length;
  };

  const getTypingMemberName = (group) => {
    if (!group || !group._id || !groupTypingUsers[(group._id || group.id).toString()]) return null;
    const groupTypingMap = groupTypingUsers[(group._id || group.id).toString()];
    const typingIds = Object.keys(groupTypingMap).filter(id => groupTypingMap[id] && id !== currentUserId?.toString());
    if (typingIds.length === 0) return null;
    const member = group.members?.find(m => (m.user?._id || m.user)?.toString() === typingIds[0]);
    return member?.user?.username || member?.user?.name || 'Member';
  };

  const fetchGroups = async () => {
    try {
      const res = await apiClient.get('/api/groups');
      setGroups(res.data);
      if (selectedGroup) {
        const isStillMember = res.data.some(g => (g._id || g.id)?.toString() === (selectedGroup._id || selectedGroup.id)?.toString());
        if (!isStillMember) {
          setSelectedGroup(null);
          setChatHistory([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch groups');
    }
  };

  const fetchGroupHistory = async (groupId) => {
    try {
      const res = await apiClient.get(`/api/groups/${groupId}/messages`);
      const history = res.data.map(m => ({
        ...m,
        isSent: (m.sender?._id || m.sender).toString() === currentUserId?.toString()
      }));
      setChatHistory(history);
    } catch (err) {
      if (err.response?.status === 403 || err.response?.status === 404) {
        setSelectedGroup(null);
        setChatHistory([]);
      }
    }
  };

  useEffect(() => {
    if (token) {
      fetchConversations();
      fetchGroups();
    }
  }, [token]);

  useEffect(() => {
    if (selectedGroup) {
      const gId = (selectedGroup._id || selectedGroup.id)?.toString();
      setSelectedContact(null);
      fetchGroupHistory(gId);
      setIsTyping(false);
      isEmittingTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      apiClient.put(`/api/groups/${gId}/read`).catch(() => {});
      setGroups(prev => prev.map(g => (g._id || g.id)?.toString() === gId ? { ...g, unreadCount: 0 } : g));
      if (socket) {
        socket.emit('join_group_room', { groupId: gId });
      }
    }
  }, [selectedGroup]);

  useEffect(() => {
    if (selectedContact) {
      fetchHistory(selectedContact._id);
      setIsTyping(false);
      isEmittingTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setConversations(prev => prev.map(c => 
        c.user._id === selectedContact._id ? { ...c, unreadCount: 0 } : c
      ));
    }
  }, [selectedContact]);

  useEffect(() => {
    if (socket) {
      socket.on('message_sent', (data) => {
        // Replace matching optimistic failed/sending message with actual database message
        setChatHistory(prev => {
          const index = prev.findIndex(m => m._id === data.tempId || (m.content === data.content && m.isSent && m._id.length < 20));
          if (index !== -1) {
            const newHistory = [...prev];
            newHistory[index] = { ...data, isSent: true };
            return newHistory;
          }
          return prev;
        });

        // Update local chat list instantly
        setConversations(prev => {
          const index = prev.findIndex(c => c.user._id.toString() === data.receiver.toString());
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              lastMessage: {
                _id: data._id,
                content: data.type === 'text' ? data.content : `📷 ${data.type.toUpperCase()}`,
                createdAt: data.createdAt,
                sender: data.sender,
                status: data.status
              }
            };
            const item = updated.splice(index, 1)[0];
            return [item, ...updated];
          } else {
            fetchConversations();
            return prev;
          }
        });
      });

      socket.on('receive_message', (data) => {
        const currentSelected = selectedContactRef.current;
        const isCurrentChat = currentSelected && data.sender.toString() === currentSelected._id.toString();
        
        if (isCurrentChat) {
           setChatHistory(prev => {
             if (prev.some(m => m._id === data._id)) return prev;
             return [...prev, { ...data, isSent: false }];
           });
           socket.emit('mark_read', { messageIds: [data._id], senderId: data.sender, receiverId: currentUserId });
        } else {
           socket.emit('message_delivered', { messageId: data._id, senderId: data.sender });
           
           // Show notification
           toast(`New message from ${data.senderName}: ${data.content.slice(0, 30)}${data.content.length > 30 ? '...' : ''}`, {
             icon: '💬',
             duration: 4000
           });

           if (Notification.permission === 'granted') {
             new Notification(`New message from ${data.senderName}`, {
               body: data.content,
               icon: data.senderAvatar || '/favicon.ico'
             });
           }
        }
        
        // Update local chat list instantly
        setConversations(prev => {
          const index = prev.findIndex(c => c.user._id.toString() === data.sender.toString());
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              lastMessage: {
                _id: data._id,
                content: data.type === 'text' ? data.content : `📷 ${data.type.toUpperCase()}`,
                createdAt: data.createdAt,
                sender: data.sender,
                status: isCurrentChat ? 'read' : 'delivered'
              },
              unreadCount: isCurrentChat ? 0 : (updated[index].unreadCount || 0) + 1
            };
            const item = updated.splice(index, 1)[0];
            return [item, ...updated];
          } else {
            fetchConversations();
            return prev;
          }
        });
      });

      socket.on('status_update', ({ messageId, status }) => {
        setChatHistory(prev => prev.map(m => m._id === messageId ? { ...m, status } : m));
        setConversations(prev => prev.map(c => 
          c.lastMessage?._id === messageId ? { ...c, lastMessage: { ...c.lastMessage, status } } : c
        ));
      });

      socket.on('messages_read', ({ messageIds, receiverId }) => {
        const currentSelected = selectedContactRef.current;
        if (currentSelected && currentSelected._id.toString() === receiverId.toString()) {
          setChatHistory(prev => prev.map(m => messageIds.includes(m._id) ? { ...m, status: 'read' } : m));
        }
        setConversations(prev => prev.map(c => 
          (c.user._id.toString() === receiverId.toString() && messageIds.includes(c.lastMessage?._id))
            ? { ...c, lastMessage: { ...c.lastMessage, status: 'read' } } 
            : c
        ));
      });

      socket.on('user_status_change', ({ userId, isOnline, lastSeen }) => {
        setConversations(prev => prev.map(c => 
          c.user._id === userId ? { ...c, user: { ...c.user, isOnline, lastSeen } } : c
        ));
        setAllUsers(prev => prev.map(u => 
          u._id === userId ? { ...u, isOnline, lastSeen } : u
        ));
        
        const currentSelected = selectedContactRef.current;
        if (currentSelected && currentSelected._id === userId) {
          setSelectedContact(prev => prev ? { ...prev, isOnline, lastSeen } : null);
        }
      });

      socket.on('message_edited', ({ messageId, content, editedAt }) => {
        setChatHistory(prev => prev.map(m => m._id === messageId ? { ...m, content, isEdited: true, editedAt } : m));
      });

      socket.on('message_deleted', ({ messageId, type }) => {
        if (type === 'everyone') {
          setChatHistory(prev => prev.map(m => m._id === messageId ? { 
            ...m, 
            content: 'This message was deleted', 
            deletedForEveryone: true,
            type: 'text',
            fileName: null,
            fileSize: null
          } : m));
        }
      });

      socket.on('message_reaction', ({ messageId, reactions }) => {
        setChatHistory(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
      });

      socket.on('typing', ({ senderId }) => {
        if (selectedContactRef.current && senderId === selectedContactRef.current._id.toString()) {
          setIsTyping(true);
        }
        setTypingStatuses(prev => ({ ...prev, [senderId]: true }));
      });

      socket.on('stop_typing', ({ senderId }) => {
        if (selectedContactRef.current && senderId === selectedContactRef.current._id.toString()) {
          setIsTyping(false);
        }
        setTypingStatuses(prev => ({ ...prev, [senderId]: false }));
      });

      socket.on('user_profile_updated', ({ userId, username, name, avatar }) => {
        setConversations(prev => prev.map(c => 
          c.user._id.toString() === userId.toString() ? { ...c, user: { ...c.user, username, name, avatar } } : c
        ));
        setAllUsers(prev => prev.map(u => 
          u._id.toString() === userId.toString() ? { ...u, username, name, avatar } : u
        ));
        const currentSelected = selectedContactRef.current;
        if (currentSelected && currentSelected._id.toString() === userId.toString()) {
          setSelectedContact(prev => prev ? { ...prev, username, name, avatar } : null);
        }
      });

      socket.on('new_friend_request', ({ sender }) => {
        toast.success(`${sender.username || sender.name} added you to contacts!`);
        if (Notification.permission === 'granted') {
          new Notification('New Contact Connected', {
            body: `${sender.username || sender.name} added you to contacts.`,
            icon: sender.avatar || '/favicon.ico'
          });
        }
        fetchAllUsers();
      });

      // Group Socket Listeners
      socket.on('receive_group_message', (data) => {
        const currGroup = selectedGroupRef.current;
        const targetGId = (data.groupId || data.group)?.toString();
        if (currGroup && (currGroup._id || currGroup.id)?.toString() === targetGId) {
          setChatHistory(prev => {
            if (prev.some(m => m._id === data._id || (m.tempId && m.tempId === data.tempId))) return prev;
            return [...prev, {
              ...data,
              isSent: (data.sender?._id || data.sender).toString() === currentUserId?.toString()
            }];
          });
          apiClient.put(`/api/groups/${targetGId}/read`).catch(() => {});
        } else {
          toast(`Group Message: ${data.content?.slice(0, 30) || 'Media'}`, { icon: '👥' });
          setGroups(prev => prev.map(g => (g._id || g.id)?.toString() === targetGId ? {
            ...g,
            unreadCount: (g.unreadCount || 0) + 1,
            lastMessage: {
              _id: data._id,
              content: data.content,
              type: data.type,
              sender: data.sender,
              createdAt: data.createdAt
            }
          } : g));
        }
        fetchGroups();
      });

      socket.on('group_message_sent', (data) => {
        setChatHistory(prev => {
          const index = prev.findIndex(m => m._id === data.tempId || m.tempId === data.tempId || m._id === data._id);
          if (index !== -1) {
            const newHist = [...prev];
            newHist[index] = { ...data, isSent: true };
            return newHist;
          }
          if (prev.some(m => m._id === data._id)) return prev;
          return [...prev, { ...data, isSent: true }];
        });
        fetchGroups();
      });

      socket.on('group_message_reaction', ({ messageId, groupId, reactions }) => {
        const currGroup = selectedGroupRef.current;
        if (currGroup && (currGroup._id || currGroup.id)?.toString() === (groupId)?.toString()) {
          setChatHistory(prev => prev.map(m => (m._id || m.id)?.toString() === messageId?.toString() ? { ...m, reactions } : m));
        }
      });

      socket.on('group_message_edited', ({ messageId, groupId, content, editedAt }) => {
        const currGroup = selectedGroupRef.current;
        if (currGroup && (currGroup._id || currGroup.id)?.toString() === (groupId)?.toString()) {
          setChatHistory(prev => prev.map(m => (m._id || m.id)?.toString() === messageId?.toString() ? { ...m, content, isEdited: true, editedAt } : m));
        }
      });

      socket.on('added_to_group', (groupData) => {
        toast.success(`You were added to group "${groupData.name}"`);
        socket.emit('join_group_room', { groupId: groupData._id });
        fetchGroups();
      });

      socket.on('group_updated', (updatedGroup) => {
        setGroups(prev => prev.map(g => (g._id || g.id)?.toString() === updatedGroup._id?.toString() ? updatedGroup : g));
        if (selectedGroupRef.current && (selectedGroupRef.current._id || selectedGroupRef.current.id)?.toString() === updatedGroup._id?.toString()) {
          setSelectedGroup(updatedGroup);
        }
      });

      socket.on('group_message_deleted', ({ messageId, groupId }) => {
        const currGroup = selectedGroupRef.current;
        if (currGroup && (currGroup._id || currGroup.id)?.toString() === (groupId)?.toString()) {
          setChatHistory(prev => prev.map(m => (m._id || m.id)?.toString() === messageId?.toString() ? {
            ...m,
            content: 'This message was deleted',
            deletedForEveryone: true,
            fileName: null,
            fileSize: null,
            type: 'text'
          } : m));
        }
      });

      socket.on('group_typing', ({ groupId, senderId }) => {
        const currGroup = selectedGroupRef.current;
        if (currGroup && (currGroup._id || currGroup.id)?.toString() === (groupId)?.toString() && senderId !== currentUserId) {
          setIsTyping(true);
        }
        setGroupTypingUsers(prev => ({
          ...prev,
          [groupId]: { ...(prev[groupId] || {}), [senderId]: true }
        }));
      });

      socket.on('group_stop_typing', ({ groupId, senderId }) => {
        const currGroup = selectedGroupRef.current;
        if (currGroup && (currGroup._id || currGroup.id)?.toString() === (groupId)?.toString() && senderId !== currentUserId) {
          setIsTyping(false);
        }
        setGroupTypingUsers(prev => ({
          ...prev,
          [groupId]: { ...(prev[groupId] || {}), [senderId]: false }
        }));
      });

      socket.on('removed_from_group', ({ groupId, groupName }) => {
        toast.error(`You were removed from ${groupName}`);
        fetchGroups();
        if (selectedGroupRef.current && (selectedGroupRef.current._id || selectedGroupRef.current.id)?.toString() === (groupId)?.toString()) {
          setSelectedGroup(null);
        }
      });
    }
    return () => {
      if (socket) {
        socket.off('receive_message');
        socket.off('message_sent');
        socket.off('user_status_change');
        socket.off('message_edited');
        socket.off('message_deleted');
        socket.off('message_reaction');
        socket.off('typing');
        socket.off('stop_typing');
        socket.off('status_update');
        socket.off('messages_read');
        socket.off('user_profile_updated');
        socket.off('new_friend_request');
        socket.off('receive_group_message');
        socket.off('group_message_sent');
        socket.off('group_message_reaction');
        socket.off('group_message_edited');
        socket.off('added_to_group');
        socket.off('group_updated');
        socket.off('group_message_deleted');
        socket.off('group_typing');
        socket.off('group_stop_typing');
        socket.off('removed_from_group');
      }
    };
  }, [socket]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isTyping]);

  const handleTyping = (e) => {
    const val = e.target.value;
    setMessage(val);
    if (!socket) return;

    if (selectedGroup) {
      if (val.trim() === '') {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (isEmittingTypingRef.current) {
          socket.emit('group_stop_typing', { groupId: selectedGroup._id });
          isEmittingTypingRef.current = false;
        }
        return;
      }

      if (!isEmittingTypingRef.current) {
        socket.emit('group_typing', { groupId: selectedGroup._id });
        isEmittingTypingRef.current = true;
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (isEmittingTypingRef.current) {
          socket.emit('group_stop_typing', { groupId: selectedGroup._id });
          isEmittingTypingRef.current = false;
        }
      }, 1800);
      return;
    }

    if (!selectedContact) return;

    if (val.trim() === '') {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isEmittingTypingRef.current) {
        socket.emit('stop_typing', { receiverId: selectedContact._id });
        isEmittingTypingRef.current = false;
      }
      return;
    }

    if (!isEmittingTypingRef.current) {
      socket.emit('typing', { receiverId: selectedContact._id });
      isEmittingTypingRef.current = true;
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      if (isEmittingTypingRef.current) {
        socket.emit('stop_typing', { receiverId: selectedContact._id });
        isEmittingTypingRef.current = false;
      }
    }, 1800);
  };

  const handleRetryMessage = (msg) => {
    if (!isConnected) {
      toast.error('Neural line still offline');
      return;
    }

    setChatHistory(prev => prev.map(m => m._id === msg._id ? { ...m, status: 'sending' } : m));

    socket.emit('send_message', {
      senderId: currentUserId,
      receiverId: selectedContact._id,
      content: msg.content,
      type: msg.type,
      repliedTo: msg.repliedTo?._id || null,
      tempId: msg._id
    });
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message || !socket) return;

    if (selectedGroup) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (isEmittingTypingRef.current) {
        socket.emit('group_stop_typing', { groupId: selectedGroup._id });
        isEmittingTypingRef.current = false;
      }

      if (editingMessage) {
        // Edit group message
        socket.emit('edit_message', { messageId: editingMessage._id, content: message, receiverId: selectedGroup._id });
        setChatHistory(prev => prev.map(m => m._id === editingMessage._id ? { ...m, content: message, isEdited: true, editedAt: new Date() } : m));
        setEditingMessage(null);
        setMessage('');
        return;
      }

      const tempId = 'group-msg-' + Date.now();
      const msgData = {
        groupId: selectedGroup._id,
        content: message,
        type: 'text',
        repliedTo: replyingTo?._id || null,
        tempId
      };

      socket.emit('send_group_message', msgData);
      setChatHistory(prev => [...prev, {
        _id: tempId,
        groupId: selectedGroup._id,
        content: message,
        type: 'text',
        sender: {
          _id: currentUserId,
          username: user?.username || user?.name || 'User',
          name: user?.name || 'User',
          avatar: user?.avatar
        },
        isSent: true,
        createdAt: new Date(),
        reactions: [],
        repliedTo: replyingTo,
        status: 'sending'
      }]);
      setMessage('');
      setReplyingTo(null);
      return;
    }

    if (!selectedContact) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (isEmittingTypingRef.current) {
      socket.emit('stop_typing', { receiverId: selectedContact._id });
      isEmittingTypingRef.current = false;
    }

    if (editingMessage) {
      socket.emit('edit_message', { messageId: editingMessage._id, content: message, receiverId: selectedContact._id });
      setChatHistory(prev => prev.map(m => m._id === editingMessage._id ? { ...m, content: message, isEdited: true, editedAt: new Date() } : m));
      setEditingMessage(null);
      setMessage('');
      return;
    }

    const tempId = 'msg-' + Date.now();
    const msgData = {
      senderId: currentUserId,
      receiverId: selectedContact._id,
      content: message,
      type: 'text',
      repliedTo: replyingTo?._id || null
    };

    if (!isConnected) {
      // Offline mode: queue message locally with failed state
      setChatHistory(prev => [...prev, { 
        ...msgData, 
        isSent: true, 
        createdAt: new Date(), 
        _id: tempId, 
        reactions: [],
        repliedTo: replyingTo,
        status: 'failed'
      }]);
      toast.error('Transmission Offline. Queued locally.');
      setMessage('');
      setReplyingTo(null);
      return;
    }

    socket.emit('send_message', { ...msgData, tempId });
    setChatHistory(prev => [...prev, { 
      ...msgData, 
      isSent: true, 
      createdAt: new Date(), 
      _id: tempId, 
      reactions: [],
      repliedTo: replyingTo,
      status: 'sending'
    }]);
    setMessage('');
    setReplyingTo(null);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await handleVoiceUpload(audioBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error accessing microphone', err);
      if (err.name === 'NotAllowedError') {
        toast.error('Microphone access denied. Please allow microphone permissions in your browser settings (click the padlock icon in the address bar).', { duration: 5000 });
      } else if (err.name === 'NotFoundError') {
        toast.error('No microphone found on this device.');
      } else {
        toast.error('Microphone access failed: ' + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = []; // clear to prevent upload
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const handleVoiceUpload = async (audioBlob) => {
    const file = new window.File([audioBlob], `voice-note-${Date.now()}.webm`, { type: 'audio/webm' });
    const tempId = 'upload-' + Date.now();
    const localUrl = URL.createObjectURL(file);

    const isGroup = !!selectedGroup;
    const targetId = isGroup ? selectedGroup._id : selectedContact?._id;
    if (!targetId) return;

    const optimisticMsg = {
      _id: tempId,
      sender: isGroup ? {
        _id: currentUserId,
        username: user?.username || user?.name || 'User',
        name: user?.name || 'User',
        avatar: user?.avatar
      } : currentUserId,
      groupId: isGroup ? selectedGroup._id : null,
      receiver: isGroup ? null : selectedContact?._id,
      content: localUrl,
      type: 'audio',
      fileName: 'Voice Note',
      fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      createdAt: new Date(),
      isSent: true,
      reactions: [],
      repliedTo: replyingTo,
      status: 'uploading',
      progress: 0
    };

    setChatHistory(prev => [...prev, optimisticMsg]);
    setReplyingTo(null);

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const res = await apiClient.post('/api/chat/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, progress: percentCompleted } : m));
        }
      });
      
      if (isGroup) {
        socket.emit('send_group_message', {
          groupId: selectedGroup._id,
          content: res.data.url,
          type: 'audio',
          fileName: 'Voice Note',
          fileSize: res.data.size,
          repliedTo: optimisticMsg.repliedTo?._id || null,
          tempId
        });
      } else {
        const msgData = {
          senderId: currentUserId,
          receiverId: selectedContact._id,
          content: res.data.url,
          type: 'audio',
          fileName: 'Voice Note',
          fileSize: res.data.size,
          repliedTo: optimisticMsg.repliedTo?._id || null,
          tempId
        };
        if (!isConnected) {
          setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
          return;
        }
        socket.emit('send_message', msgData);
      }
      setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, content: res.data.url, status: 'sending' } : m));
    } catch (err) {
      setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
      toast.error('Voice Note Transmission Failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || (!selectedContact && !selectedGroup)) return;

    const isGroup = !!selectedGroup;
    const tempId = 'upload-' + Date.now();
    const type = file.type.startsWith('image/') ? 'image' : 
                 file.type.startsWith('video/') ? 'video' :
                 file.type.startsWith('audio/') ? 'audio' : 'file';

    const localUrl = URL.createObjectURL(file);
    const optimisticMsg = {
      _id: tempId,
      sender: isGroup ? {
        _id: currentUserId,
        username: user?.username || user?.name || 'User',
        name: user?.name || 'User',
        avatar: user?.avatar
      } : currentUserId,
      groupId: isGroup ? selectedGroup._id : null,
      receiver: isGroup ? null : selectedContact?._id,
      content: localUrl,
      type,
      fileName: file.name,
      fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      createdAt: new Date(),
      isSent: true,
      reactions: [],
      repliedTo: replyingTo,
      status: 'uploading',
      progress: 0
    };

    setChatHistory(prev => [...prev, optimisticMsg]);
    setReplyingTo(null);

    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const res = await apiClient.post('/api/chat/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, progress: percentCompleted } : m));
        }
      });
      
      if (isGroup) {
        socket.emit('send_group_message', {
          groupId: selectedGroup._id,
          content: res.data.url,
          type: res.data.type,
          fileName: res.data.name,
          fileSize: res.data.size,
          repliedTo: optimisticMsg.repliedTo?._id || null,
          tempId
        });
      } else {
        const msgData = {
          senderId: currentUserId,
          receiverId: selectedContact._id,
          content: res.data.url,
          type: res.data.type,
          fileName: res.data.name,
          fileSize: res.data.size,
          repliedTo: optimisticMsg.repliedTo?._id || null,
          tempId
        };
        if (!isConnected) {
          setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
          return;
        }
        socket.emit('send_message', msgData);
      }
      setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, content: res.data.url, status: 'sending' } : m));
      toast.success(`${res.data.type === 'image' ? 'Image' : res.data.type === 'video' ? 'Video' : 'File'} Transmitted`);
    } catch (err) {
      setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
      toast.error('Transmission Failure');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReact = (msgId, emoji) => {
    if (selectedGroup) {
      socket?.emit('react_to_group_message', { messageId: msgId, groupId: selectedGroup._id, emoji, userId: currentUserId });
    } else if (selectedContact) {
      socket?.emit('react_to_message', { messageId: msgId, emoji, userId: currentUserId, receiverId: selectedContact._id });
    }
    setShowEmojiPicker(null);
  };

  const handleDeleteMessage = (msgId, type) => {
    if (selectedGroup) {
      socket?.emit('delete_group_message', { messageId: msgId, groupId: selectedGroup._id, type });
      if (type === 'me') {
        setChatHistory(prev => prev.filter(m => m._id !== msgId));
      } else {
        setChatHistory(prev => prev.map(m => m._id === msgId ? { ...m, content: 'This message was deleted', deletedForEveryone: true, fileName: null, fileSize: null, type: 'text' } : m));
      }
    } else if (selectedContact) {
      socket?.emit('delete_message', { messageId: msgId, receiverId: selectedContact._id, type });
      if (type === 'me') {
        setChatHistory(prev => prev.filter(m => m._id !== msgId));
      } else {
        setChatHistory(prev => prev.map(m => m._id === msgId ? { ...m, content: 'This message was deleted', deletedForEveryone: true, fileName: null, fileSize: null, type: 'text' } : m));
      }
    }
    toast.success('Message Deleted');
  };

  const handleForwardMessage = (target) => {
    if (!forwardingMessage || !socket) return;

    if (target.isGroup || target.members) {
      socket.emit('send_group_message', {
        groupId: target._id,
        content: forwardingMessage.content,
        type: forwardingMessage.type,
        fileName: forwardingMessage.fileName,
        fileSize: forwardingMessage.fileSize,
        isForwarded: true
      });
      toast.success(`Message forwarded to ${target.name}`);
    } else {
      socket.emit('send_message', {
        senderId: currentUserId,
        receiverId: target._id || target.id,
        content: forwardingMessage.content,
        type: forwardingMessage.type,
        fileName: forwardingMessage.fileName,
        fileSize: forwardingMessage.fileSize,
        isForwarded: true
      });
      toast.success(`Message forwarded to ${target.username || target.name}`);
    }
    setForwardingMessage(null);
  };

  const handleClearChat = async () => {
    if (!window.confirm('Delete all messages in this transmission?')) return;
    try {
      await apiClient.delete(`/api/chat/clear/${selectedContact._id}`);
      setChatHistory([]);
      fetchConversations();
      setShowOptions(false);
      toast.success('Transmission Purged');
    } catch (err) {
      toast.error('Purge Failed');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return toast.error('Group name required');

    try {
      const res = await apiClient.post('/api/groups', {
        name: newGroupName,
        description: newGroupDescription,
        avatar: newGroupAvatar,
        memberIds: newGroupMemberIds
      });

      toast.success(`Group "${res.data.name}" created!`);
      setShowCreateGroupModal(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupAvatar('');
      setNewGroupMemberIds([]);
      fetchGroups();
      setSelectedGroup(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    }
  };

  const handleUpdateMemberRole = async (memberId, newRole) => {
    if (!selectedGroup) return;
    try {
      const res = await apiClient.patch(`/api/groups/${selectedGroup._id}/members/${memberId}/role`, { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      setSelectedGroup(res.data);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId, memberName) => {
    if (!selectedGroup) return;
    if (!window.confirm(`Remove ${memberName} from ${selectedGroup.name}?`)) return;

    try {
      const res = await apiClient.delete(`/api/groups/${selectedGroup._id}/members/${memberId}`);
      toast.success('Member removed');
      setSelectedGroup(res.data.group);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;
    if (!window.confirm(`Leave group ${selectedGroup.name}?`)) return;

    try {
      await apiClient.delete(`/api/groups/${selectedGroup._id}/members/${currentUserId}`);
      toast.success(`Left ${selectedGroup.name}`);
      setSelectedGroup(null);
      setShowGroupInfoModal(false);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to leave group');
    }
  };

  const handleAddGroupMembersSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGroup || addMemberSelectedIds.length === 0) return;

    try {
      const res = await apiClient.post(`/api/groups/${selectedGroup._id}/members`, {
        memberIds: addMemberSelectedIds
      });
      toast.success('Members added!');
      setSelectedGroup(res.data);
      setShowAddGroupMemberModal(false);
      setAddMemberSelectedIds([]);
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add members');
    }
  };

  const handleDeleteGroupMessage = async (msgId) => {
    if (!selectedGroup) return;
    try {
      await apiClient.delete(`/api/groups/${selectedGroup._id}/messages/${msgId}`);
      setChatHistory(prev => prev.map(m => m._id === msgId ? {
        ...m,
        content: 'This message was deleted',
        deletedForEveryone: true,
        fileName: null,
        fileSize: null,
        type: 'text'
      } : m));
      toast.success('Group message deleted for everyone');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete message');
    }
  };

  // Selected Group Chat View
  if (selectedGroup) {
    const currentUserRole = getCurrentUserGroupRole(selectedGroup);
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-[60] bg-bg-main flex flex-col overflow-hidden"
      >
        {/* Dedicated Transmissions & Groups Background Layer */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <img
            src="/image6.png"
            alt="Group Chat Background"
            className="w-full h-full object-cover object-center opacity-25 dark:opacity-20 filter contrast-125 brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-main/90 via-bg-main/50 to-bg-main/80" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_15%,_var(--bg-main)_88%)]" />
        </div>
        {/* Group Chat Header */}
        <div className="p-4 pt-[calc(16px+env(safe-area-inset-top))] border-b border-border-main flex items-center justify-between bg-bg-card/80 backdrop-blur-md relative z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => {
              setSelectedGroup(null); 
              setEditingMessage(null); 
              setMessage('');
            }} className="p-2 dark:hover:bg-white/10 hover:bg-black/5 rounded-full text-text-muted hover:text-text-main transition-colors">
              <ArrowLeft size={22} />
            </button>
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-accent-primary/20 flex items-center justify-center border border-border-main overflow-hidden">
                 {selectedGroup.avatar ? (
                   <img src={selectedGroup.avatar} className="w-full h-full object-cover" alt="avatar" />
                 ) : (
                   <div className="w-full h-full bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center text-white font-black text-lg">
                     {selectedGroup.name?.slice(0, 2).toUpperCase()}
                   </div>
                 )}
              </div>
              <div className="absolute -bottom-1 -right-1 bg-accent-primary text-white text-[9px] px-1 rounded-full font-bold">
                {selectedGroup.members?.length || 0}
              </div>
            </div>
            <div>
              <h4 className="font-bold text-base text-text-main tracking-tight leading-tight flex items-center gap-2">
                {selectedGroup.name}
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  currentUserRole === 'Admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                  currentUserRole === 'Moderator' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                  'bg-white/10 text-text-muted border-border-main'
                }`}>
                  {currentUserRole}
                </span>
              </h4>
              <p className="text-xs text-text-muted mt-0.5 font-bold uppercase tracking-wider">
                {getTypingMemberName(selectedGroup) ? (
                  <span className="inline-flex items-center gap-1.5 text-accent-primary font-extrabold normal-case text-xs tracking-normal">
                    <span>{getTypingMemberName(selectedGroup)} is typing</span>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </span>
                ) : (
                  `${selectedGroup.members?.length || 0} Members • ${getOnlineGroupMembersCount(selectedGroup)} Online`
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-1 items-center">
            {/* Group WebRTC Audio Call Button */}
            <button 
              onClick={() => startCall({ _id: selectedGroup._id, username: selectedGroup.name, avatar: selectedGroup.avatar, isGroup: true }, 'audio')}
              disabled={callStatus !== 'idle'}
              title="Start Encrypted Group Audio Call"
              className="p-2.5 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-text-muted hover:text-emerald-400 transition-all disabled:opacity-30 cursor-pointer active:scale-95"
            >
              <Phone size={18} />
            </button>

            {/* Group WebRTC Video Call Button */}
            <button 
              onClick={() => startCall({ _id: selectedGroup._id, username: selectedGroup.name, avatar: selectedGroup.avatar, isGroup: true }, 'video')}
              disabled={callStatus !== 'idle'}
              title="Start Encrypted Group Video Call"
              className="p-2.5 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-text-muted hover:text-accent-primary transition-all disabled:opacity-30 cursor-pointer active:scale-95"
            >
              <Video size={18} />
            </button>

            <button 
              onClick={() => setShowGroupInfoModal(true)}
              className="p-2.5 rounded-xl bg-accent-primary/10 text-accent-primary hover:bg-accent-primary hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              title="Group Settings & Member Roles (RBAC)"
            >
              <ShieldCheck size={18} />
              <span className="hidden sm:inline">Group Info</span>
            </button>
          </div>
        </div>

        {/* Group Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-bg-main relative">
          <AnimatePresence initial={false}>
            {chatHistory.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center opacity-20 space-y-4">
                <Users size={48} className="text-accent-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Encrypted Group Channel Initiated</p>
              </motion.div>
            ) : (
              chatHistory.map((msg, i) => (
                <motion.div 
                  key={msg._id || i}
                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`flex ${msg.isSent ? 'justify-end' : 'justify-start'} relative z-10`}
                >
                  <div className={`max-w-[85%] md:max-w-[65%] relative group ${msg.isSent ? 'text-right' : 'text-left'}`}>
                    {!msg.isSent && (
                      <div className="flex items-center gap-2 mb-1 pl-1">
                        <span className="text-[10px] font-black text-accent-primary tracking-wide">
                          {msg.sender?.username || msg.sender?.name || 'Member'}
                        </span>
                      </div>
                    )}

                    <div className={`px-4 py-2.5 rounded-2xl shadow-lg inline-block relative min-w-[100px] transition-all ${
                      msg.isSent 
                        ? 'bg-gradient-to-br from-accent-primary to-accent-primary/80 text-white rounded-br-sm shadow-accent-primary/20' 
                        : 'bg-bg-card-secondary text-text-main rounded-bl-sm border border-border-main'
                    }`}>

                      {/* Replying to Preview inside bubble */}
                      {msg.repliedTo && (
                        <div className="mb-2 p-2 rounded-xl bg-black/20 border-l-2 border-accent-primary text-left text-xs opacity-90">
                          <p className="font-extrabold text-[10px] uppercase text-accent-primary">Replying to message</p>
                          <p className="truncate opacity-80">{msg.repliedTo.content || 'Media'}</p>
                        </div>
                      )}

                      {/* Forwarded Tag */}
                      {msg.isForwarded && (
                        <div className="flex items-center gap-1 opacity-70 mb-1">
                          <Forward size={10} className="italic" />
                          <span className="text-[9px] font-black uppercase italic tracking-widest">Forwarded</span>
                        </div>
                      )}

                      {/* Message Content Type Branching */}
                      {msg.type === 'image' ? (
                        <div className="overflow-hidden rounded-xl cursor-pointer my-1 group/img relative" onClick={() => setSelectedImage(msg.content)}>
                          <img src={msg.content} className="max-w-full max-h-72 object-cover rounded-xl transition-transform duration-300 group-hover/img:scale-105" alt="Group Media" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <Maximize2 size={20} className="text-white drop-shadow-md" />
                          </div>
                        </div>
                      ) : msg.type === 'video' ? (
                        <div className="overflow-hidden rounded-xl my-1 max-w-full">
                          <video src={msg.content} controls className="max-w-full max-h-72 rounded-xl" />
                        </div>
                      ) : msg.type === 'audio' ? (
                        <VoiceNotePlayer src={msg.content} isDarkMode={true} />
                      ) : msg.type === 'file' || msg.type === 'document' ? (
                        <div className="flex items-center gap-3 p-2 bg-black/20 rounded-xl my-1 border border-white/10">
                           <div className="p-2.5 bg-accent-primary/20 rounded-lg text-accent-primary flex-shrink-0">
                              <FileText size={20} />
                           </div>
                           <div className="text-left overflow-hidden flex-1">
                             <p className="text-sm font-bold truncate leading-tight">{msg.fileName || 'Document'}</p>
                             <p className="text-[10px] opacity-50 uppercase font-black mt-0.5">{msg.fileSize || 'File'}</p>
                           </div>
                           <a href={msg.content} target="_blank" rel="noreferrer" download={msg.fileName} className="p-2 dark:hover:bg-white/10 hover:bg-black/5 rounded-full transition-colors flex-shrink-0">
                             <Download size={16} className="text-text-main" />
                           </a>
                        </div>
                      ) : (
                        <p className={`text-[15px] font-normal leading-relaxed break-words ${msg.deletedForEveryone ? 'italic opacity-50' : ''}`}>{msg.content}</p>
                      )}

                      <div className="flex items-center justify-end gap-2 mt-1">
                        {msg.isEdited && <p className="text-[7px] font-bold uppercase opacity-30 italic">Edited</p>}
                        <p className="text-[9px] font-bold uppercase opacity-40">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      {/* Emoji Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="absolute -bottom-2 right-2 flex -space-x-1">
                          {msg.reactions.map((r, ri) => (
                            <span key={ri} className="text-[10px] bg-bg-card rounded-full px-1.5 py-0.5 border border-border-main shadow-lg" title={r.emoji}>{r.emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Options Bar on Hover */}
                    {!msg.deletedForEveryone && (
                      <div className={`absolute top-1/2 -translate-y-1/2 ${msg.isSent ? 'right-full mr-2' : 'left-full ml-2'} opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1 bg-bg-card/90 border border-border-main rounded-xl p-1 shadow-xl z-20`}>
                        <button onClick={() => setReplyingTo(msg)} title="Reply" className="p-1.5 hover:bg-accent-primary/20 text-text-muted hover:text-text-main rounded-lg transition-colors">
                          <Reply size={14} />
                        </button>
                        <button onClick={() => setForwardingMessage(msg)} title="Forward" className="p-1.5 hover:bg-accent-primary/20 text-text-muted hover:text-text-main rounded-lg transition-colors">
                          <Forward size={14} />
                        </button>
                        <button onClick={() => setShowEmojiPicker(msg._id)} title="React" className="p-1.5 hover:bg-accent-primary/20 text-text-muted hover:text-text-main rounded-lg transition-colors">
                          <Smile size={14} />
                        </button>
                        {msg.isSent && msg.type === 'text' && (
                          <button onClick={() => { setEditingMessage(msg); setMessage(msg.content); }} title="Edit" className="p-1.5 hover:bg-accent-primary/20 text-text-muted hover:text-text-main rounded-lg transition-colors">
                            <Edit3 size={14} />
                          </button>
                        )}
                        <button title="Delete for me" onClick={() => handleDeleteMessage(msg._id, 'me')} className="p-1.5 hover:bg-red-500/20 text-text-muted hover:text-red-500 rounded-lg transition-colors">
                          <Trash size={14} />
                        </button>
                        {(msg.isSent || currentUserRole === 'Admin') && (
                          <button title="Delete for everyone" onClick={() => handleDeleteMessage(msg._id, 'everyone')} className="p-1.5 hover:bg-red-500/20 text-text-muted hover:text-red-500 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Emoji Picker Overlay */}
                    {showEmojiPicker === msg._id && (
                      <div className="absolute bottom-full mb-2 left-0 z-30 bg-bg-card border border-border-main p-2 rounded-2xl flex gap-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                         {emojis.map(e => (
                           <button key={e} onClick={() => handleReact(msg._id, e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
                         ))}
                         <button onClick={() => setShowEmojiPicker(null)} className="p-1 dark:hover:bg-white/10 hover:bg-black/5 rounded-full text-text-muted"><X size={12}/></button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
          <div ref={scrollRef} />
        </div>

        {/* Reply Context Bar */}
        {replyingTo && (
          <div className="px-4 py-3 bg-bg-card border-t border-border-main flex justify-between items-center animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3 border-l-4 border-accent-primary pl-3">
              <Reply size={16} className="text-accent-primary" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-black uppercase text-accent-primary">Replying in {selectedGroup.name}</p>
                <p className="text-xs text-text-muted truncate max-w-md">{replyingTo.content || 'Media'}</p>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1.5 dark:hover:bg-white/10 hover:bg-black/5 rounded-full text-text-muted transition-colors"><X size={18} /></button>
          </div>
        )}

        {/* Group Input Footer */}
        {isRecording ? (
          <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:p-5 bg-bg-card/80 backdrop-blur-xl border-t border-border-main flex gap-2 md:gap-4 items-center relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <button onClick={cancelRecording} className="p-2 md:p-3 rounded-full text-red-500 hover:bg-red-500/20 transition-all flex-shrink-0">
              <Trash2 size={20} />
            </button>
            <div className="flex-1 flex items-center justify-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-red-500 font-mono font-bold text-lg tracking-widest">{formatDuration(recordingDuration)}</span>
              <span className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-2">Recording Voice Note...</span>
            </div>
            <button onClick={stopRecording} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-accent-primary text-white shadow-xl flex items-center justify-center transition-all flex-shrink-0 hover:scale-110 active:scale-95 shadow-accent-primary/20">
              <Send size={18} className="ml-0.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="p-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:p-5 bg-bg-card/80 backdrop-blur-xl border-t border-border-main flex gap-2 md:gap-3 items-center relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <input type="file" id="group-chat-file" className="hidden" onChange={handleFileUpload} />
            <button type="button" onClick={() => document.getElementById('group-chat-file').click()} disabled={isUploading} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg-card-secondary text-text-muted hover:text-text-main dark:hover:bg-white/10 hover:bg-black/5 flex items-center justify-center transition-all flex-shrink-0 relative overflow-hidden">
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-accent-primary/20">
                  <span className="text-[8px] font-black text-white">{uploadProgress}%</span>
                  <div className="absolute bottom-0 left-0 h-1 bg-accent-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              ) : <Paperclip size={18} />}
            </button>
            <div className="flex-1 relative group">
              <input 
                type="text" 
                value={message} 
                onChange={handleTyping} 
                placeholder={editingMessage ? "Update message..." : `Message ${selectedGroup.name}...`} 
                className="w-full bg-bg-card-secondary border border-border-main group-focus-within:border-accent-primary/50 group-focus-within:bg-bg-card rounded-full px-5 py-3 md:py-3.5 text-sm font-medium text-text-main outline-none transition-all duration-300 placeholder:text-text-muted/50 shadow-inner" 
              />
            </div>
            {message.trim() ? (
              <button type="submit" disabled={!message.trim()} className="w-10 h-10 md:w-12 md:h-12 rounded-full text-white shadow-xl flex items-center justify-center transition-all flex-shrink-0 duration-300 bg-gradient-to-r from-accent-primary to-accent-primary/80 hover:scale-110 active:scale-95 shadow-accent-primary/20">
                <Send size={18} className="ml-0.5" />
              </button>
            ) : (
              <button type="button" onClick={startRecording} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg-card-secondary text-text-muted hover:text-text-main dark:hover:bg-white/10 hover:bg-black/5 hover:scale-110 active:scale-95">
                <Mic size={18} />
              </button>
            )}
          </form>
        )}

        {/* Render Group Info Modal */}
        {showGroupInfoModal && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg bg-bg-card border border-border-main rounded-3xl overflow-hidden shadow-2xl p-6 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center border-b border-border-main pb-4">
                <h3 className="text-base font-black uppercase tracking-widest text-accent-primary flex items-center gap-2">
                  <ShieldCheck size={20} /> Group Info & Role Access (RBAC)
                </h3>
                <button onClick={() => setShowGroupInfoModal(false)} className="p-2 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-text-muted">
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-4 bg-bg-card-secondary p-4 rounded-2xl border border-border-main">
                <div className="relative group w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-primary to-purple-600 flex items-center justify-center text-white font-black text-2xl overflow-hidden shadow-lg border border-border-main">
                  {selectedGroup.avatar ? <img src={selectedGroup.avatar} className="w-full h-full object-cover" /> : selectedGroup.name.slice(0, 2).toUpperCase()}
                  {(currentUserRole === 'Admin' || currentUserRole === 'Moderator') && (
                    <div 
                      onClick={() => groupAvatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer"
                      title="Change Group Profile Picture"
                    >
                      <Camera size={20} className="text-white" />
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  ref={groupAvatarInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleGroupAvatarUpload} 
                />
                <div>
                  <h4 className="font-extrabold text-lg">{selectedGroup.name}</h4>
                  <p className="text-xs text-text-muted">{selectedGroup.description || 'No description set'}</p>
                  <p className="text-[10px] text-accent-primary font-black uppercase mt-1">Your Role: {currentUserRole}</p>
                </div>
              </div>

              <div className="flex gap-2">
                {(currentUserRole === 'Admin' || currentUserRole === 'Moderator') && (
                  <button onClick={() => { setGroupSearchQuery(''); setGroupSearchResults([]); setShowAddGroupMemberModal(true); }} className="flex-1 py-2.5 rounded-xl bg-accent-primary text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg hover:scale-105 transition-all cursor-pointer">
                    <UserPlus size={16} /> Add Members
                  </button>
                )}
                <button onClick={handleLeaveGroup} className="py-2.5 px-4 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 font-bold text-xs flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all">
                  <LogOut size={16} /> Leave Group
                </button>
              </div>

              <div className="space-y-3">
                <h5 className="text-xs font-black uppercase tracking-wider text-text-muted">Members ({selectedGroup.members?.length || 0})</h5>
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {selectedGroup.members?.map((m) => {
                    const memberUser = m.user;
                    const isMe = memberUser?._id?.toString() === currentUserId?.toString();
                    return (
                      <div key={memberUser?._id || Math.random()} className="flex items-center justify-between p-3 rounded-2xl bg-bg-card-secondary border border-border-main">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center overflow-hidden border border-border-main">
                            {memberUser?.avatar ? <img src={memberUser.avatar} className="w-full h-full object-cover" /> : <User size={18} className="text-accent-primary" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{memberUser?.username || memberUser?.name} {isMe && '(You)'}</p>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              m.role === 'Admin' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                              m.role === 'Moderator' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' :
                              'bg-white/10 text-text-muted border-border-main'
                            }`}>
                              {m.role}
                            </span>
                          </div>
                        </div>

                        {currentUserRole === 'Admin' && !isMe && (
                          <div className="flex items-center gap-2">
                            <select 
                              value={m.role}
                              onChange={(e) => handleUpdateMemberRole(memberUser._id, e.target.value)}
                              className="bg-bg-card border border-border-main text-xs font-bold rounded-lg px-2 py-1 outline-none text-text-main"
                            >
                              <option value="Member">Member</option>
                              <option value="Moderator">Moderator</option>
                              <option value="Admin">Admin</option>
                            </select>
                            <button 
                              onClick={() => handleRemoveMember(memberUser._id, memberUser.username || memberUser.name)}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                              title="Remove Member"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    );
  }

  if (selectedContact) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-[60] bg-bg-main flex flex-col overflow-hidden"
      >
        {/* Dedicated Transmissions & Groups Background Layer */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <img
            src="/image6.png"
            alt="Direct Chat Background"
            className="w-full h-full object-cover object-center opacity-25 dark:opacity-20 filter contrast-125 brightness-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-main/90 via-bg-main/50 to-bg-main/80" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_15%,_var(--bg-main)_88%)]" />
        </div>
        <div className="p-4 pt-[calc(16px+env(safe-area-inset-top))] border-b border-border-main flex items-center justify-between bg-bg-card/80 backdrop-blur-md relative z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => {
              setSelectedContact(null); 
              setEditingMessage(null); 
              setMessage('');
              setIsSearchingMessages(false);
              setMessageSearchQuery('');
              setMessageSearchResults(null);
            }} className="p-2 dark:hover:bg-white/10 hover:bg-black/5 rounded-full text-text-muted hover:text-text-main transition-colors">
              <ArrowLeft size={22} />
            </button>
            <div className="relative">
              <div className="w-11 h-11 rounded-full bg-accent-primary/20 flex items-center justify-center border border-border-main overflow-hidden">
                 {selectedContact.avatar ? (
                   <img src={selectedContact.avatar} className="w-full h-full object-cover" alt="avatar" />
                 ) : (
                   <User size={22} className="text-accent-primary" />
                 )}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-bg-card ${selectedContact.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
            </div>
            <div>
              <h4 className="font-bold text-base text-text-main tracking-tight leading-tight">{selectedContact.username || selectedContact.name}</h4>
              <p className="text-xs text-text-muted mt-0.5 font-bold uppercase tracking-wider">
                {isTyping ? (
                  <span className="inline-flex items-center gap-1.5 text-accent-primary font-extrabold normal-case text-xs tracking-normal">
                    <span>typing</span>
                    <span className="inline-flex items-center gap-0.5">
                      <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </span>
                  </span>
                ) : (
                  getPresenceText(selectedContact)
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-1 items-center">
            {/* WebRTC Audio Call Button */}
            <button 
              onClick={() => startCall(selectedContact, 'audio')}
              disabled={callStatus !== 'idle'}
              title="Start Encrypted Audio Call"
              className="p-2.5 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-text-muted hover:text-emerald-400 transition-all disabled:opacity-30 cursor-pointer active:scale-95"
            >
              <Phone size={18} />
            </button>

            {/* WebRTC Video Call Button */}
            <button 
              onClick={() => startCall(selectedContact, 'video')}
              disabled={callStatus !== 'idle'}
              title="Start Encrypted Video Call"
              className="p-2.5 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-text-muted hover:text-accent-primary transition-all disabled:opacity-30 cursor-pointer active:scale-95"
            >
              <Video size={18} />
            </button>

            <button onClick={() => setIsSearchingMessages(!isSearchingMessages)} className={`p-2.5 rounded-full transition-all ${isSearchingMessages ? 'bg-accent-primary text-white' : 'dark:hover:bg-white/10 hover:bg-black/5 text-text-muted hover:text-text-main'}`}>
              <Search size={18} />
            </button>

            <div className="relative">
              <button onClick={() => setShowOptions(!showOptions)} className={`p-2.5 rounded-full transition-all ${showOptions ? 'bg-accent-primary text-white' : 'dark:hover:bg-white/10 hover:bg-black/5 text-text-muted hover:text-text-main'}`}>
                <MoreHorizontal size={18} />
              </button>
              {showOptions && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-bg-card border border-border-main rounded-2xl shadow-2xl overflow-hidden z-20 py-2 animate-in fade-in zoom-in-95">
                   <button onClick={handleClearChat} className="w-full px-5 py-3 text-left text-xs font-black uppercase text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors">
                     <Trash2 size={14} /> Clear Transmission
                   </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isSearchingMessages && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="px-4 py-2 bg-bg-card-secondary/50 border-b border-border-main">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-primary transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="SEARCH TRANSMISSION LOGS..." 
                value={messageSearchQuery}
                onChange={(e) => handleMessageSearch(e.target.value)}
                className="w-full bg-bg-card border border-border-main rounded-xl py-2.5 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest focus:border-accent-primary outline-none transition-all placeholder:text-text-muted/50 text-text-main"
              />
            </div>
          </motion.div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-bg-main relative" onClick={() => setShowOptions(false)}>
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, var(--text-muted) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <AnimatePresence initial={false}>
            {(messageSearchQuery.trim() !== '' ? (messageSearchResults || []) : chatHistory).length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="h-full flex flex-col items-center justify-center opacity-20 space-y-6"
              >
                 <div className="w-24 h-24 rounded-full bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20">
                   {messageSearchQuery.trim() !== '' ? <Search size={40} className="text-accent-primary" /> : <MessageSquare size={40} className="text-accent-primary" />}
                 </div>
                 <p className="text-[10px] font-black uppercase tracking-[0.4em] text-accent-primary">
                   {messageSearchQuery.trim() !== '' ? 'No matches found' : 'Encrypted Channel Established'}
                 </p>
              </motion.div>
            ) : (
              (messageSearchQuery.trim() !== '' ? (messageSearchResults || []) : chatHistory).map((msg, i) => (
                <motion.div 
                  layout
                  key={msg._id || i}
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className={`flex ${msg.isSent ? 'justify-end' : 'justify-start'} relative z-10`}
                >
                  <div 
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`max-w-[85%] md:max-w-[65%] relative group ${msg.isSent ? 'text-right' : 'text-left'}`}
                  >
                    <div className={`px-4 py-2.5 rounded-2xl shadow-lg inline-block relative min-w-[80px] transition-all duration-300 ${
                      msg.isSent 
                        ? 'bg-gradient-to-br from-accent-primary to-accent-primary/80 text-white rounded-br-sm shadow-accent-primary/20' 
                        : 'bg-bg-card-secondary text-text-main rounded-bl-sm border border-border-main'
                    }`}>
                      
                      {msg.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-2xl z-20 text-white p-2">
                          <Loader2 className="animate-spin text-accent-primary mb-1" size={16} />
                          <span className="text-[9px] font-black tracking-widest">{msg.progress || 0}%</span>
                          <div className="w-20 h-1 bg-white/20 rounded-full overflow-hidden mt-1">
                            <div className="h-full bg-accent-primary transition-all duration-300" style={{ width: `${msg.progress || 0}%` }}></div>
                          </div>
                        </div>
                      )}
                      
                      {msg.isForwarded && (
                        <div className="flex items-center gap-1 opacity-70 mb-1">
                          <Forward size={10} className="italic" />
                          <span className="text-[9px] font-black uppercase italic tracking-widest">Forwarded</span>
                        </div>
                      )}

                      {/* Replied Message Context */}
                      {msg.repliedTo && (
                        <div className={`mb-2 p-2 rounded-lg text-left border-l-4 bg-black/20 ${msg.isSent ? 'border-white/30' : 'border-accent-primary'}`}>
                          <p className="text-[10px] font-black uppercase opacity-60 mb-1">
                            {msg.repliedTo.sender === currentUserId ? 'You' : (selectedContact.username || selectedContact.name)}
                          </p>
                          <p className="text-[11px] line-clamp-1 opacity-80">
                            {msg.repliedTo.type === 'image' ? '📷 Image' : msg.repliedTo.type === 'video' ? '🎥 Video' : msg.repliedTo.type === 'file' ? '📁 File' : msg.repliedTo.content}
                          </p>
                        </div>
                      )}

                      {msg.type === 'image' ? (
                        <div className="space-y-2">
                           <div className="relative group/img overflow-hidden rounded-xl border border-border-main max-w-[260px] md:max-w-[320px] bg-black/20">
                             <img 
                               src={msg.content} 
                               className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform duration-500" 
                               alt="transmission" 
                               onClick={() => { setSelectedImage(msg.content); setZoomLevel(1); }} 
                             />
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                               <Search className="text-white" size={24} />
                             </div>
                           </div>
                           <div className="flex items-center justify-between gap-4 px-1">
                             <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{msg.fileName || 'Image'}</span>
                             <a href={msg.content} target="_blank" rel="noreferrer" download={msg.fileName} className="flex items-center gap-2 text-[10px] opacity-60 hover:opacity-100 transition-opacity">
                               <Download size={12} />
                             </a>
                           </div>
                        </div>
                      ) : msg.type === 'video' ? (
                        <div className="space-y-2">
                           <div className="relative rounded-lg overflow-hidden bg-black/40 aspect-video flex items-center justify-center group/vid max-w-[260px] md:max-w-[320px]">
                             <video src={msg.content} className="w-full max-h-[320px] object-cover" controls />
                           </div>
                           <div className="flex items-center justify-between gap-4">
                             <span className="text-[10px] opacity-40 font-bold uppercase">{msg.fileName || 'Video'}</span>
                             <a href={msg.content} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[10px] opacity-60 hover:opacity-100 transition-opacity">
                               <Download size={12} />
                             </a>
                           </div>
                        </div>
                      ) : msg.type === 'audio' ? (
                        <div className="space-y-1">
                           <AudioPlayer src={msg.content} />
                           <div className="flex items-center justify-between gap-4 px-1">
                             <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{msg.fileName || 'Voice Note'}</span>
                             <a href={msg.content} target="_blank" rel="noreferrer" download={msg.fileName} className="flex items-center gap-2 text-[10px] opacity-60 hover:opacity-100 transition-opacity">
                               <Download size={12} />
                             </a>
                           </div>
                        </div>
                      ) : msg.type === 'file' || msg.type === 'document' ? (
                        <div 
                          className={`flex items-center gap-4 bg-black/5 dark:bg-black/20 p-3 rounded-xl border border-border-main min-w-[240px] ${msg.fileName?.toLowerCase().endsWith('.pdf') ? 'cursor-pointer hover:bg-black/15 dark:hover:bg-black/30 transition-colors' : ''}`}
                          onClick={() => {
                            if (msg.fileName?.toLowerCase().endsWith('.pdf')) {
                              setSelectedPdf(msg);
                            }
                          }}
                        >
                           <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                             msg.fileName?.toLowerCase().endsWith('.pdf') ? 'bg-red-500/20 text-red-500' :
                             msg.fileName?.toLowerCase().match(/\.(doc|docx)$/) ? 'bg-blue-500/20 text-blue-500' :
                             'bg-accent-primary/20 text-accent-primary'
                           }`}>
                             <FileText size={20} />
                           </div>
                           <div className="text-left overflow-hidden flex-1">
                             <p className="text-sm font-bold truncate leading-tight">{msg.fileName || 'Document'}</p>
                             <p className="text-[10px] opacity-50 uppercase font-black mt-0.5">{msg.fileSize || 'File'}</p>
                           </div>
                           <a href={msg.content} target="_blank" rel="noreferrer" download={msg.fileName} className="p-2 dark:hover:bg-white/10 hover:bg-black/5 rounded-full transition-colors flex-shrink-0">
                             <Download size={16} className="text-text-main" />
                           </a>
                        </div>
                      ) : msg.type === 'call' ? (
                        <div className="flex items-center gap-3 p-1 min-w-[200px]">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            msg.callDetails?.status === 'missed' || msg.callDetails?.status === 'declined'
                              ? 'bg-red-500/20 text-red-500'
                              : 'bg-emerald-500/20 text-emerald-500'
                          }`}>
                            {msg.callDetails?.callType === 'video' ? <Video size={18} /> : <Phone size={18} />}
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-extrabold tracking-wide uppercase">{msg.content}</p>
                            <p className="text-[9px] opacity-60 font-semibold uppercase tracking-wider">
                              {msg.callDetails?.status === 'missed' ? 'Missed Call' : msg.callDetails?.status === 'declined' ? 'Declined Call' : 'Call Completed'}
                            </p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => startCall(selectedContact, msg.callDetails?.callType || 'video')}
                            className="p-2 rounded-full bg-accent-primary/20 hover:bg-accent-primary text-accent-primary hover:text-white transition-all cursor-pointer"
                            title="Call Back"
                          >
                            {msg.callDetails?.callType === 'video' ? <Video size={14} /> : <Phone size={14} />}
                          </button>
                        </div>
                      ) : (
                        <p className={`text-[15px] font-normal leading-relaxed break-words ${msg.deletedForEveryone ? 'italic opacity-50' : ''}`}>{msg.content}</p>
                      )}
                      
                      <div className="flex items-center justify-end gap-2 mt-1">
                        {msg.isEdited && <p className="text-[7px] font-bold uppercase opacity-30 italic">Edited {msg.editedAt && new Date(msg.editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>}
                        <p className="text-[9px] font-bold uppercase opacity-40">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {msg.isSent && (
                          <div className="ml-1 flex items-center gap-1">
                            <AnimatePresence mode="wait">
                              {msg.status === 'sending' && (
                                <motion.span key="sending" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} title="Sending...">
                                  <Clock size={11} className="dark:text-white/40 text-black/40 animate-spin" style={{ animationDuration: '3s' }} />
                                </motion.span>
                              )}
                              {msg.status === 'sent' && (
                                <motion.span key="sent" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} title="Sent">
                                  <Check size={11} className="dark:text-white/50 text-black/50" />
                                </motion.span>
                              )}
                              {msg.status === 'delivered' && (
                                <motion.span key="delivered" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} title="Delivered">
                                  <CheckCheck size={11} className="dark:text-white/60 text-black/60" />
                                </motion.span>
                              )}
                              {msg.status === 'read' && (
                                <motion.span key="read" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1.15, opacity: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }} title="Read by recipient">
                                  <CheckCheck size={11} className="text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]" />
                                </motion.span>
                              )}
                              {msg.status === 'failed' && (
                                <motion.span key="failed" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                                  <button 
                                    type="button"
                                    onClick={() => handleRetryMessage(msg)}
                                    className="text-red-400 hover:text-red-300 p-0.5"
                                    title="Failed to send. Click to retry."
                                  >
                                    <RefreshCw size={11} />
                                  </button>
                                </motion.span>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>

                      {/* Reactions Display */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="absolute -bottom-2 right-2 flex -space-x-1">
                          {msg.reactions.map((r, ri) => (
                            <span key={ri} className="text-[10px] bg-bg-card rounded-full px-1.5 py-0.5 border border-border-main shadow-lg" title={r.emoji}>{r.emoji}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Message Options Hover */}
                    {!msg.deletedForEveryone && (
                      <div className={`absolute top-1/2 -translate-y-1/2 ${msg.isSent ? 'right-full mr-2 origin-right' : 'left-full ml-2 origin-left'} opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 flex flex-row items-center gap-1 z-20 bg-bg-card/90 backdrop-blur-xl border border-border-main rounded-2xl p-1 shadow-2xl`}>
                        <button onClick={() => setReplyingTo(msg)} className="p-2 hover:bg-accent-primary/20 rounded-xl text-text-muted hover:text-text-main transition-all hover:scale-110">
                          <Reply size={16} />
                        </button>
                        <button title="Forward" onClick={() => setForwardingMessage(msg)} className="p-2 hover:bg-accent-primary/20 rounded-xl text-text-muted hover:text-text-main transition-all hover:scale-110">
                          <Forward size={16} />
                        </button>
                        <button onClick={() => setShowEmojiPicker(msg._id)} className="p-2 hover:bg-accent-primary/20 rounded-xl text-text-muted hover:text-text-main transition-all hover:scale-110">
                          <Smile size={16} />
                        </button>
                        {msg.isSent && msg.type === 'text' && (
                          <button onClick={() => {setEditingMessage(msg); setMessage(msg.content);}} className="p-2 hover:bg-accent-primary/20 rounded-xl text-text-muted hover:text-text-main transition-all hover:scale-110">
                            <Edit3 size={16} />
                          </button>
                        )}
                        <button title="Delete for me" onClick={() => handleDeleteMessage(msg._id, 'me')} className="p-2 hover:bg-red-500/20 rounded-xl text-text-muted hover:text-red-500 transition-all hover:scale-110">
                          <Trash size={16} />
                        </button>
                        {msg.isSent && (
                          <button title="Delete for everyone" onClick={() => handleDeleteMessage(msg._id, 'everyone')} className="p-2 hover:bg-red-500/20 rounded-xl text-text-muted hover:text-red-500 transition-all hover:scale-110">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    )}

                    {/* Emoji Picker Overlay */}
                    {showEmojiPicker === msg._id && (
                      <div className="absolute bottom-full mb-2 left-0 z-30 bg-bg-card border border-border-main p-2 rounded-2xl flex gap-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                         {emojis.map(e => (
                           <button key={e} onClick={() => handleReact(msg._id, e)} className="text-lg hover:scale-125 transition-transform">{e}</button>
                         ))}
                         <button onClick={() => setShowEmojiPicker(null)} className="p-1 dark:hover:bg-white/10 hover:bg-black/5 rounded-full text-text-muted"><X size={12}/></button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>

          {/* Animated Typing Indicator Bubble */}
          <AnimatePresence>
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="flex justify-start items-center gap-3 relative z-10 py-1"
              >
                <div className="w-8 h-8 rounded-full bg-accent-primary/20 flex items-center justify-center border border-border-main overflow-hidden shadow-sm flex-shrink-0">
                  {selectedContact.avatar ? (
                    <img src={selectedContact.avatar} className="w-full h-full object-cover" alt="avatar" />
                  ) : (
                    <User size={22} className="text-accent-primary" />
                  )}
                </div>
                <div className="bg-bg-card-secondary text-text-main px-4 py-2.5 rounded-2xl rounded-bl-sm border border-border-main shadow-md flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-muted">{selectedContact.username || selectedContact.name} is typing</span>
                  <div className="flex items-center gap-1 ml-0.5">
                    <motion.span
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut" }}
                      className="w-1.5 h-1.5 rounded-full bg-accent-primary"
                    />
                    <motion.span
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                      className="w-1.5 h-1.5 rounded-full bg-accent-primary"
                    />
                    <motion.span
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                      className="w-1.5 h-1.5 rounded-full bg-accent-primary"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={scrollRef} />

          {/* Forwarding Modal Overlay */}
          <AnimatePresence>
            {forwardingMessage && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.9, y: 20 }}
                  className="w-full max-w-sm bg-bg-card border border-border-main rounded-3xl overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-border-main flex justify-between items-center bg-bg-card-secondary">
                    <h3 className="text-sm font-black uppercase tracking-widest text-accent-primary">Forward To...</h3>
                    <button onClick={() => setForwardingMessage(null)} className="p-2 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-text-muted">
                      <X size={18} />
                    </button>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                    {conversations.length === 0 ? (
                      <p className="text-center p-4 text-xs opacity-50 uppercase tracking-widest">No recent contacts</p>
                    ) : (
                      conversations.map(conv => (
                        <div 
                          key={conv.user._id} 
                          onClick={() => handleForwardMessage(conv.user)}
                          className="flex items-center gap-3 p-3 rounded-2xl dark:hover:bg-white/5 hover:bg-black/5 cursor-pointer transition-all border border-transparent hover:border-border-main group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center overflow-hidden border border-border-main">
                            {conv.user.avatar ? (
                              <img src={conv.user.avatar} className="w-full h-full object-cover" />
                            ) : (
                              <User size={20} className="text-accent-primary" />
                            )}
                          </div>
                          <span className="font-bold text-sm flex-1">{conv.user.username || conv.user.name}</span>
                          <div className="w-8 h-8 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100">
                            <Send size={14} className="ml-0.5" />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Reply Context Bar */}
        {replyingTo && (
          <div className="px-4 py-3 bg-bg-card border-t border-border-main flex justify-between items-center animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3 border-l-4 border-accent-primary pl-3">
              <Reply size={16} className="text-accent-primary" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-black uppercase text-accent-primary">Replying to {replyingTo.sender === currentUserId ? 'yourself' : (selectedContact.username || selectedContact.name)}</p>
                <p className="text-xs text-text-muted truncate max-w-md">
                  {replyingTo.type === 'image' ? '📷 Image' : replyingTo.type === 'video' ? '🎥 Video' : replyingTo.type === 'file' ? '📁 File' : replyingTo.content}
                </p>
              </div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="p-1.5 dark:hover:bg-white/10 hover:bg-black/5 rounded-full text-text-muted transition-colors"><X size={18} /></button>
          </div>
        )}

        {editingMessage && (
          <div className="px-4 py-3 bg-accent-primary/10 border-t border-accent-primary/20 flex justify-between items-center animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-3 border-l-4 border-accent-primary pl-3">
              <Edit3 size={16} className="text-accent-primary" />
              <div className="overflow-hidden">
                <p className="text-[10px] font-black uppercase text-accent-primary">Editing Message</p>
                <p className="text-xs text-text-muted truncate max-w-md">{editingMessage.content}</p>
              </div>
            </div>
            <button onClick={() => {setEditingMessage(null); setMessage('');}} className="p-1.5 dark:hover:bg-white/10 hover:bg-black/5 rounded-full text-text-muted transition-colors"><X size={18} /></button>
          </div>
        )}

        {isRecording ? (
          <div className="p-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:p-5 bg-bg-card/80 backdrop-blur-xl border-t border-border-main flex gap-2 md:gap-4 items-center relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <button onClick={cancelRecording} className="p-2 md:p-3 rounded-full text-red-500 hover:bg-red-500/20 transition-all flex-shrink-0">
              <Trash2 size={20} />
            </button>
            <div className="flex-1 flex items-center justify-center gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-red-500 font-mono font-bold text-lg tracking-widest">{formatDuration(recordingDuration)}</span>
              <span className="text-[10px] text-text-muted uppercase font-black tracking-widest ml-2">Recording Voice Note...</span>
            </div>
            <button onClick={stopRecording} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-accent-primary text-white shadow-xl flex items-center justify-center transition-all flex-shrink-0 hover:scale-110 active:scale-95 shadow-accent-primary/20">
              <Send size={18} className="ml-0.5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="p-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:p-5 bg-bg-card/80 backdrop-blur-xl border-t border-border-main flex gap-2 md:gap-3 items-center relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <input type="file" id="chat-file" className="hidden" onChange={handleFileUpload} />
            <button type="button" onClick={() => document.getElementById('chat-file').click()} disabled={isUploading} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg-card-secondary text-text-muted hover:text-text-main dark:hover:bg-white/10 hover:bg-black/5 flex items-center justify-center transition-all flex-shrink-0 relative overflow-hidden">
              {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-accent-primary/20">
                  <span className="text-[8px] font-black text-white">{uploadProgress}%</span>
                  <div className="absolute bottom-0 left-0 h-1 bg-accent-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              ) : <Paperclip size={18} />}
            </button>
            <div className="flex-1 relative group">
              <input 
                type="text" 
                value={message} 
                onChange={handleTyping} 
                placeholder={editingMessage ? "Update message..." : "Type a message..."} 
                className="w-full bg-bg-card-secondary border border-border-main group-focus-within:border-accent-primary/50 group-focus-within:bg-bg-card rounded-full px-5 py-3 md:py-3.5 text-sm font-medium text-text-main outline-none transition-all duration-300 placeholder:text-text-muted/50 shadow-inner" 
              />
            </div>
            {message.trim() ? (
              <button type="submit" disabled={!message.trim()} className="w-10 h-10 md:w-12 md:h-12 rounded-full text-white shadow-xl flex items-center justify-center transition-all flex-shrink-0 duration-300 bg-gradient-to-r from-accent-primary to-accent-primary/80 hover:scale-110 active:scale-95 shadow-accent-primary/20">
                <Send size={18} className="ml-0.5" />
              </button>
            ) : (
              <button type="button" onClick={startRecording} className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-bg-card-secondary text-text-muted hover:text-text-main dark:hover:bg-white/10 hover:bg-black/5 hover:scale-110 active:scale-95">
                <Mic size={18} />
              </button>
            )}
          </form>
        )}

        {/* Full Screen PDF Preview Modal */}
        <AnimatePresence>
          {selectedPdf && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-10"
            >
              <div className="absolute top-6 right-6 flex gap-4 z-[110]">
                <a 
                  href={selectedPdf.content} 
                  download={selectedPdf.fileName}
                  target="_blank" rel="noreferrer"
                  className="p-3 bg-white/10 hover:bg-accent-primary rounded-full text-white transition-all shadow-xl flex items-center justify-center"
                >
                  <Download size={20} />
                </a>
                <button 
                  onClick={() => setSelectedPdf(null)}
                  className="p-3 bg-red-500 hover:bg-red-600 rounded-full text-white transition-all shadow-xl"
                >
                  <X size={20} />
                </button>
              </div>
              <motion.div 
                className="relative w-full max-w-5xl h-[85vh] flex items-center justify-center overflow-hidden rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-bg-card-secondary"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20, opacity: 0 }}
              >
                <iframe src={selectedPdf.content} className="w-full h-full border-none" title={selectedPdf.fileName} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full Screen Image Preview Modal */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-10"
            >
              <div className="absolute top-6 right-6 flex gap-4 z-[110]">
                <button 
                  onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 3))}
                  className="p-3 bg-white/10 hover:bg-accent-primary rounded-full text-white transition-all shadow-xl"
                >
                  <Plus size={20} />
                </button>
                <button 
                  onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 1))}
                  className="p-3 bg-white/10 hover:bg-accent-primary rounded-full text-white transition-all shadow-xl"
                >
                  <X size={20} className="rotate-45" /> {/* Using X as minus icon */}
                </button>
                <a 
                  href={selectedImage} 
                  download 
                  className="p-3 bg-white/10 hover:bg-accent-primary rounded-full text-white transition-all shadow-xl flex items-center justify-center"
                >
                  <Download size={20} />
                </a>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-3 bg-red-500 hover:bg-red-600 rounded-full text-white transition-all shadow-xl"
                >
                  <X size={20} />
                </button>
              </div>

              <motion.div 
                className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden"
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
              >
                <img 
                  src={selectedImage} 
                  className="max-w-full max-h-[85vh] object-contain transition-transform duration-300 cursor-grab active:cursor-grabbing"
                  style={{ transform: `scale(${zoomLevel})` }}
                  alt="Full preview"
                />
              </motion.div>
              
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-2 bg-bg-card/90 rounded-full backdrop-blur-md border border-border-main">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted">Immersive Transmission Viewer • {Math.round(zoomLevel * 100)}% Zoom</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Message Context Menu */}
        <AnimatePresence>
          {activeMobileMenuMessage && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end justify-center sm:items-center p-4"
              onClick={() => setActiveMobileMenuMessage(null)}
            >
              <motion.div 
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="w-full max-w-sm bg-bg-card border border-border-main rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl p-4 space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Emoji reactions row */}
                <div className="flex justify-between items-center bg-bg-card-secondary p-3 rounded-2xl border border-border-main overflow-x-auto gap-2">
                  {emojis.map((emoji) => (
                    <button 
                      key={emoji} 
                      onClick={() => {
                        handleReact(activeMobileMenuMessage._id, emoji);
                        setActiveMobileMenuMessage(null);
                      }}
                      className="text-2xl hover:scale-125 active:scale-95 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Option items list */}
                <div className="divide-y divide-border-main/50 bg-bg-card-secondary rounded-2xl border border-border-main overflow-hidden">
                  
                  {/* Reply */}
                  <button 
                    onClick={() => {
                      setReplyingTo(activeMobileMenuMessage);
                      setActiveMobileMenuMessage(null);
                    }}
                    className="w-full px-5 py-3.5 text-left text-xs font-black uppercase text-text-main hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    <Reply size={16} className="text-accent-primary" /> Reply
                  </button>

                  {/* Forward */}
                  <button 
                    onClick={() => {
                      setForwardingMessage(activeMobileMenuMessage);
                      setActiveMobileMenuMessage(null);
                    }}
                    className="w-full px-5 py-3.5 text-left text-xs font-black uppercase text-text-main hover:bg-white/5 flex items-center gap-3 transition-colors"
                  >
                    <Forward size={16} className="text-accent-primary" /> Forward
                  </button>

                  {/* Copy Message (Only if text) */}
                  {activeMobileMenuMessage.type === 'text' && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(activeMobileMenuMessage.content);
                        toast.success('Copied to clipboard');
                        setActiveMobileMenuMessage(null);
                      }}
                      className="w-full px-5 py-3.5 text-left text-xs font-black uppercase text-text-main hover:bg-white/5 flex items-center gap-3 transition-colors"
                    >
                      <FileText size={16} className="text-accent-primary" /> Copy Message
                    </button>
                  )}

                  {/* Edit (Only if sent by me & type is text) */}
                  {activeMobileMenuMessage.isSent && activeMobileMenuMessage.type === 'text' && (
                    <button 
                      onClick={() => {
                        setEditingMessage(activeMobileMenuMessage);
                        setMessage(activeMobileMenuMessage.content);
                        setActiveMobileMenuMessage(null);
                      }}
                      className="w-full px-5 py-3.5 text-left text-xs font-black uppercase text-text-main hover:bg-white/5 flex items-center gap-3 transition-colors"
                    >
                      <Edit3 size={16} className="text-accent-primary" /> Edit
                    </button>
                  )}

                  {/* Delete For Me */}
                  <button 
                    onClick={() => {
                      handleDeleteMessage(activeMobileMenuMessage._id, 'me');
                      setActiveMobileMenuMessage(null);
                    }}
                    className="w-full px-5 py-3.5 text-left text-xs font-black uppercase text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                  >
                    <Trash size={16} /> Delete For Me
                  </button>

                  {/* Delete For Everyone (Only if sent by me) */}
                  {activeMobileMenuMessage.isSent && (
                    <button 
                      onClick={() => {
                        handleDeleteMessage(activeMobileMenuMessage._id, 'everyone');
                        setActiveMobileMenuMessage(null);
                      }}
                      className="w-full px-5 py-3.5 text-left text-xs font-black uppercase text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                    >
                      <Trash2 size={16} /> Delete For Everyone
                    </button>
                  )}

                </div>

                {/* Cancel Button */}
                <button 
                  onClick={() => setActiveMobileMenuMessage(null)}
                  className="w-full py-4 text-center text-xs font-black uppercase text-text-muted hover:text-text-main bg-bg-card-secondary rounded-2xl border border-border-main transition-colors"
                >
                  Cancel
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden relative">
      {/* Dedicated Transmissions & Groups Social/Matrix Background Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/image6.png"
          alt="Transmissions & Groups Social Matrix Background"
          className="w-full h-full object-cover object-center opacity-30 dark:opacity-25 filter contrast-125 brightness-90"
        />
        {/* Cyber Gradient & Radial Vignette for Depth and Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-main/90 via-bg-main/45 to-bg-main/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_15%,_var(--bg-main)_88%)]" />
      </div>

      <div className="p-3.5 sm:p-5 md:p-6 border-b border-border-main space-y-4 relative z-10">
        <div className="flex justify-between items-center gap-2">
          <div className="flex bg-bg-card-secondary p-1 rounded-xl gap-1 min-w-0 flex-1 overflow-x-auto custom-scrollbar-none">
             <button 
               onClick={() => { setView('transmissions'); setSelectedGroup(null); }}
               className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[9px] xs:text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${view === 'transmissions' ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20' : 'text-text-muted hover:text-text-main'}`}
             >
               Transmissions
             </button>
             <button 
               onClick={() => { setView('groups'); setSelectedContact(null); }}
               className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[9px] xs:text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 whitespace-nowrap ${view === 'groups' ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20' : 'text-text-muted hover:text-text-main'}`}
             >
               Groups {groups.reduce((acc, g) => acc + (g.unreadCount || 0), 0) > 0 ? (
                 <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-black animate-pulse">{groups.reduce((acc, g) => acc + (g.unreadCount || 0), 0)}</span>
               ) : groups.length > 0 ? (
                 <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[8px]">{groups.length}</span>
               ) : null}
             </button>
          </div>
          <button onClick={() => setIsSearching(!isSearching)} className={`p-2 sm:p-2.5 rounded-xl transition-all shrink-0 ${isSearching ? 'bg-accent-primary text-white' : 'bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20'}`}>
            <Search size={18} />
          </button>
        </div>

        {isSearching && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-primary transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="ENTER EXACT USERNAME OR GMAIL..." 
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-bg-card-secondary border border-border-main rounded-xl py-3 pl-12 pr-4 text-text-main text-[10px] font-black uppercase tracking-widest focus:border-accent-primary outline-none transition-all"
              />
            </div>
            {searchResults.length > 0 ? (
              <div className="bg-bg-card-secondary/50 rounded-xl border border-border-main overflow-hidden max-h-60 overflow-y-auto">
                <p className="p-3 text-[8px] font-black text-accent-primary uppercase tracking-[0.2em] bg-bg-card-secondary border-b border-border-main">Exact User Match Found</p>
                {searchResults.map(u => (
                  <div key={u._id} onClick={() => { setSelectedContact(u); setView('transmissions'); setIsSearching(false); setSearchResults([]); }} className="p-4 hover:bg-accent-primary/10 cursor-pointer flex items-center justify-between transition-colors border-b border-border-main/50 last:border-0 group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center overflow-hidden border border-border-main group-hover:rotate-6 transition-transform">
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <User size={18} className="text-accent-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-tight">{u.username || u.name}</p>
                        {u.email && <p className="text-[10px] text-text-muted">{u.email}</p>}
                        <p className="text-[9px] text-accent-primary font-bold uppercase tracking-wider">{u.isOnline ? 'Online' : 'Offline'}</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg bg-accent-primary text-white text-[10px] font-black uppercase tracking-wider shadow-md hover:scale-105 transition-all">
                      Chat & Call
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery.trim().length > 0 && (
              <div className="p-6 text-center bg-bg-card-secondary rounded-xl border border-dashed border-border-main">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No registered user found with this exact username or email address.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative z-10">
        {view === 'groups' ? (
          <div className="space-y-3">
            <button 
              onClick={() => { setGroupSearchQuery(''); setGroupSearchResults([]); setShowCreateGroupModal(true); }}
              className="w-full py-3 rounded-2xl bg-accent-primary text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-accent-primary/20 hover:scale-[1.02] active:scale-95 transition-all mb-4 cursor-pointer"
            >
              <Plus size={18} /> Create Group
            </button>
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-30 space-y-3">
                <Users size={40} className="text-accent-primary" />
                <p className="text-[10px] font-black uppercase tracking-widest">No groups joined</p>
              </div>
            ) : (
              groups.map((g) => {
                const gOnlineCount = getOnlineGroupMembersCount(g);
                const typingName = getTypingMemberName(g);
                const unread = g.unreadCount || 0;

                return (
                  <motion.div 
                    key={g._id || g.id}
                    whileHover={{ x: 5 }}
                    onClick={() => setSelectedGroup(g)}
                    className="flex items-center justify-between p-4 rounded-2xl dark:hover:bg-white/5 hover:bg-black/5 transition-all cursor-pointer border border-transparent hover:border-border-main group"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-2xl bg-accent-primary/20 flex items-center justify-center border border-border-main overflow-hidden text-accent-primary font-black text-lg shadow-xl">
                          {g.avatar ? <img src={g.avatar} className="w-full h-full object-cover" /> : g.name?.slice(0, 2).toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[2.5px] border-bg-card ${gOnlineCount > 0 ? 'bg-green-500' : 'bg-gray-500'} shadow-lg`}></div>
                      </div>
                      <div className="overflow-hidden flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <h4 className="font-bold text-sm tracking-tight truncate flex items-center gap-1.5">
                            {g.name}
                            <span className="text-[8px] font-black bg-accent-primary/10 text-accent-primary px-1.5 py-0.5 rounded-full">
                              {g.members?.length} M
                            </span>
                          </h4>
                          {g.lastMessage && (
                            <span className="text-[10px] text-text-muted font-bold ml-2 flex-shrink-0">
                              {new Date(g.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {typingName ? (
                            <p className="text-[11px] font-bold text-accent-primary flex items-center gap-1.5 animate-pulse">
                              <span>{typingName} is typing</span>
                              <span className="inline-flex items-center gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-1 h-1 rounded-full bg-accent-primary animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-text-muted truncate max-w-[180px]">
                              {g.lastMessage ? `${g.lastMessage.sender?.username || 'Member'}: ${g.lastMessage.content}` : g.description || 'Group transmission'}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    {unread > 0 ? (
                      <div className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-red-500/40 animate-in zoom-in-50 ml-2 flex-shrink-0">
                        {unread > 99 ? '99+' : unread}
                      </div>
                    ) : (
                      <ChevronDown size={16} className="text-text-muted -rotate-90 group-hover:text-accent-primary transition-all ml-2 flex-shrink-0" />
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        ) : view === 'transmissions' ? (
          conversations.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center py-32 opacity-20">
               <div className="w-20 h-20 bg-accent-primary/20 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare size={40} className="text-accent-primary" />
               </div>
               <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero active transmissions</p>
               <p className="text-[8px] font-bold uppercase tracking-widest mt-2">Search users to initiate connection</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <motion.div 
                key={conv.user._id} 
                whileHover={{ x: 5 }}
                onClick={() => setSelectedContact(conv.user)}
                className="flex items-center justify-between p-4 rounded-2xl dark:hover:bg-white/5 hover:bg-black/5 transition-all cursor-pointer group border border-transparent hover:border-border-main"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-bg-card-secondary flex items-center justify-center border border-border-main overflow-hidden shadow-xl">
                       {conv.user.avatar ? (
                         <img src={conv.user.avatar} className="w-full h-full object-cover" alt="avatar" />
                       ) : (
                         <User size={26} className="text-accent-primary" />
                       )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-bg-card ${conv.user.isOnline ? 'bg-green-500' : 'bg-gray-500'} shadow-lg`}></div>
                  </div>
                  <div className="overflow-hidden flex-1 min-w-0">
                    <h4 className="font-bold text-sm tracking-tight truncate">{conv.user.username || conv.user.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      {conv.lastMessage.sender === currentUserId && (
                        <div className="flex items-center flex-shrink-0 gap-0.5 text-accent-primary">
                          {conv.lastMessage.status === 'read' ? (
                            <CheckCheck size={12} className="text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]" />
                          ) : conv.lastMessage.status === 'delivered' ? (
                            <CheckCheck size={12} className="dark:text-white/50 text-black/50" />
                          ) : (
                            <Check size={12} className="dark:text-white/50 text-black/50" />
                          )}
                          <span className="text-[9px] font-black uppercase tracking-wider ml-0.5 mr-1">You:</span>
                        </div>
                      )}
                      {typingStatuses[conv.user._id] ? (
                        <span className="text-accent-primary font-bold text-[11px] flex items-center gap-1">
                          <span>typing</span>
                          <span className="inline-flex gap-0.5">
                            <span className="w-1 h-1 rounded-full bg-accent-primary animate-ping"></span>
                          </span>
                        </span>
                      ) : (
                        <p className="text-[11px] text-text-muted font-medium truncate flex-1">{conv.lastMessage.content}</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5 relative min-w-[70px]">
                   <p className="text-[8px] text-text-muted font-bold uppercase group-hover:opacity-0 transition-opacity">{new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                   {conv.unreadCount > 0 && (
                     <div className="bg-accent-primary text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center shadow-lg shadow-accent-primary/20 animate-in zoom-in-75 group-hover:opacity-0 transition-opacity">
                       {conv.unreadCount}
                     </div>
                   )}
                   <button 
                     onClick={async (e) => {
                       e.stopPropagation();
                       if (window.confirm(`Delete transmission with ${conv.user.username || conv.user.name}?`)) {
                         try {
                           await apiClient.delete(`/api/chat/clear/${conv.user._id}`);
                           toast.success('Transmission deleted');
                           fetchConversations();
                         } catch (err) {
                           toast.error('Failed to delete');
                         }
                       }
                     }}
                     className="absolute top-1/2 right-0 -translate-y-1/2 p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                     title="Delete Transmission"
                   >
                     <Trash2 size={12} />
                   </button>
                </div>
              </motion.div>
            ))
          )
        ) : null}
      </div>

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-bg-card border border-border-main rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-main pb-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-accent-primary flex items-center gap-2">
                <Users size={18} /> Create New Group
              </h3>
              <button onClick={() => setShowCreateGroupModal(false)} className="p-1.5 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-text-muted">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-text-muted">Group Name</label>
                <input 
                  type="text" 
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Cyber Squad"
                  className="w-full bg-bg-card-secondary border border-border-main rounded-xl p-3 text-sm text-text-main outline-none focus:border-accent-primary mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-text-muted">Description (Optional)</label>
                <input 
                  type="text" 
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Group mission..."
                  className="w-full bg-bg-card-secondary border border-border-main rounded-xl p-3 text-sm text-text-main outline-none focus:border-accent-primary mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-text-muted">Search & Add Members</label>
                <input
                  type="text"
                  placeholder="ENTER EXACT USERNAME OR GMAIL..."
                  value={groupSearchQuery}
                  onChange={(e) => handleGroupUserSearch(e.target.value)}
                  className="w-full bg-bg-card-secondary border border-border-main rounded-xl p-2.5 text-xs text-text-main outline-none focus:border-accent-primary mt-1 mb-2 font-bold"
                />
                <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
                  {(() => {
                    const contacts = conversations.map(c => c.user);
                    const combined = [...contacts];
                    groupSearchResults.forEach(su => {
                      if (!combined.some(u => u._id === su._id)) combined.push(su);
                    });
                    if (combined.length === 0) {
                      return <p className="text-[10px] text-text-muted text-center py-4 uppercase font-bold">No contacts or searched user found</p>;
                    }
                    return combined.map((u) => (
                      <label key={u._id} className="flex items-center justify-between p-2 rounded-xl bg-bg-card-secondary border border-border-main cursor-pointer hover:border-accent-primary/50">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-accent-primary/20 overflow-hidden flex items-center justify-center">
                            {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <User size={14} className="text-accent-primary" />}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{u.username || u.name}</p>
                            {u.email && <p className="text-[9px] text-text-muted">{u.email}</p>}
                          </div>
                        </div>
                        <input 
                          type="checkbox"
                          checked={newGroupMemberIds.includes(u._id)}
                          onChange={(e) => {
                            if (e.target.checked) setNewGroupMemberIds(prev => [...prev, u._id]);
                            else setNewGroupMemberIds(prev => prev.filter(id => id !== u._id));
                          }}
                          className="accent-accent-primary"
                        />
                      </label>
                    ));
                  })()}
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl bg-accent-primary text-white font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-all">
                Create Group
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddGroupMemberModal && selectedGroup && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-bg-card border border-border-main rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border-main pb-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-accent-primary flex items-center gap-2">
                <UserPlus size={18} /> Add Members to {selectedGroup.name}
              </h3>
              <button onClick={() => setShowAddGroupMemberModal(false)} className="p-1.5 rounded-full dark:hover:bg-white/10 hover:bg-black/5 text-text-muted">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddGroupMembersSubmit} className="space-y-4">
              <input
                type="text"
                placeholder="ENTER EXACT USERNAME OR GMAIL..."
                value={groupSearchQuery}
                onChange={(e) => handleGroupUserSearch(e.target.value)}
                className="w-full bg-bg-card-secondary border border-border-main rounded-xl p-2.5 text-xs text-text-main outline-none focus:border-accent-primary font-bold"
              />
              <div className="max-h-60 overflow-y-auto space-y-2 custom-scrollbar">
                {(() => {
                  const contacts = conversations.map(c => c.user);
                  const combined = [...contacts];
                  groupSearchResults.forEach(su => {
                    if (!combined.some(u => u._id === su._id)) combined.push(su);
                  });
                  const filtered = combined.filter(u => !selectedGroup.members?.some(m => (m.user?._id || m.user).toString() === u._id.toString()));
                  if (filtered.length === 0) {
                    return <p className="text-[10px] text-text-muted text-center py-6 uppercase font-bold">No non-member candidates found</p>;
                  }
                  return filtered.map((u) => (
                    <label key={u._id} className="flex items-center justify-between p-2.5 rounded-xl bg-bg-card-secondary border border-border-main cursor-pointer hover:border-accent-primary">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-accent-primary/20 overflow-hidden flex items-center justify-center">
                          {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <User size={16} className="text-accent-primary" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold">{u.username || u.name}</p>
                          {u.email && <p className="text-[9px] text-text-muted">{u.email}</p>}
                        </div>
                      </div>
                      <input 
                        type="checkbox"
                        checked={addMemberSelectedIds.includes(u._id)}
                        onChange={(e) => {
                          if (e.target.checked) setAddMemberSelectedIds(prev => [...prev, u._id]);
                          else setAddMemberSelectedIds(prev => prev.filter(id => id !== u._id));
                        }}
                        className="accent-accent-primary"
                      />
                    </label>
                  ));
                })()}
              </div>

              <button type="submit" disabled={addMemberSelectedIds.length === 0} className="w-full py-3 rounded-xl bg-accent-primary text-white font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 transition-all disabled:opacity-40">
                Confirm Add Members
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ChatSection;
