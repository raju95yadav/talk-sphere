import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  X,
  CheckCheck,
  Trash2,
  UserPlus,
  ShieldAlert,
  PhoneMissed,
  Sparkles,
  MessageSquare,
  Smartphone,
  ChevronRight,
  Clock,
  UserCheck
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

// Helper for formatting relative time
const formatTimeAgo = (dateStr) => {
  if (!dateStr) return 'Just now';
  const now = new Date();
  const date = new Date(dateStr);
  const diffInSec = Math.floor((now - date) / 1000);

  if (diffInSec < 60) return 'Just now';
  const diffInMin = Math.floor(diffInSec / 60);
  if (diffInMin < 60) return `${diffInMin}m ago`;
  const diffInHours = Math.floor(diffInMin / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Filter category configuration
const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'invites', label: '🤝 Invites', types: ['invite_joined'] },
  { id: 'security', label: '🛡️ Security', types: ['login_alert'] },
  { id: 'calls_chats', label: '📞 Calls & Chats', types: ['call_missed', 'chat_message', 'friend_request'] },
  { id: 'system_ai', label: '✨ System & AI', types: ['ai_alert', 'system'] },
];

const NotificationCenter = ({ onOpenSettings, onOpenChatWithContact }) => {
  const {
    notifications,
    unreadCount,
    isOpen,
    closeNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    connectUser,
  } = useNotifications();

  const [activeCategory, setActiveCategory] = useState('all');
  const [connectingId, setConnectingId] = useState(null);

  // Filter notifications by active tab
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    const cat = CATEGORIES.find((c) => c.id === activeCategory);
    if (!cat?.types) return notifications;
    return notifications.filter((n) => cat.types.includes(n.type));
  }, [notifications, activeCategory]);

  const handleConnect = async (notification) => {
    const targetUserId =
      notification.data?.senderId ||
      notification.sender?._id ||
      notification.sender;

    if (!targetUserId) return;

    setConnectingId(notification._id);
    try {
      const contact = await connectUser(notification._id, targetUserId);
      if (contact && onOpenChatWithContact) {
        onOpenChatWithContact(contact);
      }
    } finally {
      setConnectingId(null);
    }
  };

  const getItemVisuals = (notif) => {
    switch (notif.type) {
      case 'invite_joined':
        return {
          icon: UserPlus,
          bg: 'bg-emerald-500/15 border-emerald-500/25 text-emerald-600 dark:text-emerald-400',
          badge: 'INVITE CONNECTED',
          badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
        };
      case 'login_alert':
        return {
          icon: ShieldAlert,
          bg: 'bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400',
          badge: 'SECURITY LOGIN',
          badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
        };
      case 'call_missed':
        return {
          icon: PhoneMissed,
          bg: 'bg-rose-500/15 border-rose-500/25 text-rose-600 dark:text-rose-400',
          badge: 'MISSED CALL',
          badgeColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
        };
      case 'friend_request':
        return {
          icon: UserCheck,
          bg: 'bg-cyan-500/15 border-cyan-500/25 text-cyan-600 dark:text-cyan-400',
          badge: 'NEW CONTACT',
          badgeColor: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30'
        };
      case 'ai_alert':
        return {
          icon: Sparkles,
          bg: 'bg-purple-500/15 border-purple-500/25 text-purple-600 dark:text-purple-400',
          badge: 'AI ASSISTANT',
          badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30'
        };
      default:
        return {
          icon: Bell,
          bg: 'bg-blue-500/15 border-blue-500/25 text-blue-600 dark:text-blue-400',
          badge: 'SYSTEM UPDATE',
          badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
        };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeNotifications}
            className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm cursor-pointer"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="relative w-full max-w-md sm:max-w-lg h-full bg-[#f8fafc] dark:bg-[#11141a] text-slate-900 dark:text-white border-l border-slate-200 dark:border-gray-800/60 shadow-2xl shadow-black/20 dark:shadow-black/70 flex flex-col z-10 overflow-hidden transition-colors duration-300"
          >
            {/* Top Highlight Accent Line */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none z-10" />

            {/* Ambient Background Glow (Subtle in light, vivid in dark) */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-10 left-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />

            {/* Header */}
            <div className="relative p-4 sm:p-5 border-b border-slate-200 dark:border-gray-800/60 flex items-center justify-between gap-3 shrink-0 bg-white/70 dark:bg-white/[0.02] backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 shrink-0">
                  <Bell size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    NOTIFICATIONS
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-slate-950 tracking-wider shadow-sm">
                        {unreadCount} NEW
                      </span>
                    )}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">
                    Real-time updates across all TalkSphere events
                  </p>
                </div>
              </div>

              {/* Header Action Controls */}
              <div className="flex items-center gap-1.5">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={markAllAsRead}
                      title="Mark all as read"
                      className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800/80 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200 dark:border-gray-700/50 transition-all cursor-pointer"
                    >
                      <CheckCheck size={16} />
                    </button>
                    <button
                      onClick={clearAll}
                      title="Clear all"
                      className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800/80 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-gray-700/50 transition-all cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button
                  onClick={closeNotifications}
                  title="Close panel"
                  className="p-2 rounded-xl bg-slate-100 dark:bg-gray-800/80 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-gray-700/50 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-gray-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-slate-100/50 dark:bg-black/20">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-bold'
                      : 'bg-white/80 dark:bg-gray-800/60 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-gray-700/50'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
              {filteredNotifications.length === 0 ? (
                <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 select-none">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-400 dark:text-gray-500 mb-3 shadow-sm">
                    <Bell size={28} className="stroke-[1.5]" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-gray-200 uppercase tracking-wider">
                    All Caught Up
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-500 max-w-xs mt-1">
                    No active notifications in this category. You're completely up to date!
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const visuals = getItemVisuals(notif);
                  const Icon = visuals.icon;
                  const isInvite = notif.type === 'invite_joined';

                  return (
                    <motion.div
                      key={notif._id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      className={`relative p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        notif.isRead
                          ? 'bg-white/80 dark:bg-gray-850/40 dark:bg-gray-900/40 border-slate-200/80 dark:border-gray-800/60 shadow-sm hover:shadow-md'
                          : 'bg-emerald-500/[0.06] dark:bg-gradient-to-r dark:from-emerald-500/[0.09] dark:to-teal-500/[0.04] border-emerald-500/35 dark:border-emerald-500/30 shadow-md shadow-emerald-500/5'
                      }`}
                    >
                      {/* Unread Glowing Dot */}
                      {!notif.isRead && (
                        <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                      )}

                      <div className="flex items-start gap-3">
                        {/* Icon or Avatar */}
                        <div
                          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${visuals.bg}`}
                        >
                          {notif.sender?.avatar ? (
                            <img
                              src={notif.sender.avatar}
                              alt=""
                              className="w-full h-full object-cover rounded-xl"
                            />
                          ) : (
                            <Icon size={19} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${visuals.badgeColor}`}
                            >
                              {visuals.badge}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-gray-400 flex items-center gap-1 font-mono">
                              <Clock size={10} />
                              {formatTimeAgo(notif.createdAt)}
                            </span>
                          </div>

                          <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {notif.title}
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-gray-300 mt-1 leading-relaxed break-words">
                            {notif.message}
                          </p>

                          {/* Action Buttons for Invite and Security */}
                          {isInvite && (
                            <div className="mt-3 flex items-center gap-2">
                              {notif.actionDone ? (
                                <button
                                  onClick={() => {
                                    closeNotifications();
                                    const targetId =
                                      notif.data?.senderId ||
                                      notif.sender?._id ||
                                      notif.sender;
                                    if (onOpenChatWithContact && targetId) {
                                      onOpenChatWithContact({ _id: targetId, id: targetId });
                                    }
                                  }}
                                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 transition-all cursor-pointer shadow-sm"
                                >
                                  <UserCheck size={14} />
                                  Connected • Open Chat
                                </button>
                              ) : (
                                <button
                                  id={`notif-connect-btn-${notif._id}`}
                                  disabled={connectingId === notif._id}
                                  onClick={() => handleConnect(notif)}
                                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
                                >
                                  {connectingId === notif._id ? (
                                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <span>🤝 CONNECT & CHAT ASAP</span>
                                      <ChevronRight size={14} />
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}

                          {notif.type === 'login_alert' && (
                            <div className="mt-3">
                              <button
                                onClick={() => {
                                  closeNotifications();
                                  if (onOpenSettings) onOpenSettings('linked-devices');
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5 border border-amber-500/30 transition-all cursor-pointer"
                              >
                                <Smartphone size={13} />
                                Review Active Devices
                              </button>
                            </div>
                          )}

                          {notif.type === 'friend_request' && (
                            <div className="mt-3">
                              <button
                                onClick={() => {
                                  closeNotifications();
                                  const targetId =
                                    notif.data?.senderId ||
                                    notif.sender?._id ||
                                    notif.sender;
                                  if (onOpenChatWithContact && targetId) {
                                    onOpenChatWithContact({ _id: targetId, id: targetId });
                                  }
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 font-bold text-xs flex items-center gap-1.5 border border-cyan-500/30 transition-all cursor-pointer"
                              >
                                <MessageSquare size={13} />
                                Open Chat
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Individual Delete / Dismiss */}
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <button
                            onClick={() => deleteNotification(notif._id)}
                            title="Remove notification"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 dark:text-gray-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                          {!notif.isRead && (
                            <button
                              onClick={() => markAsRead(notif._id)}
                              title="Mark read"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 dark:text-gray-500 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                            >
                              <CheckCheck size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer Info */}
            <div className="p-3 border-t border-slate-200 dark:border-gray-800/60 bg-slate-50 dark:bg-white/[0.01] flex items-center justify-between text-[11px] text-slate-500 dark:text-gray-400 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Socket Active
              </span>
              <span>TalkSphere Notifications</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NotificationCenter;
