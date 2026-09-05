import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User as UserIcon, LayoutDashboard, Settings, Globe, Plus, Moon, Sun, Sparkles, Phone } from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocketStatus } from '../context/SocketContext';
import NoteSection from '../components/NoteSection';
import ChatSection from '../components/ChatSection';
import AIChatSection from '../components/AIChatSection';
import ManagementSection from '../components/ManagementSection';
import CallLogsSection from '../components/CallLogsSection';

const Dashboard = () => {
  const { user, logout, token, refreshUser } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const { isConnected, isReconnecting } = useSocketStatus();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeTab, setActiveTab] = useState('MANAGEMENT HOME');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);
  const [stats, setStats] = useState({ messages: 0, notes: 0 });

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

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/api/users/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats');
    }
  };

  React.useEffect(() => {
    if (token) {
      fetchStats();
      // Refresh stats every 30 seconds for real-time feel
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const tabs = [
    { name: 'MANAGEMENT HOME', shortName: 'HOME', icon: LayoutDashboard },
    { name: 'CALL LOGS', shortName: 'CALLS', icon: Phone },
    { name: 'AI ASSISTANT', shortName: 'AI ASSIST', icon: Sparkles },
    { name: 'MANAGEMENT', shortName: 'SETTINGS', icon: Settings },
  ];

  return (
    <div className="relative min-h-screen bg-bg-main text-text-main p-3 sm:p-5 md:p-8 lg:p-12 transition-colors duration-300 overflow-x-hidden">
      {/* Cybernetic Background Image Layer with Animated Crossfade */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img
            key={
              activeTab === 'AI ASSISTANT' ? '/image2.png' :
              activeTab === 'MANAGEMENT' ? '/image4.png' :
              activeTab === 'CALL LOGS' ? '/image5.png' :
              '/image.png'
            }
            src={
              activeTab === 'AI ASSISTANT' ? '/image2.png' :
              activeTab === 'MANAGEMENT' ? '/image4.png' :
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
        <div className="sticky top-0 z-50 max-w-7xl mx-auto mb-4 sm:mb-8 pt-1 sm:pt-3 px-1 sm:px-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-2.5 sm:gap-3 glass-card p-2 sm:p-3 rounded-2xl lg:rounded-full shadow-2xl backdrop-blur-2xl border border-border-main max-w-full overflow-hidden">
          
          {/* Left: Brand Logo */}
          <div className="flex items-center justify-between w-full lg:w-auto px-2 sm:px-4 py-0.5 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 3 }}
                whileTap={{ scale: 0.95 }}
                className="w-8 h-8 sm:w-10 sm:h-10 bg-accent-primary rounded-xl flex items-center justify-center shadow-lg shadow-accent-primary/20 shrink-0 cursor-pointer"
              >
                <span className="font-black text-base sm:text-xl text-white">TS</span>
              </motion.div>
              <h1 className="text-base sm:text-xl font-black tracking-tighter text-text-main whitespace-nowrap">TALK SPHERE</h1>
            </div>

            {/* Mobile / Tablet Actions (Theme & Avatar) visible on top row for small screens */}
            <div className="flex items-center gap-2 lg:hidden">
              <button 
                onClick={toggleTheme}
                className="p-2 sm:p-2.5 rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main active:scale-95 cursor-pointer"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <div 
                onClick={handleAvatarClick}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-bg-card-secondary border border-border-main flex items-center justify-center cursor-pointer overflow-hidden relative group shrink-0 active:scale-95 transition-transform"
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

          {/* Center: Tabs Navigation */}
          <div className="w-full lg:w-auto bg-bg-card-secondary/80 backdrop-blur-md rounded-xl lg:rounded-full p-1 max-w-full overflow-hidden">
            <div className="grid grid-cols-4 gap-1 lg:flex lg:items-center lg:gap-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(tab.name)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2.5 px-2 sm:px-4 lg:px-5 rounded-lg lg:rounded-full text-[8.5px] xs:text-[9.5px] sm:text-[10px] font-bold transition-all uppercase tracking-wider text-center cursor-pointer ${
                    activeTab === tab.name 
                      ? 'text-white' 
                      : 'text-text-muted hover:text-text-main dark:hover:bg-white/5 hover:bg-black/5'
                  }`}
                >
                  {activeTab === tab.name && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-accent-primary rounded-lg lg:rounded-full shadow-lg shadow-accent-primary/30"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}
                  <tab.icon size={14} className="shrink-0 sm:size-[15px] relative z-10" />
                  <span className="sm:hidden text-[8px] sm:text-[10px] leading-none relative z-10">{tab.shortName}</span>
                  <span className="hidden sm:inline whitespace-nowrap relative z-10">{tab.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Desktop User Session & Controls (visible on lg screens) */}
          <div className="hidden lg:flex items-center gap-3 shrink-0 px-4 border-l border-border-main">
             <button 
               onClick={toggleTheme}
               className="p-2.5 rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main active:scale-95 cursor-pointer"
               title="Toggle Theme"
             >
               {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
             </button>

             <div className="text-right pl-1">
               <p className="text-xs font-bold truncate max-w-[130px] text-text-main">{user?.name || user?.email}</p>
               <p className="text-[9px] text-text-muted uppercase font-semibold tracking-wider">Active Session</p>
             </div>
             
             <div 
               onClick={handleAvatarClick}
               className="w-9 h-9 rounded-full bg-bg-card-secondary border border-border-main flex items-center justify-center cursor-pointer overflow-hidden relative group shrink-0 active:scale-95 transition-transform"
               title="Change Avatar"
             >
               {user?.avatar ? (
                 <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
               ) : (
                 <UserIcon size={18} className="text-accent-primary" />
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
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start"
            >
              {/* Chats Section - Full Height/Width in its column */}
              <div className="lg:col-span-7 h-[520px] sm:h-[620px] lg:h-[780px] xl:h-[820px] flex flex-col">
                <ChatSection />
              </div>

              <div className="lg:col-span-5 h-[520px] sm:h-[620px] lg:h-[780px] xl:h-[820px] flex flex-col">
                {/* Notes Section */}
                <div className="h-full flex-1 flex flex-col">
                  <NoteSection />
                </div>
              </div>
            </motion.div>
          ) : activeTab === 'CALL LOGS' ? (
            <motion.div 
              key="call-logs"
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-[calc(100vh-140px)] min-h-[500px] sm:h-[650px] lg:h-[780px] xl:h-[820px] max-w-5xl mx-auto flex flex-col w-full"
            >
              <CallLogsSection />
            </motion.div>
          ) : activeTab === 'AI ASSISTANT' ? (
            <motion.div 
              key="ai"
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-[calc(100vh-140px)] min-h-[500px] sm:h-[650px] lg:h-[780px] xl:h-[820px] max-w-4xl mx-auto flex flex-col w-full"
            >
              <AIChatSection />
            </motion.div>
          ) : (
            <motion.div 
              key="management"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start"
            >
              {/* Left Section: Profile Card (Visible only in MANAGEMENT tab) */}
              <div className="lg:col-span-4 space-y-5 sm:space-y-8">
                <div className="glass-card p-6 sm:p-8 md:p-10 flex flex-col items-center text-center relative overflow-hidden group shadow-2xl">
                   {/* Cyber Security Background Layer */}
                   <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                     <img
                       src="/image4.png"
                       alt="Management Profile Background"
                       className="w-full h-full object-cover object-center opacity-25 dark:opacity-20 filter contrast-125 brightness-90"
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-bg-main/90 via-bg-main/45 to-bg-main/80" />
                     <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_15%,_var(--bg-main)_88%)]" />
                   </div>

                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary to-accent-secondary z-10"></div>
                   
                   <div className="relative z-10 w-full flex flex-col items-center">
                     <div 
                       onClick={handleAvatarClick}
                       className="w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-tr from-accent-primary to-accent-secondary rounded-[2rem] flex items-center justify-center mb-6 sm:mb-8 shadow-2xl group-hover:rotate-6 transition-transform cursor-pointer overflow-hidden relative active:scale-95"
                     >
                       {user?.avatar ? (
                         <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
                       ) : (
                         <UserIcon size={52} className="text-white" />
                       )}
                       <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                         <Plus className="text-white opacity-0 group-hover:opacity-100 scale-0 group-hover:scale-100 transition-all" size={30} />
                       </div>
                     </div>
                     <h2 className="text-xl sm:text-2xl font-black mb-1.5 sm:mb-2 tracking-tight uppercase">USER IDENTITY</h2>
                     <p className="text-text-muted text-xs mb-8 sm:mb-10 font-medium truncate w-full px-4 tracking-widest">{user?.email}</p>
                     
                     <button 
                       onClick={logout}
                       className="w-full flex items-center justify-center gap-3 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black text-xs uppercase tracking-[0.2em] shadow-sm active:scale-95 cursor-pointer"
                     >
                       <LogOut size={18} /> TERMINATE SESSION
                     </button>
                   </div>
                </div>

                {/* Stats/Status Placeholder */}
                <div className="glass-card p-4 sm:p-6 grid grid-cols-2 gap-3 sm:gap-4 shadow-xl">
                   <div 
                     onClick={() => setActiveTab('MANAGEMENT HOME')}
                     className="p-3.5 sm:p-4 bg-bg-card-secondary/80 backdrop-blur-md rounded-2xl border border-border-main cursor-pointer hover:border-accent-primary dark:hover:bg-white/5 hover:bg-black/5 transition-all group active:scale-95"
                   >
                      <p className="text-[10px] text-text-muted font-bold uppercase mb-1">Messages</p>
                      <p className="text-xl sm:text-2xl font-black tracking-tighter group-hover:text-accent-primary transition-colors">{stats.messages}</p>
                   </div>
                   <div 
                     onClick={() => setActiveTab('MANAGEMENT HOME')}
                     className="p-3.5 sm:p-4 bg-bg-card-secondary/80 backdrop-blur-md rounded-2xl border border-border-main cursor-pointer hover:border-accent-primary dark:hover:bg-white/5 hover:bg-black/5 transition-all group active:scale-95"
                   >
                      <p className="text-[10px] text-text-muted font-bold uppercase mb-1">Notes</p>
                      <p className="text-xl sm:text-2xl font-black tracking-tighter group-hover:text-accent-primary transition-colors">{stats.notes}</p>
                   </div>
                </div>
              </div>

              <ManagementSection />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
};

export default Dashboard;
