import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Laptop,
  Monitor,
  Smartphone,
  Tablet,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  MapPin,
  Clock,
  ShieldAlert
} from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';

const DeviceIcon = ({ os, size = 24, className = '' }) => {
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

/**
 * DeviceApprovalModal
 * Props:
 * - isOpen {boolean}
 * - qrToken {string}
 * - deviceInfo {object: { browser, os, ip }}
 * - onClose {function}
 * - onComplete {function(approved: boolean)}
 */
const DeviceApprovalModal = ({
  isOpen,
  qrToken,
  deviceInfo,
  onClose,
  onComplete
}) => {
  const [loading, setLoading] = useState(false);
  const [decision, setDecision] = useState(null); // 'approved' | 'rejected'

  if (!isOpen) return null;

  const handleDecision = async (allow) => {
    if (!qrToken) return;
    setLoading(true);

    try {
      const res = await apiClient.post('/api/auth/qr/approve', {
        qrToken,
        allow
      });

      if (allow) {
        setDecision('approved');
        toast.success(res.data?.message || 'Device linked successfully!');
        setTimeout(() => {
          onComplete?.(true);
          onClose();
        }, 1200);
      } else {
        setDecision('rejected');
        toast('Device link request was declined', { icon: '🛑' });
        setTimeout(() => {
          onComplete?.(false);
          onClose();
        }, 1000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process device request');
      setLoading(false);
    }
  };

  const browser = deviceInfo?.browser || 'Web Browser';
  const os = deviceInfo?.os || 'Desktop Device';
  const ip = deviceInfo?.ip || 'Local Network';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        onClick={(e) => !loading && e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm rounded-3xl border border-gray-800 bg-[#0e121a] text-white shadow-2xl overflow-hidden p-6"
        >
          {/* Top highlight bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

          {decision === 'approved' ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-lg font-black text-white">Device Linked!</h3>
              <p className="text-xs text-gray-400">
                {browser} on {os} is now logged into your TalkSphere account.
              </p>
            </div>
          ) : decision === 'rejected' ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                <XCircle size={36} />
              </div>
              <h3 className="text-lg font-black text-white">Request Declined</h3>
              <p className="text-xs text-gray-400">This device was not permitted to log in.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Header Icon */}
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <ShieldCheck size={30} />
              </div>

              <div>
                <h3 className="text-lg font-black text-white tracking-tight">
                  Link New Device?
                </h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  A device is requesting permission to log in to your TalkSphere account.
                </p>
              </div>

              {/* Target Device Card */}
              <div className="w-full bg-[#151a24] border border-gray-800 rounded-2xl p-4 flex items-center gap-3.5 text-left">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <DeviceIcon os={os} size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {browser} on {os}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={10} className="text-gray-500" />
                      {ip}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={10} className="text-gray-500" />
                      Just now
                    </span>
                  </div>
                </div>
              </div>

              {/* Security advice */}
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 text-left">
                <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 leading-tight">
                  Only allow this request if you scanned the QR code yourself on your own computer or device.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDecision(false)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  Decline
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleDecision(true)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/25 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <span>Allow & Link</span>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DeviceApprovalModal;
