import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/apiClient';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { playNotificationChime } from '../utils/notificationSound';
import toast from 'react-hot-toast';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { token, user } = useAuth();
  const socket = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [historyNotifications, setHistoryNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [historyCount, setHistoryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState('active'); // 'active' | 'history'

  // Active chat switch callback set by Dashboard / ChatSection
  const onConnectAndChatRef = useRef(null);

  const registerChatOpener = useCallback((callback) => {
    onConnectAndChatRef.current = callback;
  }, []);

  // 1. Fetch Active Notifications
  const fetchNotifications = useCallback(async () => {
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      setActiveCount(0);
      setHistoryCount(0);
      return;
    }

    try {
      setIsLoading(true);
      const res = await apiClient.get('/api/notifications');
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
      setActiveCount(res.data.activeCount ?? (res.data.notifications || []).length);
      setHistoryCount(res.data.historyCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Fetch History Notifications
  const fetchHistory = useCallback(async () => {
    if (!token) {
      setHistoryNotifications([]);
      return;
    }

    try {
      setIsLoadingHistory(true);
      const res = await apiClient.get('/api/notifications?history=true');
      setHistoryNotifications(res.data.notifications || []);
      setHistoryCount(res.data.historyCount ?? (res.data.notifications || []).length);
      if (typeof res.data.activeCount === 'number') setActiveCount(res.data.activeCount);
      if (typeof res.data.unreadCount === 'number') setUnreadCount(res.data.unreadCount);
    } catch (err) {
      console.error('Failed to load notification history:', err.message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token]);

  // Initial load when logged in
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // When switching to history mode, fetch history items
  useEffect(() => {
    if (viewMode === 'history' && isOpen) {
      fetchHistory();
    }
  }, [viewMode, isOpen, fetchHistory]);

  // 2. Real-time Socket Listener for New Notifications
  useEffect(() => {
    if (!socket || !token) return;

    const handleNewNotification = (notif) => {
      if (!notif) return;

      // Play subtle chime sound
      playNotificationChime();

      // Prepend to notifications list
      setNotifications((prev) => {
        if (prev.some((n) => n._id === notif._id)) return prev;
        return [notif, ...prev];
      });

      // Increment counts
      setUnreadCount((prev) => prev + 1);
      setActiveCount((prev) => prev + 1);

      // Show high-priority Toast
      if (notif.type === 'invite_joined') {
        toast.custom(
          (t) => (
            <div
              className={`${
                t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-slate-900/95 dark:bg-[#12131C]/95 border border-indigo-500/40 shadow-2xl shadow-indigo-500/20 rounded-2xl pointer-events-auto flex p-4 backdrop-blur-xl`}
            >
              <div className="flex-1 w-0 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-md shadow-indigo-500/30">
                  🤝
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                    {notif.title}
                  </p>
                  <p className="text-sm font-medium text-white truncate mt-0.5">
                    {notif.message}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  toast.dismiss(t.id);
                  setViewMode('active');
                  setIsOpen(true);
                }}
                className="ml-3 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-500/25 shrink-0 self-center"
              >
                View
              </button>
            </div>
          ),
          { duration: 6000 }
        );
      } else {
        toast(notif.title + ': ' + notif.message, {
          icon: notif.type === 'login_alert' ? '🛡️' : notif.type === 'call_missed' ? '📞' : '🔔',
          duration: 4000,
        });
      }
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [socket, token]);

  // 3. Auto-Claim Pending Invite on Login
  useEffect(() => {
    if (!token || !user) return;

    const pendingRef = localStorage.getItem('talksphere_pending_ref');
    if (!pendingRef) return;

    const claimPendingInvite = async () => {
      try {
        const res = await apiClient.post('/api/notifications/claim-invite', { ref: pendingRef });
        if (res.data?.success) {
          toast.success(`Connected with @${pendingRef}!`);
          fetchNotifications();
        }
      } catch (err) {
        console.warn('Auto-claim invite warning:', err.response?.data?.message || err.message);
      } finally {
        localStorage.removeItem('talksphere_pending_ref');
      }
    };

    claimPendingInvite();
  }, [token, user, fetchNotifications]);

  // 4. Notification Actions
  const markAsRead = async (id) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await apiClient.put(`/api/notifications/${id}/read`);
    } catch (err) {
      console.error('Failed to mark notification read:', err.message);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      await apiClient.put('/api/notifications/read-all');
      toast.success('All marked as read');
    } catch (err) {
      console.error('Failed to mark all notifications read:', err.message);
    }
  };

  // Clear single notification from active list -> Saved in Database under History
  const clearNotification = async (id) => {
    try {
      const target = notifications.find((n) => n._id === id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setActiveCount((prev) => Math.max(0, prev - 1));
      setHistoryCount((prev) => prev + 1);
      if (target) {
        setHistoryNotifications((prev) => [{ ...target, isCleared: true, isRead: true }, ...prev]);
        if (!target.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
      await apiClient.put(`/api/notifications/${id}/clear`);
      toast.success('Notification cleared to history');
    } catch (err) {
      console.error('Failed to clear notification:', err.message);
      toast.error('Failed to clear notification');
    }
  };

  // Clear all active notifications -> Saved in Database under History
  const clearAllActive = async () => {
    try {
      const count = notifications.length;
      if (count === 0) return;
      const clearedItems = notifications.map((n) => ({ ...n, isCleared: true, isRead: true }));
      setNotifications([]);
      setUnreadCount(0);
      setActiveCount(0);
      setHistoryCount((prev) => prev + count);
      setHistoryNotifications((prev) => [...clearedItems, ...prev]);
      await apiClient.put('/api/notifications/clear-all');
      toast.success('All notifications cleared to history');
    } catch (err) {
      console.error('Failed to clear all notifications:', err.message);
      toast.error('Failed to clear notifications');
    }
  };

  // Restore notification from history back to active
  const restoreNotification = async (id) => {
    try {
      const target = historyNotifications.find((n) => n._id === id);
      setHistoryNotifications((prev) => prev.filter((n) => n._id !== id));
      setHistoryCount((prev) => Math.max(0, prev - 1));
      setActiveCount((prev) => prev + 1);
      if (target) {
        setNotifications((prev) => [{ ...target, isCleared: false }, ...prev]);
      }
      await apiClient.put(`/api/notifications/${id}/restore`);
      toast.success('Notification restored to active');
    } catch (err) {
      console.error('Failed to restore notification:', err.message);
      toast.error('Failed to restore notification');
    }
  };

  // Permanently delete a single notification from MongoDB database
  const deleteNotification = async (id, isFromHistory = false) => {
    try {
      if (isFromHistory) {
        setHistoryNotifications((prev) => prev.filter((n) => n._id !== id));
        setHistoryCount((prev) => Math.max(0, prev - 1));
      } else {
        const target = notifications.find((n) => n._id === id);
        setNotifications((prev) => prev.filter((n) => n._id !== id));
        setActiveCount((prev) => Math.max(0, prev - 1));
        if (target && !target.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
      await apiClient.delete(`/api/notifications/${id}`);
      toast.success('Notification permanently deleted from database');
    } catch (err) {
      console.error('Failed to delete notification:', err.message);
      toast.error('Failed to delete notification');
    }
  };

  // Permanently delete all history notifications from MongoDB database
  const clearHistory = async () => {
    try {
      setHistoryNotifications([]);
      setHistoryCount(0);
      await apiClient.delete('/api/notifications/history');
      toast.success('History permanently deleted from database');
    } catch (err) {
      console.error('Failed to clear history:', err.message);
      toast.error('Failed to clear history');
    }
  };

  // Permanently delete all ACTIVE notifications at once from MongoDB database (keeps history intact)
  const deleteAllActive = async () => {
    try {
      setNotifications([]);
      setUnreadCount(0);
      setActiveCount(0);
      await apiClient.delete('/api/notifications/active');
      toast.success('All active notifications permanently deleted from database');
    } catch (err) {
      console.error('Failed to delete active notifications:', err.message);
      toast.error('Failed to delete active notifications');
    }
  };

  // Permanently delete ALL notifications (active + history) from database
  const deleteAll = async () => {
    try {
      setNotifications([]);
      setHistoryNotifications([]);
      setUnreadCount(0);
      setActiveCount(0);
      setHistoryCount(0);
      await apiClient.delete('/api/notifications/all');
      toast.success('All notifications permanently deleted from database');
    } catch (err) {
      console.error('Failed to delete all notifications:', err.message);
      toast.error('Failed to delete notifications');
    }
  };

  // 5. One-Click Mutual Connect with Invited / Requesting User
  const connectUser = async (notificationId, targetUserId) => {
    try {
      const res = await apiClient.post('/api/notifications/connect-invite', {
        notificationId,
        targetUserId,
      });

      if (res.data?.success) {
        // Mark local notification action as done
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === notificationId ? { ...n, actionDone: true, isRead: true } : n
          )
        );
        toast.success(`Connected with ${res.data.contact?.name || 'user'}!`);

        // If registered callback exists, trigger opening chat with this contact
        if (onConnectAndChatRef.current && res.data.contact) {
          onConnectAndChatRef.current(res.data.contact);
          setIsOpen(false);
        }

        return res.data.contact;
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to connect');
      throw err;
    }
  };

  const value = {
    notifications,
    historyNotifications,
    unreadCount,
    activeCount,
    historyCount,
    isLoading,
    isLoadingHistory,
    isOpen,
    viewMode,
    setViewMode,
    setIsOpen,
    openNotifications: () => setIsOpen(true),
    closeNotifications: () => setIsOpen(false),
    fetchNotifications,
    fetchHistory,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAllActive,
    restoreNotification,
    deleteNotification,
    deleteAllActive,
    clearHistory,
    deleteAll,
    connectUser,
    registerChatOpener,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
