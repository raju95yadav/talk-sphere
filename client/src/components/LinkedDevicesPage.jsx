import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Chrome,
  Globe,
  MapPin,
  Clock,
  Link2,
  Unlink,
  LogOut,
  RefreshCw,
  X,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const SESSION_KEY = 'ts_session_id';

const getOrCreateSessionId = () => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

const slideIn = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.2,  ease: 'easeIn' } },
};

const child = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.24 } },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

// Humanise the last-active timestamp
const fmtLastActive = (dateStr) => {
  const d     = new Date(dateStr);
  const now   = new Date();
  const diffMs = now - d;
  const mins  = Math.floor(diffMs / 60_000);
  const hrs   = Math.floor(diffMs / 3_600_000);
  const days  = Math.floor(diffMs / 86_400_000);

  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Pick an icon based on OS/browser strings
const DeviceIcon = ({ os, size = 20, className = '' }) => {
  const lower = (os || '').toLowerCase();
  if (lower.includes('android') || lower.includes('ios')) {
    return <Smartphone size={size} className={className} />;
  }
  if (lower.includes('ipad') || lower.includes('tablet')) {
    return <Tablet size={size} className={className} />;
  }
  if (lower.includes('windows') || lower.includes('macos') || lower.includes('linux')) {
    return <Laptop size={size} className={className} />;
  }
  return <Monitor size={size} className={className} />;
};

// ─────────────────────────────────────────────────────────────
// QR Modal
// ─────────────────────────────────────────────────────────────
const QR_TTL = 60; // seconds

const QRModal = ({ onClose, onLinked }) => {
  const [qrToken,    setQrToken]    = useState(null);
  const [expiresAt,  setExpiresAt]  = useState(null);
  const [remaining,  setRemaining]  = useState(QR_TTL);
  const [loading,    setLoading]    = useState(true);
  const [linked,     setLinked]     = useState(false);
  const refreshRef   = useRef(null);
  const countdownRef = useRef(null);

  const fetchToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/api/devices/qr-token');
      setQrToken(res.data.qrToken);
      setExpiresAt(res.data.expiresAt);
      setRemaining(QR_TTL);
    } catch {
      toast.error('Could not generate QR code');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount, then auto-refresh every 60s
  useEffect(() => {
    fetchToken();
    refreshRef.current = setInterval(fetchToken, 60_000);
    return () => clearInterval(refreshRef.current);
  }, [fetchToken]);

  // Countdown tick
  useEffect(() => {
    if (!expiresAt) return;
    countdownRef.current = setInterval(() => {
      const secs = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemaining(secs);
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [expiresAt]);

  // Handle device:linked socket event (from parent via prop)
  const handleLinkedEvent = useCallback(() => {
    setLinked(true);
    clearInterval(refreshRef.current);
    setTimeout(() => {
      onLinked();
      onClose();
    }, 1800);
  }, [onLinked, onClose]);

  // QR payload – include token + app identifier
  const qrPayload = qrToken
    ? JSON.stringify({ app: 'talk-sphere', token: qrToken })
    : '';

  const pct = (remaining / QR_TTL) * 100;
  const isWarning = remaining <= 15;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1,   y: 0  }}
        exit={{ opacity: 0, scale: 0.9, y: 24 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-3xl border border-gray-700/60 shadow-2xl shadow-black/70 overflow-hidden"
        style={{ background: '#141720' }}
      >
        {/* Top emerald stripe */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-800/80 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer z-10"
          aria-label="Close"
        >
          <X size={13} />
        </button>

        <div className="px-6 py-7 flex flex-col items-center gap-5">
          {/* Header */}
          <div className="text-center">
            <h3 className="text-[16px] font-black text-white tracking-tight">Link a Device</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Scan this QR code on your other device
            </p>
          </div>

          {/* QR area */}
          <div className="relative">
            {/* Progress ring */}
            <svg
              className="absolute inset-0 -rotate-90"
              width="220"
              height="220"
              viewBox="0 0 220 220"
              aria-hidden="true"
            >
              <circle cx="110" cy="110" r="106" fill="none" stroke="#1f2430" strokeWidth="4" />
              <circle
                cx="110" cy="110" r="106"
                fill="none"
                stroke={isWarning ? '#ef4444' : '#10b981'}
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 106}`}
                strokeDashoffset={`${2 * Math.PI * 106 * (1 - pct / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>

            <div
              className="w-[200px] h-[200px] rounded-2xl flex items-center justify-center overflow-hidden mx-[10px] my-[10px]"
              style={{ background: '#fff' }}
            >
              <AnimatePresence mode="wait">
                {linked ? (
                  <motion.div
                    key="linked"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1,   opacity: 1 }}
                    className="flex flex-col items-center gap-2"
                  >
                    <CheckCircle2 size={52} className="text-emerald-500" />
                    <span className="text-[12px] font-bold text-emerald-600">Device Linked!</span>
                  </motion.div>
                ) : loading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <Loader2 size={36} className="text-gray-400 animate-spin" />
                  </motion.div>
                ) : (
                  <motion.div
                    key={qrToken}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <QRCodeSVG
                      value={qrPayload}
                      size={180}
                      level="M"
                      fgColor="#0f172a"
                      bgColor="#ffffff"
                      style={{ borderRadius: 4, display: 'block' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Countdown badge */}
            {!linked && !loading && (
              <div
                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold border shadow-lg ${
                  isWarning
                    ? 'bg-red-500/15 border-red-500/30 text-red-400'
                    : 'bg-gray-900 border-gray-700/50 text-gray-400'
                }`}
              >
                Refreshes in {remaining}s
              </div>
            )}
          </div>

          {/* Manual refresh */}
          {!linked && (
            <button
              onClick={fetchToken}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-emerald-400 transition-colors cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh QR Code
            </button>
          )}

          {/* Steps */}
          <div className="w-full space-y-2.5 pt-1 border-t border-gray-800/60">
            {[
              { n: '1', text: 'Open Talk Sphere on your other device or browser' },
              { n: '2', text: 'Go to Settings → Linked Devices → Link a Device' },
              { n: '3', text: 'Point your camera at this QR code to sign in instantly' },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-[10px] font-black text-emerald-400">
                  {step.n}
                </span>
                <p className="text-[11px] text-gray-400 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Single Session Card
// ─────────────────────────────────────────────────────────────
const SessionCard = ({ session, isCurrent, onRemove, removing }) => (
  <motion.div
    variants={child}
    layout
    className={`
      w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all
      ${isCurrent
        ? 'border-emerald-500/25 bg-emerald-500/5'
        : 'border-gray-800/70 bg-gray-900/50 hover:bg-gray-900/80'}
    `}
  >
    {/* Device icon bubble */}
    <div
      className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${
        isCurrent
          ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
          : 'bg-gray-800/80 border-gray-700/50 text-gray-400'
      }`}
    >
      <DeviceIcon os={session.os} size={18} />
    </div>

    {/* Details */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <p className="text-[13px] font-bold text-white truncate leading-tight">
          {session.browser} on {session.os}
        </p>
        {isCurrent && (
          <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
            This device
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {session.ip && session.ip !== 'Unknown' && (
          <span className="flex items-center gap-1 text-[10px] text-gray-500">
            <MapPin size={9} />
            {session.ip}
          </span>
        )}
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <Clock size={9} />
          {fmtLastActive(session.lastActive)}
        </span>
      </div>
    </div>

    {/* Log out button */}
    {!isCurrent && (
      <button
        id={`device-logout-${session.sessionId}`}
        onClick={() => onRemove(session.sessionId)}
        disabled={removing === session.sessionId}
        className="shrink-0 w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all cursor-pointer focus-visible:outline-none disabled:opacity-50"
        title="Log out from this device"
        aria-label="Log out from this device"
      >
        {removing === session.sessionId
          ? <Loader2 size={13} className="animate-spin" />
          : <Unlink size={13} />}
      </button>
    )}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────
// Main LinkedDevicesPage
// ─────────────────────────────────────────────────────────────
/**
 * Props:
 *  - isOpen  {boolean}
 *  - onBack  {function}
 */
const LinkedDevicesPage = ({ isOpen, onBack }) => {
  const { user }  = useAuth();
  const socket    = useSocket();

  const [sessions,    setSessions]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [showQR,      setShowQR]      = useState(false);
  const [removing,    setRemoving]    = useState(null);
  const [removingAll, setRemovingAll] = useState(false);

  const currentSessionId = getOrCreateSessionId();

  // ── Load sessions ────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/devices');
      setSessions(res.data || []);
    } catch {
      toast.error('Could not load linked devices');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Register current session on mount ────────────────────
  const registerCurrent = useCallback(async () => {
    try {
      await apiClient.post('/api/devices/register', { sessionId: currentSessionId });
    } catch { /* non-critical */ }
  }, [currentSessionId]);

  useEffect(() => {
    if (!isOpen) return;
    registerCurrent().then(loadSessions);
  }, [isOpen, registerCurrent, loadSessions]);

  // ── Socket: real-time device events ─────────────────────
  useEffect(() => {
    if (!socket) return;

    const onLinked = ({ session }) => {
      setSessions((prev) => {
        const exists = prev.find((s) => s.sessionId === session.sessionId);
        return exists ? prev : [session, ...prev];
      });
      toast.success('New device linked!');
    };

    const onRemoved = ({ sessionId }) => {
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    };

    const onAllRemoved = ({ currentSessionId: kept }) => {
      setSessions((prev) =>
        kept ? prev.filter((s) => s.sessionId === kept) : []
      );
    };

    socket.on('device:linked',      onLinked);
    socket.on('device:removed',     onRemoved);
    socket.on('device:all_removed', onAllRemoved);

    return () => {
      socket.off('device:linked',      onLinked);
      socket.off('device:removed',     onRemoved);
      socket.off('device:all_removed', onAllRemoved);
    };
  }, [socket]);

  // ── Remove one session ───────────────────────────────────
  const handleRemove = useCallback(async (sessionId) => {
    setRemoving(sessionId);
    try {
      await apiClient.delete(`/api/devices/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
      toast.success('Device logged out');
    } catch {
      toast.error('Failed to log out device');
    } finally {
      setRemoving(null);
    }
  }, []);

  // ── Remove all other sessions ────────────────────────────
  const handleRemoveAll = useCallback(async () => {
    setRemovingAll(true);
    try {
      await apiClient.delete('/api/devices/all', {
        data: { currentSessionId },
      });
      setSessions((prev) => prev.filter((s) => s.sessionId === currentSessionId));
      toast.success('Logged out from all other devices');
    } catch {
      toast.error('Failed to log out from all devices');
    } finally {
      setRemovingAll(false);
    }
  }, [currentSessionId]);

  const otherSessions = sessions.filter((s) => s.sessionId !== currentSessionId);
  const currentSession = sessions.find((s) => s.sessionId === currentSessionId);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="linked-devices-page"
            variants={slideIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            aria-label="Linked devices"
            style={{ background: '#11141a' }}
            className="absolute inset-0 z-20 flex flex-col overflow-hidden"
          >
            {/* Top highlight line */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent pointer-events-none z-10" />

            {/* ── Header ── */}
            <div
              className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-gray-800/60 shrink-0"
              style={{ background: '#11141a' }}
            >
              <motion.button
                id="linked-devices-back"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.88 }}
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer focus-visible:outline-none"
              >
                <ArrowLeft size={15} />
              </motion.button>

              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] font-black tracking-tight text-white leading-tight">
                  Linked Devices
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/75 leading-none mt-0.5">
                  Manage active sessions
                </p>
              </div>

              <button
                onClick={loadSessions}
                disabled={loading}
                className="shrink-0 w-8 h-8 rounded-xl bg-gray-800/80 border border-gray-700/50 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer focus-visible:outline-none"
                title="Refresh"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="flex-1 overflow-y-auto px-4 pb-36 pt-4 space-y-5"
            >
              {/* Hero illustration */}
              <motion.div
                variants={child}
                className="flex flex-col items-center gap-3 py-4"
              >
                {/* Stacked device illustration */}
                <div className="relative flex items-end justify-center gap-2 h-20">
                  {/* Laptop */}
                  <div className="relative">
                    <div className="w-16 h-11 rounded-t-lg bg-gray-800 border border-gray-700/80 flex items-center justify-center shadow-xl">
                      <div className="w-12 h-7 rounded bg-gray-900 border border-gray-700/60 flex items-center justify-center">
                        <div className="w-6 h-4 rounded-sm"
                          style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                        />
                      </div>
                    </div>
                    <div className="w-20 h-1.5 rounded-b bg-gray-700 border-t border-gray-600/60 -mt-px" />
                  </div>

                  {/* Phone */}
                  <div className="w-8 h-14 rounded-xl bg-gray-800 border border-gray-700/80 flex flex-col items-center justify-between py-1.5 shadow-xl mb-1">
                    <div className="w-3 h-0.5 rounded-full bg-gray-700" />
                    <div className="w-5 h-7 rounded bg-gray-900 border border-gray-700/60 flex items-center justify-center">
                      <div className="w-2.5 h-3.5 rounded-sm"
                        style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                      />
                    </div>
                    <div className="w-3 h-3 rounded-full border border-gray-600/60" />
                  </div>

                  {/* Wifi arcs */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 opacity-60">
                    {[14, 10, 6].map((s, i) => (
                      <div key={i}
                        className="rounded-full border-t-2 border-emerald-400"
                        style={{ width: s, height: s / 2 }}
                      />
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-[13px] font-bold text-white">Use Talk Sphere everywhere</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 max-w-[220px] leading-relaxed">
                    Link up to 4 devices and stay connected across all platforms.
                  </p>
                </div>
              </motion.div>

              {/* ── Link a Device button ── */}
              <motion.div variants={child}>
                <motion.button
                  id="linked-devices-link-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowQR(true)}
                  className="relative w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-[13px] font-black uppercase tracking-wider text-white overflow-hidden cursor-pointer focus-visible:outline-none shadow-xl"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)',
                    boxShadow: '0 8px 32px -4px rgba(16,185,129,0.4)',
                  }}
                >
                  {/* Pulse rings */}
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-full h-full rounded-2xl border-2 border-emerald-400/30 animate-ping absolute" />
                  </span>
                  <Link2 size={17} />
                  Link a Device
                </motion.button>
              </motion.div>

              {/* ── Current device ── */}
              {currentSession && (
                <motion.div variants={child} className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 px-1">
                    This Device
                  </p>
                  <SessionCard
                    session={currentSession}
                    isCurrent
                    onRemove={handleRemove}
                    removing={removing}
                  />
                </motion.div>
              )}

              {/* ── Linked devices list ── */}
              <motion.div variants={child} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 px-1">
                  Linked Devices {otherSessions.length > 0 && `(${otherSessions.length})`}
                </p>

                <AnimatePresence mode="popLayout">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-10 flex flex-col items-center gap-3"
                    >
                      <Loader2 size={24} className="text-gray-600 animate-spin" />
                      <p className="text-[11px] text-gray-600">Loading sessions…</p>
                    </motion.div>
                  ) : otherSessions.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-8 flex flex-col items-center gap-3 border border-dashed border-gray-800/60 rounded-2xl"
                    >
                      <div className="w-10 h-10 rounded-xl bg-gray-800/60 border border-gray-700/50 flex items-center justify-center">
                        <WifiOff size={18} className="text-gray-600" />
                      </div>
                      <div className="text-center">
                        <p className="text-[12px] font-semibold text-gray-500">No linked devices</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          Scan the QR code to link another device
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="list"
                      variants={stagger}
                      initial="hidden"
                      animate="visible"
                      className="space-y-2"
                    >
                      {otherSessions.map((session) => (
                        <SessionCard
                          key={session.sessionId}
                          session={session}
                          isCurrent={false}
                          onRemove={handleRemove}
                          removing={removing}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Security note */}
              <motion.div
                variants={child}
                className="flex items-start gap-2.5 px-3 py-3 rounded-xl bg-amber-500/5 border border-amber-500/15"
              >
                <Shield size={14} className="text-amber-400/70 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-400/60 leading-relaxed">
                  If you see an unfamiliar device, log it out immediately and change your password.
                </p>
              </motion.div>
            </motion.div>

            {/* ── Sticky "Log out all" footer ── */}
            {otherSessions.length > 0 && (
              <div
                className="absolute bottom-0 inset-x-0 px-4 pb-5 pt-4"
                style={{ background: 'linear-gradient(to top, #11141a 70%, transparent)' }}
              >
                <motion.button
                  id="linked-devices-logout-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRemoveAll}
                  disabled={removingAll}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/18 hover:text-red-300 text-[12px] font-black uppercase tracking-wider transition-all cursor-pointer focus-visible:outline-none disabled:opacity-50 shadow-xl"
                >
                  {removingAll
                    ? <Loader2 size={14} className="animate-spin" />
                    : <LogOut size={14} />}
                  Log Out From All Other Devices
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QR Modal (portal-style, outside the panel) ── */}
      <AnimatePresence>
        {showQR && (
          <QRModal
            onClose={() => setShowQR(false)}
            onLinked={loadSessions}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default LinkedDevicesPage;
