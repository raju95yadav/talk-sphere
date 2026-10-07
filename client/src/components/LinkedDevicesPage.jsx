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
  Edit2,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const SESSION_KEY = 'ts_device_id';

const getOrCreateSessionId = () => {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = sessionStorage.getItem('ts_session_id') || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
    sessionStorage.setItem('ts_session_id', id);
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

  if (mins < 1)  return 'Active now';
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return `Yesterday at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Pick an icon based on OS/browser/deviceType strings
const DeviceIcon = ({ os, deviceType, size = 20, className = '' }) => {
  const lower = (os || '').toLowerCase();
  const type = (deviceType || '').toLowerCase();
  if (type === 'mobile' || lower.includes('android') || lower.includes('ios') || lower.includes('iphone')) {
    return <Smartphone size={size} className={className} />;
  }
  if (type === 'tablet' || lower.includes('ipad') || lower.includes('tablet')) {
    return <Tablet size={size} className={className} />;
  }
  if (type === 'desktop' || lower.includes('windows') || lower.includes('macos') || lower.includes('mac') || lower.includes('linux')) {
    return <Laptop size={size} className={className} />;
  }
  return <Monitor size={size} className={className} />;
};

// ─────────────────────────────────────────────────────────────
// QR Modal
// ─────────────────────────────────────────────────────────────
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  Upload,
  SwitchCamera,
  Flashlight,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Link Device Modal (WhatsApp-style Dual Mode: Scan QR or Show QR)
// ─────────────────────────────────────────────────────────────
const QR_TTL = 60; // seconds

const LinkDeviceModal = ({ onClose, onLinked }) => {
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'show'

  // ── Show QR State ──────────────────────────────────────────
  const [qrToken,    setQrToken]    = useState(null);
  const [expiresAt,  setExpiresAt]  = useState(null);
  const [remaining,  setRemaining]  = useState(QR_TTL);
  const [loadingQR,  setLoadingQR]  = useState(false);
  const [linked,     setLinked]     = useState(false);
  const refreshRef   = useRef(null);
  const countdownRef = useRef(null);

  // ── Scan QR State ──────────────────────────────────────────
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Approval step when camera detects a QR code
  const [scannedToken, setScannedToken] = useState(null);
  const [targetDevice, setTargetDevice] = useState(null);
  const [approving, setApproving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState(null); // 'approved' | 'rejected'

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const readerId = 'linked-device-camera-feed';

  // ── Fetch QR Token for "Show QR" Tab ──────────────────────
  const fetchToken = useCallback(async () => {
    setLoadingQR(true);
    try {
      const res = await apiClient.post('/api/auth/qr/generate');
      setQrToken(res.data.qrToken);
      setExpiresAt(res.data.expiresAt);
      setRemaining(Math.round((res.data.expiresAt - Date.now()) / 1000) || QR_TTL);
    } catch {
      toast.error('Could not generate QR code');
    } finally {
      setLoadingQR(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'show') {
      fetchToken();
      refreshRef.current = setInterval(fetchToken, 60_000);
      return () => clearInterval(refreshRef.current);
    }
  }, [activeTab, fetchToken]);

  useEffect(() => {
    if (!expiresAt || activeTab !== 'show') return;
    countdownRef.current = setInterval(() => {
      const secs = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemaining(secs);
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [expiresAt, activeTab]);

  // ── Camera Scanner Handlers ───────────────────────────────
  const extractToken = (rawText) => {
    if (!rawText) return null;
    const trimmed = rawText.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.token) return parsed.token;
      if (parsed?.qrToken) return parsed.qrToken;
    } catch { /* not JSON */ }
    if (trimmed.includes('token=')) {
      const match = trimmed.match(/token=([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    if (trimmed.includes('tsqr_')) {
      const match = trimmed.match(/(tsqr_[a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return trimmed;
  };

  const handleScanCaptured = useCallback(async (decodedText) => {
    if (isVerifying || targetDevice) return;

    const token = extractToken(decodedText);
    if (!token) return toast.error('Unrecognized QR Code');

    setIsVerifying(true);
    setScannedToken(token);

    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch { /* ignore */ }

    // Verify token with server and get target device details
    try {
      const res = await apiClient.post('/api/auth/qr/scan', { qrToken: token });
      await stopScanner();
      setTargetDevice(res.data.device || { browser: 'Desktop Browser', os: 'Computer', ip: '127.0.0.1' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid or expired QR code');
      setScannedToken(null);
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, targetDevice]);

  const startScanner = async (camId) => {
    setScannerError(null);
    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch { /* ignore */ }
      }
      const qrCode = new Html5Qrcode(readerId);
      scannerRef.current = qrCode;

      const cameraConfig = camId ? { deviceId: { exact: camId } } : { facingMode: 'environment' };
      await qrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(160, Math.floor(minEdge * 0.75));
            return { width: size, height: size };
          },
          aspectRatio: 1.0
        },
        (decodedText) => handleScanCaptured(decodedText),
        () => {}
      );
      setIsScanning(true);

      try {
        const capabilities = qrCode.getRunningTrackCapabilities();
        setHasTorch(Boolean(capabilities?.torch));
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      setIsScanning(false);
      setScannerError(
        err?.name === 'NotAllowedError' || err?.message?.includes('Permission')
          ? 'Camera permission denied. Please allow camera permissions in your browser or upload an image below.'
          : 'Could not start camera. Check permissions or upload an image.'
      );
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch { /* ignore */ }
    }
    setIsScanning(false);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch { /* ignore */ }
  };

  const handleSwitchCamera = () => {
    if (cameras.length < 2) return;
    const curIdx = cameras.findIndex(c => c.id === selectedCameraId);
    const nextCam = cameras[(curIdx + 1) % cameras.length];
    setSelectedCameraId(nextCam.id);
    startScanner(nextCam.id);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const qrCode = new Html5Qrcode('qr-upload-helper');
      const text = await qrCode.scanFile(file, true);
      qrCode.clear();
      handleScanCaptured(text);
    } catch {
      toast.error('No readable QR code found in this image');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Start / stop camera based on active tab
  useEffect(() => {
    if (activeTab === 'scan' && !targetDevice) {
      let isMounted = true;
      Html5Qrcode.getCameras()
        .then((devices) => {
          if (!isMounted) return;
          if (devices?.length > 0) {
            setCameras(devices);
            const rear = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
            const camId = rear ? rear.id : devices[0].id;
            setSelectedCameraId(camId);
            startScanner(camId);
          } else {
            startScanner(null);
          }
        })
        .catch(() => {
          if (isMounted) startScanner(null);
        });
      return () => {
        isMounted = false;
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [activeTab, targetDevice]);

  // ── Approval Decision Handler ─────────────────────────────
  const handleApproveDecision = async (allow) => {
    if (!scannedToken) return;
    setApproving(true);
    try {
      const res = await apiClient.post('/api/auth/qr/approve', {
        qrToken: scannedToken,
        allow
      });

      if (allow) {
        setApprovalStatus('approved');
        toast.success(res.data?.message || 'Device linked successfully!');
        setTimeout(() => {
          onLinked();
          onClose();
        }, 1400);
      } else {
        setApprovalStatus('rejected');
        toast('Device linking was declined', { icon: '🛑' });
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process approval');
      setApproving(false);
    }
  };

  const qrPayload = qrToken ? JSON.stringify({ app: 'talk-sphere', type: 'login', token: qrToken }) : '';
  const pct = (remaining / QR_TTL) * 100;
  const isWarning = remaining <= 15;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => !approving && e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 24 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 shadow-2xl shadow-black/80 overflow-hidden flex flex-col"
        style={{ background: '#12131C' }}
      >
        {/* Top accent line */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
          <div>
            <h3 className="text-base font-black text-white tracking-tight">Link a Device</h3>
            <p className="text-[11px] text-gray-400">
              {activeTab === 'scan' ? 'Scan another screen to link' : 'Show code to be scanned'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Segmented Mode Tabs (Scan QR vs Show QR) */}
        {!targetDevice && (
          <div className="px-5 pt-3">
            <div className="grid grid-cols-2 p-1 bg-gray-900/90 rounded-2xl border border-gray-800">
              <button
                type="button"
                onClick={() => setActiveTab('scan')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'scan'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Camera size={14} />
                <span>Scan QR Code</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('show')}
                className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'show'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Link2 size={14} />
                <span>Show QR Code</span>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 flex flex-col items-center">
          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB 1: SCAN QR (Default WhatsApp Experience) */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTab === 'scan' && (
            <div className="w-full flex flex-col items-center">
              {targetDevice ? (
                /* Device Approval Prompt */
                <div className="w-full flex flex-col items-center text-center space-y-4 py-2">
                  {approvalStatus === 'approved' ? (
                    <div className="py-6 flex flex-col items-center gap-2.5">
                      <CheckCircle2 size={48} className="text-indigo-400 animate-bounce" />
                      <h4 className="text-base font-black text-white">Device Linked!</h4>
                      <p className="text-xs text-gray-400">
                        {targetDevice.browser} on {targetDevice.os} is now connected.
                      </p>
                    </div>
                  ) : approvalStatus === 'rejected' ? (
                    <div className="py-6 flex flex-col items-center gap-2.5">
                      <AlertTriangle size={48} className="text-red-400" />
                      <h4 className="text-base font-black text-white">Request Declined</h4>
                      <p className="text-xs text-gray-400">Connection permission was not granted.</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-13 h-13 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg">
                        <Shield size={28} />
                      </div>

                      <div>
                        <h4 className="text-base font-black text-white">Authorize New Device?</h4>
                        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                          This screen wants to log into your TalkSphere account:
                        </p>
                      </div>

                      {/* Device Detail Card */}
                      <div className="w-full bg-[#1C1D2A] border border-white/10 rounded-2xl p-3.5 flex items-center gap-3 text-left">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                          <DeviceIcon os={targetDevice.os} deviceType={targetDevice.deviceType} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {targetDevice.deviceName || `${targetDevice.browser} on ${targetDevice.os}`}
                          </p>
                          <p className="text-[11px] text-indigo-400/90 font-medium truncate">
                            {targetDevice.browser} on {targetDevice.os}
                          </p>
                          <div className="flex items-center gap-2.5 mt-0.5 text-[11px] text-gray-400">
                            <span className="flex items-center gap-1">
                              <MapPin size={10} className="text-gray-500" />
                              {targetDevice.ip}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock size={10} className="text-gray-500" />
                              Just now
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="w-full bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2 text-left">
                        <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-200/90 leading-tight">
                          Ensure this is your screen. Only approve devices you recognize.
                        </p>
                      </div>

                      {/* Approval Action Buttons */}
                      <div className="w-full flex items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          disabled={approving}
                          onClick={() => handleApproveDecision(false)}
                          className="flex-1 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          Decline
                        </button>

                        <button
                          type="button"
                          disabled={approving}
                          onClick={() => handleApproveDecision(true)}
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/30 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {approving ? <Loader2 size={14} className="animate-spin" /> : <span>Allow & Link</span>}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Camera Scanner Viewfinder */
                <div className="w-full flex flex-col items-center">
                  <div className="relative w-[230px] h-[230px] rounded-2xl overflow-hidden bg-black border-2 border-indigo-500/40 shadow-inner flex items-center justify-center my-1">
                    <div id={readerId} className="w-full h-full overflow-hidden [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

                    {/* Viewfinder Target & Laser Overlay */}
                    {isScanning && !isVerifying && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-[170px] h-[170px] relative border-2 border-white/20 rounded-xl">
                          <motion.div
                            animate={{ y: [0, 150, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute top-2 inset-x-2 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_10px_#6366f1]"
                          />
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-3 border-l-3 border-indigo-400 rounded-tl-md" />
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-3 border-r-3 border-indigo-400 rounded-tr-md" />
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-3 border-l-3 border-indigo-400 rounded-bl-md" />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-3 border-r-3 border-indigo-400 rounded-br-md" />
                        </div>
                      </div>
                    )}

                    {/* Verifying Session Overlay */}
                    {isVerifying && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex flex-col items-center justify-center p-3 text-center gap-2 z-20">
                        <Loader2 size={32} className="text-indigo-400 animate-spin" />
                        <span className="text-xs font-bold text-white">Verifying QR Code...</span>
                        <span className="text-[10px] text-indigo-300">Connecting to session</span>
                      </div>
                    )}

                    {scannerError && (
                      <div className="absolute inset-0 bg-[#0d1117] flex flex-col items-center justify-center p-4 text-center gap-2.5">
                        <AlertTriangle size={28} className="text-amber-400" />
                        <p className="text-[11px] text-gray-300 leading-snug">{scannerError}</p>
                        <button
                          onClick={() => startScanner(selectedCameraId)}
                          className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-[11px] font-bold"
                        >
                          Retry Camera
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Camera Controls */}
                  {isScanning && (
                    <div className="flex items-center gap-2 mt-2">
                      {cameras.length > 1 && (
                        <button
                          type="button"
                          onClick={handleSwitchCamera}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-800 text-[11px] text-gray-300 hover:text-white"
                        >
                          <SwitchCamera size={12} />
                          <span>Flip</span>
                        </button>
                      )}
                      {hasTorch && (
                        <button
                          type="button"
                          onClick={toggleTorch}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                            torchOn ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          <Flashlight size={12} />
                          <span>{torchOn ? 'Torch On' : 'Torch Off'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Alternative: Image Upload */}
                  <div className="w-full flex items-center justify-between pt-3 mt-2 border-t border-gray-800/80">
                    <span className="text-[11px] text-gray-400">Can't point camera?</span>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold"
                    >
                      <Upload size={12} className="text-indigo-400" />
                      <span>Upload QR Image</span>
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                  <div id="qr-upload-helper" className="hidden" />
                </div>
              )}
            </div>
          )}

          {/* ────────────────────────────────────────────────────────── */}
          {/* TAB 2: SHOW QR (Generate Code for Other Devices) */}
          {/* ────────────────────────────────────────────────────────── */}
          {activeTab === 'show' && (
            <div className="w-full flex flex-col items-center gap-4">
              <div className="relative">
                {/* Progress countdown ring */}
                <svg
                  className="absolute inset-0 -rotate-90"
                  width="210"
                  height="210"
                  viewBox="0 0 210 210"
                  aria-hidden="true"
                >
                  <circle cx="105" cy="105" r="101" fill="none" stroke="#1f2430" strokeWidth="4" />
                  <circle
                    cx="105" cy="105" r="101"
                    fill="none"
                    stroke={isWarning ? '#ef4444' : '#6366f1'}
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 101}`}
                    strokeDashoffset={`${2 * Math.PI * 101 * (1 - pct / 100)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
                  />
                </svg>

                <div
                  className="w-[190px] h-[190px] rounded-2xl flex items-center justify-center overflow-hidden mx-[10px] my-[10px]"
                  style={{ background: '#fff' }}
                >
                  <AnimatePresence mode="wait">
                    {linked ? (
                      <motion.div
                        key="linked"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <CheckCircle2 size={48} className="text-indigo-400" />
                        <span className="text-[12px] font-bold text-indigo-400">Device Linked!</span>
                      </motion.div>
                    ) : loadingQR ? (
                      <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <Loader2 size={32} className="text-gray-400 animate-spin" />
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
                          size={170}
                          level="M"
                          fgColor="#0f172a"
                          bgColor="#ffffff"
                          style={{ borderRadius: 4, display: 'block' }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {!linked && !loadingQR && (
                  <div
                    className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold border shadow-lg ${
                      isWarning
                        ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        : 'bg-gray-900 border-gray-700/50 text-gray-400'
                    }`}
                  >
                    Refreshes in {remaining}s
                  </div>
                )}
              </div>

              {!linked && (
                <button
                  onClick={fetchToken}
                  disabled={loadingQR}
                  className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-indigo-400 transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} className={loadingQR ? 'animate-spin' : ''} />
                  Refresh QR Code
                </button>
              )}

              {/* Instructions */}
              <div className="w-full space-y-2 pt-2 border-t border-gray-800">
                {[
                  { n: '1', text: 'Open Talk Sphere on your other device' },
                  { n: '2', text: 'Go to Settings → Linked Devices → Link a Device' },
                  { n: '3', text: 'Point your camera at this QR code to link' },
                ].map((step) => (
                  <div key={step.n} className="flex items-start gap-2.5">
                    <span className="shrink-0 w-4.5 h-4.5 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-[10px] font-black text-indigo-400">
                      {step.n}
                    </span>
                    <p className="text-[11px] text-gray-400 leading-snug">{step.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Single Session Card
// ─────────────────────────────────────────────────────────────
const SessionCard = ({ session, isCurrent, onRemove, removing, onRename }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(session.customName || '');

  const displayName = session.customName || session.deviceName || `${session.browser} on ${session.os}`;
  const deviceCategory = session.deviceType === 'mobile' ? 'Mobile Phone' : session.deviceType === 'tablet' ? 'Tablet' : 'Computer';

  const handleSaveName = (e) => {
    e.stopPropagation();
    if (nameInput.trim() && nameInput.trim() !== session.customName) {
      if (onRename) onRename(session.sessionId, nameInput.trim());
    }
    setIsEditing(false);
  };

  return (
    <motion.div
      variants={child}
      layout
      className={`
        w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border transition-all shadow-sm
        ${isCurrent
          ? 'border-indigo-500/30 bg-indigo-500/10'
          : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#1C1D2A] hover:bg-slate-50 dark:hover:bg-[#1C1D2A]/80'}
      `}
    >
      {/* Device icon bubble */}
      <div
        className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${
          isCurrent
            ? 'bg-indigo-500/15 border-indigo-500/25 text-indigo-600 dark:text-indigo-400'
            : 'bg-slate-100 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700/50 text-slate-600 dark:text-gray-400'
        }`}
      >
        <DeviceIcon os={session.os} deviceType={session.deviceType} size={20} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {isEditing ? (
            <div className="flex items-center gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Give device a name"
                className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-gray-800 border border-indigo-500/50 rounded-lg text-slate-900 dark:text-white outline-none w-full max-w-[170px]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName(e);
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center cursor-pointer hover:bg-indigo-500"
                title="Save name"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="w-6 h-6 rounded-md bg-gray-700 text-gray-300 flex items-center justify-center cursor-pointer"
                title="Cancel"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate leading-tight">
                {displayName}
              </p>
              <button
                type="button"
                onClick={() => {
                  setNameInput(session.customName || session.deviceName || '');
                  setIsEditing(true);
                }}
                className="text-gray-400 hover:text-indigo-400 transition-colors p-0.5"
                title="Rename this device"
              >
                <Edit2 size={11} />
              </button>
            </div>
          )}

          {isCurrent && !isEditing && (
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-1.5 py-0.5 rounded-full">
              This device
            </span>
          )}
        </div>

        {/* Subtitle with browser, OS, and category */}
        <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium truncate mb-1">
          {session.browser} on {session.os} • {deviceCategory}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {session.ip && session.ip !== 'Unknown' && (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-gray-400">
              <MapPin size={9} />
              {session.ip}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-gray-400">
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
          className="shrink-0 w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-300 transition-all cursor-pointer focus-visible:outline-none disabled:opacity-50"
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
};

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
      let clientModel = '';
      if (navigator.userAgentData?.getHighEntropyValues) {
        try {
          const data = await navigator.userAgentData.getHighEntropyValues(['model']);
          if (data?.model) clientModel = data.model;
        } catch { /* ignore */ }
      }
      await apiClient.post('/api/devices/register', {
        sessionId: currentSessionId,
        clientModel,
      });
    } catch { /* non-critical */ }
  }, [currentSessionId]);

  useEffect(() => {
    if (!isOpen) return;
    registerCurrent().then(loadSessions);
  }, [isOpen, registerCurrent, loadSessions]);

  // ── Rename device ────────────────────────────────────────
  const handleRename = useCallback(async (sessionId, newName) => {
    try {
      const res = await apiClient.put(`/api/devices/${sessionId}/name`, { customName: newName });
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, customName: res.data.session.customName } : s))
      );
      toast.success('Device name updated');
    } catch {
      toast.error('Failed to update device name');
    }
  }, []);

  // ── Socket: real-time device events ─────────────────────
  useEffect(() => {
    if (!socket) return;

    const onLinked = () => {
      loadSessions();
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
  }, [socket, loadSessions]);

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
            className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-[#f8fafc] dark:bg-[#12131C] text-slate-900 dark:text-white transition-colors duration-300"
          >
            {/* Top highlight line */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent pointer-events-none z-10" />

            {/* ── Header ── */}
            <div
              className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-slate-200 dark:border-white/10 shrink-0 bg-white/90 dark:bg-[#12131C]/90 backdrop-blur-md"
            >
              <motion.button
                id="linked-devices-back"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.88 }}
                onClick={onBack}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer focus-visible:outline-none"
              >
                <ArrowLeft size={15} />
              </motion.button>

              <div className="flex-1 min-w-0">
                <h2 className="text-[17px] font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                  Linked Devices
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400/85 leading-none mt-0.5">
                  Manage active sessions
                </p>
              </div>

              <button
                onClick={loadSessions}
                disabled={loading}
                className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer focus-visible:outline-none"
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
                    <div className="w-16 h-11 rounded-t-lg bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-700/80 flex items-center justify-center shadow-md">
                      <div className="w-12 h-7 rounded bg-slate-100 dark:bg-gray-900 border border-slate-300 dark:border-gray-700/60 flex items-center justify-center">
                        <div className="w-6 h-4 rounded-sm"
                          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                        />
                      </div>
                    </div>
                    <div className="w-20 h-1.5 rounded-b bg-slate-300 dark:bg-gray-700 border-t border-slate-300 dark:border-gray-600/60 -mt-px" />
                  </div>

                  {/* Phone */}
                  <div className="w-8 h-14 rounded-xl bg-slate-200 dark:bg-gray-800 border border-slate-300 dark:border-gray-700/80 flex flex-col items-center justify-between py-1.5 shadow-md mb-1">
                    <div className="w-3 h-0.5 rounded-full bg-slate-400 dark:bg-gray-700" />
                    <div className="w-5 h-7 rounded bg-slate-100 dark:bg-gray-900 border border-slate-300 dark:border-gray-700/60 flex items-center justify-center">
                      <div className="w-2.5 h-3.5 rounded-sm"
                        style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
                      />
                    </div>
                    <div className="w-3 h-3 rounded-full border border-slate-300 dark:border-gray-600/60" />
                  </div>

                  {/* Wifi arcs */}
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 opacity-60">
                    {[14, 10, 6].map((s, i) => (
                      <div key={i}
                        className="rounded-full border-t-2 border-indigo-400"
                        style={{ width: s, height: s / 2 }}
                      />
                    ))}
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-[13px] font-bold text-slate-900 dark:text-white">Use Talk Sphere everywhere</p>
                  <p className="text-[11px] text-slate-500 dark:text-gray-500 mt-0.5 max-w-[220px] leading-relaxed">
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
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #4338ca 100%)',
                    boxShadow: '0 8px 32px -4px rgba(99,102,241,0.4)',
                  }}
                >
                  {/* Pulse rings */}
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="w-full h-full rounded-2xl border-2 border-indigo-400/30 animate-ping absolute" />
                  </span>
                  <Link2 size={17} />
                  Link a Device
                </motion.button>
              </motion.div>

              {/* ── Current device ── */}
              {currentSession && (
                <motion.div variants={child} className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400 px-1">
                    This Device
                  </p>
                  <SessionCard
                    session={currentSession}
                    isCurrent
                    onRemove={handleRemove}
                    removing={removing}
                    onRename={handleRename}
                  />
                </motion.div>
              )}

              {/* ── Linked devices list ── */}
              <motion.div variants={child} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400 px-1">
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
                      <Loader2 size={24} className="text-indigo-500 dark:text-indigo-400 animate-spin" />
                      <p className="text-[11px] text-slate-500 dark:text-gray-400 font-medium">Loading sessions…</p>
                    </motion.div>
                  ) : otherSessions.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="py-8 flex flex-col items-center gap-3 border border-dashed border-slate-300 dark:border-white/10 rounded-2xl bg-white/50 dark:bg-transparent"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-gray-800/60 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center">
                        <WifiOff size={18} className="text-slate-400 dark:text-gray-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-[12px] font-semibold text-slate-700 dark:text-gray-400">No linked devices</p>
                        <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-0.5">
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
                          onRename={handleRename}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Security note */}
              <motion.div
                variants={child}
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25"
              >
                <Shield size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[10.5px] text-amber-800 dark:text-amber-300/90 font-medium leading-relaxed">
                  If you see an unfamiliar device, log it out immediately and change your password.
                </p>
              </motion.div>
            </motion.div>

            {/* ── Sticky "Log out all" footer ── */}
            {otherSessions.length > 0 && (
              <div
                className="absolute bottom-0 inset-x-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom,16px))] pt-4 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc]/95 dark:from-[#11141a] dark:via-[#11141a]/95 to-transparent z-20"
              >
                <motion.button
                  id="linked-devices-logout-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRemoveAll}
                  disabled={removingAll}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-300 text-[12px] font-black uppercase tracking-wider transition-all cursor-pointer focus-visible:outline-none disabled:opacity-50 shadow-xl"
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

      {/* ── Link Device Modal (portal-style, outside the panel) ── */}
      <AnimatePresence>
        {showQR && (
          <LinkDeviceModal
            onClose={() => setShowQR(false)}
            onLinked={loadSessions}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default LinkedDevicesPage;
