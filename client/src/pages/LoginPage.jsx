import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Lock,
  QrCode,
  Camera,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  Laptop,
  HelpCircle,
  Sparkles,
  ChevronRight,
  Shield
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import QRScannerModal from '../components/QRScannerModal';

const QR_EXPIRE_SECONDS = 90;

const LoginPage = () => {
  // ── Authentication Mode: 'email' (Default) | 'qr' | 'google' ─
  const [authMethod, setAuthMethod] = useState('email'); // Default is Email OTP as requested

  // ── Pending Referral Capture ──────────────────────────────
  const [pendingRef] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      let ref = params.get('ref') || params.get('invite');
      if (!ref && window.location.pathname.startsWith('/join/')) {
        ref = window.location.pathname.replace('/join/', '');
      }
      if (ref) {
        const clean = decodeURIComponent(ref).replace(/^@/, '').trim();
        localStorage.setItem('talksphere_pending_ref', clean);
        return clean;
      }
      return localStorage.getItem('talksphere_pending_ref') || '';
    } catch {
      return '';
    }
  });

  // ── Email / OTP State ─────────────────────────────────────
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState(1); // 1 = enter email, 2 = enter otp
  const [loading, setLoading] = useState(false);

  // ── QR Code Login State (WhatsApp Web Style) ───────────────
  const [qrToken, setQrToken] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [remaining, setRemaining] = useState(QR_EXPIRE_SECONDS);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrStatus, setQrStatus] = useState('idle'); // 'idle' | 'pending' | 'scanned' | 'approved' | 'expired'
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const pollIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const { login } = useAuth();

  // ── Generate QR Token ──────────────────────────────────────
  const generateNewQR = useCallback(async () => {
    setQrLoading(true);
    setQrStatus('pending');
    try {
      const res = await apiClient.post('/api/auth/qr/generate');
      setQrToken(res.data.qrToken);
      setExpiresAt(res.data.expiresAt);
      setRemaining(Math.round((res.data.expiresAt - Date.now()) / 1000) || QR_EXPIRE_SECONDS);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      toast.error('Failed to generate QR code');
      setQrStatus('expired');
    } finally {
      setQrLoading(false);
    }
  }, []);

  // ── Poll for QR Approval Status ────────────────────────────
  useEffect(() => {
    if (authMethod !== 'qr' || !qrToken || qrStatus === 'approved') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await apiClient.get(`/api/auth/qr/status/${qrToken}`);
        const { status, token, refreshToken, user } = res.data;

        if (status === 'scanned') {
          setQrStatus('scanned');
        } else if (status === 'approved' && token && user) {
          setQrStatus('approved');
          clearInterval(pollIntervalRef.current);
          if (pollIntervalRef.current) pollIntervalRef.current = null;
          toast.success(`Welcome back, ${user.name || user.username || 'User'}!`);
          setTimeout(() => {
            login(user, token, refreshToken);
          }, 800);
        } else if (status === 'expired' || status === 'invalid') {
          setQrStatus('expired');
          clearInterval(pollIntervalRef.current);
        } else if (status === 'rejected') {
          setQrStatus('expired');
          toast.error('Login request was declined on your phone');
          clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        console.error('QR status check error:', err);
      }
    };

    pollIntervalRef.current = setInterval(checkStatus, 1500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [authMethod, qrToken, qrStatus, login]);

  // ── Countdown Timer for QR Code ────────────────────────────
  useEffect(() => {
    if (!expiresAt || authMethod !== 'qr') return;

    countdownIntervalRef.current = setInterval(() => {
      const diff = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemaining(diff);

      if (diff <= 0) {
        setQrStatus('expired');
        clearInterval(countdownIntervalRef.current);
      }
    }, 1000);

    return () => clearInterval(countdownIntervalRef.current);
  }, [expiresAt, authMethod]);

  // Initial fetch when switching to QR mode
  useEffect(() => {
    if (authMethod === 'qr') {
      generateNewQR();
    }
  }, [authMethod, generateNewQR]);

  // ── Scan QR via Camera on Login Page (Direct Claim) ────────
  const handleCameraScanSuccess = async (token) => {
    setShowCameraScanner(false);
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/qr/claim', { qrToken: token });
      if (res.data.token && res.data.user) {
        toast.success(`Welcome back, ${res.data.user.name || 'User'}!`);
        login(res.data.user, res.data.token, res.data.refreshToken);
      } else {
        toast.error('Could not authenticate with this QR code');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired QR code');
    } finally {
      setLoading(false);
    }
  };

  // ── Email OTP Handlers ─────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email');

    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/request-otp', { email });
      toast.success(res.data.message);
      setOtpStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return toast.error('Please enter the OTP');

    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/verify-otp', { email, code: otp });
      toast.success('Login successful!');
      login(res.data.user, res.data.token, res.data.refreshToken);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────
  const handleGoogleCustomLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (!tokenResponse?.access_token) {
        toast.error('Google Sign-In failed: No token received');
        return;
      }
      setLoading(true);
      try {
        const res = await apiClient.post('/api/auth/google', { token: tokenResponse.access_token });
        toast.success('Login successful!');
        login(res.data.user, res.data.token, res.data.refreshToken);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Google Sign-In failed');
      } finally {
        setLoading(false);
      }
    },
    onError: () => toast.error('Google Sign-In failed')
  });

  const qrPayload = qrToken
    ? JSON.stringify({ app: 'talk-sphere', type: 'login', token: qrToken })
    : '';

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-3 sm:p-6 bg-[#04060f] text-white overflow-x-hidden select-none">
      {/* Dynamic Animated Hero Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.img
          src="/hero-1.jpg"
          alt="Cyber Handshake Background"
          initial={{ scale: 1.02 }}
          animate={{
            scale: [1.02, 1.10, 1.02],
            x: [0, -15, 0],
            y: [0, 10, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          className="w-full h-full object-cover object-center opacity-85 filter brightness-105 contrast-110"
        />

        {/* Cyber Gradient & Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04060f]/85 via-[#050816]/40 to-[#04060f]/90" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_#04060f_92%)]" />

        {/* Ambient Glowing Orbs */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -25, 0], opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/6 left-1/6 w-72 sm:w-96 h-72 sm:h-96 bg-cyan-400/25 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 25, 0], opacity: [0.25, 0.5, 0.25] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/6 right-1/6 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/20 rounded-full blur-[110px]"
        />
      </div>

      {/* Main Glassmorphic Card (Responsive width: expands nicely when in QR mode) */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={`w-full relative z-10 rounded-3xl bg-[#0a0d14]/92 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_50px_rgba(16,185,129,0.15)] overflow-hidden transition-all duration-300 ${
          authMethod === 'qr' ? 'max-w-[760px] p-5 sm:p-8' : 'max-w-[450px] p-6 sm:p-8'
        }`}
      >
        {/* Top Shimmer Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-[2.5px] bg-gradient-to-r from-transparent via-emerald-400 via-teal-400 to-transparent animate-pulse" />

        {/* Header Branding */}
        <div className="flex flex-col items-center mb-5 text-center">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.08, rotate: 6 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-12 h-12 rounded-2xl p-[1.5px] bg-gradient-to-tr from-emerald-400 via-teal-500 to-emerald-600 shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <div className="w-full h-full bg-[#0b0e14] rounded-[14px] flex items-center justify-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 via-transparent to-teal-500/20 opacity-90" />
                <ShieldCheck size={26} className="text-white drop-shadow-[0_0_8px_rgba(16,185,129,0.8)] relative z-10" />
              </div>
            </motion.div>

            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent leading-none">
                TALK SPHERE
              </h1>
              <p className="text-[#94a3b8] text-[11px] sm:text-xs font-semibold tracking-wide mt-1">
                Next-Gen Communication Platform
              </p>
            </div>
          </div>
        </div>

        {/* ── Personal Invitation Banner (if referred) ── */}
        {pendingRef && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/35 flex items-center gap-3 shadow-lg shadow-emerald-500/10"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-bold shrink-0 shadow-md shadow-emerald-500/30 text-lg">
              ✨
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                Personal Invitation
              </p>
              <p className="text-xs text-white font-medium truncate mt-0.5">
                Invited by <span className="font-bold text-emerald-300">@{pendingRef}</span>
              </p>
              <p className="text-[11px] text-gray-400">
                Sign in with Google or Email to instantly connect!
              </p>
            </div>
          </motion.div>
        )}

        {/* ── 3 Primary Authentication Tabs (Email OTP -> Google -> Scan QR) ── */}
        <div className="mb-6">
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-[#121622] border border-white/10 shadow-inner relative">
            {/* 1st Tab: Email OTP */}
            <button
              type="button"
              onClick={() => setAuthMethod('email')}
              className={`relative z-10 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                authMethod === 'email' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {authMethod === 'email' && (
                <motion.div
                  layoutId="authTabPill"
                  className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-md shadow-emerald-500/30"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5 truncate">
                <Mail size={15} />
                <span>Email OTP</span>
              </span>
            </button>

            {/* 2nd Tab: Google */}
            <button
              type="button"
              onClick={() => setAuthMethod('google')}
              className={`relative z-10 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                authMethod === 'google' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {authMethod === 'google' && (
                <motion.div
                  layoutId="authTabPill"
                  className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-md shadow-emerald-500/30"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5 truncate">
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </span>
            </button>

            {/* 3rd Tab: Scan QR */}
            <button
              type="button"
              onClick={() => setAuthMethod('qr')}
              className={`relative z-10 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                authMethod === 'qr' ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {authMethod === 'qr' && (
                <motion.div
                  layoutId="authTabPill"
                  className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-md shadow-emerald-500/30"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5 truncate">
                <QrCode size={15} />
                <span>Scan QR</span>
              </span>
            </button>
          </div>
        </div>

        {/* ── Active Form Section ───────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB: "SCAN TO LOG IN" (QR Code Flow)                       */}
          {/* ══════════════════════════════════════════════════════════ */}
          {authMethod === 'qr' && (
            <motion.div
              key="qr-login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col md:flex-row items-center gap-6 md:gap-8 justify-between"
            >
              {/* Left Side: Instructions */}
              <div className="flex-1 space-y-4 text-left">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    Scan to log in
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Link your phone to use Talk Sphere on this computer seamlessly without passwords.
                  </p>
                </div>

                {/* Steps Checklist */}
                <div className="space-y-3 pt-1">
                  {[
                    { n: '1', text: 'Open Talk Sphere on your logged-in phone' },
                    { n: '2', text: 'Go to Settings → Linked Devices → Link a Device' },
                    { n: '3', text: 'Point your camera at this QR code to confirm & log in' },
                  ].map((step) => (
                    <div key={step.n} className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/35 flex items-center justify-center text-xs font-black text-emerald-400">
                        {step.n}
                      </span>
                      <p className="text-xs sm:text-[13px] text-gray-300 leading-snug pt-0.5">
                        {step.text}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Options: Stay Logged In & Camera Scan alternative */}
                <div className="pt-2 border-t border-gray-800/80 space-y-2.5">
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={stayLoggedIn}
                      onChange={(e) => setStayLoggedIn(e.target.checked)}
                      className="rounded accent-emerald-500 cursor-pointer w-4 h-4"
                    />
                    <span>Stay logged in on this browser</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCameraScanner(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer py-1"
                    >
                      <Camera size={14} />
                      <span>Or scan a QR code using this device's camera</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: High-Res QR Code Display with WhatsApp-style center logo & countdown */}
              <div className="flex flex-col items-center shrink-0">
                <div className="relative p-3 rounded-3xl bg-white border-4 border-emerald-500/30 shadow-[0_0_35px_rgba(16,185,129,0.25)] flex items-center justify-center">
                  {/* Glowing TalkSphere shield overlay at the center */}
                  <div className="relative">
                    {qrPayload ? (
                      <QRCodeSVG
                        value={qrPayload}
                        size={200}
                        level="M"
                        fgColor="#0a0d14"
                        bgColor="#ffffff"
                        includeMargin={false}
                        style={{ borderRadius: 8, display: 'block' }}
                      />
                    ) : (
                      <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-50 rounded-xl">
                        <Loader2 size={36} className="text-emerald-600 animate-spin" />
                      </div>
                    )}

                    {/* Loading Spinner Overlay */}
                    {qrLoading && (
                      <div className="absolute inset-0 bg-white/90 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center gap-2">
                        <Loader2 size={36} className="text-emerald-600 animate-spin" />
                        <span className="text-[11px] font-bold text-gray-800">Generating QR...</span>
                      </div>
                    )}

                    {/* Scanned Waiting for Approval Overlay */}
                    {qrStatus === 'scanned' && (
                      <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center p-3 text-center gap-2">
                        <Loader2 size={36} className="text-emerald-400 animate-spin" />
                        <span className="text-xs font-black text-white">QR Code Scanned!</span>
                        <span className="text-[10px] text-emerald-200">
                          Please tap "Allow" on your phone to complete login
                        </span>
                      </div>
                    )}

                    {/* Approved Celebration Overlay */}
                    {qrStatus === 'approved' && (
                      <div className="absolute inset-0 bg-emerald-600 rounded-xl flex flex-col items-center justify-center p-3 text-center gap-2 text-white">
                        <CheckCircle2 size={44} className="animate-bounce" />
                        <span className="text-sm font-black">Authenticated!</span>
                        <span className="text-[11px] opacity-90">Entering Talk Sphere...</span>
                      </div>
                    )}

                    {/* Expired Overlay with WhatsApp-style Reload Button */}
                    {qrStatus === 'expired' && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center p-3 text-center gap-3">
                        <span className="text-xs font-bold text-gray-300">QR Code Expired</span>
                        <button
                          type="button"
                          onClick={generateNewQR}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                          <RefreshCw size={13} />
                          <span>Reload QR Code</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expiry Badge / Refresh Trigger */}
                <div className="mt-3 flex items-center gap-2">
                  {qrStatus === 'pending' && (
                    <span className="text-[11px] font-medium text-gray-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Refreshes in <span className="font-bold text-emerald-400">{remaining}s</span>
                    </span>
                  )}
                  {qrStatus !== 'expired' && qrStatus !== 'approved' && (
                    <button
                      type="button"
                      onClick={generateNewQR}
                      disabled={qrLoading}
                      className="text-gray-400 hover:text-emerald-400 transition-colors p-1"
                      title="Force refresh QR code"
                    >
                      <RefreshCw size={13} className={qrLoading ? 'animate-spin' : ''} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 2: EMAIL & FAST OTP LOGIN                              */}
          {/* ══════════════════════════════════════════════════════════ */}
          {authMethod === 'email' && (
            <motion.div
              key="email-login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
            >
              {otpStep === 1 ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="space-y-2 text-left">
                    <label className="flex items-center justify-between text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider ml-1">
                      <span>Email Address</span>
                      <span className="text-[10px] text-emerald-400 font-semibold normal-case">Instant OTP</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b] group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                        <Mail size={18} />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@domain.com"
                        className="w-full bg-[#111728]/90 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white text-sm focus:border-emerald-400/80 focus:bg-[#151d33] focus:ring-4 focus:ring-emerald-500/15 outline-none transition-all placeholder:text-[#64748b] font-medium"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    disabled={loading}
                    className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {loading ? (
                        <Loader2 className="animate-spin" size={17} />
                      ) : (
                        <>
                          GET ONE-TIME PASSWORD <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                        </>
                      )}
                    </span>
                  </motion.button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2 text-left">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider ml-1">
                      <span>Verification Code</span>
                      <span className="text-[10px] text-cyan-400 font-semibold normal-case">Check inbox</span>
                    </div>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b] group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                        <ShieldCheck size={19} />
                      </div>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="000000"
                        maxLength="6"
                        className="w-full bg-[#111728]/90 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white focus:border-cyan-400/80 focus:bg-[#151d33] focus:ring-4 focus:ring-cyan-500/15 outline-none transition-all text-center tracking-[0.6em] font-black text-xl placeholder:text-[#475569]"
                        required
                        autoFocus
                      />
                    </div>
                    <p className="text-[11px] text-[#64748b] text-center">
                      Sent to <span className="text-white font-medium">{email}</span>
                    </p>
                  </div>

                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500 text-slate-950 font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {loading ? <Loader2 className="animate-spin text-black" size={17} /> : <span>AUTHENTICATE & ENTER</span>}
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => setOtpStep(1)}
                    className="w-full text-[#94a3b8] hover:text-white text-xs font-bold transition-colors uppercase tracking-widest cursor-pointer py-1"
                  >
                    ← Change Email Address
                  </button>
                </form>
              )}
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════════════════ */}
          {/* TAB 3: ONE-CLICK GOOGLE SIGN IN                             */}
          {/* ══════════════════════════════════════════════════════════ */}
          {authMethod === 'google' && (
            <motion.div
              key="google-login"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="py-4 space-y-4 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-1">
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Sign in with Google</h3>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                  Access your chats instantly with your verified Google account.
                </p>
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGoogleCustomLogin()}
                disabled={loading}
                className="w-full max-w-sm flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-white/10 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin text-slate-900" />
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>CONTINUE WITH GOOGLE</span>
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Security Note */}
        <div className="pt-5 mt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-[#64748b]">
          <Lock size={12} className="text-emerald-400" />
          <span>End-to-end encrypted • Multi-device synchronized</span>
        </div>
      </motion.div>

      {/* Camera QR Scanner Modal (if user wants to scan with webcam from login screen) */}
      <QRScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScanSuccess={handleCameraScanSuccess}
        title="Scan Login QR"
        subtitle="Point your camera at a TalkSphere QR code to sign in"
      />
    </div>
  );
};

export default LoginPage;
