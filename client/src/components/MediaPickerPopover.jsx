import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Smile, Film, Loader2, Sparkles, Clock, Flame } from 'lucide-react';
import { EMOJI_CATEGORIES, EMOJI_DATA, searchEmojis } from '../data/emojiData';
import { GIF_CATEGORIES, fetchGifs } from '../services/gifService';

const RECENT_EMOJIS_KEY = 'talksphere_recent_emojis';

export default function MediaPickerPopover({
  isOpen,
  onClose,
  onSelectEmoji,
  onSelectGif,
  defaultTab = 'emoji', // 'emoji' | 'gif'
  anchorPosition = 'bottom' // 'bottom' | 'top'
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [emojiSearch, setEmojiSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState([]);

  // GIF states
  const [gifSearch, setGifSearch] = useState('');
  const [selectedGifCategory, setSelectedGifCategory] = useState('trending');
  const [gifs, setGifs] = useState([]);
  const [loadingGifs, setLoadingGifs] = useState(false);

  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  // Sync tab if defaultTab changes when opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // Load recent emojis on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Close on click outside or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Fetch GIFs when activeTab is 'gif', or when category or search changes
  useEffect(() => {
    if (!isOpen || activeTab !== 'gif') return;

    let isMounted = true;
    setLoadingGifs(true);

    const timer = setTimeout(() => {
      fetchGifs({
        query: gifSearch,
        category: selectedGifCategory,
        limit: 24
      }).then(results => {
        if (isMounted) {
          setGifs(results);
          setLoadingGifs(false);
        }
      }).catch(() => {
        if (isMounted) setLoadingGifs(false);
      });
    }, gifSearch ? 350 : 0);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, activeTab, gifSearch, selectedGifCategory]);

  // Handle emoji click
  const handleEmojiClick = (emojiChar) => {
    // Add to recent emojis
    try {
      const updated = [emojiChar, ...recentEmojis.filter(e => e !== emojiChar)].slice(0, 24);
      setRecentEmojis(updated);
      localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }

    onSelectEmoji?.(emojiChar);
  };

  // Filter emojis based on search or category
  const displayedEmojis = useMemo(() => {
    if (emojiSearch.trim()) {
      return searchEmojis(emojiSearch);
    }

    if (activeCategory === 'recent') {
      if (recentEmojis.length > 0) {
        return recentEmojis.map(char => {
          const match = EMOJI_DATA.find(e => e.emoji === char);
          return match || { emoji: char, name: 'Recent', category: 'recent' };
        });
      }
      // If empty recent, return top smileys
      return EMOJI_DATA.filter(e => e.category === 'smileys').slice(0, 24);
    }

    return EMOJI_DATA.filter(e => e.category === activeCategory);
  }, [emojiSearch, activeCategory, recentEmojis]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={popoverRef}
        initial={{ opacity: 0, y: 15, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.96 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="absolute bottom-full mb-3 left-0 sm:left-2 z-[90] w-[95vw] sm:w-[380px] md:w-[420px] max-h-[500px] bg-bg-card/95 backdrop-blur-2xl border border-border-main rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.35)] flex flex-col overflow-hidden text-text-main"
        style={{
          boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Tab Switcher (Emoji vs GIF) */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border-main bg-bg-card-secondary/70">
          <div className="flex items-center gap-1.5 p-1 bg-bg-main/60 rounded-2xl border border-border-main">
            <button
              type="button"
              onClick={() => setActiveTab('emoji')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'emoji'
                  ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/25'
                  : 'text-text-muted hover:text-text-main hover:bg-white/5'
              }`}
            >
              <Smile size={15} />
              <span>Emojis</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('gif')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'gif'
                  ? 'bg-accent-primary text-white shadow-md shadow-accent-primary/25'
                  : 'text-text-muted hover:text-text-main hover:bg-white/5'
              }`}
            >
              <Film size={15} />
              <span>GIFs</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-main rounded-full hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* ===================== EMOJI TAB CONTENT ===================== */}
        {activeTab === 'emoji' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Emoji Search Box */}
            <div className="p-3 border-b border-border-main/50">
              <div className="relative flex items-center">
                <Search size={15} className="absolute left-3 text-text-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search all emojis (e.g. happy, cry, cat, fire)..."
                  className="w-full bg-bg-card-secondary border border-border-main focus:border-accent-primary/60 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-text-main outline-none transition-all placeholder:text-text-muted/60"
                />
                {emojiSearch && (
                  <button
                    type="button"
                    onClick={() => setEmojiSearch('')}
                    className="absolute right-2.5 text-text-muted hover:text-text-main p-0.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Category Icons Header (hidden during search) */}
            {!emojiSearch && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-border-main/40 overflow-x-auto custom-scrollbar no-scrollbar bg-bg-card/40">
                {EMOJI_CATEGORIES.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setActiveCategory(cat.id)}
                      title={cat.label}
                      className={`p-1.5 rounded-lg text-sm transition-all shrink-0 ${
                        isActive
                          ? 'bg-accent-primary/20 scale-110 border border-accent-primary/40'
                          : 'opacity-60 hover:opacity-100 hover:bg-white/5'
                      }`}
                    >
                      {cat.icon}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Emoji Grid Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar max-h-[310px]">
              {displayedEmojis.length === 0 ? (
                <div className="py-10 text-center text-xs text-text-muted flex flex-col items-center gap-2">
                  <Smile size={28} className="opacity-30" />
                  <p>No matching emojis found for "{emojiSearch}"</p>
                </div>
              ) : (
                <div>
                  {!emojiSearch && (
                    <div className="text-[10px] font-black uppercase tracking-wider text-text-muted mb-2 px-1 flex items-center justify-between">
                      <span>{EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.label || 'Emojis'}</span>
                      <span className="text-[9px] opacity-60">{displayedEmojis.length} items</span>
                    </div>
                  )}

                  <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                    {displayedEmojis.map((item, idx) => (
                      <button
                        key={`${item.emoji}_${idx}`}
                        type="button"
                        onClick={() => handleEmojiClick(item.emoji)}
                        title={item.name}
                        className="w-10 h-10 flex items-center justify-center text-2xl rounded-xl hover:bg-accent-primary/20 hover:scale-125 transition-transform active:scale-95 duration-150 cursor-pointer select-none"
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Reactions Bar Footer */}
            <div className="px-3 py-2 border-t border-border-main bg-bg-card-secondary/40 flex items-center justify-between">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Quick Pick</span>
              <div className="flex items-center gap-1.5">
                {['👍', '❤️', '😂', '🔥', '🎉', '👏', '🙏'].map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleEmojiClick(em)}
                    className="text-base hover:scale-130 transition-transform p-0.5 active:scale-95"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================== GIF TAB CONTENT ===================== */}
        {activeTab === 'gif' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* GIF Search Bar */}
            <div className="p-3 border-b border-border-main/50">
              <div className="relative flex items-center">
                <Search size={15} className="absolute left-3 text-text-muted" />
                <input
                  type="text"
                  value={gifSearch}
                  onChange={(e) => {
                    setGifSearch(e.target.value);
                    if (e.target.value) setSelectedGifCategory('');
                  }}
                  placeholder="Search GIFs on Tenor & Giphy (e.g. dancing, wow)..."
                  className="w-full bg-bg-card-secondary border border-border-main focus:border-accent-primary/60 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-text-main outline-none transition-all placeholder:text-text-muted/60"
                />
                {gifSearch && (
                  <button
                    type="button"
                    onClick={() => setGifSearch('')}
                    className="absolute right-2.5 text-text-muted hover:text-text-main p-0.5"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* GIF Category Chips */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border-main/40 overflow-x-auto custom-scrollbar no-scrollbar bg-bg-card/40">
              {GIF_CATEGORIES.map((chip) => {
                const isSelected = selectedGifCategory === chip.id && !gifSearch;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setGifSearch('');
                      setSelectedGifCategory(chip.id);
                    }}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-accent-primary text-white shadow-sm shadow-accent-primary/30'
                        : 'bg-bg-card-secondary hover:bg-white/10 text-text-muted hover:text-text-main border border-border-main/60'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* GIF Masonry Grid */}
            <div className="flex-1 overflow-y-auto p-2.5 custom-scrollbar max-h-[310px]">
              {loadingGifs ? (
                <div className="h-44 flex flex-col items-center justify-center gap-2 text-text-muted text-xs">
                  <Loader2 size={24} className="animate-spin text-accent-primary" />
                  <span>Loading animated GIFs...</span>
                </div>
              ) : gifs.length === 0 ? (
                <div className="h-44 flex flex-col items-center justify-center gap-2 text-text-muted text-xs">
                  <Film size={28} className="opacity-30" />
                  <span>No GIFs found. Try searching another term!</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {gifs.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelectGif?.(item)}
                      className="group relative rounded-xl overflow-hidden bg-bg-card-secondary border border-border-main/60 aspect-video cursor-pointer hover:border-accent-primary transition-colors shadow-sm"
                    >
                      <img
                        src={item.previewUrl || item.url}
                        alt={item.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                        <span className="text-[10px] font-bold text-white truncate drop-shadow">
                          {item.title}
                        </span>
                      </div>
                      <span className="absolute top-1.5 right-1.5 text-[8px] font-black uppercase tracking-wider bg-black/60 text-white/90 px-1 py-0.5 rounded backdrop-blur-xs">
                        GIF
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer with Giphy/Tenor branding & info */}
            <div className="px-3 py-1.5 border-t border-border-main bg-bg-card-secondary/40 flex items-center justify-between text-[10px] text-text-muted">
              <span className="flex items-center gap-1">
                <Sparkles size={11} className="text-accent-primary" />
                <span>Click any GIF to send directly</span>
              </span>
              <span className="font-mono opacity-60">Powered by GIPHY / Tenor</span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
