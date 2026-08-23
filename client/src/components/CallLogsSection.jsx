import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, Search, Filter, Loader2, User, RefreshCw } from 'lucide-react';
import apiClient from '../api/apiClient';
import { useAuth } from '../context/AuthContext';
import { useCall } from '../context/CallContext';
import toast from 'react-hot-toast';

import useSocket from '../hooks/useSocket';

const CallLogsSection = () => {
  const { user } = useAuth();
  const { startCall, callStatus } = useCall();
  const socket = useSocket();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'MISSED' | 'AUDIO' | 'VIDEO'

  const currentUserId = user?._id || user?.id;

  const fetchCallLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/chat/call-logs');
      setLogs(res.data);
    } catch (err) {
      console.error('Error fetching call logs:', err);
      toast.error('Failed to load call logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallLogs();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleNewCallLog = (newLog) => {
      console.log('[CallLogs] Real-time call log received:', newLog);
      if (!newLog || !newLog._id) return;
      setLogs(prevLogs => {
        if (prevLogs.some(l => l._id === newLog._id)) {
          return prevLogs.map(l => l._id === newLog._id ? newLog : l);
        }
        return [newLog, ...prevLogs];
      });
    };

    socket.on('receive_call_log', handleNewCallLog);
    socket.on('receive-call-log', handleNewCallLog);
    socket.on('update-call-history', handleNewCallLog);
    socket.on('update_call_history', handleNewCallLog);

    return () => {
      socket.off('receive_call_log', handleNewCallLog);
      socket.off('receive-call-log', handleNewCallLog);
      socket.off('update-call-history', handleNewCallLog);
      socket.off('update_call_history', handleNewCallLog);
    };
  }, [socket]);

  const filteredLogs = logs.filter(log => {
    const isSender = log.sender?._id === currentUserId;
    const peer = isSender ? log.receiver : log.sender;
    const peerName = peer?.name || peer?.username || peer?.email || '';

    const matchesSearch = peerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesFilter = true;
    if (filterType === 'MISSED') {
      matchesFilter = log.callDetails?.status === 'missed' || log.callDetails?.status === 'declined';
    } else if (filterType === 'AUDIO') {
      matchesFilter = log.callDetails?.callType === 'audio';
    } else if (filterType === 'VIDEO') {
      matchesFilter = log.callDetails?.callType === 'video';
    }

    return matchesSearch && matchesFilter;
  });

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="glass-card p-6 md:p-8 h-full flex flex-col relative overflow-hidden">
      {/* Background Accent Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-accent-secondary/10 blur-[100px] pointer-events-none rounded-full"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-text-main flex items-center gap-3">
            <Phone className="text-accent-primary" size={24} /> CALL LOGS
          </h2>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">
            Encrypted Session Activity & History
          </p>
        </div>

        <button 
          onClick={fetchCallLogs} 
          className="p-2.5 rounded-xl bg-bg-card-secondary border border-border-main text-text-muted hover:text-accent-primary transition-all self-start sm:self-auto"
          title="Refresh Call Logs"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="space-y-4 mb-6 relative z-10">
        {/* Search Bar */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-primary transition-colors" size={16} />
          <input 
            type="text"
            placeholder="SEARCH LOGS BY USERNAME..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-card-secondary border border-border-main rounded-2xl py-3 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest focus:border-accent-primary outline-none transition-all placeholder:text-text-muted/50 text-text-main"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'MISSED', 'AUDIO', 'VIDEO'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`py-1.5 px-4 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                filterType === type 
                  ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20' 
                  : 'bg-bg-card-secondary border border-border-main text-text-muted hover:text-text-main'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 relative z-10">
        {loading ? (
          <div className="h-full flex items-center justify-center text-text-muted space-y-2 flex-col">
            <Loader2 className="animate-spin text-accent-primary" size={32} />
            <span className="text-[10px] font-black uppercase tracking-widest">Loading Transmission Records...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 p-8">
            <PhoneMissed size={48} className="text-accent-primary mb-3" />
            <p className="text-xs font-black uppercase tracking-widest">No Call Logs Found</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isSender = log.sender?._id === currentUserId;
            const peer = isSender ? log.receiver : log.sender;
            const peerName = peer?.username || peer?.name || peer?.email || 'User';
            const peerAvatar = peer?.avatar;

            const isMissed = log.callDetails?.status === 'missed' || log.callDetails?.status === 'declined';
            const duration = formatDuration(log.callDetails?.duration);

            return (
              <motion.div 
                key={log._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-bg-card-secondary/70 border border-border-main rounded-2xl flex items-center justify-between gap-4 hover:border-accent-primary/50 transition-all group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* User Avatar */}
                  <div className="w-12 h-12 rounded-2xl bg-bg-card border border-border-main overflow-hidden flex items-center justify-center shrink-0">
                    {peerAvatar ? (
                      <img src={peerAvatar} alt={peerName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={24} className="text-accent-primary" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0">
                    <h4 className="text-sm font-extrabold truncate text-text-main group-hover:text-accent-primary transition-colors">{peerName}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {isMissed ? (
                        <PhoneMissed size={14} className="text-red-500 shrink-0" />
                      ) : isSender ? (
                        <PhoneOutgoing size={14} className="text-emerald-400 shrink-0" />
                      ) : (
                        <PhoneIncoming size={14} className="text-blue-400 shrink-0" />
                      )}
                      
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isMissed ? 'text-red-400' : 'text-text-muted'}`}>
                        {isMissed ? 'Missed Call' : isSender ? 'Outgoing Call' : 'Incoming Call'}
                        {duration && ` • ${duration}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right side: Timestamp & Re-dial actions */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider hidden sm:inline">
                    {new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Re-dial buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => startCall(peer, 'audio')}
                      disabled={callStatus !== 'idle'}
                      className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all disabled:opacity-30 cursor-pointer"
                      title="Voice Re-dial"
                    >
                      <Phone size={16} />
                    </button>
                    <button
                      onClick={() => startCall(peer, 'video')}
                      disabled={callStatus !== 'idle'}
                      className="p-2.5 rounded-xl bg-accent-primary/10 text-accent-primary hover:bg-accent-primary hover:text-white transition-all disabled:opacity-30 cursor-pointer"
                      title="Video Re-dial"
                    >
                      <Video size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CallLogsSection;
