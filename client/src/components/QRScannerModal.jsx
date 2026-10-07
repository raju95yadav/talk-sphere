import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import {
  X,
  Camera,
  RefreshCw,
  Upload,
  AlertCircle,
  CheckCircle2,
  SwitchCamera,
  Flashlight,
  Shield,
  Smartphone,
  Laptop
} from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * QRScannerModal
 * Props:
 * - isOpen {boolean}
 * - onClose {function}
 * - onScanSuccess {function(qrToken: string)}
 * - title {string} optional
 * - subtitle {string} optional
 */
const QRScannerModal = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan QR Code',
  subtitle = 'Align the QR code within the frame to link'
}) => {
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [scannedResult, setScannedResult] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const readerElementId = 'talk-sphere-qr-reader';

  // Helper to extract clean token from whatever payload was in QR code
  const extractToken = (rawText) => {
    if (!rawText) return null;
    const trimmed = rawText.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.token) return parsed.token;
      if (parsed && parsed.qrToken) return parsed.qrToken;
    } catch {
      // not JSON, check if direct token string
    }
    // Check if URL with token param
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

  const handleSuccessfulScan = (decodedText) => {
    const token = extractToken(decodedText);
    if (!token) {
      toast.error('Invalid QR code format');
      return;
    }

    setScannedResult(token);

    // Haptic feedback if supported
    try {
      if (navigator.vibrate) navigator.vibrate(80);
    } catch { /* ignore */ }

    // Stop scanner
    stopScanner();

    if (onScanSuccess) {
      onScanSuccess(token);
    }
  };

  // Start the scanner with a specific camera
  const startScanner = async (cameraId) => {
    setErrorMsg(null);
    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch { /* ignore */ }
      }

      const html5QrCode = new Html5Qrcode(readerElementId);
      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.max(160, Math.floor(minEdge * 0.75));
          return { width: size, height: size };
        },
        aspectRatio: 1.0,
      };

      const cameraParam = cameraId ? { deviceId: { exact: cameraId } } : { facingMode: 'environment' };

      await html5QrCode.start(
        cameraParam,
        config,
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // ignore frame decode errors while searching
        }
      );

      setIsScanning(true);

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      console.warn('Camera start error:', err);
      setIsScanning(false);
      setErrorMsg(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Please allow camera access in your browser settings, or upload a QR image below.'
          : 'Could not access camera. Ensure no other application is using it or upload an image.'
      );
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (e) {
        console.warn('Error stopping scanner:', e);
      }
    }
    setIsScanning(false);
  };

  // Toggle torch / flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: !torchOn }]
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn('Torch toggle failed:', e);
    }
  };

  // Switch between available cameras
  const handleSwitchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setSelectedCameraId(nextCamera.id);
    startScanner(nextCamera.id);
  };

  // Handle local image file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('qr-temp-file-reader');
      const result = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      handleSuccessfulScan(result);
    } catch (err) {
      toast.error('No QR code detected in this image. Try another one.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Init when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedResult(null);
      setErrorMsg(null);
      return;
    }

    let isMounted = true;

    // Detect cameras
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/rear camera if available
          const backCam = devices.find((d) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('environment'));
          const selectedId = backCam ? backCam.id : devices[0].id;
          setSelectedCameraId(selectedId);
          startScanner(selectedId);
        } else {
          // Fallback to environment facingMode
          startScanner(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          startScanner(null);
        }
      });

    return () => {
      isMounted = false;
      stopScanner();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#12131C] text-white shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500" />

          {/* Modal Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Camera size={16} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">{title}</h3>
                <p className="text-[11px] text-gray-400 leading-tight">{subtitle}</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-800/80 border border-gray-700/60 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-all cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Viewfinder area */}
          <div className="relative p-5 flex flex-col items-center justify-center min-h-[320px]">
            {/* Camera feed canvas container */}
            <div className="relative w-[280px] h-[280px] rounded-2xl overflow-hidden bg-black border-2 border-indigo-500/40 shadow-inner flex items-center justify-center">
              <div id={readerElementId} className="w-full h-full overflow-hidden [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

              {/* Viewfinder Reticle / Overlay */}
              {isScanning && !scannedResult && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Dark vignette corners */}
                  <div className="w-[200px] h-[200px] relative border-2 border-white/20 rounded-2xl">
                    {/* Glowing Laser Scan Bar */}
                    <motion.div
                      animate={{ y: [0, 180, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                      className="absolute top-2 inset-x-2 h-[2px] bg-gradient-to-r from-transparent via-indigo-400 to-transparent shadow-[0_0_12px_#6366f1]"
                    />

                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-lg" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-lg" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-lg" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-lg" />
                  </div>
                </div>
              )}

              {/* Success Result Overlay */}
              {scannedResult && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 p-4">
                  <CheckCircle2 size={54} className="text-indigo-400 animate-bounce" />
                  <span className="text-sm font-extrabold text-white">QR Code Captured!</span>
                  <span className="text-[11px] text-gray-400 text-center">Verifying session details...</span>
                </div>
              )}

              {/* Error / Permission Denied */}
              {errorMsg && (
                <div className="absolute inset-0 bg-[#0f141c] flex flex-col items-center justify-center p-5 text-center gap-3">
                  <AlertCircle size={36} className="text-amber-400" />
                  <p className="text-xs text-gray-300 leading-relaxed font-medium">{errorMsg}</p>
                  <button
                    onClick={() => startScanner(selectedCameraId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-bold hover:bg-indigo-500/30 transition-all cursor-pointer"
                  >
                    <RefreshCw size={12} />
                    Try Again
                  </button>
                </div>
              )}
            </div>

            {/* In-view controls (Switch Camera, Torch) */}
            {isScanning && !scannedResult && (
              <div className="flex items-center gap-3 mt-4">
                {cameras.length > 1 && (
                  <button
                    onClick={handleSwitchCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800/80 border border-gray-700/60 text-xs text-gray-300 hover:text-white hover:bg-gray-700 transition-all cursor-pointer"
                  >
                    <SwitchCamera size={13} />
                    <span>Flip Camera</span>
                  </button>
                )}

                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                      torchOn
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'bg-gray-800/80 border-gray-700/60 text-gray-300 hover:text-white'
                    }`}
                  >
                    <Flashlight size={13} />
                    <span>{torchOn ? 'Torch On' : 'Torch Off'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer: Alternative Image Upload */}
          <div className="px-5 py-3.5 bg-[#1C1D2A] border-t border-white/10 flex items-center justify-between gap-3">
            <span className="text-[11px] text-gray-400">Can't use camera?</span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-indigo-500/50 text-gray-200 hover:text-white text-xs font-semibold transition-all cursor-pointer"
            >
              <Upload size={13} className="text-indigo-400" />
              <span>Scan QR from Image</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          {/* Hidden element for file scanning */}
          <div id="qr-temp-file-reader" className="hidden" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default QRScannerModal;
