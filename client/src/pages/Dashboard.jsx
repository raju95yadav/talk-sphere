import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User as UserIcon, LayoutDashboard, Settings, Plus, Moon, Sun, Sparkles, Phone, Bell } from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocketStatus } from '../context/SocketContext';
import { useNotifications } from '../context/NotificationContext';
import NoteSection from '../components/NoteSection';
import ChatSection from '../components/ChatSection';
import AIChatSection from '../components/AIChatSection';
import CallLogsSection from '../components/CallLogsSection';
import SettingsPanel from '../components/SettingsPanel';
import NotificationCenter from '../components/NotificationCenter';

const Dashboard = () => {
  const { user, logout, token, refreshUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isConnected, isReconnecting } = useSocketStatus();
  const { unreadCount, openNotifications, registerChatOpener } = useNotifications();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState('MANAGEMENT HOME');
  const [isUploading, setIsUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [targetChatContact, setTargetChatContact] = useState(null);
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    registerChatOpener((contact) => {
      setActiveTab('MANAGEMENT HOME');
      setTargetChatContact(contact);
      window.dispatchEvent(new CustomEvent('talksphere:open_chat', { detail: { contact } }));
    });
  }, [registerChatOpener]);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet link restored');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Internet link severed. Entering offline mode.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setIsUploading(true);
    try {
      await apiClient.post('/api/users/avatar', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Avatar updated!');
      refreshUser();
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const tabs = [
    { name: 'MANAGEMENT HOME', label: 'MANAGEMENT', shortName: 'HOME', icon: LayoutDashboard },
    { name: 'CALL LOGS', label: 'CALL LOGS', shortName: 'CALLS', icon: Phone },
    { name: 'AI ASSISTANT', label: 'AI ASSISTANT', shortName: 'AI ASSIST', icon: Sparkles },
  ];

  return (
    <div className="relative min-h-screen bg-bg-main text-text-main p-2.5 sm:p-4 md:p-6 lg:p-8 transition-colors duration-300 overflow-x-hidden">
      {/* Cybernetic Background Image Layer with Animated Crossfade */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={
              activeTab === 'AI ASSISTANT' ? '/image2.png' :
              activeTab === 'CALL LOGS' ? '/image5.png' :
              '/image.png'
            }
            src={
              activeTab === 'AI ASSISTANT' ? '/image2.png' :
              activeTab === 'CALL LOGS' ? '/image5.png' :
              '/image.png'
            }
            alt="TalkSphere Backdrop"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 0.42, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-full object-cover object-center filter contrast-115 brightness-95"
          />
        </AnimatePresence>
        {/* Dynamic Gradient and Radial Vignette Overlays for Depth and Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-main/90 via-bg-main/45 to-bg-main/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_20%,_var(--bg-main)_85%)]" />
      </div>

      {/* Foreground Interactive Content */}
      <div className="relative z-10">
        {token && !isOnline && (
          <div className="fixed top-0 left-0 w-full bg-red-600/95 backdrop-blur-md text-white py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] z-[100] shadow-lg flex items-center justify-center gap-2">
            <span>⚠️ OFFLINE MODE: Internet connection lost. Local sync only.</span>
          </div>
        )}
        {token && isOnline && !isConnected && (
          <div className="fixed top-0 left-0 w-full bg-amber-500/95 backdrop-blur-md text-black py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] z-[100] shadow-lg flex items-center justify-center gap-2">
            <span className="animate-pulse">⚠️ NEURAL LINK INTERRUPTED: {isReconnecting ? 'Reconnecting to secure channel...' : 'Neural link severed.'}</span>
          </div>
        )}
        <input 
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />
        {/* Top Navigation */}
        <div className="sticky top-0 z-50 max-w-7xl mx-auto mb-4 sm:mb-8 pt-1 sm:pt-2 px-0 sm:px-2">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-2.5 sm:gap-3 glass-card p-2 sm:p-2.5 lg:p-3 rounded-2xl lg:rounded-full shadow-2xl backdrop-blur-2xl border border-border-main max-w-full">
          
          {/* Left: Brand Logo & Mobile Action Controls */}
          <div className="flex items-center justify-between w-full lg:w-auto px-1 sm:px-3 py-0.5 shrink-0 min-w-0">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 3 }}
                whileTap={{ scale: 0.95 }}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-indigo-500 via-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0 cursor-pointer"
              >
                <span className="font-black text-sm sm:text-base text-white">TS</span>
              </motion.div>
              <h1 className="text-sm xs:text-base sm:text-lg font-black tracking-tight text-text-main whitespace-nowrap truncate">
                TALK SPHERE
              </h1>
            </div>

            {/* Mobile / Tablet Actions (Theme, Bell, Settings, Avatar) */}
            <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 shrink-0 lg:hidden">
              <button 
                onClick={toggleTheme}
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main active:scale-95 cursor-pointer shrink-0"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              {/* Notification bell – mobile */}
              <button
                id="notif-open-btn-mobile"
                onClick={openNotifications}
                className="relative w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main active:scale-95 cursor-pointer shrink-0"
                title="Notifications"
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded-full bg-indigo-600 text-[8px] font-black text-white shadow-md shadow-indigo-500/30 animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Settings gear – mobile */}
              <button
                id="settings-open-btn-mobile"
                onClick={() => setShowSettings(true)}
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 flex items-center justify-center rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main active:scale-95 cursor-pointer shrink-0"
                title="Settings"
              >
                <Settings size={15} />
              </button>

              <div 
                onClick={handleAvatarClick}
                className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-bg-card-secondary border border-border-main flex items-center justify-center cursor-pointer overflow-hidden relative group shrink-0 active:scale-95 transition-transform"
                title="Change Avatar"
              >
                {user?.avatar ? (
                  <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
                ) : (
                  <UserIcon size={15} className="text-accent-primary" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center: Tabs Navigation */}
          <div className="w-full lg:w-auto bg-bg-card-secondary/80 backdrop-blur-md rounded-xl lg:rounded-full p-1 max-w-full border border-border-main shrink-0">
            <div className="grid grid-cols-3 gap-1 lg:flex lg:items-center lg:gap-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`relative flex flex-row items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 lg:px-3.5 xl:px-4 2xl:px-5 rounded-lg lg:rounded-full text-[9px] xs:text-[10px] sm:text-[10px] font-bold transition-all uppercase tracking-wider text-center cursor-pointer shrink-0 ${
                    activeTab === tab.name 
                      ? 'text-white' 
                      : 'text-text-muted hover:text-text-main dark:hover:bg-white/5 hover:bg-black/5'
                  }`}
                >
                  {activeTab === tab.name && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 rounded-lg lg:rounded-full shadow-lg shadow-indigo-500/35"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <tab.icon size={14} className="shrink-0 sm:size-[15px] relative z-10" />
                  {/* Phone view: short name */}
                  <span className="sm:hidden text-[9px] xs:text-[10px] leading-none relative z-10 whitespace-nowrap">{tab.shortName}</span>
                  {/* Tablet & Laptop/Desktop: responsive clean label */}
                  <span className="hidden sm:inline 2xl:hidden whitespace-nowrap relative z-10">{tab.label}</span>
                  {/* Extra large screens: full title */}
                  <span className="hidden 2xl:inline whitespace-nowrap relative z-10">{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Desktop User Session & Controls (visible on lg screens) */}
          <div className="hidden lg:flex items-center gap-2 xl:gap-2.5 shrink-0 px-2 xl:px-3 border-l border-border-main">
             <button 
               onClick={toggleTheme}
               className="w-8.5 h-8.5 xl:w-9 xl:h-9 flex items-center justify-center rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main active:scale-95 cursor-pointer shrink-0"
               title="Toggle Theme"
             >
               {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
             </button>

             {/* Notification bell – desktop */}
             <button
               id="notif-open-btn-desktop"
               onClick={openNotifications}
               className="relative w-8.5 h-8.5 xl:w-9 xl:h-9 flex items-center justify-center rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main active:scale-95 cursor-pointer shrink-0"
               title="Notifications"
             >
               <Bell size={15} />
               {unreadCount > 0 && (
                 <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-black text-white shadow-lg shadow-indigo-500/35 animate-pulse">
                   {unreadCount > 99 ? '99+' : unreadCount}
                 </span>
               )}
             </button>

             {/* Settings gear – desktop */}
             <button
               id="settings-open-btn-desktop"
               onClick={() => setShowSettings(true)}
               className="w-8.5 h-8.5 xl:w-9 xl:h-9 flex items-center justify-center rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main active:scale-95 cursor-pointer shrink-0"
               title="Settings"
             >
               <Settings size={15} />
             </button>

             <div 
               onClick={() => setShowSettings(true)}
               className="hidden xl:block text-right pl-1 cursor-pointer group/user select-none"
               title="Settings & Profile"
             >
               <p className="text-xs font-bold truncate max-w-[120px] text-text-main group-hover/user:text-accent-primary transition-colors">{user?.name || user?.email}</p>
               <p className="text-[9px] text-text-muted uppercase font-semibold tracking-wider group-hover/user:text-accent-primary/80 transition-colors">Active Session</p>
             </div>
             
             <div 
               onClick={handleAvatarClick}
               className="w-8.5 h-8.5 xl:w-9 xl:h-9 rounded-full bg-bg-card-secondary border border-border-main flex items-center justify-center cursor-pointer overflow-hidden relative group shrink-0 active:scale-95 transition-transform"
               title="Change Avatar"
             >
               {user?.avatar ? (
                 <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
               ) : (
                 <UserIcon size={16} className="text-accent-primary" />
               )}
               {isUploading && (
                 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                   <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                 </div>
               )}
             </div>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'MANAGEMENT HOME' ? (
            <motion.div 
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-start"
            >
              {/* Chats Section - Full Height/Width in its column */}
              <div className="lg:col-span-7 h-[540px] sm:h-[640px] lg:h-[780px] xl:h-[820px] flex flex-col">
                <ChatSection externalContact={targetChatContact} />
              </div>

              <div className="lg:col-span-5 h-[540px] sm:h-[640px] lg:h-[780px] xl:h-[820px] flex flex-col">
                {/* Notes Section */}
                <div className="h-full flex-1 flex flex-col">
                  <NoteSection />
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'CALL LOGS' ? (
            <motion.div 
              key="call-logs"
              initial={{ opacity: 0, scale: 0.97, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -15 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="h-[calc(100vh-140px)] min-h-[500px] sm:h-[650px] lg:h-[780px] xl:h-[820px] max-w-5xl mx-auto flex flex-col w-full"
            >
              <CallLogsSection />
            </motion.div>
          ) : (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, scale: 0.97, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -15 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="h-[calc(100vh-140px)] min-h-[500px] sm:h-[650px] lg:h-[780px] xl:h-[820px] max-w-5xl xl:max-w-6xl mx-auto flex flex-col w-full"
            >
              <AIChatSection />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      {/* ── Settings Panel Overlay ── */}
      <AnimatePresence>
        {showSettings && (
          <>
            {/* Backdrop */}
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setShowSettings(false)}
              className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />
            {/* Panel */}
            <div className="fixed inset-y-0 left-0 right-0 sm:right-auto z-[201] flex h-full h-[100dvh] max-h-[100dvh]">
              <SettingsPanel
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onNavigate={() => {
                  setShowSettings(false);
                }}
              />
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Real-time Notification Center Drawer ── */}
      <NotificationCenter
        onOpenSettings={(pageId) => {
          setShowSettings(true);
        }}
        onOpenChatWithContact={(contact) => {
          setActiveTab('MANAGEMENT HOME');
          setTargetChatContact(contact);
          window.dispatchEvent(new CustomEvent('talksphere:open_chat', { detail: { contact } }));
        }}
      />
    </div>
  );
};

export default Dashboard;
