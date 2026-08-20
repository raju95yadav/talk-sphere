import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, MoreHorizontal, Send, User, ArrowLeft, Search, Plus, Edit3, Trash2, Download, Loader2, Globe, Smile, X, Trash, Paperclip, FileText, Reply, Play, Check, CheckCheck, Clock, Mic, Pause, Forward, RefreshCw, Phone, Video } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import { useSocketStatus } from '../context/SocketContext';
import { useCall } from '../context/CallContext';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import WaveSurfer from 'wavesurfer.js';
import { useTheme } from '../context/ThemeContext';


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
  
  // Reference tick to satisfy linter for forced updates
  const _tickRef = tick;
  const typingTimeoutRef = useRef(null);
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
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await apiClient.get(`/api/users?search=${val}`);
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

  useEffect(() => {
    if (token) {
      fetchConversations();
      if (view === 'discover') fetchAllUsers();
    }
  }, [token, view]);

  useEffect(() => {
    if (selectedContact) {
      fetchHistory(selectedContact._id);
      setIsTyping(false);
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
      }
    };
  }, [socket]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleTyping = (e) => {
    setMessage(e.target.value);
    if (!socket || !selectedContact) return;

    if (e.target.value.trim() === '') {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socket.emit('stop_typing', { receiverId: selectedContact._id });
      return;
    }

    socket.emit('typing', { receiverId: selectedContact._id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { receiverId: selectedContact._id });
    }, 2000);
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
    if (!message || !selectedContact || !socket) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('stop_typing', { receiverId: selectedContact._id });

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

    // Optimistic media bubble rendered immediately
    const optimisticMsg = {
      _id: tempId,
      sender: currentUserId,
      senderName: user?.username || user?.name || 'User',
      senderAvatar: user?.avatar,
      receiver: selectedContact._id,
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
    if (!file || !selectedContact) return;

    const tempId = 'upload-' + Date.now();
    const type = file.type.startsWith('image/') ? 'image' : 
                 file.type.startsWith('video/') ? 'video' :
                 file.type.startsWith('audio/') ? 'audio' : 'file';

    const localUrl = URL.createObjectURL(file);
    const optimisticMsg = {
      _id: tempId,
      sender: currentUserId,
      senderName: user?.username || user?.name || 'User',
      senderAvatar: user?.avatar,
      receiver: selectedContact._id,
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
      setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, content: res.data.url, status: 'sending' } : m));
      toast.success(`${res.data.type === 'image' ? 'Image' : res.data.type === 'video' ? 'Video' : 'File'} Transmitted`);
    } catch (err) {
      setChatHistory(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
      toast.error('Transmission Failure');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMessage = (msgId, type) => {
    socket.emit('delete_message', { messageId: msgId, receiverId: selectedContact._id, type });
    if (type === 'me') {
      setChatHistory(prev => prev.filter(m => m._id !== msgId));
    } else {
      setChatHistory(prev => prev.map(m => m._id === msgId ? { ...m, content: 'This message was deleted', deletedForEveryone: true, fileName: null, fileSize: null, type: 'text' } : m));
    }
    toast.success('Message Deleted');
  };

  const handleForwardMessage = (contact) => {
    if (!forwardingMessage) return;

    const msgData = {
      senderId: currentUserId,
      receiverId: contact._id,
      content: forwardingMessage.content,
      type: forwardingMessage.type,
      fileName: forwardingMessage.fileName,
      fileSize: forwardingMessage.fileSize,
      isForwarded: true
    };

    socket.emit('send_message', msgData);
    setForwardingMessage(null);
    toast.success(`Message forwarded to ${contact.username || contact.name}`);
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

  const handleReact = (msgId, emoji) => {
    socket.emit('react_to_message', { messageId: msgId, emoji, userId: currentUserId, receiverId: selectedContact._id });
    setShowEmojiPicker(null);
  };

  const emojis = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥'];

  if (selectedContact) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed inset-0 z-[60] bg-bg-main flex flex-col overflow-hidden"
      >
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
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedContact.username || selectedContact.name}`} alt="avatar" />
                 )}
              </div>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-bg-card ${selectedContact.isOnline ? 'bg-green-500' : 'bg-gray-500'}`}></div>
            </div>
            <div>
              <h4 className="font-bold text-base text-text-main tracking-tight leading-tight">{selectedContact.username || selectedContact.name}</h4>
              <p className="text-xs text-text-muted mt-0.5 font-bold uppercase tracking-wider">
                {isTyping ? (
                  <span className="text-accent-primary animate-pulse">typing...</span>
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
                            {msg.status === 'sending' && <Clock size={10} className="dark:text-white/40 text-black/40" />}
                            {msg.status === 'sent' && <Check size={10} className="dark:text-white/40 text-black/40" />}
                            {msg.status === 'delivered' && <CheckCheck size={10} className="dark:text-white/40 text-black/40" />}
                            {msg.status === 'read' && <CheckCheck size={10} className="text-blue-400" />}
                            {msg.status === 'failed' && (
                              <button 
                                type="button"
                                onClick={() => handleRetryMessage(msg)}
                                className="text-red-400 hover:text-red-300 p-0.5"
                                title="Failed to send. Click to retry."
                              >
                                <RefreshCw size={10} />
                              </button>
                            )}
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
                              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.user.username || conv.user.name}`} />
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
    <div className="glass-card flex flex-col h-full overflow-hidden">
      <div className="p-6 border-b border-border-main space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex bg-bg-card-secondary p-1 rounded-xl">
             <button 
               onClick={() => setView('transmissions')}
               className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${view === 'transmissions' ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20' : 'text-text-muted hover:text-text-main'}`}
             >
               Transmissions
             </button>
             <button 
               onClick={() => setView('discover')}
               className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${view === 'discover' ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20' : 'text-text-muted hover:text-text-main'}`}
             >
               Discover
             </button>
          </div>
          <button onClick={() => setIsSearching(!isSearching)} className={`p-2.5 rounded-xl transition-all ${isSearching ? 'bg-accent-primary text-white' : 'bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20'}`}>
            <Search size={18} />
          </button>
        </div>

        {isSearching && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-primary transition-colors" size={16} />
              <input 
                type="text" 
                placeholder="SEARCH GLOBAL SPHERE..." 
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full bg-bg-card-secondary border border-border-main rounded-xl py-3 pl-12 pr-4 text-text-main text-[10px] font-black uppercase tracking-widest focus:border-accent-primary outline-none transition-all"
              />
            </div>
            {searchResults.length > 0 ? (
              <div className="bg-bg-card-secondary/50 rounded-xl border border-border-main overflow-hidden max-h-60 overflow-y-auto">
                <p className="p-3 text-[8px] font-black text-accent-primary uppercase tracking-[0.2em] bg-bg-card-secondary border-b border-border-main">Results found</p>
                {searchResults.map(u => (
                  <div key={u._id} onClick={() => { setSelectedContact(u); setIsSearching(false); setSearchResults([]); }} className="p-4 hover:bg-accent-primary/10 cursor-pointer flex items-center justify-between transition-colors border-b border-border-main/50 last:border-0 group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center overflow-hidden border border-border-main group-hover:rotate-6 transition-transform">
                        {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <User size={18} className="text-accent-primary" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold tracking-tight">{u.username || u.name}</p>
                        <p className="text-[10px] text-text-muted uppercase tracking-widest">{u.isOnline ? 'Online' : 'Offline'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm(`Hide ${u.username || u.name} from global directory?`)) {
                            try {
                              await apiClient.post(`/api/users/hide/${u._id}`);
                              toast.success('User removed');
                              setSearchResults(prev => prev.filter(item => item._id !== u._id));
                              fetchAllUsers();
                            } catch (err) {
                              toast.error('Failed to remove user');
                            }
                          }
                        }}
                        className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                        title="Remove User"
                      >
                        <Trash2 size={12} />
                      </button>
                      <Plus size={14} className="text-text-muted group-hover:text-accent-primary group-hover:scale-125 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery.length > 1 && (
              <div className="p-8 text-center bg-bg-card-secondary rounded-xl border border-dashed border-border-main">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">No users found matching your query</p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {view === 'transmissions' ? (
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
                         <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.user.username || conv.user.name}`} alt="avatar" />
                       )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-[3px] border-bg-card ${conv.user.isOnline ? 'bg-green-500' : 'bg-gray-500'} shadow-lg`}></div>
                  </div>
                  <div className="overflow-hidden flex-1 min-w-0">
                    <h4 className="font-bold text-sm tracking-tight truncate">{conv.user.username || conv.user.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      {conv.lastMessage.sender === currentUserId && (
                        <div className="flex items-center flex-shrink-0 gap-0.5 text-accent-primary">
                          {conv.lastMessage.status === 'read' ? <CheckCheck size={12} className="text-blue-400" /> : 
                           conv.lastMessage.status === 'delivered' ? <CheckCheck size={12} className="dark:text-white/40 text-black/40" /> : 
                           <Check size={12} className="dark:text-white/40 text-black/40" />}
                          <span className="text-[9px] font-black uppercase tracking-wider ml-0.5 mr-1">You:</span>
                        </div>
                      )}
                      {typingStatuses[conv.user._id] ? (
                        <span className="text-accent-primary animate-pulse font-bold text-[11px]">typing...</span>
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
        ) : (
          <div className="space-y-2">
            {allUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 opacity-20">
                 <Globe size={40} className="text-accent-primary mb-4" />
                 <p className="text-[10px] font-black uppercase tracking-[0.2em]">Searching for lifeforms...</p>
              </div>
            ) : (
              allUsers.map((u) => (
                <motion.div 
                  key={u._id} 
                  whileHover={{ x: 5 }}
                  onClick={() => setSelectedContact(u)}
                  className="flex items-center justify-between p-4 rounded-2xl dark:hover:bg-white/5 hover:bg-black/5 transition-all cursor-pointer group border border-transparent hover:border-border-main"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-bg-card-secondary flex items-center justify-center border border-border-main overflow-hidden shadow-xl">
                         {u.avatar ? (
                           <img src={u.avatar} className="w-full h-full object-cover" alt="avatar" />
                         ) : (
                           <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username || u.name}`} alt="avatar" />
                         )}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-[3px] border-bg-card ${u.isOnline ? 'bg-green-500' : 'bg-gray-500'} shadow-lg`}></div>
                    </div>
                    <div>
                      <h4 className="font-black text-[10px] uppercase tracking-wider">{u.username || u.name}</h4>
                      <p className="text-[8px] text-text-muted font-bold uppercase tracking-widest mt-0.5">{u.isOnline ? 'Active Connection' : 'Off-grid'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (window.confirm(`Hide ${u.username || u.name} from Discover list?`)) {
                          try {
                            await apiClient.post(`/api/users/hide/${u._id}`);
                            toast.success('User removed');
                            fetchAllUsers();
                          } catch (err) {
                            toast.error('Failed to remove user');
                          }
                        }
                      }}
                      className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 z-10"
                      title="Remove User"
                    >
                      <Trash2 size={12} />
                    </button>
                    <Plus size={16} className="text-text-muted group-hover:text-accent-primary" />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSection;
