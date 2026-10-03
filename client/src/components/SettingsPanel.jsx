import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  X,
  Search,
  User,
  Smartphone,
  UserPlus,
  Database,
  RefreshCw,
  LogOut,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Sun,
  Moon,
  Bell,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import toast from 'react-hot-toast';
import ProfileDisplayCard from './ProfileDisplayCard';
import ProfileSettingsPage from './ProfileSettingsPage';
import LinkedDevicesPage from './LinkedDevicesPage';
import InviteFriendPage from './InviteFriendPage';
import StorageDataPage from './StorageDataPage';

// ─────────────────────────────────────────────────────────────
// Settings menu item definitions
// ─────────────────────────────────────────────────────────────
const SETTINGS_ITEMS = [
  {
    id: 'profile',
    icon: User,
    label: 'Profile',
    description: 'Name, profile picture, username',
    accent: true,
  },
  {
    id: 'linked-devices',
    icon: Smartphone,
    label: 'Linked devices',
    description: 'Use TalkSphere on other devices',
  },
  {
    id: 'invite-friend',
    icon: UserPlus,
    label: 'Invite a friend',
    description: 'Share your profile link',
  },
  {
    id: 'notifications',
    icon: Bell,
    label: 'Notifications',
    description: 'System alerts, invites, calls, and security',
  },
  {
    id: 'storage-data',
    icon: RefreshCw,
    label: 'Storage and data',
    description: 'Network usage, auto-download, local cache',
  },
];

// ─────────────────────────────────────────────────────────────
// Individual Settings Row
// ─────────────────────────────────────────────────────────────
const SettingsRow = ({ item, onClick }) => {
  const Icon = item.icon;
  return (
    <motion.button
      id={`settings-item-${item.id}`}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(item.id)}
      className="w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/8 transition-all group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      {/* Icon container */}
      <div
        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          item.accent
            ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 dark:text-emerald-400 group-hover:bg-emerald-500/25 group-hover:text-emerald-600 dark:group-hover:text-emerald-300'
            : 'bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 text-slate-600 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-gray-200 group-hover:border-slate-300 dark:group-hover:border-gray-600/60 group-hover:bg-slate-200/70 dark:group-hover:bg-gray-700/60'
        }`}
      >
        <Icon size={16} />
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0 text-left">
        <p
          className={`text-[13px] font-semibold leading-tight truncate transition-colors ${
            item.accent
              ? 'text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300'
              : 'text-slate-800 dark:text-gray-200 group-hover:text-slate-950 dark:group-hover:text-white'
          }`}
        >
          {item.label}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-gray-500 leading-snug truncate mt-0.5 group-hover:text-slate-700 dark:group-hover:text-gray-400 transition-colors">
          {item.description}
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight
        size={14}
        className="shrink-0 text-slate-400 dark:text-gray-600 group-hover:text-slate-700 dark:group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all"
      />
    </motion.button>
  );
};

// ─────────────────────────────────────────────────────────────
// Main SettingsPanel Component
// ─────────────────────────────────────────────────────────────
/**
 * SettingsPanel
 *
 * Props:
 *  - isOpen      {boolean}    Whether the panel is visible
 *  - onClose     {function}   Called when the back/close button is pressed
 *  - onNavigate  {function}   Called with a settings item id when a row is clicked
 */
const SettingsPanel = ({ isOpen = true, onClose, onNavigate }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { openNotifications } = useNotifications();
  const socket = useSocket();
  const [query, setQuery] = useState('');
  const [activePage, setActivePage] = useState(null); // null | 'profile'
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (socket) {
        socket.disconnect();
      }
      await logout();
      toast.success('Logged out successfully');
      setShowLogoutModal(false);
      if (onClose) onClose();
    } catch (err) {
      toast.error('Failed to log out');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const dynamicItems = useMemo(() => [
    ...SETTINGS_ITEMS,
    {
      id: 'theme',
      icon: isDarkMode ? Sun : Moon,
      label: 'Theme & Appearance',
      description: isDarkMode ? 'Dark theme active (Tap to switch to Light)' : 'Light theme active (Tap to switch to Dark)',
      isTheme: true,
    },
  ], [isDarkMode]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dynamicItems;
    return dynamicItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [query, dynamicItems]);

  const displayName = user?.name || user?.username || user?.email || 'You';
  const isSearching = query.trim().length > 0;

  // Panel animation
  const panelVariants = {
    hidden:  { opacity: 0, x: -28, scale: 0.97 },
    visible: { opacity: 1, x: 0,   scale: 1,    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
    exit:    { opacity: 0, x: -20, scale: 0.97,  transition: { duration: 0.22, ease: 'easeIn' } },
  };

  // Children stagger
  const listVariants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.18 } },
  };

  const childVariants = {
    hidden:  { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0,  transition: { duration: 0.28, ease: 'easeOut' } },
  };

  return (
    <>
      <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="settings-panel"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-label="Settings panel"
          className="
            relative flex flex-col
            w-full sm:w-96 max-w-full sm:max-w-md
            min-h-screen md:min-h-0 md:h-full
            bg-[#f8fafc] dark:bg-[#11141a]
            text-slate-900 dark:text-white
            border-r border-slate-200 dark:border-gray-800/60
            shadow-2xl shadow-black/20 dark:shadow-black/70
            overflow-hidden transition-colors duration-300
          "
        >
          {/* Top highlight line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none z-10" />

          {/* Scrollable content */}
          <div className="flex flex-col flex-1 overflow-y-auto px-4 pt-5 pb-8 space-y-1">

            {/* ── HEADER ── */}
            <motion.div
              variants={childVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-2.5 sm:gap-3 mb-5"
            >
              {/* Back button */}
              {onClose && (
                <motion.button
                  id="settings-panel-back"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={onClose}
                  aria-label="Go back"
                  className="w-8 h-8 shrink-0 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-gray-700/80 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  <ArrowLeft size={15} />
                </motion.button>
              )}

              {/* Title */}
              <div className="flex-1 min-w-0">
                <h2
                  id="settings-panel-title"
                  className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white truncate leading-tight"
                >
                  {displayName}
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400/75 leading-none mt-0.5">
                  Settings
                </p>
              </div>

              {/* Theme toggle button */}
              <motion.button
                id="settings-theme-toggle"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  toggleTheme();
                  toast.success(isDarkMode ? 'Switched to Light mode' : 'Switched to Dark mode', { id: 'theme-toast', duration: 1500 });
                }}
                aria-label="Toggle theme"
                title={isDarkMode ? 'Switch to Light mode' : 'Switch to Dark mode'}
                className="w-8 h-8 shrink-0 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-600 dark:text-gray-400 hover:text-amber-500 dark:hover:text-yellow-400 hover:bg-slate-200 dark:hover:bg-gray-700/80 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={isDarkMode ? 'dark' : 'light'}
                    initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
                    transition={{ duration: 0.18 }}
                  >
                    {isDarkMode ? (
                      <Sun size={15} className="text-yellow-400" />
                    ) : (
                      <Moon size={15} className="text-slate-700" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.button>

              {/* Avatar chip */}
              <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600/25 to-emerald-800/15 border border-emerald-500/25 flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={16} className="text-emerald-500 dark:text-emerald-400" />
                )}
              </div>
            </motion.div>

            {/* ── SEARCH BAR ── */}
            <motion.div
              variants={childVariants}
              initial="hidden"
              animate="visible"
              className="relative"
            >
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-gray-500 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="settings-search-input"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                aria-label="Search settings"
                className="
                  w-full
                  bg-slate-100 dark:bg-gray-800/70 border border-slate-200 dark:border-gray-700/50
                  text-slate-900 dark:text-white text-[13px] font-medium
                  placeholder-slate-400 dark:placeholder-gray-500
                  rounded-full
                  py-2.5 pl-9 pr-9
                  outline-none
                  transition-all duration-200
                  focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40
                  hover:bg-slate-200/70 dark:hover:bg-gray-800
                "
              />
              <AnimatePresence>
                {isSearching && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ duration: 0.14 }}
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 dark:bg-gray-600/70 flex items-center justify-center text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-300 dark:hover:bg-gray-500/80 transition-all cursor-pointer focus-visible:outline-none"
                  >
                    <X size={10} />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── PROFILE DISPLAY CARD (always visible, hidden while searching) ── */}
            {!isSearching && (
              <motion.div
                variants={childVariants}
                initial="hidden"
                animate="visible"
                className="py-5 flex justify-center border-b border-slate-200 dark:border-gray-800/60 mb-1"
              >
                <ProfileDisplayCard size="md" />
              </motion.div>
            )}

            {/* ── SETTINGS LIST ── */}
            <motion.div
              variants={listVariants}
              initial="hidden"
              animate="visible"
              className="mt-3 space-y-0.5"
            >
              <AnimatePresence mode="popLayout">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <motion.div
                      key={item.id}
                      variants={childVariants}
                      layout
                      exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                    >
                      <SettingsRow
                        item={item}
                        onClick={(id) => {
                          if (id === 'theme') {
                            toggleTheme();
                            toast.success(isDarkMode ? 'Switched to Light mode' : 'Switched to Dark mode', { id: 'theme-toast', duration: 1500 });
                          } else if (id === 'profile') {
                            setActivePage('profile');
                          } else if (id === 'linked-devices') {
                            setActivePage('linked-devices');
                          } else if (id === 'invite-friend') {
                            setActivePage('invite-friend');
                          } else if (id === 'notifications') {
                            onClose?.();
                            openNotifications?.();
                          } else if (id === 'storage-data') {
                            setActivePage('storage-data');
                          } else {
                            onNavigate?.(id);
                          }
                        }}
                      />
                    </motion.div>
                  ))
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="py-12 flex flex-col items-center gap-3 text-center"
                  >
                    <Search size={30} className="text-slate-300 dark:text-gray-700" />
                    <p className="text-[12px] text-slate-500 dark:text-gray-500 font-medium">
                      No results for{' '}
                      <span className="text-slate-800 dark:text-gray-300 font-semibold">"{query}"</span>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── DIVIDER (hidden while searching) ── */}
            {!isSearching && (
              <motion.div
                variants={childVariants}
                initial="hidden"
                animate="visible"
                className="pt-1 border-t border-slate-200 dark:border-gray-800/80"
              />
            )}

            {/* ── LOGOUT (hidden while searching) ── */}
            {!isSearching && (
              <motion.div
                variants={childVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.button
                  id="settings-logout-btn"
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowLogoutModal(true)}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-red-500/10 transition-colors group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                >
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 group-hover:bg-red-500/20 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    <LogOut size={16} />
                  </div>
                  <span className="text-[13px] font-semibold text-red-500 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    Log out
                  </span>
                </motion.button>
              </motion.div>
            )}
          </div>

          {/* Bottom fade-out gradient */}
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#f8fafc] dark:from-[#11141a] to-transparent" />

          {/* ── Profile sub-page ── */}
          <ProfileSettingsPage
            isOpen={activePage === 'profile'}
            onBack={() => setActivePage(null)}
          />

          {/* ── Linked Devices sub-page ── */}
          <LinkedDevicesPage
            isOpen={activePage === 'linked-devices'}
            onBack={() => setActivePage(null)}
          />

          {/* ── Invite a Friend sub-page ── */}
          <InviteFriendPage
            isOpen={activePage === 'invite-friend'}
            onBack={() => setActivePage(null)}
          />

          {/* ── Storage & Data sub-page ── */}
          <StorageDataPage
            isOpen={activePage === 'storage-data'}
            onBack={() => setActivePage(null)}
          />
        </motion.aside>
      )}
    </AnimatePresence>

    {/* ── Logout Confirmation Modal ── */}
    <AnimatePresence>
      {showLogoutModal && (
        <motion.div
          key="logout-confirmation-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoggingOut) {
              setShowLogoutModal(false);
            }
          }}
          className="fixed inset-0 z-[300] backdrop-blur-md bg-black/60 flex items-center justify-center p-4 select-none"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 16 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[340px] rounded-3xl border border-slate-200 dark:border-gray-700/60 p-6 flex flex-col items-center text-center shadow-2xl overflow-hidden bg-white dark:bg-[#141720]"
          >
            {/* Warning icon */}
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 dark:text-red-400 mb-4 shadow-inner">
              <AlertTriangle size={24} />
            </div>

            {/* Title & Description */}
            <h3 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white mb-2 leading-snug">
              Log out of Talk Sphere?
            </h3>
            <p className="text-[13px] text-slate-600 dark:text-gray-300 leading-relaxed mb-6 px-1">
              You will need to log back in to access your chats and calls.
            </p>

            {/* Action Buttons */}
            <div className="w-full flex items-center gap-3">
              <button
                id="logout-modal-cancel-btn"
                type="button"
                disabled={isLoggingOut}
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-slate-800 dark:text-white font-semibold text-[13px] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="logout-modal-confirm-btn"
                type="button"
                disabled={isLoggingOut}
                onClick={handleConfirmLogout}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 font-semibold text-[13px] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Logging out...</span>
                  </>
                ) : (
                  'Confirm Log Out'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default SettingsPanel;
