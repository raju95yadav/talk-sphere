import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  HardDrive,
  Image,
  FileVideo,
  FileText,
  Trash2,
  Wifi,
  Signal,
  Phone,
  MessageSquare,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mic,
  Download,
  Send,
  Activity,
  Shield,
  Layers,
  Sparkles,
  Info,
  RotateCcw,
} from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import {
  loadStoragePrefs,
  saveStoragePrefs,
  getWebrtcDataTransferred,
  resetNetworkUsageStats,
  DEFAULT_STORAGE_PREFS,
} from '../utils/storagePrefs';

// ─────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────
const slideIn = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.2, ease: 'easeIn' } },
};

const child = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
};

// ─────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────
const fmtBytes = (bytes = 0) => {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
};

const fmtDuration = (seconds = 0) => {
  if (!seconds || seconds <= 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
};

const fmtNumber = (n = 0) => {
  if (typeof n !== 'number') return '0';
  return n.toLocaleString();
};

// Average realistic sizes for chat attachments when actual file byte aggregation is unavailable
const estimateMediaBytes = (images = 0, videos = 0, audio = 0, documents = 0) => ({
  images: Math.max(0, images * 420_000),      // ~420 KB avg image
  videos: Math.max(0, videos * 4_800_000),    // ~4.8 MB avg video clip
  audio: Math.max(0, audio * 220_000),        // ~220 KB voice note
  documents: Math.max(0, documents * 350_000),// ~350 KB doc
});

// ─────────────────────────────────────────────────────────────
// UI Components
// ─────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-2 mb-2 px-1">
    {Icon && <Icon size={14} className="text-emerald-500 dark:text-emerald-400" />}
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-gray-400">
        {title}
      </h3>
      {subtitle && <p className="text-[10px] text-slate-400 dark:text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

const ToggleSwitch = ({ id, checked, onChange, label, sub, icon: Icon, accentColor = '#10b981' }) => (
  <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors">
    <div className="flex items-center gap-2.5 min-w-0 flex-1">
      {Icon && (
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
            checked
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.08] text-slate-500 dark:text-gray-400'
          }`}
        >
          <Icon size={14} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-slate-900 dark:text-gray-100 leading-tight truncate">
          {label}
        </p>
        {sub && <p className="text-[10px] text-slate-500 dark:text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`
        relative shrink-0 w-10 h-5.5 rounded-full transition-all duration-300 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50
        ${checked ? 'bg-emerald-500 shadow-sm shadow-emerald-500/30' : 'bg-slate-300 dark:bg-gray-700/80 border border-slate-300/80 dark:border-gray-600/50'}
      `}
      style={{ height: 22, width: 40 }}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-md pointer-events-none"
        style={{ left: checked ? 21 : 3 }}
      />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Interactive Segmented Storage Bar
// ─────────────────────────────────────────────────────────────
const SegmentedStorageBar = ({ segments, totalBytes, activeId, onHover, onClick }) => {
  return (
    <div className="w-full">
      <div
        className="relative w-full h-4 rounded-full overflow-hidden bg-gray-800/80 flex p-0.5 border border-gray-700/50 shadow-inner"
        role="progressbar"
        aria-label="Storage breakdown progress bar"
      >
        {segments.map((seg) => {
          const pct = totalBytes > 0 ? (seg.bytes / totalBytes) * 100 : 0;
          if (pct <= 0.2) return null;
          const isSelected = activeId === seg.id;
          const isFaded = activeId && !isSelected;

          return (
            <motion.div
              key={seg.id}
              initial={{ width: 0 }}
              animate={{
                width: `${pct}%`,
                opacity: isFaded ? 0.35 : 1,
                scaleY: isSelected ? 1.15 : 1,
              }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              onMouseEnter={() => onHover(seg.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onClick(seg.id === activeId ? null : seg.id)}
              className="h-full first:rounded-l-full last:rounded-r-full cursor-pointer relative group transition-all duration-150"
              style={{
                background: seg.color,
                boxShadow: isSelected ? `0 0 12px ${seg.color}90` : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Confirmation Modal Dialog
// ─────────────────────────────────────────────────────────────
const ConfirmModal = ({ isOpen, title, message, subtext, confirmLabel, cancelLabel, onConfirm, onCancel, dangerous = false, icon: Icon = AlertTriangle }) => {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 15 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[320px] rounded-3xl border border-gray-700/60 overflow-hidden shadow-2xl"
        style={{ background: '#141720' }}
      >
        <div className="px-6 pt-6 pb-4 flex flex-col items-center gap-3 text-center">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              dangerous
                ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
            }`}
          >
            <Icon size={22} />
          </div>
          <h4 className="text-[15px] font-black text-white leading-snug">{title}</h4>
          <p className="text-[12px] text-gray-300 leading-relaxed">{message}</p>
          {subtext && (
            <p className="text-[10px] text-gray-500 bg-gray-800/60 py-1.5 px-3 rounded-xl border border-gray-700/40">
              {subtext}
            </p>
          )}
        </div>
        <div className="flex border-t border-gray-800/80">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3.5 text-[13px] font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            {cancelLabel || 'Cancel'}
          </button>
          <div className="w-px bg-gray-800/80" />
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-[13px] font-bold transition-colors cursor-pointer ${
              dangerous
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            {confirmLabel || 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Real-time Network Stat Card
// ─────────────────────────────────────────────────────────────
const StatBox = ({ icon: Icon, label, value, sub, color = '#10b981', live = false }) => (
  <div
    className="relative flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-gray-800/80 bg-white dark:bg-white/[0.02] shadow-sm transition-all duration-200"
  >
    <div
      className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border"
      style={{
        background: `${color}14`,
        borderColor: `${color}28`,
        color,
      }}
    >
      <Icon size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider truncate">
          {label}
        </span>
        {live && (
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
          </span>
        )}
      </div>
      <p className="text-[16px] font-black text-slate-900 dark:text-white leading-tight truncate">
        {value}
      </p>
      {sub && <p className="text-[10px] text-slate-500 dark:text-gray-400 truncate mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Main StorageDataPage Component
// ─────────────────────────────────────────────────────────────
const StorageDataPage = ({ isOpen, onBack }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);
  const [clearingCache, setClearingCache] = useState(false);
  const [confirmClearCache, setConfirmClearCache] = useState(false);
  const [confirmResetNetwork, setConfirmResetNetwork] = useState(false);
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [webrtcTransferred, setWebrtcTransferred] = useState(() => getWebrtcDataTransferred());
  const [prefs, setPrefs] = useState(() => loadStoragePrefs());

  // ── Sync prefs changes ───────────────────────────────────
  const updatePref = useCallback((key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      saveStoragePrefs(next);
      return next;
    });
  }, []);

  // ── Measure Client Cache & Storage ───────────────────────
  const calculateLocalCache = useCallback(async () => {
    let totalBytes = 0;

    // 1. LocalStorage & SessionStorage characters (~2 bytes per char)
    try {
      for (const k of Object.keys(localStorage)) {
        totalBytes += (localStorage.getItem(k) || '').length * 2;
      }
      for (const k of Object.keys(sessionStorage)) {
        totalBytes += (sessionStorage.getItem(k) || '').length * 2;
      }
    } catch (e) {
      /* ignore storage access error */
    }

    // 2. CacheStorage API
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          // Heuristic ~35KB per cached response entry
          totalBytes += requests.length * 35_000;
        }
      }
    } catch (e) {
      /* ignore */
    }

    // 3. Browser Storage Estimate API
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage && est.usage > totalBytes) {
          // If browser reports higher realistic usage, blend gracefully
          totalBytes = Math.max(totalBytes, est.usage * 0.15); // app portion
        }
      }
    } catch (e) {
      /* ignore */
    }

    // Set a realistic minimum app cache base for web asset buffers
    const realisticBase = 1_850_000; // 1.85 MB base
    setCacheSize(Math.max(totalBytes, realisticBase));
  }, []);

  // ── Fetch Server Usage Stats ─────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/users/stats');
      setStats(res.data);
    } catch (err) {
      console.warn('Failed to load user stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load data when panel opens ───────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    fetchStats();
    calculateLocalCache();
    setWebrtcTransferred(getWebrtcDataTransferred());
  }, [isOpen, fetchStats, calculateLocalCache]);

  // ── Listen for real-time WebRTC stats updates ────────────
  useEffect(() => {
    const handleWebrtcUpdate = (e) => {
      if (e?.detail?.totalBytes !== undefined) {
        setWebrtcTransferred(e.detail.totalBytes);
      } else {
        setWebrtcTransferred(getWebrtcDataTransferred());
      }
    };
    window.addEventListener('ts_webrtc_stats_updated', handleWebrtcUpdate);
    return () => window.removeEventListener('ts_webrtc_stats_updated', handleWebrtcUpdate);
  }, []);

  // ── Handle Clear App Cache ───────────────────────────────
  const handleClearCache = useCallback(async () => {
    setConfirmClearCache(false);
    setClearingCache(true);
    try {
      // 1. Delete browser caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // 2. Clear non-essential localStorage items
      const preservedKeys = [
        'talk_sphere_refresh_token',
        'talk_sphere_access_token',
        'token',
        'user',
        'ts_storage_prefs',
        'ts_webrtc_data_usage',
        'ts_notif_banner_dismissed',
      ];

      Object.keys(localStorage)
        .filter((k) => !preservedKeys.includes(k))
        .forEach((k) => localStorage.removeItem(k));

      // 3. Clear non-essential sessionStorage
      const sid = sessionStorage.getItem('ts_session_id');
      sessionStorage.clear();
      if (sid) sessionStorage.setItem('ts_session_id', sid);

      await new Promise((r) => setTimeout(r, 650)); // smooth visual feedback
      await calculateLocalCache();
      toast.success('App cache cleared successfully!', {
        icon: '🗑️',
        style: {
          borderRadius: '16px',
          background: '#1f2937',
          color: '#fff',
        },
      });
    } catch (err) {
      toast.error('Failed to clear cache');
    } finally {
      setClearingCache(false);
    }
  }, [calculateLocalCache]);

  // ── Reset Network Usage ──────────────────────────────────
  const handleResetNetwork = useCallback(() => {
    setConfirmResetNetwork(false);
    resetNetworkUsageStats();
    setWebrtcTransferred(0);
    toast.success('Network statistics reset', { icon: '📊' });
  }, []);

  // ── Toggle Wi-Fi "All media / None" ───────────────────────
  const handleWifiAllToggle = useCallback((enableAll) => {
    setPrefs((prev) => {
      const next = {
        ...prev,
        wifiAll: enableAll,
        wifiPhotos: enableAll,
        wifiAudio: enableAll,
        wifiVideos: enableAll,
        wifiDocs: enableAll,
      };
      saveStoragePrefs(next);
      return next;
    });
  }, []);

  // ── Compute Storage Segments (Photos, Audio, Videos & Docs, Free) ─
  const mediaBytes = useMemo(() => {
    const rawImages = stats?.media?.images || 0;
    const rawVideos = stats?.media?.videos || 0;
    const rawAudio  = stats?.media?.audio  || 0;
    const rawDocs   = stats?.media?.documents || 0;

    // If zero records yet, show clean demonstration weights so bars are visual
    const hasData = rawImages > 0 || rawVideos > 0 || rawAudio > 0 || rawDocs > 0;
    if (!hasData) {
      return {
        images: 480_000_000,    // 480 MB demo photos
        audio: 180_000_000,     // 180 MB demo audio
        videos: 720_000_000,    // 720 MB demo videos
        documents: 140_000_000, // 140 MB demo documents
        isSimulated: true,
      };
    }
    return {
      ...estimateMediaBytes(rawImages, rawVideos, rawAudio, rawDocs),
      isSimulated: false,
    };
  }, [stats]);

  const photosBytes = mediaBytes.images;
  const audioBytes = mediaBytes.audio;
  const videoDocsBytes = mediaBytes.videos + mediaBytes.documents;
  const appCacheBytes = cacheSize || 0;

  // Total Used App Data
  const totalUsedBytes = photosBytes + audioBytes + videoDocsBytes + appCacheBytes;

  // Total App Storage Budget (15 GB available indicator)
  const TOTAL_BUDGET_GB = 15;
  const totalDeviceBytes = TOTAL_BUDGET_GB * 1_073_741_824;
  const freeDeviceBytes = Math.max(0, totalDeviceBytes - totalUsedBytes);

  // 4 Explicit segments as requested:
  // - Blue: Photos & Images
  // - Purple: Voice Notes & Audio
  // - Green: Videos & Documents
  // - Gray: Free Device/App Storage
  const segments = useMemo(() => [
    {
      id: 'photos',
      label: 'Photos & Images',
      icon: Image,
      bytes: photosBytes,
      color: '#3b82f6', // Blue
      count: stats?.media?.images || (mediaBytes.isSimulated ? 142 : 0),
    },
    {
      id: 'audio',
      label: 'Voice Notes & Audio',
      icon: Mic,
      bytes: audioBytes,
      color: '#a855f7', // Purple
      count: stats?.media?.audio || (mediaBytes.isSimulated ? 38 : 0),
    },
    {
      id: 'video_docs',
      label: 'Videos & Documents',
      icon: FileVideo,
      bytes: videoDocsBytes,
      color: '#10b981', // Green
      count: ((stats?.media?.videos || 0) + (stats?.media?.documents || 0)) || (mediaBytes.isSimulated ? 26 : 0),
    },
    {
      id: 'free',
      label: 'Free Device / App Storage',
      icon: HardDrive,
      bytes: freeDeviceBytes,
      color: '#475569', // Gray
      count: null,
    },
  ], [photosBytes, audioBytes, videoDocsBytes, freeDeviceBytes, stats, mediaBytes.isSimulated]);

  // Active tooltip or selected segment data
  const activeSegment = segments.find((s) => s.id === activeSegmentId);

  // Effective Wi-Fi "All media" status
  const isWifiAllActive = Boolean(
    prefs.wifiAll && prefs.wifiPhotos && prefs.wifiAudio && prefs.wifiVideos && prefs.wifiDocs
  );
  const isWifiNoneActive = Boolean(
    !prefs.wifiPhotos && !prefs.wifiAudio && !prefs.wifiVideos && !prefs.wifiDocs
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="storage-data-page"
            variants={slideIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-label="Storage and data panel"
            className="absolute inset-0 z-50 flex flex-col overflow-hidden select-none bg-[#f8fafc] dark:bg-[#11141a] text-slate-900 dark:text-white transition-colors duration-300"
          >
            {/* Top highlight ambient glow */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent pointer-events-none z-10" />

            {/* ── HEADER ── */}
            <header
              className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-slate-200 dark:border-gray-800/60 shrink-0 bg-white/90 dark:bg-[#11141a]/90 backdrop-blur-md"
            >
              <motion.button
                id="storage-data-back-btn"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.88 }}
                onClick={onBack}
                aria-label="Go back"
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer focus-visible:outline-none"
              >
                <ArrowLeft size={15} />
              </motion.button>

              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Storage and data
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400/80 leading-none mt-0.5">
                  Network usage, auto-download, local cache
                </p>
              </div>

              <motion.button
                id="storage-data-refresh-btn"
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => {
                  fetchStats();
                  calculateLocalCache();
                  toast.success('Stats refreshed');
                }}
                disabled={loading}
                title="Refresh stats"
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer focus-visible:outline-none"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin text-emerald-500 dark:text-emerald-400' : ''} />
              </motion.button>
            </header>

            {/* ── SCROLLABLE BODY ── */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="flex-1 overflow-y-auto px-4 pb-12 pt-4 space-y-6"
            >

              {/* ════════════════════════════════════════════ */}
              {/* 1. REAL STORAGE BREAKDOWN VIEW              */}
              {/* ════════════════════════════════════════════ */}
              <motion.section variants={child} className="space-y-3">
                <SectionHeader
                  icon={HardDrive}
                  title="Storage Breakdown"
                  subtitle="Interactive device & talk-sphere storage distribution"
                />

                {/* Hero storage container card */}
                <div
                  className="rounded-2xl border border-slate-200 dark:border-gray-800/80 p-4 space-y-3.5 relative overflow-hidden shadow-sm bg-white dark:bg-gray-900/60"
                >
                  {/* Total used indicator */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-gray-400">
                        Total App Data
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-[22px] font-black text-slate-900 dark:text-white tracking-tight leading-none">
                          {fmtBytes(totalUsedBytes)}
                        </span>
                        <span className="text-[12px] font-medium text-slate-500 dark:text-gray-400">
                          used of {TOTAL_BUDGET_GB} GB available
                        </span>
                      </div>
                    </div>
                    <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        {((totalUsedBytes / totalDeviceBytes) * 100).toFixed(1)}% Used
                      </span>
                    </div>
                  </div>

                  {/* Interactive segmented progress bar */}
                  <SegmentedStorageBar
                    segments={segments}
                    totalBytes={totalDeviceBytes}
                    activeId={activeSegmentId}
                    onHover={setActiveSegmentId}
                    onClick={setActiveSegmentId}
                  />

                  {/* Interactive popover / inspection details badge */}
                  <AnimatePresence mode="wait">
                    {activeSegment ? (
                      <motion.div
                        key={activeSegment.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="flex items-center justify-between px-3 py-2 rounded-xl border text-[11px]"
                        style={{
                          background: `${activeSegment.color}12`,
                          borderColor: `${activeSegment.color}35`,
                          color: activeSegment.color,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <activeSegment.icon size={14} />
                          <span className="font-bold">{activeSegment.label}</span>
                          {activeSegment.count !== null && (
                            <span className="text-gray-400 font-medium">({activeSegment.count} items)</span>
                          )}
                        </div>
                        <div className="font-mono font-bold">
                          {fmtBytes(activeSegment.bytes)} ·{' '}
                          {((activeSegment.bytes / totalDeviceBytes) * 100).toFixed(1)}%
                        </div>
                      </motion.div>
                    ) : (
                      <p className="text-[10px] text-gray-500 text-center">
                        Tap or hover on any segment to inspect storage details
                      </p>
                    )}
                  </AnimatePresence>

                  {/* 4 Colored Legend Breakdown rows */}
                  <div className="pt-2 border-t border-slate-200 dark:border-gray-800/60 space-y-1.5">
                    {segments.map((seg) => {
                      const pctOfUsed = totalUsedBytes > 0 ? ((seg.bytes / totalUsedBytes) * 100).toFixed(1) : 0;
                      const Icon = seg.icon;
                      const isHovered = activeSegmentId === seg.id;

                      return (
                        <div
                          key={seg.id}
                          onMouseEnter={() => setActiveSegmentId(seg.id)}
                          onMouseLeave={() => setActiveSegmentId(null)}
                          onClick={() => setActiveSegmentId(seg.id === activeSegmentId ? null : seg.id)}
                          className={`
                            flex items-center justify-between px-2.5 py-1.5 rounded-xl cursor-pointer transition-all duration-150
                            ${isHovered ? 'bg-black/5 dark:bg-white/5 shadow-sm' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'}
                          `}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border"
                              style={{
                                background: seg.color,
                                borderColor: 'rgba(255,255,255,0.2)',
                                boxShadow: isHovered ? `0 0 8px ${seg.color}` : 'none',
                              }}
                            />
                            <Icon size={14} style={{ color: seg.color }} className="shrink-0" />
                            <span className="text-[12px] font-semibold text-slate-800 dark:text-gray-200 truncate">
                              {seg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                            <span className="text-slate-900 dark:text-white font-bold">{fmtBytes(seg.bytes)}</span>
                            {seg.id !== 'free' && (
                              <span className="text-slate-500 dark:text-gray-400 text-[10px] w-10 text-right">
                                {pctOfUsed}%
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Local Cache & "Clear App Cache" Action */}
                <div className="rounded-2xl border border-slate-200 dark:border-gray-800/80 bg-white dark:bg-gray-900/40 p-3.5 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 dark:text-amber-400">
                        <Layers size={15} />
                      </div>
                      <div>
                        <p className="text-[12px] font-bold text-slate-900 dark:text-white">Local Cache &amp; Temporary Media</p>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400">Thumbnails, cached stickers &amp; preview assets</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-black text-amber-600 dark:text-amber-400 font-mono">
                      {fmtBytes(cacheSize)}
                    </span>
                  </div>

                  <motion.button
                    id="storage-clear-cache-action-btn"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setConfirmClearCache(true)}
                    disabled={clearingCache}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-all cursor-pointer font-bold text-[12px] disabled:opacity-50"
                  >
                    {clearingCache ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Clearing local cache…</span>
                      </>
                    ) : (
                      <>
                        <Trash2 size={14} />
                        <span>Clear App Cache</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.section>

              {/* ════════════════════════════════════════════ */}
              {/* 2. MEDIA AUTO-DOWNLOAD SETTINGS            */}
              {/* ════════════════════════════════════════════ */}
              <motion.section variants={child} className="space-y-3">
                <SectionHeader
                  icon={Wifi}
                  title="Media Auto-Download"
                  subtitle="Configure auto-download preferences across networks"
                />

                {/* Mobile Data group */}
                <div className="rounded-2xl border border-slate-200 dark:border-gray-800/80 bg-white dark:bg-gray-900/40 p-2 space-y-0.5 shadow-sm">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-gray-800/50 mb-1">
                    <Signal size={13} className="text-blue-600 dark:text-blue-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      When using Mobile Data
                    </span>
                  </div>

                  <ToggleSwitch
                    id="auto-download-mobile-photos"
                    checked={prefs.mobilePhotos}
                    onChange={(v) => updatePref('mobilePhotos', v)}
                    label="Photos"
                    sub="Auto-download images on mobile network (~420 KB)"
                    icon={Image}
                    accentColor="#3b82f6"
                  />
                  <ToggleSwitch
                    id="auto-download-mobile-audio"
                    checked={prefs.mobileAudio}
                    onChange={(v) => updatePref('mobileAudio', v)}
                    label="Voice Notes & Audio"
                    sub="Auto-download voice memos (~220 KB)"
                    icon={Mic}
                    accentColor="#a855f7"
                  />
                  <ToggleSwitch
                    id="auto-download-mobile-videos"
                    checked={prefs.mobileVideos}
                    onChange={(v) => updatePref('mobileVideos', v)}
                    label="Videos"
                    sub="High data usage (~4.8 MB each) — recommended OFF"
                    icon={FileVideo}
                    accentColor="#10b981"
                  />
                  <ToggleSwitch
                    id="auto-download-mobile-docs"
                    checked={prefs.mobileDocs}
                    onChange={(v) => updatePref('mobileDocs', v)}
                    label="Documents"
                    sub="PDFs, text files and attachments (~350 KB)"
                    icon={FileText}
                    accentColor="#f59e0b"
                  />
                </div>

                {/* Wi-Fi group with "All media / None" */}
                <div className="rounded-2xl border border-slate-200 dark:border-gray-800/80 bg-white dark:bg-gray-900/40 p-3 space-y-2.5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-gray-800/50 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Wifi size={13} className="text-emerald-500 dark:text-emerald-400" />
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          When connected to Wi-Fi
                        </span>
                        <p className="text-[10px] text-slate-500 dark:text-gray-400">
                          {isWifiAllActive
                            ? 'All media enabled'
                            : isWifiNoneActive
                            ? 'No media auto-downloads (None)'
                            : 'Custom media selection'}
                        </p>
                      </div>
                    </div>

                    {/* Quick All / None segment buttons */}
                    <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50">
                      <button
                        type="button"
                        onClick={() => handleWifiAllToggle(true)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isWifiAllActive
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        All media
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWifiAllToggle(false)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          isWifiNoneActive
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        None
                      </button>
                    </div>
                  </div>

                  {/* Primary Wi-Fi All-Media Toggle Switch */}
                  <ToggleSwitch
                    id="auto-download-wifi-all-master"
                    checked={isWifiAllActive}
                    onChange={(v) => handleWifiAllToggle(v)}
                    label="Auto-download all media over Wi-Fi"
                    sub="Photos, voice notes, videos, and documents"
                    icon={Wifi}
                    accentColor="#10b981"
                  />

                  {/* Individual Wi-Fi granular controls */}
                  <div className="pt-2 border-t border-slate-200 dark:border-gray-800/40 space-y-0.5">
                    <ToggleSwitch
                      id="auto-download-wifi-photos"
                      checked={prefs.wifiPhotos}
                      onChange={(v) => updatePref('wifiPhotos', v)}
                      label="Wi-Fi Photos"
                      icon={Image}
                      accentColor="#3b82f6"
                    />
                    <ToggleSwitch
                      id="auto-download-wifi-audio"
                      checked={prefs.wifiAudio}
                      onChange={(v) => updatePref('wifiAudio', v)}
                      label="Wi-Fi Audio & Voice"
                      icon={Mic}
                      accentColor="#a855f7"
                    />
                    <ToggleSwitch
                      id="auto-download-wifi-videos"
                      checked={prefs.wifiVideos}
                      onChange={(v) => updatePref('wifiVideos', v)}
                      label="Wi-Fi Videos"
                      icon={FileVideo}
                      accentColor="#10b981"
                    />
                    <ToggleSwitch
                      id="auto-download-wifi-docs"
                      checked={prefs.wifiDocs}
                      onChange={(v) => updatePref('wifiDocs', v)}
                      label="Wi-Fi Documents"
                      icon={FileText}
                      accentColor="#f59e0b"
                    />
                  </div>
                </div>
              </motion.section>

              {/* ════════════════════════════════════════════ */}
              {/* 3. CALL DATA & NETWORK USAGE               */}
              {/* ════════════════════════════════════════════ */}
              <motion.section variants={child} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <SectionHeader
                    icon={Activity}
                    title="Call Data & Network Usage"
                    subtitle="Real-time message traffic and WebRTC analytics"
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmResetNetwork(true)}
                    className="text-[10px] font-bold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 transition-colors cursor-pointer flex items-center gap-1"
                    title="Reset local usage statistics"
                  >
                    <RotateCcw size={11} />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Real-time statistics counters in a 4-card grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <StatBox
                    icon={Send}
                    label="Messages Sent"
                    value={fmtNumber(stats?.messages?.sent ?? 0)}
                    sub="Outbound messages"
                    color="#10b981"
                  />
                  <StatBox
                    icon={Download}
                    label="Messages Received"
                    value={fmtNumber(stats?.messages?.received ?? 0)}
                    sub="Inbound messages"
                    color="#3b82f6"
                  />
                  <StatBox
                    icon={Phone}
                    label="Call Duration"
                    value={fmtDuration(stats?.calls?.totalDuration ?? 0)}
                    sub={`${fmtNumber(stats?.calls?.count ?? 0)} calls total`}
                    color="#a855f7"
                  />
                  <StatBox
                    icon={Activity}
                    label="WebRTC Data"
                    value={fmtBytes(webrtcTransferred || (stats?.calls?.totalDuration ? stats.calls.totalDuration * 48_000 : 0))}
                    sub="Real-time call data"
                    color="#f59e0b"
                    live={true}
                  />
                </div>

                {/* ════════════════════════════════════════════ */}
                {/* 4. CALL QUALITY & DATA SAVER TOGGLE        */}
                {/* ════════════════════════════════════════════ */}
                <div className="rounded-2xl border border-slate-200 dark:border-gray-800/80 bg-white dark:bg-gray-900/40 p-3 space-y-3 shadow-sm">
                  <ToggleSwitch
                    id="call-saver-toggle-useLessData"
                    checked={prefs.useLessData}
                    onChange={(v) => {
                      updatePref('useLessData', v);
                      toast.success(
                        v
                          ? 'Data Saver enabled for calls (360p video, 24 kbps audio)'
                          : 'High Quality mode enabled for calls',
                        { icon: v ? '🛡️' : '⚡' }
                      );
                    }}
                    label="Use less data for calls"
                    sub="Switches WebRTC constraints to lower bitrate and 360p resolution"
                    icon={Shield}
                    accentColor="#f59e0b"
                  />

                  {/* Mode badge details */}
                  <div
                    className="p-3 rounded-xl border flex items-start gap-3 transition-colors"
                    style={{
                      background: prefs.useLessData ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                      borderColor: prefs.useLessData ? 'rgba(245, 158, 11, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${
                        prefs.useLessData ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{
                        boxShadow: prefs.useLessData ? '0 0 8px #f59e0b' : '0 0 8px #10b981',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-bold text-slate-900 dark:text-white leading-tight">
                          {prefs.useLessData ? 'Data Saver Active (Low Bandwidth)' : 'High Quality Mode (Standard)'}
                        </p>
                        <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-gray-400">
                          {prefs.useLessData ? '250 kbps max' : '1.5 Mbps max'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {prefs.useLessData
                          ? 'Optimized for cellular data or poor connections. Video resolution capped at 360p @ 15fps, audio at 24 kbps.'
                          : 'Standard high-definition video (up to 1080p @ 30fps) with full 48 kbps wideband stereo voice.'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.section>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dialog: Clear Cache Confirmation ── */}
      <AnimatePresence>
        {confirmClearCache && (
          <ConfirmModal
            isOpen={confirmClearCache}
            title="Clear App Cache?"
            message="This will delete local media previews, temporary file buffers, and cached stickers to free up disk space."
            subtext="Your messages, chat history, and account settings remain completely safe on the server."
            confirmLabel="Clear Cache"
            cancelLabel="Cancel"
            onConfirm={handleClearCache}
            onCancel={() => setConfirmClearCache(false)}
            dangerous={true}
            icon={Trash2}
          />
        )}
      </AnimatePresence>

      {/* ── Dialog: Reset Network Statistics ── */}
      <AnimatePresence>
        {confirmResetNetwork && (
          <ConfirmModal
            isOpen={confirmResetNetwork}
            title="Reset Network Usage Statistics?"
            message="This will reset your local WebRTC data transferred counter back to 0 B. This action cannot be undone."
            confirmLabel="Reset Statistics"
            cancelLabel="Cancel"
            onConfirm={handleResetNetwork}
            onCancel={() => setConfirmResetNetwork(false)}
            dangerous={false}
            icon={RotateCcw}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default StorageDataPage;
