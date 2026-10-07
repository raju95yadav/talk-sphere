import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  Trash2,
  Pencil,
  Check,
  X,
  AtSign,
  User,
  FileText,
  Phone,
  Mail,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Smile,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const NAME_MAX = 40;
const BIO_MAX  = 120;

const BIO_PRESETS = [
  { emoji: '🟢', text: 'Available' },
  { emoji: '💼', text: 'At work' },
  { emoji: '🔋', text: 'Battery about to die' },
  { emoji: '📅', text: 'In a meeting' },
  { emoji: '🎮', text: 'Gaming' },
  { emoji: '🚗', text: 'On the road' },
];

const EMOJI_QUICK = ['😊','😂','❤️','👍','🔥','✨','🎉','💯','🙏','😎','🤔','😴'];

// ─────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────
const slideVariants = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.2,  ease: 'easeIn' } },
};

const childVar = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
};

// Counter color helper
const counterColor = (len, max) => {
  const pct = len / max;
  if (pct >= 1)   return 'text-red-400';
  if (pct >= 0.8) return 'text-amber-400';
  return 'text-gray-500';
};

// ─────────────────────────────────────────────────────────────
// SectionLabel
// ─────────────────────────────────────────────────────────────
const SectionLabel = ({ children }) => (
  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-500 mb-2 px-1">
    {children}
  </p>
);

// ─────────────────────────────────────────────────────────────
// FieldCard – glass wrapper for each editable row
// ─────────────────────────────────────────────────────────────
const FieldCard = ({ children, className = '' }) => (
  <div
    className={`w-full bg-white dark:bg-[#1C1D2A] border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-3 shadow-sm transition-all duration-200 focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-500/15 ${className}`}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────
// ReadOnlyCredential
// ─────────────────────────────────────────────────────────────
const ReadOnlyCredential = ({ icon: Icon, label, value, verified = false }) => (
  <FieldCard>
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-500 dark:text-gray-500 shrink-0">
        <Icon size={15} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-500 dark:text-gray-500 font-semibold uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="text-[13px] text-slate-800 dark:text-gray-300 font-medium truncate">
          {value || <span className="text-slate-400 dark:text-gray-600 italic">Not set</span>}
        </p>
      </div>
      {verified && (
        <div className="shrink-0 flex items-center gap-1 text-indigo-400 text-[10px] font-bold">
          <ShieldCheck size={13} />
          <span className="hidden sm:inline">Verified</span>
        </div>
      )}
    </div>
  </FieldCard>
);

// ─────────────────────────────────────────────────────────────
// UsernameField – with debounced availability check
// ─────────────────────────────────────────────────────────────
const UsernameField = ({ value, onChange, currentUsername }) => {
  const [checking, setChecking]   = useState(false);
  const [available, setAvailable] = useState(null); // null | true | false
  const debounceRef = useRef(null);

  useEffect(() => {
    const trimmed = value.trim().replace(/^@/, '');
    // No check needed if unchanged or empty
    if (!trimmed || trimmed === currentUsername) {
      setAvailable(null);
      return;
    }
    if (trimmed.length < 3) {
      setAvailable(false);
      return;
    }

    setChecking(true);
    setAvailable(null);
    clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        // Reuse the getAllUsers search endpoint: exact match means taken
        const res = await apiClient.get(`/api/users?search=${encodeURIComponent(trimmed)}`);
        // If any result matches exactly → taken
        const taken = res.data?.some(
          (u) => u.username?.toLowerCase() === trimmed.toLowerCase()
        );
        setAvailable(!taken);
      } catch {
        setAvailable(null);
      } finally {
        setChecking(false);
      }
    }, 520);

    return () => clearTimeout(debounceRef.current);
  }, [value, currentUsername]);

  const clean = value.replace(/^@/, '');
  const showStatus = clean && clean !== currentUsername && clean.length >= 3;

  return (
    <FieldCard>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-500 dark:text-gray-400 shrink-0">
          <AtSign size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-0.5">
            Username
          </p>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 dark:text-gray-500 text-[13px] font-semibold select-none">@</span>
            <input
              id="profile-username-input"
              type="text"
              value={clean}
              onChange={(e) => onChange('@' + e.target.value.replace(/^@/, '').replace(/\s/g, '').toLowerCase())}
              placeholder="yourhandle"
              maxLength={24}
              className="flex-1 bg-transparent text-[13.5px] text-slate-900 dark:text-white font-medium outline-none placeholder-slate-400 dark:placeholder-gray-600 min-w-0"
            />
          </div>
        </div>
        {/* Availability indicator */}
        <div className="shrink-0 flex items-center">
          {checking && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-gray-500 font-medium">
              <Loader2 size={13} className="animate-spin text-indigo-500" />
              <span className="hidden sm:inline text-[10px]">Checking</span>
            </div>
          )}
          {!checking && showStatus && available === true && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold">
              <Check size={12} strokeWidth={2.5} />
              <span className="text-[10px]">Available</span>
            </div>
          )}
          {!checking && showStatus && available === false && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[11px] font-semibold">
              <X size={12} strokeWidth={2.5} />
              <span className="text-[10px]">Taken</span>
            </div>
          )}
        </div>
      </div>
      {showStatus && !checking && (
        <p className={`text-[10px] mt-1.5 px-1 font-medium ${available ? 'text-indigo-500 dark:text-indigo-400' : 'text-rose-500 dark:text-rose-400'}`}>
          {available ? '✓ Username available' : '✗ Username already taken'}
        </p>
      )}
      {clean && clean.length > 0 && clean.length < 3 && (
        <p className="text-[10px] mt-1.5 px-1 text-amber-500 dark:text-amber-400 font-medium">
          Minimum 3 characters required
        </p>
      )}
    </FieldCard>
  );
};

// ─────────────────────────────────────────────────────────────
// BioField – textarea + emoji quick-insert + presets
// ─────────────────────────────────────────────────────────────
const BioField = ({ value, onChange }) => {
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef(null);

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const next  = value.slice(0, start) + emoji + value.slice(end);
    if (next.length <= BIO_MAX) {
      onChange(next);
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + emoji.length;
        el.focus();
      });
    }
  };

  const remaining = BIO_MAX - value.length;

  return (
    <div className="space-y-2">
      <FieldCard className="pb-2.5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-500 dark:text-gray-400 shrink-0 mt-0.5">
            <FileText size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-slate-500 dark:text-gray-400 font-semibold uppercase tracking-wider">
                About / Bio
              </p>
              <span className={`text-[10px] font-mono font-medium ${counterColor(value.length, BIO_MAX)}`}>
                {remaining}
              </span>
            </div>
            <textarea
              ref={textareaRef}
              id="profile-bio-textarea"
              value={value}
              onChange={(e) => onChange(e.target.value.slice(0, BIO_MAX))}
              placeholder="Write a status or bio..."
              rows={2}
              className="w-full bg-transparent text-[13px] text-slate-900 dark:text-white font-medium outline-none placeholder-slate-400 dark:placeholder-gray-600 resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-gray-800/60 mt-1">
              <button
                type="button"
                onClick={() => setShowEmoji((v) => !v)}
                className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-lg transition-colors cursor-pointer ${
                  showEmoji
                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-400 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400'
                }`}
                aria-label="Emoji picker"
              >
                <Smile size={14} />
                <span className="text-[10.5px]">Emoji</span>
              </button>
            </div>
          </div>
        </div>
      </FieldCard>

      {/* Emoji quick-insert row */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -4 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-1.5 p-2 bg-slate-100/90 dark:bg-gray-900/60 border border-slate-200/80 dark:border-gray-800/60 rounded-xl backdrop-blur-sm">
              {EMOJI_QUICK.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => insertEmoji(em)}
                  className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-white dark:hover:bg-gray-800 hover:scale-115 active:scale-95 transition-all cursor-pointer focus-visible:outline-none"
                >
                  {em}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick bio presets - smooth horizontal scroller on phone, flex-wrap on larger screens */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5 sm:flex-wrap">
        {BIO_PRESETS.map((p) => {
          const isSelected = value.trim() === `${p.emoji} ${p.text}`.trim();
          return (
            <button
              key={p.text}
              type="button"
              onClick={() => onChange(`${p.emoji} ${p.text}`.slice(0, BIO_MAX))}
              className={`shrink-0 text-[11px] font-medium rounded-full px-3 py-1 transition-all duration-200 cursor-pointer focus-visible:outline-none shadow-sm active:scale-95 flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-indigo-600 text-white font-semibold shadow-indigo-500/25'
                  : 'text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800/70 border border-slate-200 dark:border-gray-700/60 hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            >
              <span>{p.emoji}</span>
              <span>{p.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// AvatarEditor – top photo section
// ─────────────────────────────────────────────────────────────
const AvatarEditor = ({ user, onAvatarChange }) => {
  const { isDarkMode } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [removing,  setRemoving]  = useState(false);
  const [progress,  setProgress]  = useState(0);
  const fileRef = useRef(null);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 MB'); return; }

    const fd = new FormData();
    fd.append('avatar', file);
    setUploading(true);
    setProgress(0);

    try {
      const res = await apiClient.post('/api/users/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) =>
          setProgress(Math.round((ev.loaded / ev.total) * 100)),
      });
      onAvatarChange(res.data?.avatar);
      toast.success('Photo updated!');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await apiClient.put('/api/users/profile', { avatar: '' });
      onAvatarChange('');
      toast.success('Photo removed');
    } catch {
      toast.error('Failed to remove photo');
    } finally {
      setRemoving(false);
    }
  };

  const displayName = user?.name || user?.username || 'U';
  const initials = displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <motion.div variants={childVar} className="flex flex-col items-center gap-4 py-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleUpload}
      />

      {/* Avatar + ring */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full p-[3px] ring-4 ring-slate-200 dark:ring-gray-800/80 shadow-xl shadow-black/10 dark:shadow-black/40"
          style={{ background: isDarkMode ? 'conic-gradient(#22c55e44 0%, #1e2130 50%, #22c55e22 100%)' : 'conic-gradient(#22c55e44 0%, #e2e8f0 50%, #22c55e22 100%)' }}
        >
          <div className="w-full h-full rounded-full overflow-hidden bg-slate-100 dark:bg-gray-900 border-2 border-slate-200 dark:border-gray-800/60 flex items-center justify-center">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-slate-500 dark:text-gray-500 select-none">{initials}</span>
            )}
          </div>
        </div>

        {/* Camera badge */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 border-2 border-white dark:border-[#090A0F] flex items-center justify-center text-white shadow-lg hover:bg-indigo-500 transition-colors cursor-pointer focus-visible:outline-none"
        >
          <Camera size={12} />
        </button>
      </div>

      {/* Upload progress bar */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="w-32 h-1 bg-gray-800 rounded-full overflow-hidden"
          >
            <motion.div
              className="h-full bg-indigo-500 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          id="profile-change-photo-btn"
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/30 dark:border-indigo-500/25 rounded-full px-3.5 py-1.5 hover:bg-indigo-500/20 transition-all cursor-pointer focus-visible:outline-none disabled:opacity-50"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          {uploading ? `Uploading ${progress}%` : 'Change Photo'}
        </button>

        {user?.avatar && (
          <button
            id="profile-remove-photo-btn"
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-500/15 border border-red-500/30 dark:border-red-500/25 rounded-full px-3.5 py-1.5 hover:bg-red-500/20 transition-all cursor-pointer focus-visible:outline-none disabled:opacity-50"
          >
            {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Remove
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main ProfileSettingsPage
// ─────────────────────────────────────────────────────────────
/**
 * ProfileSettingsPage
 *
 * Props:
 *  - isOpen   {boolean}
 *  - onBack   {function}   Navigate back to settings list
 */
const ProfileSettingsPage = ({ isOpen, onBack }) => {
  const { user, updateUserData, refreshUser } = useAuth();
  const socket = useSocket();

  // Form state
  const [name,     setName]     = useState(user?.name     || '');
  const [username, setUsername] = useState('@' + (user?.username || ''));
  const [bio,      setBio]      = useState(user?.bio      || '');

  // UI state
  const [saving,   setSaving]   = useState(false);

  // Sync on user change (e.g. after avatar update)
  useEffect(() => {
    setName(user?.name     || '');
    setUsername('@' + (user?.username || ''));
    setBio(user?.bio       || '');
  }, [user?._id]);

  // ── Dirty checking ──────────────────────────────────────────
  const isDirty = useMemo(() => {
    const cleanUsername = username.replace(/^@/, '');
    return (
      name.trim()         !== (user?.name     || '') ||
      cleanUsername.trim() !== (user?.username || '') ||
      bio.trim()          !== (user?.bio       || '')
    );
  }, [name, username, bio, user]);

  // ── Reset handler (revert changes to original user data) ─────
  const handleReset = () => {
    setName(user?.name || '');
    setUsername('@' + (user?.username || ''));
    setBio(user?.bio || '');
  };

  // ── Avatar change callback (from AvatarEditor) ─────────────
  const handleAvatarChange = useCallback(
    (newAvatarUrl) => {
      if (updateUserData) updateUserData({ ...user, avatar: newAvatarUrl });
      else refreshUser();
    },
    [user, updateUserData, refreshUser]
  );

  // ── Save handler ────────────────────────────────────────────
  const handleSave = async () => {
    if (!isDirty || saving) return;

    const cleanUsername = username.replace(/^@/, '').trim();

    if (name.trim().length === 0) {
      toast.error('Display name cannot be empty');
      return;
    }
    if (cleanUsername.length > 0 && cleanUsername.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name:     name.trim(),
        username: cleanUsername || undefined,
        bio:      bio.trim(),
      };
      const res = await apiClient.put('/api/users/profile', payload);
      const updatedUser = res.data?.user || { ...user, ...payload };

      if (updateUserData) updateUserData(updatedUser);

      // Broadcast via socket for real-time presence
      if (socket) {
        socket.emit('user_profile_updated', {
          userId:   updatedUser._id,
          name:     updatedUser.name,
          username: updatedUser.username,
          avatar:   updatedUser.avatar,
        });
      }

      toast.success('Profile saved!');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="profile-settings-page"
          variants={slideVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-label="Profile settings"
          className="
            absolute inset-0 z-50
            flex flex-col
            h-full max-h-[100dvh]
            overflow-hidden
            bg-[#f8fafc] dark:bg-[#12131C]
            text-slate-900 dark:text-white
            transition-colors duration-300
          "
        >
          {/* Top highlight line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent pointer-events-none z-10" />

          {/* ── Fixed header ── */}
          <div
            className="flex items-center gap-3 px-4 pt-4 sm:pt-5 pb-3 border-b border-slate-200 dark:border-white/10 shrink-0 bg-white/95 dark:bg-[#12131C]/95 backdrop-blur-md z-10"
          >
            <motion.button
              id="profile-settings-back"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.88 }}
              onClick={onBack}
              aria-label="Back to settings"
              className="w-8 h-8 shrink-0 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-gray-700/80 transition-all cursor-pointer focus-visible:outline-none"
            >
              <ArrowLeft size={15} />
            </motion.button>

            <div className="flex-1 min-w-0">
              <h2 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                Profile
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400/85 leading-none mt-0.5">
                Edit your info
              </p>
            </div>

            {/* Dirty save shortcut button */}
            <AnimatePresence>
              {isDirty && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  id="profile-settings-save-header"
                  onClick={handleSave}
                  disabled={saving}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold shadow-lg hover:bg-indigo-500 transition-all cursor-pointer focus-visible:outline-none disabled:opacity-60"
                >
                  {saving
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Check size={12} />}
                  Save
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* ── Scrollable body ── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="flex-1 overflow-y-auto px-4 pt-2.5 pb-6 space-y-5 overscroll-contain"
          >
            {/* Avatar section */}
            <AvatarEditor user={user} onAvatarChange={handleAvatarChange} />

            {/* ── Display Name ── */}
            <motion.div variants={childVar} className="space-y-2">
              <SectionLabel>Display Name</SectionLabel>
              <FieldCard>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-500 dark:text-gray-500 shrink-0">
                    <User size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      id="profile-name-input"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                      placeholder="Your display name"
                      className="w-full bg-transparent text-[14px] text-slate-900 dark:text-white font-semibold outline-none placeholder-slate-400 dark:placeholder-gray-600"
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono ${counterColor(name.length, NAME_MAX)}`}>
                      {name.length}/{NAME_MAX}
                    </span>
                    <Pencil size={12} className="text-slate-400 dark:text-gray-600" />
                  </div>
                </div>
              </FieldCard>
              <p className="text-[10px] text-slate-500 dark:text-gray-600 px-1">
                This is the name others see in chats and groups.
              </p>
            </motion.div>

            {/* ── Username ── */}
            <motion.div variants={childVar} className="space-y-2">
              <SectionLabel>Username</SectionLabel>
              <UsernameField
                value={username}
                onChange={setUsername}
                currentUsername={user?.username || ''}
              />
              <p className="text-[10px] text-slate-500 dark:text-gray-500 px-1">
                Unique handle used to find and share your profile.
              </p>
            </motion.div>

            {/* ── Bio / About ── */}
            <motion.div variants={childVar} className="space-y-2">
              <SectionLabel>About</SectionLabel>
              <BioField value={bio} onChange={setBio} />
            </motion.div>

            {/* ── Identity Credentials ── */}
            <motion.div variants={childVar} className="space-y-2">
              <SectionLabel>Identity</SectionLabel>
              <div className="space-y-2">
                <ReadOnlyCredential
                  icon={Mail}
                  label="Email address"
                  value={user?.email}
                  verified={user?.isVerified}
                />
                <ReadOnlyCredential
                  icon={Phone}
                  label="Phone number"
                  value={user?.phoneNumber}
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-gray-500 px-1">
                Email and phone are identity credentials and cannot be changed here.
              </p>
            </motion.div>
          </motion.div>

          {/* ── Responsive Modern Save Changes Action Bar ── */}
          <div
            className="
              shrink-0 z-20
              px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,16px))]
              border-t border-slate-200/90 dark:border-gray-800/90
              bg-white/95 dark:bg-[#11141a]/95
              backdrop-blur-xl
              shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.06)] dark:shadow-[0_-12px_28px_-5px_rgba(0,0,0,0.45)]
              transition-colors duration-300
            "
          >
            {/* Status indicator row: Unsaved changes + Reset / Clean state */}
            <AnimatePresence mode="wait">
              {isDirty ? (
                <motion.div
                  key="dirty-indicator"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center justify-between text-[11px] mb-2 px-1"
                >
                  <span className="flex items-center gap-1.5 font-bold text-amber-500 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-sm shadow-amber-500/50" />
                    Unsaved changes
                  </span>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors cursor-pointer py-0.5 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-gray-800 active:scale-95"
                  >
                    <RotateCcw size={11} />
                    Reset
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="clean-indicator"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="flex items-center justify-center text-[10.5px] mb-2 font-medium text-slate-400 dark:text-gray-500 gap-1.5"
                >
                  <Check size={12} className="text-indigo-400" strokeWidth={2.5} />
                  <span>Profile details up to date</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action button */}
            <motion.button
              id="profile-settings-save-btn"
              whileHover={isDirty && !saving ? { scale: 1.01 } : {}}
              whileTap={isDirty && !saving ? { scale: 0.98 } : {}}
              onClick={handleSave}
              disabled={!isDirty || saving}
              className={`
                relative overflow-hidden w-full
                h-12 rounded-2xl
                flex items-center justify-center gap-2.5
                text-[13px] font-black uppercase tracking-wider
                transition-all duration-300
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50
                select-none
                ${isDirty
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer active:scale-[0.98]'
                  : 'bg-slate-100 dark:bg-gray-800/40 text-slate-400 dark:text-gray-500 border border-slate-200/80 dark:border-gray-700/50 cursor-not-allowed opacity-85'}
              `}
            >
              {isDirty && !saving && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0 pointer-events-none -translate-x-full animate-[shimmer_2.5s_infinite]" />
              )}

              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin text-white" />
                  <span>Saving Changes…</span>
                </>
              ) : isDirty ? (
                <>
                  <Check size={16} strokeWidth={2.5} className="text-white" />
                  <span>Save Changes</span>
                </>
              ) : (
                <>
                  <Check size={15} className="text-slate-400 dark:text-gray-500" />
                  <span>Save Changes</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProfileSettingsPage;
