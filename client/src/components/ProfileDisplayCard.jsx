import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, ChevronDown, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Presence status definitions
// ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  {
    id: 'available',
    label: 'Available',
    dot: '#22c55e',         // green-500
    ring: 'ring-green-500/40',
    bg: 'bg-green-500/15 border-green-500/30 text-green-400',
    pulse: true,
  },
  {
    id: 'busy',
    label: 'Busy',
    dot: '#f59e0b',         // amber-500
    ring: 'ring-amber-500/40',
    bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    pulse: false,
  },
  {
    id: 'away',
    label: 'Away',
    dot: '#64748b',         // slate-500
    ring: 'ring-slate-500/40',
    bg: 'bg-slate-500/15 border-slate-500/30 text-slate-400',
    pulse: false,
  },
  {
    id: 'in-a-call',
    label: 'In a Call',
    dot: '#ef4444',         // red-500
    ring: 'ring-red-500/40',
    bg: 'bg-red-500/15 border-red-500/30 text-red-400',
    pulse: true,
  },
  {
    id: 'do-not-disturb',
    label: 'Do Not Disturb',
    dot: '#8b5cf6',         // violet-500
    ring: 'ring-violet-500/40',
    bg: 'bg-violet-500/15 border-violet-500/30 text-violet-400',
    pulse: false,
  },
];

const getStatus = (id) =>
  STATUS_OPTIONS.find((s) => s.id === id) ?? STATUS_OPTIONS[0];

// ─────────────────────────────────────────────────────────────
// StatusDot  – tiny animated presence indicator
// ─────────────────────────────────────────────────────────────
const StatusDot = ({ statusId, size = 10 }) => {
  const s = getStatus(statusId);
  return (
    <span className="relative flex" style={{ width: size, height: size }}>
      {s.pulse && (
        <span
          className="absolute inline-flex rounded-full opacity-75 animate-ping"
          style={{ width: size, height: size, backgroundColor: s.dot }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{ width: size, height: size, backgroundColor: s.dot }}
      />
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// StatusBubble – the floating pill + dropdown trigger
// ─────────────────────────────────────────────────────────────
const StatusBubble = ({ statusId, onSelect, isChanging }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const s = getStatus(statusId);

  // Click-outside to close
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative flex flex-col items-center z-30">
      {/* Speech bubble tail */}
      <div className="w-2.5 h-2 overflow-hidden flex justify-center">
        <div
          className="w-2 h-2 rotate-45 border-l border-t border-gray-700/60"
          style={{ background: '#1a1d24', marginTop: '4px' }}
        />
      </div>

      {/* Pill trigger */}
      <motion.button
        id="profile-status-bubble"
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((v) => !v)}
        disabled={isChanging}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold tracking-wide shadow-lg backdrop-blur-sm cursor-pointer transition-all select-none ${s.bg} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[#11141a] ${s.ring}`}
        style={{ background: '#1a1d24' }}
      >
        {isChanging ? (
          <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <StatusDot statusId={statusId} size={7} />
        )}
        <span>{s.label}</span>
        <ChevronDown
          size={11}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Select presence status"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute top-full mt-2 w-44 rounded-2xl border border-gray-700/60 shadow-2xl shadow-black/60 overflow-hidden z-50"
            style={{ background: '#1a1d24' }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <motion.li
                key={opt.id}
                role="option"
                aria-selected={opt.id === statusId}
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                onClick={() => {
                  onSelect(opt.id);
                  setOpen(false);
                }}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors"
              >
                <StatusDot statusId={opt.id} size={8} />
                <span className="flex-1 text-[12px] font-medium text-gray-200">
                  {opt.label}
                </span>
                {opt.id === statusId && (
                  <Check size={12} className="text-emerald-400 shrink-0" />
                )}
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main ProfileDisplayCard
// ─────────────────────────────────────────────────────────────
/**
 * ProfileDisplayCard
 *
 * Props:
 *  - className  {string}   Additional wrapper classes
 *  - size       {'sm'|'md'|'lg'}  Avatar size preset (default 'lg')
 */
const ProfileDisplayCard = ({ className = '', size = 'lg' }) => {
  const { user, refreshUser, updateUserData } = useAuth();
  const socket = useSocket();

  const [isUploading, setIsUploading] = useState(false);
  const [isHoveringAvatar, setIsHoveringAvatar] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState(
    user?.presenceStatus ?? 'available'
  );
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const fileInputRef = useRef(null);

  // Keep local status synced with auth user on mount / user change
  useEffect(() => {
    if (user?.presenceStatus) setPresenceStatus(user.presenceStatus);
  }, [user?.presenceStatus]);

  // Listen for real-time presence changes from other tabs / devices
  useEffect(() => {
    if (!socket) return;
    const userId = user?._id || user?.id;
    const handler = ({ userId: changedId, presenceStatus: newStatus }) => {
      if (changedId?.toString() === userId?.toString()) {
        setPresenceStatus(newStatus);
      }
    };
    socket.on('presence_status_change', handler);
    return () => socket.off('presence_status_change', handler);
  }, [socket, user]);

  // Avatar size presets
  const sizeMap = {
    sm: { outer: 'w-20 h-20', text: 'text-2xl', cam: 16 },
    md: { outer: 'w-28 h-28', text: 'text-3xl', cam: 18 },
    lg: { outer: 'w-36 h-36 sm:w-40 sm:h-40', text: 'text-4xl', cam: 22 },
  };
  const sz = sizeMap[size] ?? sizeMap.lg;

  const displayName = user?.name || user?.username || user?.email || 'User';
  const initials = displayName
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // ── Avatar upload ──────────────────────────────────────────
  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be under 5 MB');
        return;
      }
      const formData = new FormData();
      formData.append('avatar', file);
      setIsUploading(true);
      try {
        const res = await apiClient.post('/api/users/avatar', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Avatar updated!');
        if (res.data?.avatar && updateUserData) {
          updateUserData({ ...user, avatar: res.data.avatar });
        } else {
          await refreshUser();
        }
      } catch {
        toast.error('Avatar upload failed');
      } finally {
        setIsUploading(false);
        // Reset so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [user, refreshUser, updateUserData]
  );

  // ── Presence status change ─────────────────────────────────
  const handleStatusSelect = useCallback(
    async (newStatus) => {
      if (newStatus === presenceStatus) return;
      setIsChangingStatus(true);
      // Optimistic local update
      setPresenceStatus(newStatus);
      try {
        const res = await apiClient.patch('/api/users/presence', {
          presenceStatus: newStatus,
        });
        if (updateUserData && res.data?.user) {
          updateUserData(res.data.user);
        }
        toast.success(`Status set to ${getStatus(newStatus).label}`);
      } catch {
        // Revert on failure
        setPresenceStatus(presenceStatus);
        toast.error('Failed to update status');
      } finally {
        setIsChangingStatus(false);
      }
    },
    [presenceStatus, updateUserData]
  );

  const currentStatus = getStatus(presenceStatus);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center ${className}`}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
        aria-label="Upload profile picture"
      />

      {/* ── Status speech bubble (above avatar) ── */}
      <div className="mb-2">
        <StatusBubble
          statusId={presenceStatus}
          onSelect={handleStatusSelect}
          isChanging={isChangingStatus}
        />
      </div>

      {/* ── Avatar ring container ── */}
      <motion.div
        id="profile-avatar-container"
        className="relative cursor-pointer select-none"
        onHoverStart={() => setIsHoveringAvatar(true)}
        onHoverEnd={() => setIsHoveringAvatar(false)}
        whileTap={{ scale: 0.97 }}
        onClick={() => fileInputRef.current?.click()}
        title="Change profile picture"
      >
        {/* Outer luxury ring */}
        <div
          className={`
            ${sz.outer}
            rounded-full p-[3px]
            ring-4 ring-gray-800/80
            hover:ring-emerald-500/40
            transition-all duration-300
            shadow-2xl shadow-black/50
          `}
          style={{
            background: `conic-gradient(
              ${currentStatus.dot}55 0%,
              #1e2130 40%,
              ${currentStatus.dot}33 80%,
              #1e2130 100%
            )`,
          }}
        >
          {/* Inner image circle */}
          <div className={`relative w-full h-full rounded-full overflow-hidden bg-gray-900 border-2 border-gray-800/60`}>
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={displayName}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                <span className={`${sz.text} font-black text-gray-400 select-none`}>
                  {initials}
                </span>
              </div>
            )}

            {/* Hover edit overlay */}
            <AnimatePresence>
              {(isHoveringAvatar || isUploading) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-1.5 backdrop-blur-[2px]"
                >
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Camera size={sz.cam} className="text-white drop-shadow" />
                      <span className="text-[10px] font-bold text-white/90 tracking-wide uppercase">
                        Edit
                      </span>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Status dot badge on ring bottom-right */}
        <div
          className="absolute bottom-1 right-1 rounded-full p-[2px] shadow-lg"
          style={{ background: '#11141a' }}
        >
          <StatusDot statusId={presenceStatus} size={12} />
        </div>
      </motion.div>

      {/* ── Name + email ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="mt-4 text-center"
      >
        <h3 className="text-[17px] font-black tracking-tight text-white leading-tight">
          {displayName}
        </h3>
        {user?.email && (
          <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[200px]">
            {user.email}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
};

export default ProfileDisplayCard;
