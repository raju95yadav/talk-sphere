import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  X,
  Search,
  Bell,
  User,
  Smartphone,
  UserPlus,
  Database,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ProfileDisplayCard from './ProfileDisplayCard';
import ProfileSettingsPage from './ProfileSettingsPage';

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
    id: 'storage-data',
    icon: Database,
    label: 'Storage and data',
    description: 'Network usage, auto-download',
  },
];

// ─────────────────────────────────────────────────────────────
// Notification Banner
// ─────────────────────────────────────────────────────────────
const BANNER_STORAGE_KEY = 'ts_notif_banner_dismissed';

const NotificationBanner = () => {
  const [visible, setVisible] = useState(
    () => localStorage.getItem(BANNER_STORAGE_KEY) !== 'true'
  );

  const dismiss = useCallback(() => {
    localStorage.setItem(BANNER_STORAGE_KEY, 'true');
    setVisible(false);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="notif-banner"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -14, scale: 0.96, height: 0, marginTop: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-start gap-3 bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700/60 rounded-2xl p-4 mt-2 overflow-hidden"
          role="alert"
          aria-live="polite"
        >
          {/* Left emerald accent stripe */}
          <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-2xl bg-gradient-to-b from-emerald-400 to-emerald-600" />

          {/* Bell icon bubble */}
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <Bell size={15} className="text-emerald-400" />
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-white leading-snug mb-0.5">
              Choose your notifications
            </p>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Get notifications for messages, groups or your status.{' '}
              <button
                id="settings-banner-choose-now"
                onClick={dismiss}
                className="text-emerald-400 font-semibold hover:underline hover:text-emerald-300 transition-colors cursor-pointer focus-visible:outline-none"
              >
                Choose now
              </button>
            </p>
          </div>

          {/* Close X button */}
          <motion.button
            id="settings-banner-dismiss"
            whileTap={{ scale: 0.85 }}
            onClick={dismiss}
            aria-label="Dismiss notification prompt"
            className="shrink-0 w-6 h-6 rounded-lg bg-gray-700/60 hover:bg-gray-600/80 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <X size={11} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

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
      className="w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-white/5 active:bg-white/8 transition-all group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
    >
      {/* Icon container */}
      <div
        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
          item.accent
            ? 'bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 group-hover:bg-emerald-500/25 group-hover:text-emerald-300'
            : 'bg-gray-800/80 border border-gray-700/50 text-gray-400 group-hover:text-gray-200 group-hover:border-gray-600/60 group-hover:bg-gray-700/60'
        }`}
      >
        <Icon size={16} />
      </div>

      {/* Label + description */}
      <div className="flex-1 min-w-0 text-left">
        <p
          className={`text-[13px] font-semibold leading-tight truncate transition-colors ${
            item.accent
              ? 'text-white group-hover:text-emerald-300'
              : 'text-gray-200 group-hover:text-white'
          }`}
        >
          {item.label}
        </p>
        <p className="text-[11px] text-gray-500 leading-snug truncate mt-0.5 group-hover:text-gray-400 transition-colors">
          {item.description}
        </p>
      </div>

      {/* Chevron */}
      <ChevronRight
        size={14}
        className="shrink-0 text-gray-600 group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all"
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
  const [query, setQuery] = useState('');
  const [activePage, setActivePage] = useState(null); // null | 'profile'

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTINGS_ITEMS;
    return SETTINGS_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [query]);

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
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          key="settings-panel"
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-label="Settings panel"
          style={{ background: '#11141a' }}
          className="
            relative flex flex-col
            w-full max-w-sm
            min-h-screen md:min-h-0 md:h-full
            border-r border-gray-800/60
            shadow-2xl shadow-black/70
            overflow-hidden
          "
        >
          {/* Top highlight line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent pointer-events-none z-10" />

          {/* Scrollable content */}
          <div className="flex flex-col flex-1 overflow-y-auto px-4 pt-5 pb-8 space-y-1">

            {/* ── HEADER ── */}
            <motion.div
              variants={childVariants}
              initial="hidden"
              animate="visible"
              className="flex items-center gap-3 mb-5"
            >
              {/* Back button */}
              {onClose && (
                <motion.button
                  id="settings-panel-back"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={onClose}
                  aria-label="Go back"
                  className="w-8 h-8 shrink-0 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/80 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  <ArrowLeft size={15} />
                </motion.button>
              )}

              {/* Title */}
              <div className="flex-1 min-w-0">
                <h2
                  id="settings-panel-title"
                  className="text-[17px] font-black tracking-tight text-white truncate leading-tight"
                >
                  {displayName}
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/75 leading-none mt-0.5">
                  Settings
                </p>
              </div>

              {/* Avatar chip */}
              <div className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600/25 to-emerald-800/15 border border-emerald-500/25 flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={16} className="text-emerald-400" />
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
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
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
                  bg-gray-800/70 border border-gray-700/50
                  text-white text-[13px] font-medium
                  placeholder-gray-500
                  rounded-full
                  py-2.5 pl-9 pr-9
                  outline-none
                  transition-all duration-200
                  focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/40
                  hover:bg-gray-800
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-600/70 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-500/80 transition-all cursor-pointer focus-visible:outline-none"
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
                className="py-5 flex justify-center border-b border-gray-800/60 mb-1"
              >
                <ProfileDisplayCard size="md" />
              </motion.div>
            )}

            {/* ── NOTIFICATION BANNER (hidden while searching) ── */}
            {!isSearching && <NotificationBanner />}

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
                          if (id === 'profile') {
                            setActivePage('profile');
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
                    <Search size={30} className="text-gray-700" />
                    <p className="text-[12px] text-gray-500 font-medium">
                      No results for{' '}
                      <span className="text-gray-300 font-semibold">"{query}"</span>
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
                className="pt-1 border-t border-gray-800/80"
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
                  whileTap={{ scale: 0.97 }}
                  onClick={logout}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl hover:bg-red-500/8 transition-all group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                >
                  <div className="shrink-0 w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:bg-red-500/18 group-hover:text-red-300 transition-all">
                    <LogOut size={16} />
                  </div>
                  <span className="text-[13px] font-semibold text-red-400 group-hover:text-red-300 transition-colors">
                    Log out
                  </span>
                </motion.button>
              </motion.div>
            )}
          </div>

          {/* Bottom fade-out gradient */}
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-12 bg-gradient-to-t from-[#11141a] to-transparent" />

          {/* ── Profile sub-page (slides in over list) ── */}
          <ProfileSettingsPage
            isOpen={activePage === 'profile'}
            onBack={() => setActivePage(null)}
          />
        </motion.aside>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;
