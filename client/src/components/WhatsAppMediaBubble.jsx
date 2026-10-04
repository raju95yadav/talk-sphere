import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  Loader2,
  FileText,
  Maximize2,
  FileVideo,
  Image as ImageIcon,
  Check,
  CheckCheck,
  Clock,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  FileArchive,
  FileCode,
} from 'lucide-react';
import {
  isMediaDownloaded,
  markMediaDownloaded,
  shouldAutoDownload,
  getCurrentNetworkType,
} from '../utils/storagePrefs';
import toast from 'react-hot-toast';

/**
 * Helper to render authentic WhatsApp delivery tick status marks
 */
const renderStatusTicks = (status, onRetry, msg) => {
  switch (status) {
    case 'uploading':
      return <Loader2 size={10} className="animate-spin text-emerald-300 shrink-0" />;
    case 'sending':
      return <Clock size={10} className="text-white/70 animate-spin shrink-0" style={{ animationDuration: '3s' }} />;
    case 'sent':
      return <Check size={12} className="text-white/75 shrink-0" />;
    case 'delivered':
      return <CheckCheck size={12} className="text-white/80 shrink-0" />;
    case 'read':
      return <CheckCheck size={12} className="text-sky-300 drop-shadow-[0_0_5px_rgba(56,189,248,0.7)] shrink-0" />;
    case 'failed':
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetry?.(msg);
          }}
          className="text-red-400 hover:text-red-300 pointer-events-auto p-0.5 transition-colors shrink-0"
          title="Failed to send. Click to retry transmission."
        >
          <RefreshCw size={10} />
        </button>
      );
    default:
      return <Check size={12} className="text-white/70 shrink-0" />;
  }
};

/**
 * Format timestamp into 12-hour AM/PM format (e.g., "06:02 PM")
 */
const formatMsgTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

/**
 * Helper to determine document badge styling and icon based on file extension
 */
const getDocumentMeta = (fileName = '') => {
  const parts = fileName.split('.');
  const ext = (parts.length > 1 ? parts.pop() : '').toLowerCase();

  if (ext === 'pdf') {
    return {
      ext: 'PDF',
      badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
      Icon: FileText,
    };
  }
  if (['doc', 'docx', 'rtf'].includes(ext)) {
    return {
      ext: 'DOC',
      badgeClass: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      Icon: FileText,
    };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return {
      ext: 'XLS',
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      Icon: FileSpreadsheet,
    };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return {
      ext: 'ZIP',
      badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      Icon: FileArchive,
    };
  }
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'cpp'].includes(ext)) {
    return {
      ext: ext.toUpperCase(),
      badgeClass: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
      Icon: FileCode,
    };
  }
  return {
    ext: ext ? ext.toUpperCase() : 'FILE',
    badgeClass: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
    Icon: FileText,
  };
};

/**
 * Authentic WhatsApp-Style Media Bubble:
 * - Photos & Videos: Edge-to-edge sleek rendering with floating bottom-right glass timestamp pill,
 *   subtle dark vignette for high contrast, no bulky neon borders or redundant filename text.
 * - Documents: Compact WhatsApp document card with type badge, file size, action button, and timestamp.
 * - Audio: Modern voice note layout with timestamp.
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
  onRetryMessage,
}) => {
  // Determine if current user is the sender
  const isSender = useMemo(() => {
    if (msg.isSent !== undefined) return !!msg.isSent;
    const senderId = msg.sender?._id || msg.sender;
    return String(senderId) === String(currentUserId);
  }, [msg, currentUserId]);

  const activeNetwork = propNetworkType || getCurrentNetworkType(prefs);
  const rawType = (msg.type || '').toLowerCase();
  const mediaType = rawType === 'photo' ? 'image' : rawType;

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

  // Check if media is corrupted or invalid
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

  // Manual download handler
  const handleManualDownload = useCallback(async (e) => {
    if (e) e.stopPropagation();
    if (downloading || downloaded || isInvalidMedia) return;

    setDownloading(true);
    setDownloadProgress(20);

    try {
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 25;
        });
      }, 120);

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
        await new Promise((r) => setTimeout(r, 550));
      }

      clearInterval(interval);
      setDownloadProgress(100);
      await new Promise((r) => setTimeout(r, 160));

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
      <div className="flex flex-col items-center justify-center p-3 rounded-2xl border border-white/10 bg-slate-900/90 text-center max-w-[260px] md:max-w-[300px] shadow-sm select-none">
        <div className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mb-1.5">
          <AlertCircle size={16} />
        </div>
        <p className="text-[11.5px] font-bold text-slate-200">
          {mediaType === 'image' ? 'Photo Unavailable' : mediaType === 'video' ? 'Video Unavailable' : 'Media Unavailable'}
        </p>
        <p className="text-[9.5px] text-slate-400 mt-0.5 leading-snug">
          {isSender ? 'Upload incomplete or local file expired.' : 'File not available on server.'}
        </p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. IMAGE / PHOTO (AUTHENTIC WHATSAPP UI)
  // ─────────────────────────────────────────────────────────────
  if (mediaType === 'image') {
    if (!downloaded) {
      // Receiver blurred photo card with centered WhatsApp download button
      return (
        <div
          className="relative overflow-hidden rounded-[15px] w-[260px] sm:w-[320px] max-w-full h-[260px] sm:h-[300px] bg-slate-950 flex items-center justify-center cursor-pointer group select-none shadow-md"
          onClick={handleManualDownload}
        >
          {msg.content && !msg.content.startsWith('blob:') && !hasError ? (
            <img
              src={msg.content}
              className="absolute inset-0 w-full h-full object-cover filter blur-xl scale-110 opacity-50 brightness-75 pointer-events-none select-none"
              alt=""
              onError={() => setHasError(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-slate-900" />
          )}
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[5px]" />
 
          {/* Top-left Photo Indicator Badge */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-white shadow-sm pointer-events-none">
            <ImageIcon size={12} className="text-emerald-400" />
            <span>Photo</span>
          </div>

          {/* Centered WhatsApp download button */}
          <motion.div
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.93 }}
            className="relative z-10 flex flex-col items-center justify-center w-16 h-16 rounded-full bg-black/75 border border-white/20 shadow-2xl backdrop-blur-md group-hover:bg-black/90 group-hover:border-emerald-500/50 transition-all cursor-pointer"
          >
            {downloading ? (
              <div className="flex flex-col items-center">
                <Loader2 size={24} className="text-emerald-400 animate-spin" />
                <span className="text-[9px] font-bold text-emerald-400 font-mono mt-0.5">
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

          {/* Floating WhatsApp Bottom-Right Timestamp */}
          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white/90 shadow-sm pointer-events-none select-none">
            <span>{formatMsgTime(msg.createdAt)}</span>
          </div>
        </div>
      );
    }

    // Fully downloaded / Sender Photo
    return (
      <div className="relative group/img overflow-hidden rounded-[15px] select-none w-full max-w-[280px] sm:max-w-[340px] bg-black/20">
        {/* Uploading circular progress overlay */}
        {msg.status === 'uploading' && (
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] rounded-[15px] flex items-center justify-center z-20">
            <div className="relative flex flex-col items-center justify-center w-14 h-14 rounded-full bg-black/75 border border-white/25 shadow-xl">
              <Loader2 size={24} className="text-emerald-400 animate-spin" />
              {typeof msg.progress === 'number' && msg.progress > 0 && (
                <span className="text-[9px] font-bold text-white font-mono mt-0.5 leading-none">
                  {msg.progress}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* Clean Photo Image */}
        <img
          src={msg.content}
          onError={() => setHasError(true)}
          onClick={() => onSelectImage && onSelectImage(msg.content)}
          className="w-full max-h-[380px] object-cover rounded-[15px] cursor-pointer block transition-transform duration-300 group-hover/img:scale-[1.015]"
          alt={msg.fileName || 'Photo'}
          loading="lazy"
        />

        {/* Subtle dark bottom vignette so the floating timestamp is always ultra-crisp */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none rounded-b-[15px]" />

        {/* Floating Top-Right Hover Action Bar (Download & Fullscreen) */}
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200">
          <a
            href={msg.content}
            target="_blank"
            rel="noreferrer"
            download={msg.fileName || 'photo'}
            onClick={(e) => e.stopPropagation()}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            title="Download Photo"
          >
            <Download size={13} />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSelectImage) onSelectImage(msg.content);
            }}
            className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
            title="View Fullscreen"
          >
            <Maximize2 size={13} />
          </button>
        </div>

        {/* Floating WhatsApp Bottom-Right Pill: [Time Ticks] */}
        <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-md text-[10px] font-medium text-white/95 shadow-md pointer-events-none select-none">
          {msg.isEdited && <span className="text-[8px] uppercase opacity-75 font-semibold mr-0.5">edited</span>}
          <span>{formatMsgTime(msg.createdAt)}</span>
          {isSender && renderStatusTicks(msg.status, onRetryMessage, msg)}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. VIDEO (AUTHENTIC WHATSAPP UI)
  // ─────────────────────────────────────────────────────────────
  if (mediaType === 'video') {
    if (!downloaded) {
      return (
        <div
          className="relative overflow-hidden rounded-[15px] w-[260px] sm:w-[310px] h-[200px] bg-slate-950 flex items-center justify-center cursor-pointer group select-none shadow-md"
          onClick={handleManualDownload}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/80" />
          {/* Top-left Video Indicator Badge */}
          <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-white shadow-sm pointer-events-none">
            <FileVideo size={12} className="text-emerald-400" />
            <span>Video</span>
          </div>

          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            className="relative z-10 flex flex-col items-center justify-center w-14 h-14 rounded-full bg-black/75 border border-white/20 shadow-2xl backdrop-blur-md group-hover:bg-black/90 group-hover:border-emerald-500/50 transition-all cursor-pointer"
          >
            {downloading ? (
              <div className="flex flex-col items-center">
                <Loader2 size={22} className="text-emerald-400 animate-spin" />
                <span className="text-[9px] font-bold text-emerald-400 font-mono mt-0.5">
                  {downloadProgress}%
                </span>
              </div>
            ) : (
              <>
                <Download size={18} className="text-white drop-shadow group-hover:text-emerald-400 transition-colors" />
                <span className="text-[9.5px] font-bold text-white/90 font-mono mt-0.5 leading-none">
                  {msg.fileSize || 'Video'}
                </span>
              </>
            )}
          </motion.div>

          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white/90 shadow-sm pointer-events-none select-none">
            <span>{formatMsgTime(msg.createdAt)}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="relative group/vid overflow-hidden rounded-[15px] select-none w-full max-w-[280px] sm:max-w-[340px] bg-black/40">
        <video
          src={msg.content}
          controls
          className="w-full max-h-[360px] object-cover rounded-[15px] block"
        />
        {/* Floating WhatsApp Bottom-Right Pill */}
        <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-medium text-white/95 shadow-md pointer-events-none select-none">
          {msg.isEdited && <span className="text-[8px] uppercase opacity-75 font-semibold mr-0.5">edited</span>}
          <span>{formatMsgTime(msg.createdAt)}</span>
          {isSender && renderStatusTicks(msg.status, onRetryMessage, msg)}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. AUDIO / VOICE NOTE (AUTHENTIC WHATSAPP UI)
  // ─────────────────────────────────────────────────────────────
  if (mediaType === 'audio') {
    if (!downloaded) {
      return (
        <div
          onClick={handleManualDownload}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-black/20 hover:bg-black/30 cursor-pointer transition-all group min-w-[230px] max-w-[300px]"
        >
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex-shrink-0 group-hover:scale-105 transition-transform">
            {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[12px] font-bold text-white truncate">
              {msg.fileName || 'Voice Note'}
            </p>
            <p className="text-[10px] font-mono text-emerald-400 font-semibold mt-0.5">
              {downloading ? `Downloading ${downloadProgress}%` : `Tap to download (${msg.fileSize || '220 KB'})`}
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full min-w-[230px] max-w-[320px]">
        {AudioPlayerComponent && <AudioPlayerComponent src={msg.content} />}
        <div className="flex items-center justify-end gap-1.5 px-1 pt-1 text-[10px] text-white/70">
          {msg.isEdited && <span className="text-[8px] uppercase opacity-75 font-semibold mr-0.5">edited</span>}
          <span>{formatMsgTime(msg.createdAt)}</span>
          {isSender && renderStatusTicks(msg.status, onRetryMessage, msg)}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 4. DOCUMENT / FILE / PDF (AUTHENTIC WHATSAPP CARD)
  // ─────────────────────────────────────────────────────────────
  if (mediaType === 'file' || mediaType === 'document') {
    const isPdf = (msg.fileName || '').toLowerCase().endsWith('.pdf');
    const { ext, badgeClass, Icon } = getDocumentMeta(msg.fileName);

    return (
      <div className="w-full min-w-[240px] max-w-[320px] select-none">
        <div
          onClick={() => {
            if (!downloaded) {
              handleManualDownload();
            } else if (isPdf && onSelectPdf) {
              onSelectPdf(msg);
            } else {
              window.open(msg.content, '_blank');
            }
          }}
          className="flex items-center gap-3 p-2.5 rounded-xl bg-black/25 hover:bg-black/35 transition-all cursor-pointer group/doc"
        >
          {/* File type badge */}
          <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 shadow-sm ${badgeClass}`}>
            <Icon size={18} />
            <span className="text-[7.5px] font-black uppercase tracking-wider leading-none mt-0.5">
              {ext}
            </span>
          </div>

          {/* File Details */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[13px] font-semibold text-white/95 truncate leading-snug group-hover/doc:text-emerald-300 transition-colors">
              {msg.fileName || 'Document'}
            </p>
            <p className="text-[10.5px] text-white/60 font-mono mt-0.5 flex items-center gap-1.5">
              <span>{msg.fileSize || 'Document'}</span>
              <span>•</span>
              <span className="uppercase">{ext}</span>
              {!downloaded && <span className="text-emerald-400 font-bold">• Tap to download</span>}
            </p>
          </div>

          {/* Action Button */}
          <div className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white flex-shrink-0 transition-all">
            {downloading ? (
              <Loader2 size={14} className="animate-spin text-emerald-400" />
            ) : !downloaded ? (
              <Download size={14} className="text-white group-hover/doc:text-emerald-400" />
            ) : isPdf ? (
              <Maximize2 size={13} className="text-white group-hover/doc:text-emerald-400" />
            ) : (
              <Download size={14} className="text-white group-hover/doc:text-emerald-400" />
            )}
          </div>
        </div>

        {/* Timestamp & Ticks inside document bubble */}
        <div className="flex items-center justify-end gap-1.5 px-1 pt-1.5 text-[10px] text-white/70">
          {msg.isEdited && <span className="text-[8px] uppercase opacity-75 font-semibold mr-0.5">edited</span>}
          <span>{formatMsgTime(msg.createdAt)}</span>
          {isSender && renderStatusTicks(msg.status, onRetryMessage, msg)}
        </div>
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
