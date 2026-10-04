import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Loader2,
  FileText,
  Search,
  Maximize2,
  Mic,
  FileVideo,
  Play,
  CheckCircle,
  ArrowDownToLine,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import {
  isMediaDownloaded,
  markMediaDownloaded,
  shouldAutoDownload,
  getCurrentNetworkType,
} from '../utils/storagePrefs';
import toast from 'react-hot-toast';

/**
 * WhatsApp-style Media Bubble component:
 * - Sender (Ram): Media is always displayed clearly because sender sent it.
 * - Receiver (Shyam): Auto-downloads based on Shyam's storage/data preferences & network,
 *   or shows WhatsApp blurred download card until manually clicked.
 */
const WhatsAppMediaBubble = ({
  msg,
  currentUserId,
  prefs,
  networkType: propNetworkType,
  onSelectImage,
  onSelectPdf,
  AudioPlayerComponent,
  isGroup = false,
}) => {
  // Determine if current user is the sender
  const isSender = useMemo(() => {
    if (msg.isSent) return true;
    const senderId = msg.sender?._id || msg.sender;
    return String(senderId) === String(currentUserId);
  }, [msg, currentUserId]);

  const activeNetwork = propNetworkType || getCurrentNetworkType(prefs);
  const mediaType = (msg.type || '').toLowerCase();

  // Local state for whether this media has been downloaded on this client
  const [downloaded, setDownloaded] = useState(() => {
    if (isSender) return true;
    if (isMediaDownloaded(msg._id)) return true;
    // Check auto-download preference for receiver
    const auto = shouldAutoDownload(mediaType, prefs, activeNetwork);
    if (auto && msg._id) {
      markMediaDownloaded(msg._id);
      return true;
    }
    return false;
  });

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

  // Check if media is corrupted or invalid (e.g. client-local blob on receiver or dead link)
  const isInvalidMedia =
    hasError ||
    !msg.content ||
    msg.isCorruptedMedia ||
    (typeof msg.content === 'string' && msg.content.startsWith('blob:') && !isSender);

  // Sync if another tab or event marks it downloaded
  useEffect(() => {
    if (downloaded) return;
    const handleDownloadedEvent = (e) => {
      if (e?.detail?.cleared) {
        // If cache cleared, re-evaluate
        if (!isSender) {
          const auto = shouldAutoDownload(mediaType, prefs, activeNetwork);
          setDownloaded(auto);
        }
      } else if (e?.detail?.msgId === String(msg._id)) {
        setDownloaded(true);
      }
    };
    window.addEventListener('ts_media_downloaded', handleDownloadedEvent);
    return () => window.removeEventListener('ts_media_downloaded', handleDownloadedEvent);
  }, [downloaded, isSender, mediaType, prefs, activeNetwork, msg._id]);

  // Re-check when storage preferences or network type changes
  useEffect(() => {
    if (isSender || downloaded) return;
    if (isMediaDownloaded(msg._id)) {
      setDownloaded(true);
      return;
    }
    const auto = shouldAutoDownload(mediaType, prefs, activeNetwork);
    if (auto && msg._id) {
      markMediaDownloaded(msg._id);
      setDownloaded(true);
    }
  }, [prefs, activeNetwork, isSender, downloaded, mediaType, msg._id]);

  // Manual download handler (simulating authentic WhatsApp download flow)
  const handleManualDownload = useCallback(async (e) => {
    if (e) e.stopPropagation();
    if (downloading || downloaded || isInvalidMedia) return;

    setDownloading(true);
    setDownloadProgress(15);

    try {
      // Animate simulated downloading progress while fetching/caching
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 25;
        });
      }, 120);

      // Preload image/media safely
      if (mediaType === 'image') {
        if (!msg.content || (msg.content.startsWith('blob:') && !isSender)) {
          setHasError(true);
          return;
        }
        await new Promise((resolve) => {
          const img = new window.Image();
          img.src = msg.content;
          img.onload = () => resolve();
          img.onerror = () => {
            setHasError(true);
            resolve();
          };
        });
      } else {
        await new Promise((r) => setTimeout(r, 600));
      }

      clearInterval(interval);
      setDownloadProgress(100);
      await new Promise((r) => setTimeout(r, 180));

      markMediaDownloaded(msg._id);
      setDownloaded(true);
      toast.success(
        `${mediaType === 'image' ? 'Photo' : mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Voice Note' : 'Document'} downloaded`,
        { icon: '📥', style: { borderRadius: '14px', background: '#1f2937', color: '#fff', fontSize: '12px' } }
      );
    } catch (err) {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  }, [downloading, downloaded, isInvalidMedia, mediaType, msg._id, msg.content, isSender]);

  // Render graceful fallback card if media is unavailable / dead link
  if (isInvalidMedia) {
    return (
      <div className="space-y-1.5 my-1">
        <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/10 bg-slate-900/80 text-center max-w-[260px] md:max-w-[300px] shadow-sm">
          <div className="w-9 h-9 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-2">
            <AlertCircle size={18} />
          </div>
          <p className="text-[12px] font-bold text-slate-200">
            {mediaType === 'image' ? 'Photo Unavailable' : mediaType === 'video' ? 'Video Unavailable' : 'Media Unavailable'}
          </p>
          <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
            {isSender ? 'Upload was incomplete or local file has expired.' : 'This file was not uploaded to the server.'}
          </p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. IMAGE / PHOTO
  // ─────────────────────────────────────────────────────────────
  if (mediaType === 'image') {
    if (!downloaded) {
      // WhatsApp blurred image placeholder with centered circular download button
      return (
        <div className="space-y-1.5 my-1">
          <div
            className="relative overflow-hidden rounded-xl border border-white/10 max-w-[260px] md:max-w-[320px] h-[210px] bg-slate-900 flex items-center justify-center cursor-pointer group select-none shadow-md"
            onClick={handleManualDownload}
          >
            {/* Blurred background preview (only if valid remote url) */}
            {msg.content && !msg.content.startsWith('blob:') && !hasError ? (
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-500 filter blur-xl scale-110 opacity-40 brightness-75"
                style={{ backgroundImage: `url(${msg.content})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-slate-800/80" />
            )}
            {/* WhatsApp frosted dark vignette */}
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[6px]" />

            {/* Centered WhatsApp download button */}
            <motion.div
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className="relative z-10 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-black/75 border border-white/20 shadow-2xl backdrop-blur-md group-hover:bg-black/90 group-hover:border-emerald-500/50 transition-all cursor-pointer"
            >
              {downloading ? (
                <div className="flex flex-col items-center">
                  <Loader2 size={24} className="text-emerald-400 animate-spin" />
                  <span className="text-[9px] font-bold text-emerald-400 font-mono mt-1">
                    {downloadProgress}%
                  </span>
                </div>
              ) : (
                <>
                  <Download size={20} className="text-white drop-shadow group-hover:text-emerald-400 transition-colors" />
                  <span className="text-[10px] font-bold text-white/90 font-mono mt-0.5 leading-none">
                    {msg.fileSize || 'Photo'}
                  </span>
                </>
              )}
            </motion.div>

            {/* Bottom info badge */}
            <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-white/80 font-bold uppercase tracking-wider z-10 pointer-events-none">
              <span className="truncate max-w-[150px]">{msg.fileName || 'Photo'}</span>
              <span className="bg-black/60 px-1.5 py-0.5 rounded text-[9px] border border-white/10 text-emerald-400">
                Tap to download
              </span>
            </div>
          </div>
        </div>
      );
    }

    // Fully downloaded / sender view
    return (
      <div className="space-y-1.5 my-1">
        <div
          className={`relative group/img overflow-hidden rounded-xl border border-white/10 max-w-[260px] md:max-w-[320px] bg-black/20 ${
            isGroup ? 'cursor-pointer' : ''
          }`}
          onClick={() => {
            if (onSelectImage) onSelectImage(msg.content);
          }}
        >
          <img
            src={msg.content}
            onError={() => setHasError(true)}
            className="w-full max-h-[320px] object-cover rounded-lg cursor-pointer hover:scale-[1.03] transition-transform duration-300"
            alt={msg.fileName || 'Photo'}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <Search className="text-white drop-shadow-md" size={24} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 px-1">
          <span className="text-[10px] opacity-50 font-bold uppercase tracking-widest truncate max-w-[180px]">
            {msg.fileName || 'Photo'}
          </span>
          <a
            href={msg.content}
            target="_blank"
            rel="noreferrer"
            download={msg.fileName || 'photo'}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 text-[10px] opacity-70 hover:opacity-100 transition-opacity text-emerald-400 font-semibold"
          >
            <Download size={12} />
            <span>Save</span>
          </a>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. VIDEO
  // ─────────────────────────────────────────────────────────────
  if (mediaType === 'video') {
    if (!downloaded) {
      return (
        <div className="space-y-1.5 my-1">
          <div
            className="relative overflow-hidden rounded-xl border border-white/10 max-w-[260px] md:max-w-[320px] h-[190px] bg-slate-900 flex items-center justify-center cursor-pointer group select-none shadow-md"
            onClick={handleManualDownload}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/80" />
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-white">
              <FileVideo size={12} className="text-emerald-400" />
              <span>Video</span>
            </div>

            <motion.div
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className="relative z-10 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-black/75 border border-white/20 shadow-2xl backdrop-blur-md group-hover:bg-black/90 group-hover:border-emerald-500/50 transition-all cursor-pointer"
            >
              {downloading ? (
                <div className="flex flex-col items-center">
                  <Loader2 size={24} className="text-emerald-400 animate-spin" />
                  <span className="text-[9px] font-bold text-emerald-400 font-mono mt-1">
                    {downloadProgress}%
                  </span>
                </div>
              ) : (
                <>
                  <Download size={20} className="text-white drop-shadow group-hover:text-emerald-400 transition-colors" />
                  <span className="text-[10px] font-bold text-white/90 font-mono mt-0.5 leading-none">
                    {msg.fileSize || '4.8 MB'}
                  </span>
                </>
              )}
            </motion.div>

            <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-white/80 font-bold uppercase tracking-wider z-10 pointer-events-none">
              <span className="truncate max-w-[150px]">{msg.fileName || 'Video'}</span>
              <span className="bg-black/60 px-1.5 py-0.5 rounded text-[9px] border border-white/10 text-emerald-400">
                Tap to download
              </span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-1.5 my-1">
        <div className="relative rounded-xl overflow-hidden bg-black/40 aspect-video flex items-center justify-center max-w-[260px] md:max-w-[320px] border border-white/10">
          <video src={msg.content} className="w-full max-h-[320px] object-cover rounded-xl" controls />
        </div>
        <div className="flex items-center justify-between gap-4 px-1">
          <span className="text-[10px] opacity-50 font-bold uppercase truncate max-w-[180px]">
            {msg.fileName || 'Video'}
          </span>
          <a
            href={msg.content}
            target="_blank"
            rel="noreferrer"
            download={msg.fileName || 'video'}
            className="flex items-center gap-1 text-[10px] opacity-70 hover:opacity-100 transition-opacity text-emerald-400 font-semibold"
          >
            <Download size={12} />
            <span>Save</span>
          </a>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. AUDIO / VOICE NOTE
  // ─────────────────────────────────────────────────────────────
  if (mediaType === 'audio') {
    if (!downloaded) {
      return (
        <div
          onClick={handleManualDownload}
          className="flex items-center gap-3 p-2.5 rounded-xl my-1 bg-black/25 dark:bg-black/35 border border-white/10 hover:border-emerald-500/40 cursor-pointer transition-all group max-w-[280px]"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0 group-hover:scale-105 transition-transform">
            {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[12px] font-bold text-text-main truncate">
              {msg.fileName || 'Voice Note'}
            </p>
            <p className="text-[10px] font-mono text-emerald-400 font-semibold mt-0.5">
              {downloading ? `Downloading ${downloadProgress}%` : `Tap to download (${msg.fileSize || '220 KB'})`}
            </p>
          </div>
        </div>
      );
    }

    if (AudioPlayerComponent) {
      return (
        <div className="space-y-1 my-1">
          <AudioPlayerComponent src={msg.content} />
          <div className="flex items-center justify-between gap-4 px-1">
            <span className="text-[10px] opacity-50 font-bold uppercase tracking-widest truncate max-w-[180px]">
              {msg.fileName || 'Voice Note'}
            </span>
            <a
              href={msg.content}
              target="_blank"
              rel="noreferrer"
              download={msg.fileName || 'voice-note'}
              className="flex items-center gap-1 text-[10px] opacity-70 hover:opacity-100 transition-opacity text-emerald-400 font-semibold"
            >
              <Download size={12} />
              <span>Save</span>
            </a>
          </div>
        </div>
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. DOCUMENT / FILE / PDF
  // ─────────────────────────────────────────────────────────────
  if (mediaType === 'file' || mediaType === 'document') {
    const isPdf = (msg.fileName || '').toLowerCase().endsWith('.pdf');
    const isDoc = (msg.fileName || '').toLowerCase().match(/\.(doc|docx)$/);

    if (!downloaded) {
      return (
        <div
          onClick={handleManualDownload}
          className="flex items-center gap-3 p-3 bg-black/20 hover:bg-black/30 rounded-xl my-1 border border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer group min-w-[240px] max-w-[320px]"
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isPdf
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : isDoc
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            <FileText size={20} />
          </div>

          <div className="text-left overflow-hidden flex-1">
            <p className="text-[13px] font-bold truncate leading-tight text-text-main group-hover:text-emerald-400 transition-colors">
              {msg.fileName || 'Document'}
            </p>
            <p className="text-[10px] font-mono text-text-muted mt-0.5 flex items-center gap-1.5">
              <span>{msg.fileSize || '350 KB'}</span>
              <span className="text-emerald-400 font-bold">• Tap to download</span>
            </p>
          </div>

          <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-all">
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          </div>
        </div>
      );
    }

    // Downloaded document
    return (
      <div
        className={`flex items-center gap-3 p-3 bg-black/15 dark:bg-black/25 rounded-xl my-1 border border-white/10 min-w-[240px] max-w-[320px] ${
          isPdf ? 'cursor-pointer hover:bg-black/30 hover:border-red-500/40' : ''
        } transition-all`}
        onClick={() => {
          if (isPdf && onSelectPdf) onSelectPdf(msg);
        }}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isPdf
              ? 'bg-red-500/20 text-red-500 border border-red-500/30'
              : isDoc
              ? 'bg-blue-500/20 text-blue-500 border border-blue-500/30'
              : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
          }`}
        >
          <FileText size={20} />
        </div>
        <div className="text-left overflow-hidden flex-1">
          <p className="text-[13px] font-bold truncate leading-tight text-text-main">
            {msg.fileName || 'Document'}
          </p>
          <p className="text-[10px] opacity-60 uppercase font-bold mt-0.5">
            {msg.fileSize || 'File'} {isPdf && '• Click to view'}
          </p>
        </div>
        <a
          href={msg.content}
          target="_blank"
          rel="noreferrer"
          download={msg.fileName || 'document'}
          onClick={(e) => e.stopPropagation()}
          className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0 text-emerald-400"
          title="Save file"
        >
          <Download size={16} />
        </a>
      </div>
    );
  }

  // Fallback for regular text
  return (
    <p className={`text-[15px] font-normal leading-relaxed break-words ${msg.deletedForEveryone ? 'italic opacity-50' : ''}`}>
      {msg.content}
    </p>
  );
};

export default WhatsAppMediaBubble;
