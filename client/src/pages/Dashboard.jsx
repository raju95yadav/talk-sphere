import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User as UserIcon, LayoutDashboard, Settings, Globe, Plus, Moon, Sun, Sparkles } from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSocketStatus } from '../context/SocketContext';
import NoteSection from '../components/NoteSection';
import ChatSection from '../components/ChatSection';
import AIChatSection from '../components/AIChatSection';
import ManagementSection from '../components/ManagementSection';

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
    { name: 'MANAGEMENT HOME', icon: LayoutDashboard },
    { name: 'AI ASSISTANT', icon: Sparkles },
    { name: 'MANAGEMENT', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-bg-main text-text-main p-4 md:p-8 lg:p-12 transition-colors duration-300">
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
      <div className="md:sticky md:top-0 z-50 max-w-7xl mx-auto mb-6 md:mb-10 pt-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6 glass-card p-2 md:rounded-full shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center gap-4 px-6 py-2">
            <div className="w-10 h-10 bg-accent-primary rounded-xl flex items-center justify-center shadow-lg shadow-accent-primary/20">
              <span className="font-black text-xl text-white">TS</span>
            </div>
            <h1 className="text-xl font-black tracking-tighter">TALK SPHERE</h1>
          </div>
          
          <div className="flex bg-bg-card-secondary rounded-full p-1 w-full md:w-auto">
            {tabs.map((tab) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 py-2.5 px-3 sm:px-6 rounded-full text-[9px] sm:text-[10px] font-bold transition-all uppercase tracking-widest ${
                  activeTab === tab.name 
                    ? 'bg-accent-primary text-white shadow-xl shadow-accent-primary/30' 
                    : 'text-text-muted hover:text-text-main dark:hover:bg-white/5 hover:bg-black/5'
                }`}
              >
                <tab.icon size={14} />
                <span className="hidden sm:inline">{tab.name}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto px-6 md:border-l border-border-main">
             <button 
               onClick={toggleTheme}
               className="p-3 rounded-xl bg-bg-card-secondary text-text-muted hover:text-accent-primary transition-all border border-border-main"
             >
               {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
             </button>

             <div className="hidden lg:block text-right">
               <p className="text-xs font-bold truncate max-w-[150px]">{user?.name || user?.email}</p>
               <p className="text-[10px] text-text-muted uppercase font-semibold">Active Session</p>
             </div>
             
             <div 
               onClick={handleAvatarClick}
               className="w-10 h-10 rounded-full bg-bg-card-secondary border border-border-main flex items-center justify-center cursor-pointer overflow-hidden relative group"
             >
               {user?.avatar ? (
                 <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
               ) : (
                 <UserIcon size={20} className="text-accent-primary" />
               )}
               {isUploading && (
                 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto">
        {activeTab === 'MANAGEMENT HOME' ? (
          <motion.div 
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          >
            {/* Chats Section - Full Height/Width in its column */}
            <div className="lg:col-span-7 h-[500px] sm:h-[600px] lg:h-[800px] flex flex-col">
              <ChatSection />
            </div>

            <div className="lg:col-span-5 h-[500px] sm:h-[600px] lg:h-[800px] flex flex-col">
              {/* Notes Section */}
              <div className="flex-1">
                <NoteSection />
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'AI ASSISTANT' ? (
          <motion.div 
            key="ai"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="h-[500px] sm:h-[600px] lg:h-[800px] max-w-4xl mx-auto flex flex-col"
          >
            <AIChatSection />
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Section: Profile Card (Visible only in MANAGEMENT tab) */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-4 space-y-8"
            >
              <div className="glass-card p-10 flex flex-col items-center text-center relative overflow-hidden group">
                 <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-primary to-accent-secondary"></div>
                 

                 <div 
                   onClick={handleAvatarClick}
                   className="w-28 h-28 bg-gradient-to-tr from-accent-primary to-accent-secondary rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl group-hover:rotate-6 transition-transform cursor-pointer overflow-hidden relative"
                 >
                   {user?.avatar ? (
                     <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
                   ) : (
                     <UserIcon size={56} className="text-white" />
                   )}
                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
                     <Plus className="text-white opacity-0 group-hover:opacity-100 scale-0 group-hover:scale-100 transition-all" size={32} />
                   </div>
                 </div>
                 <h2 className="text-2xl font-black mb-2 tracking-tight uppercase">USER IDENTITY</h2>
                 <p className="text-text-muted text-xs mb-10 font-medium truncate w-full px-4 tracking-widest">{user?.email}</p>
                 
                 <button 
                   onClick={logout}
                   className="w-full flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all font-black text-xs uppercase tracking-[0.2em]"
                 >
                   <LogOut size={18} /> TERMINATE SESSION
                 </button>
              </div>

              {/* Stats/Status Placeholder */}
              <div className="glass-card p-6 grid grid-cols-2 gap-4">
                 <div 
                   onClick={() => setActiveTab('MANAGEMENT HOME')}
                   className="p-4 bg-bg-card-secondary rounded-2xl border border-border-main cursor-pointer hover:border-accent-primary dark:hover:bg-white/5 hover:bg-black/5 transition-all group"
                 >
                    <p className="text-[10px] text-text-muted font-bold uppercase mb-1">Messages</p>
                    <p className="text-xl font-black tracking-tighter group-hover:text-accent-primary transition-colors">{stats.messages}</p>
                 </div>
                 <div 
                   onClick={() => setActiveTab('MANAGEMENT HOME')}
                   className="p-4 bg-bg-card-secondary rounded-2xl border border-border-main cursor-pointer hover:border-accent-primary dark:hover:bg-white/5 hover:bg-black/5 transition-all group"
                 >
                    <p className="text-[10px] text-text-muted font-bold uppercase mb-1">Notes</p>
                    <p className="text-xl font-black tracking-tighter group-hover:text-accent-primary transition-colors">{stats.notes}</p>
                 </div>
              </div>
            </motion.div>

            <ManagementSection />
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
