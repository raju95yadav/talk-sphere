import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Copy,
  Check,
  Share2,
  QrCode,
  Link2,
  Mail,
  MessageCircle,
  Send,
  Gift,
  Sparkles,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
// Slide / child animation variants
// ─────────────────────────────────────────────────────────────
const slideIn = {
  hidden:  { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0,  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.2,  ease: 'easeIn' } },
};

const child = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.24, ease: 'easeOut' } },
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const tabContent = {
  hidden:  { opacity: 0, y: 8, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1,    transition: { duration: 0.22 } },
  exit:    { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.16 } },
};

// ─────────────────────────────────────────────────────────────
// Base invite URL
// ─────────────────────────────────────────────────────────────
const APP_BASE_URL = import.meta.env.VITE_APP_URL || 'https://talk-sphere.app';

// ─────────────────────────────────────────────────────────────
// Social share definitions
// ─────────────────────────────────────────────────────────────
const buildShareText = (url, name) =>
  `Hey${name ? ` ${name}` : ''}! 👋 Join me on Talk Sphere — encrypted messaging & HD video calls. Sign up instantly: ${url}`;

const getSocialLinks = (url, text) => [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    bg: 'rgba(37,211,102,0.12)',
    border: 'rgba(37,211,102,0.25)',
    href: `https://wa.me/?text=${encodeURIComponent(text)}`,
    icon: ({ size }) => (
      // WhatsApp SVG mark
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#2AABEE',
    bg: 'rgba(42,171,238,0.12)',
    border: 'rgba(42,171,238,0.25)',
    href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: ({ size }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    color: '#1DA1F2',
    bg: 'rgba(29,161,242,0.12)',
    border: 'rgba(29,161,242,0.25)',
    href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    icon: ({ size }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    id: 'email',
    label: 'Email',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.25)',
    href: `mailto:?subject=${encodeURIComponent('Join me on Talk Sphere!')}&body=${encodeURIComponent(text)}`,
    icon: ({ size }) => <Mail size={size} />,
  },
];

// ─────────────────────────────────────────────────────────────
// CopyButton
// ─────────────────────────────────────────────────────────────
const CopyButton = ({ text, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Link copied!', { icon: '🔗', duration: 2000 });
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      toast.success('Link copied!', { icon: '🔗', duration: 2000 });
      setTimeout(() => setCopied(false), 2200);
    }
  }, [text]);

  return (
    <motion.button
      id="invite-copy-link-btn"
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      onClick={handleCopy}
      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer focus-visible:outline-none ${
        copied
          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
          : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/25'
      } ${className}`}
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5"
          >
            <Check size={13} /> Copied!
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1.5"
          >
            <Copy size={13} /> Copy
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

// ─────────────────────────────────────────────────────────────
// SocialButton
// ─────────────────────────────────────────────────────────────
const SocialButton = ({ platform }) => {
  const Icon = platform.icon;
  return (
    <motion.a
      id={`invite-social-${platform.id}`}
      href={platform.href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.06, y: -2 }}
      whileTap={{ scale: 0.94 }}
      className="flex flex-col items-center gap-2 cursor-pointer focus-visible:outline-none group"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg transition-all group-hover:shadow-xl"
        style={{
          background: platform.bg,
          borderColor: platform.border,
          color: platform.color,
          boxShadow: `0 4px 20px -4px ${platform.color}33`,
        }}
      >
        <Icon size={22} />
      </div>
      <span className="text-[10px] font-semibold text-slate-600 dark:text-gray-400 group-hover:text-slate-900 dark:group-hover:text-gray-200 transition-colors">
        {platform.label}
      </span>
    </motion.a>
  );
};

// ─────────────────────────────────────────────────────────────
// LinkTab
// ─────────────────────────────────────────────────────────────
const LinkTab = ({ inviteUrl, shareText, canShare, onNativeShare }) => (
  <motion.div
    key="link-tab"
    variants={tabContent}
    initial="hidden"
    animate="visible"
    exit="exit"
    className="space-y-5"
  >
    {/* Invite link card */}
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-500 px-1">
        Your Personal Invite Link
      </p>
      <div className="flex items-center gap-2 bg-white dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700/60 rounded-2xl px-4 py-3 shadow-sm">
        <Link2 size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
        <p className="flex-1 text-[12px] text-slate-800 dark:text-gray-300 font-mono truncate min-w-0 select-all">
          {inviteUrl}
        </p>
        <CopyButton text={inviteUrl} />
      </div>
    </div>

    {/* Native share */}
    {canShare && (
      <motion.button
        id="invite-native-share-btn"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNativeShare}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-slate-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/60 text-[13px] font-bold text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-gray-700/60 transition-all cursor-pointer focus-visible:outline-none shadow-sm"
      >
        <Share2 size={15} className="text-emerald-500 dark:text-emerald-400" />
        Share via…
      </motion.button>
    )}

    {/* Social platforms */}
    <div className="space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-500 px-1">
        Share on
      </p>
      <div className="grid grid-cols-4 gap-3">
        {getSocialLinks(inviteUrl, shareText).map((p) => (
          <SocialButton key={p.id} platform={p} />
        ))}
      </div>
    </div>

    {/* Prefilled message preview */}
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-500 px-1">
        Message Preview
      </p>
      <div className="relative bg-white dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800/70 rounded-2xl p-4 overflow-hidden shadow-sm">
        {/* Subtle gradient shimmer */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
        <p className="text-[12px] text-slate-600 dark:text-gray-400 leading-relaxed relative">
          {shareText}
        </p>
      </div>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────
// QRTab
// ─────────────────────────────────────────────────────────────
const QRTab = ({ inviteUrl, displayName }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Link copied!', { icon: '🔗', duration: 2000 });
      setTimeout(() => setCopied(false), 2200);
    } catch { /* ignore */ }
  }, [inviteUrl]);

  return (
    <motion.div
      key="qr-tab"
      variants={tabContent}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col items-center gap-5 py-2"
    >
      {/* QR code frame */}
      <div className="relative">
        {/* Glow halo */}
        <div
          className="absolute inset-0 rounded-3xl blur-xl opacity-30 scale-110 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }}
        />

        <div
          className="relative rounded-3xl p-4 border border-slate-200 dark:border-gray-700/60 shadow-2xl bg-white dark:bg-[#141720]"
        >
          {/* Corner decorations */}
          {[
            'top-2 left-2 border-t-2 border-l-2 rounded-tl-xl',
            'top-2 right-2 border-t-2 border-r-2 rounded-tr-xl',
            'bottom-2 left-2 border-b-2 border-l-2 rounded-bl-xl',
            'bottom-2 right-2 border-b-2 border-r-2 rounded-br-xl',
          ].map((cls, i) => (
            <div key={i} className={`absolute w-5 h-5 border-emerald-500/60 ${cls}`} />
          ))}

          <div className="w-[200px] h-[200px] rounded-2xl overflow-hidden bg-white flex items-center justify-center">
            <QRCodeSVG
              value={inviteUrl}
              size={190}
              level="M"
              fgColor="#0f172a"
              bgColor="#ffffff"
              style={{ display: 'block' }}
            />
          </div>
        </div>
      </div>

      {/* Display name badge */}
      <div className="flex flex-col items-center gap-1">
        <p className="text-[13px] font-black text-slate-900 dark:text-white">{displayName}</p>
        <p className="text-[11px] text-slate-500 dark:text-gray-400">Scan to join Talk Sphere</p>
      </div>

      {/* URL + copy */}
      <div className="w-full flex items-center gap-2 bg-slate-100 dark:bg-gray-900/70 border border-slate-200 dark:border-gray-700/60 rounded-2xl px-3 py-2.5">
        <p className="flex-1 text-[11px] text-slate-700 dark:text-gray-300 font-mono truncate min-w-0">
          {inviteUrl}
        </p>
        <button
          onClick={handleCopy}
          className="shrink-0 w-7 h-7 rounded-lg bg-white dark:bg-gray-800/80 border border-slate-200 dark:border-gray-700/50 flex items-center justify-center text-slate-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
      </div>

      <p className="text-[10px] text-slate-500 dark:text-gray-400 text-center max-w-[220px] leading-relaxed">
        Share this QR code with friends nearby to let them join instantly
      </p>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main InviteFriendPage
// ─────────────────────────────────────────────────────────────
/**
 * Props:
 *  - isOpen  {boolean}
 *  - onBack  {function}
 */
const InviteFriendPage = ({ isOpen, onBack }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('link'); // 'link' | 'qr'

  const handle = user?.username || user?.name?.replace(/\s+/g, '') || user?._id?.slice(-6) || 'user';
  const displayName = user?.name || user?.username || 'You';

  const inviteUrl = `${APP_BASE_URL}/join?ref=${encodeURIComponent('@' + handle)}`;
  const shareText = buildShareText(inviteUrl, user?.name);

  // Web Share API
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const handleNativeShare = useCallback(async () => {
    try {
      await navigator.share({
        title: 'Join me on Talk Sphere',
        text: shareText,
        url: inviteUrl,
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Sharing failed');
      }
    }
  }, [shareText, inviteUrl]);

  const tabs = [
    { id: 'link', label: 'Share Link', icon: Link2 },
    { id: 'qr',   label: 'QR Code',   icon: QrCode },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="invite-friend-page"
          variants={slideIn}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-label="Invite a friend"
          className="absolute inset-0 z-50 flex flex-col overflow-hidden bg-[#f8fafc] dark:bg-[#11141a] text-slate-900 dark:text-white transition-colors duration-300"
        >
          {/* Top highlight line */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/35 to-transparent pointer-events-none z-10" />

          {/* ── Header ── */}
          <div
            className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-slate-200 dark:border-gray-800/60 shrink-0 bg-white/90 dark:bg-[#11141a]/90 backdrop-blur-md"
          >
            <motion.button
              id="invite-friend-back"
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
                Invite a Friend
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400/75 leading-none mt-0.5">
                Grow your circle
              </p>
            </div>

            {/* Gift sparkle badge */}
            <div className="shrink-0 w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Gift size={16} className="text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="flex-1 overflow-y-auto px-4 pb-10 pt-4 space-y-5"
          >
            {/* Hero banner */}
            <motion.div
              variants={child}
              className="relative rounded-2xl overflow-hidden p-5"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.08) 50%, rgba(4,120,87,0.04) 100%)',
                border: '1px solid rgba(16,185,129,0.2)',
              }}
            >
              {/* Subtle sparkles */}
              <div className="absolute top-3 right-3 opacity-40">
                <Sparkles size={20} className="text-emerald-400" />
              </div>
              <div className="absolute bottom-2 right-10 opacity-20">
                <Sparkles size={12} className="text-emerald-300" />
              </div>

              <div className="flex items-center gap-4">
                {/* Icon stack */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-xl shadow-emerald-500/10">
                    <MessageCircle size={26} className="text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#11141a] flex items-center justify-center">
                    <span className="text-[8px] font-black text-white">+1</span>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-black text-slate-900 dark:text-white leading-tight mb-1">
                    Invite friends to Talk Sphere
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-gray-400 leading-relaxed">
                    Share encrypted messaging, HD calls, and smart AI — all free.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── Tabs ── */}
            <motion.div variants={child}>
              <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-gray-900/60 border border-slate-200 dark:border-gray-800/60">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`invite-tab-${tab.id}`}
                      onClick={() => setActiveTab(tab.id)}
                      className={`
                        flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[12px] font-bold transition-all duration-200 cursor-pointer focus-visible:outline-none
                        ${active
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-200'}
                      `}
                    >
                      <Icon size={13} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* ── Tab content ── */}
            <motion.div variants={child}>
              <AnimatePresence mode="wait">
                {activeTab === 'link' ? (
                  <LinkTab
                    key="link"
                    inviteUrl={inviteUrl}
                    shareText={shareText}
                    canShare={canShare}
                    onNativeShare={handleNativeShare}
                  />
                ) : (
                  <QRTab
                    key="qr"
                    inviteUrl={inviteUrl}
                    displayName={displayName}
                  />
                )}
              </AnimatePresence>
            </motion.div>

            {/* ── Stats strip ── */}
            <motion.div variants={child}>
              <div className="flex divide-x divide-slate-200 dark:divide-gray-800/60 bg-white dark:bg-gray-900/40 border border-slate-200 dark:border-gray-800/60 rounded-2xl overflow-hidden shadow-sm">
                {[
                  { label: 'End-to-end encrypted', value: '🔒' },
                  { label: 'Free forever', value: '✨' },
                  { label: 'No ads', value: '🚫' },
                ].map((item) => (
                  <div key={item.label} className="flex-1 flex flex-col items-center gap-1 py-3 px-2">
                    <span className="text-lg">{item.value}</span>
                    <span className="text-[9px] text-slate-500 dark:text-gray-500 font-medium text-center leading-tight">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default InviteFriendPage;
