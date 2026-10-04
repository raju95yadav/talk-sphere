import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, X, ArrowRight, Image, Video, Mic, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { playNotificationChime } from '../utils/notificationSound';

/**
 * Modern, advanced incoming message banner toast.
 * Renders in the upper side (top-right / top-center) with smooth spring entry,
 * frosted glass aesthetics, online sender badge, and click-to-open interaction.
 */
export const IncomingMessageToast = ({
  t,
  senderName = 'User',
  senderAvatar,
  groupName,
  content = '',
  type = 'text',
  fileName,
  isGroup = false,
  onClick,
}) => {
  const initials = (senderName || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Content & Icon helper
  let displayContent = content;
  let iconComponent = null;

  if (type === 'image') {
    displayContent = 'Photo';
    iconComponent = <Image size={13} className="text-emerald-400 shrink-0" />;
  } else if (type === 'video') {
    displayContent = 'Video';
    iconComponent = <Video size={13} className="text-purple-400 shrink-0" />;
  } else if (type === 'audio') {
    displayContent = 'Voice Note';
    iconComponent = <Mic size={13} className="text-amber-400 shrink-0" />;
  } else if (type === 'file') {
    displayContent = fileName || 'Attachment';
    iconComponent = <FileText size={13} className="text-blue-400 shrink-0" />;
  }

  const handleOpen = (e) => {
    e.stopPropagation();
    toast.dismiss(t.id);
    if (onClick) onClick();
  };

  const handleClose = (e) => {
    e.stopPropagation();
    toast.dismiss(t.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -28, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      onClick={handleOpen}
      className={`
        pointer-events-auto
        w-full max-w-[360px] sm:max-w-[400px]
        bg-slate-900/95 dark:bg-[#11141a]/95
        backdrop-blur-xl
        border border-emerald-500/40 dark:border-emerald-500/30
        rounded-2xl p-3.5
        shadow-2xl shadow-emerald-500/15 dark:shadow-black/70
        flex items-center gap-3
        cursor-pointer group
        transition-all duration-300
        hover:border-emerald-500/70 hover:shadow-emerald-500/25 hover:scale-[1.01]
        select-none
      `}
    >
      {/* Left glowing neon accent line */}
      <div className="w-1 self-stretch rounded-full bg-gradient-to-b from-emerald-400 via-teal-400 to-emerald-600 shadow-sm shadow-emerald-500/60 shrink-0" />

      {/* Sender Avatar with active ring and online badge */}
      <div className="relative shrink-0">
        {senderAvatar ? (
          <img
            src={senderAvatar}
            alt={senderName}
            className="w-10 h-10 rounded-xl object-cover ring-2 ring-emerald-500/30 group-hover:ring-emerald-500/60 transition-all shadow-md"
          />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-xs font-black ring-2 ring-emerald-500/30 shadow-md">
            {initials}
          </div>
        )}
        {/* Pulsing emerald badge */}
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-slate-900 dark:ring-[#11141a] flex items-center justify-center">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        </span>
      </div>

      {/* Message Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[13px] font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
              {senderName}
            </span>
            {isGroup && groupName && (
              <span className="text-[10px] text-slate-400 dark:text-gray-400 truncate max-w-[90px] font-medium">
                in {groupName}
              </span>
            )}
          </div>
          <span className="text-[10px] font-medium text-slate-400 dark:text-gray-500 shrink-0">
            Just now
          </span>
        </div>

        <p className="text-[12px] text-slate-300 dark:text-gray-300 truncate leading-snug flex items-center gap-1.5">
          {iconComponent}
          <span className="truncate">{displayContent || 'New message'}</span>
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={handleOpen}
          className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 font-bold text-[11px] transition-all flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
        >
          <span>Reply</span>
          <ArrowRight size={11} />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Dismiss notification"
        >
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
};

/**
 * Triggers the upper-side stylish message toast with sound chime
 */
export const showIncomingMessageToast = (props) => {
  // Play subtle chime sound
  playNotificationChime();

  toast.custom(
    (t) => <IncomingMessageToast t={t} {...props} />,
    {
      id: `msg-toast-${props.id || Date.now()}`,
      position: 'top-right',
      duration: 5000,
    }
  );
};

export default IncomingMessageToast;
