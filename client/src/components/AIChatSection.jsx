import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, Loader2, Trash2, Sparkles, Plus, MessageSquare, 
  History, X, Square, Copy, Check, Volume2, VolumeX, RefreshCw, 
  Download, Cpu, AlertTriangle, Zap, Code2, BookOpen, Lightbulb, Wrench 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import apiClient from '../api/apiClient';

const AI_MODELS = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', desc: 'Ultra-Fast Realtime', icon: Zap, color: 'text-amber-400' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: 'Deep Reasoning Core', icon: Cpu, color: 'text-purple-400' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', desc: 'Balanced Engine', icon: Sparkles, color: 'text-blue-400' },
  { id: 'groq-llama3', name: 'Groq Llama 3.3', desc: 'Low Latency LPU', icon: Zap, color: 'text-emerald-400' }
];

const PRESET_PROMPTS = [
  { label: 'Code Review', icon: Code2, prompt: 'Perform a full code review and optimize performance for:' },
  { label: 'Summarize Document', icon: BookOpen, prompt: 'Provide a concise summary with key takeaways of:' },
  { label: 'Brainstorm Ideas', icon: Lightbulb, prompt: 'Generate 5 creative ideas for:' },
  { label: 'Debug Code Error', icon: Wrench, prompt: 'Explain the root cause and fix for this error:' }
];

const AIChatSection = () => {
  const { token, user } = useAuth();
  const socket = useSocket();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');
  
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [isColdStarting, setIsColdStarting] = useState(false);
  const [serverPingMs, setServerPingMs] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);

  const scrollRef = useRef();
  const abortControllerRef = useRef(null);
  const coldTimerRef = useRef(null);
  const sessionsRef = useRef(sessions);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Load sessions from MongoDB
  const fetchSessions = async () => {
    try {
      const res = await apiClient.get('/api/ai/sessions');
      if (res.data && res.data.length > 0) {
        setSessions(res.data);
        setActiveSessionId(res.data[0]._id);
        if (res.data[0].modelPreference) {
          setSelectedModel(res.data[0].modelPreference);
        }
      } else {
        // Create initial MongoDB session
        const createRes = await apiClient.post('/api/ai/sessions', {
          title: 'New Chat',
          modelPreference: 'gemini-3.6-flash',
          messages: []
        });
        setSessions([createRes.data]);
        setActiveSessionId(createRes.data._id);
      }
    } catch (err) {
      console.error('Failed to load AI sessions:', err);
    }
  };

  const checkServerPing = async () => {
    const startTime = Date.now();
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/api/ai/ping`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const elapsed = Date.now() - startTime;
        setServerPingMs(elapsed);
        setServerStatus('online');
      } else {
        setServerStatus('cold');
      }
    } catch (e) {
      setServerStatus('cold');
    }
  };

  useEffect(() => {
    if (token) {
      checkServerPing();
      fetchSessions();
    }
  }, [token]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find(s => (s._id || s.id) === activeSessionId) || sessions[0];

  const startNewChat = async () => {
    try {
      const res = await apiClient.post('/api/ai/sessions', {
        title: 'New Chat',
        modelPreference: selectedModel,
        messages: []
      });
      setSessions([res.data, ...sessions]);
      setActiveSessionId(res.data._id);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (err) {
      toast.error('Failed to create new chat session');
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (coldTimerRef.current) clearTimeout(coldTimerRef.current);
    setIsLoading(false);
    setIsColdStarting(false);
    toast('Generation stopped', { icon: '🛑' });
  };

  const handleSendMessage = async (e, customPrompt = null) => {
    if (e) e.preventDefault();
    const promptToSend = customPrompt || message;
    if (!promptToSend.trim() || isLoading) return;

    const userMsg = { role: 'user', content: promptToSend, createdAt: new Date().toISOString() };
    
    let targetSessionId = activeSessionId;
    let currentHistory = [];

    if (!targetSessionId || sessions.length === 0) {
      try {
        const createRes = await apiClient.post('/api/ai/sessions', {
          title: promptToSend.slice(0, 24) + '...',
          modelPreference: selectedModel,
          messages: [userMsg]
        });
        setSessions([createRes.data, ...sessions]);
        setActiveSessionId(createRes.data._id);
        targetSessionId = createRes.data._id;
      } catch (err) {
        return toast.error('Failed to initialize AI session');
      }
    } else {
      currentHistory = activeSession?.messages || [];
      setSessions(prev => prev.map(s => {
        if ((s._id || s.id) === targetSessionId) {
          return {
            ...s,
            messages: [...s.messages, userMsg],
            title: s.messages.length === 0 ? promptToSend.slice(0, 24) + '...' : s.title
          };
        }
        return s;
      }));
    }

    if (!customPrompt) setMessage('');
    setIsLoading(true);
    setIsColdStarting(false);

    coldTimerRef.current = setTimeout(() => {
      setIsColdStarting(true);
    }, 2500);

    const aiPlaceholderMsg = { role: 'assistant', content: '', createdAt: new Date().toISOString() };
    setSessions(prev => prev.map(s => {
      if ((s._id || s.id) === targetSessionId) {
        return {
          ...s,
          messages: [...s.messages, aiPlaceholderMsg]
        };
      }
      return s;
    }));

    abortControllerRef.current = new AbortController();

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiBase}/api/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: promptToSend,
          history: currentHistory.slice(-10),
          sessionId: targetSessionId,
          model: selectedModel
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedFirstChunk = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (!receivedFirstChunk) {
          receivedFirstChunk = true;
          if (coldTimerRef.current) clearTimeout(coldTimerRef.current);
          setIsColdStarting(false);
          setServerStatus('online');
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.substring(6);
            if (dataStr === '[DONE]') {
              break;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                toast.error(parsed.error);
                appendChunkToSession(targetSessionId, `\n\n${parsed.error}`);
              } else if (parsed.chunk) {
                appendChunkToSession(targetSessionId, parsed.chunk);
              }
            } catch (e) {
              // Ignore partial fragments
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Stream stopped by user
      } else {
        console.error('AI Stream Error:', err);
        toast.error('Connection interrupted');
        appendChunkToSession(targetSessionId, `\n\n⚠️ *Connection Interrupted:* ${err.message || 'Server timeout'}`);
      }
    } finally {
      if (coldTimerRef.current) clearTimeout(coldTimerRef.current);
      setIsLoading(false);
      setIsColdStarting(false);
      abortControllerRef.current = null;

      // Sync completed messages to MongoDB
      const updatedSess = sessionsRef.current.find(s => (s._id || s.id) === targetSessionId);
      if (updatedSess) {
        apiClient.put(`/api/ai/sessions/${targetSessionId}`, {
          title: updatedSess.title,
          modelPreference: selectedModel,
          messages: updatedSess.messages
        }).catch(err => console.error('Failed to sync session to MongoDB:', err));
      }
    }
  };

  const appendChunkToSession = (sessionId, chunk) => {
    setSessions(prev => prev.map(s => {
      if ((s._id || s.id) === sessionId) {
        const msgs = [...s.messages];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
          msgs[msgs.length - 1] = {
            ...msgs[msgs.length - 1],
            content: msgs[msgs.length - 1].content + chunk
          };
        }
        return { ...s, messages: msgs };
      }
      return s;
    }));
  };

  const deleteSession = async (e, id) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/api/ai/sessions/${id}`);
      const filtered = sessions.filter(s => (s._id || s.id) !== id);
      if (filtered.length === 0) {
        const createRes = await apiClient.post('/api/ai/sessions', {
          title: 'New Chat',
          modelPreference: selectedModel,
          messages: []
        });
        setSessions([createRes.data]);
        setActiveSessionId(createRes.data._id);
      } else {
        setSessions(filtered);
        if (activeSessionId === id) setActiveSessionId(filtered[0]._id || filtered[0].id);
      }
      toast.success('Chat deleted');
    } catch (err) {
      toast.error('Failed to delete chat session');
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const speakText = (text, index) => {
    if (!('speechSynthesis' in window)) {
      return toast.error('Text-to-speech is not supported in this browser');
    }
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`~]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingIndex(null);
    utterance.onerror = () => setSpeakingIndex(null);
    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  const regenerateResponse = () => {
    if (!activeSession || activeSession.messages.length < 2) return;
    const lastUserMsgIndex = [...activeSession.messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserMsgIndex !== -1) {
      const actualIndex = activeSession.messages.length - 1 - lastUserMsgIndex;
      const lastUserMsg = activeSession.messages[actualIndex];
      setSessions(prev => prev.map(s => {
        if ((s._id || s.id) === activeSessionId) {
          return {
            ...s,
            messages: s.messages.slice(0, actualIndex + 1)
          };
        }
        return s;
      }));
      handleSendMessage(null, lastUserMsg.content);
    }
  };

  const exportChatSession = () => {
    if (!activeSession || activeSession.messages.length === 0) {
      return toast.error('No messages to export');
    }
    let content = `# ${activeSession.title}\n\n*Exported from Talk Sphere AI Assistant on ${new Date().toLocaleString()}*\n\n---\n\n`;
    activeSession.messages.forEach(m => {
      const sender = m.role === 'user' ? '👤 User' : '🤖 AI Assistant';
      content += `### ${sender}\n${m.content}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_export.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported to Markdown');
  };

  return (
    <div className="glass-card flex h-full overflow-hidden shadow-2xl relative w-full border border-border-main/50 font-sans min-w-0">
      {/* Dedicated AI Assistant Neural Background Image Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/image2.png"
          alt="AI Assistant Neural Core"
          className="w-full h-full object-cover object-center opacity-35 dark:opacity-30 filter contrast-125 brightness-95"
        />
        {/* Dynamic Gradient and Radial Vignette for high readability and futuristic depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-main/90 via-bg-main/40 to-bg-main/80" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_15%,_var(--bg-main)_88%)]" />
      </div>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="md:hidden absolute inset-0 bg-black/60 z-20 backdrop-blur-xs transition-opacity" 
        />
      )}

      {/* Sidebar Drawer */}
      <motion.div 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? '280px' : '0px',
          opacity: isSidebarOpen ? 1 : 0
        }}
        className="bg-white/95 dark:bg-[#0e121b]/95 backdrop-blur-2xl border-r border-slate-200 dark:border-white/10 flex flex-col overflow-hidden transition-all duration-300 z-30 absolute md:relative inset-y-0 left-0 h-full shadow-2xl md:shadow-none shrink-0"
      >
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
              <Sparkles size={15} />
            </div>
            <h3 className="text-xs font-black tracking-wider uppercase text-slate-900 dark:text-white">Chat History</h3>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        
        <div className="p-3">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20 active:scale-95 cursor-pointer"
          >
            <Plus size={15} /> New Conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {sessions.map(s => {
            const sId = s._id || s.id;
            const isActive = activeSessionId === sId;
            return (
              <div 
                key={sId}
                onClick={() => {
                  setActiveSessionId(sId);
                  if (s.modelPreference) setSelectedModel(s.modelPreference);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`p-3 rounded-xl cursor-pointer group transition-all border ${
                    isActive 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm' 
                      : 'bg-slate-50/70 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-950 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 truncate">
                    <MessageSquare size={14} className={isActive ? 'text-emerald-500 shrink-0' : 'text-slate-400 dark:text-slate-500 shrink-0'} />
                    <span className="text-xs truncate">{s.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(e, sId)}
                    className="opacity-70 md:opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/15 rounded-md transition-all shrink-0 cursor-pointer"
                    title="Delete Chat"
                  >
                    <Trash2 size={12} className="text-red-500 dark:text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer Export */}
        <div className="p-3 border-t border-slate-200 dark:border-white/10">
          <button
            onClick={exportChatSession}
            className="w-full flex items-center justify-center gap-2 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 transition-all cursor-pointer"
          >
            <Download size={13} /> Export Session (.md)
          </button>
        </div>
      </motion.div>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col bg-transparent relative z-10 min-w-0 h-full overflow-hidden">
        {/* Header Bar - Fully Responsive */}
        <div className="p-2.5 sm:p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-white/80 dark:bg-[#0e121b]/80 backdrop-blur-xl gap-2 min-w-0">
          {/* Left Title & Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-300 hover:text-emerald-500 hover:border-emerald-500/40 shadow-sm transition-all shrink-0 cursor-pointer active:scale-95"
              title="Chat History"
            >
              <History size={17} />
            </button>
            
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
              <Sparkles size={17} className="text-emerald-500 animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {activeSession?.title || 'New Chat'}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap overflow-hidden">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                  Real-time Neural Engine
                </span>
                {serverPingMs && (
                  <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 hidden md:inline">
                    • {serverPingMs}ms latency
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Model Select & Regenerate */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="relative max-w-[130px] sm:max-w-[180px]">
              <select
                value={selectedModel}
                onChange={(e) => {
                  const newModel = e.target.value;
                  setSelectedModel(newModel);
                  if (activeSessionId) {
                    apiClient.put(`/api/ai/sessions/${activeSessionId}`, { modelPreference: newModel }).catch(() => {});
                  }
                }}
                aria-label="Select AI Model"
                className="w-full bg-slate-100 dark:bg-white/5 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold outline-none cursor-pointer appearance-none pr-7 truncate shadow-sm transition-all focus:border-emerald-500"
              >
                {AI_MODELS.map(m => (
                  <option key={m.id} value={m.id} className="bg-white dark:bg-[#141822] text-slate-900 dark:text-white text-xs">
                    {m.name}
                  </option>
                ))}
              </select>
              <Cpu size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" />
            </div>

            {activeSession?.messages?.length > 0 && (
              <button
                onClick={regenerateResponse}
                disabled={isLoading}
                className="p-1.5 sm:p-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-300 hover:text-emerald-500 hover:border-emerald-500/40 shadow-sm transition-all cursor-pointer disabled:opacity-40 shrink-0 active:scale-95"
                title="Regenerate Last Response"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* Cold Start Warning Banner */}
        <AnimatePresence>
          {isColdStarting && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2 flex items-center justify-between gap-2 text-amber-600 dark:text-amber-300 text-[11px] font-semibold"
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                <AlertTriangle size={14} className="animate-bounce shrink-0 text-amber-500" />
                <span className="truncate">Waking up server... (Spinning up instance)</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping"></div>
                <span className="text-[9px] font-mono text-amber-600 dark:text-amber-400">Connecting</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-5 min-w-0">
          {(!activeSession || activeSession.messages.length === 0) ? (
            <div className="flex flex-col items-center justify-center min-h-full py-8 px-2 sm:px-4 max-w-2xl mx-auto my-auto text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-xl shadow-emerald-500/10">
                <Sparkles size={26} className="text-emerald-500" />
              </div>
              
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                How can I assist you today?
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6 sm:mb-8 leading-relaxed max-w-md font-medium">
                Ask questions, inspect code, draft documents, or brainstorm ideas in real-time.
              </p>

              {/* 2x2 Quick Action Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
                {PRESET_PROMPTS.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setMessage(p.prompt + ' ');
                        document.getElementById('ai-message-input')?.focus();
                      }}
                      className="p-4 bg-white dark:bg-[#121620] hover:bg-slate-50 dark:hover:bg-[#171d2b] border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 rounded-2xl text-left transition-all duration-300 group cursor-pointer flex items-start gap-3.5 shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:border-emerald-500/50 group-hover:scale-105 shrink-0 transition-all">
                        <Icon size={18} className="text-emerald-500 transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors mb-0.5">
                          {p.label}
                        </div>
                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                          {p.prompt}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {activeSession.messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className={`flex items-start gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'} min-w-0`}
                  >
                    {/* Bot Avatar Icon */}
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-[1px] shrink-0 shadow-md shadow-emerald-500/20 mt-1">
                        <div className="w-full h-full bg-[#0b0e14] rounded-[11px] flex items-center justify-center">
                          <Bot size={15} className="text-emerald-400" />
                        </div>
                      </div>
                    )}

                    <div className={`max-w-[94%] sm:max-w-[85%] flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className={`p-4 sm:p-5 rounded-2xl shadow-md text-xs sm:text-sm font-normal leading-relaxed min-w-0 overflow-hidden break-words [word-break:break-word] ${
                        isUser 
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-xs shadow-emerald-500/20' 
                          : 'bg-white dark:bg-[#121620] text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200 dark:border-white/10 shadow-black/5 dark:shadow-black/30'
                      }`}>
                        <div className="markdown-container max-w-none break-words [word-break:break-word] overflow-hidden text-xs sm:text-sm">
                          <ReactMarkdown 
                            components={{
                              a: ({ node, ...props }) => (
                                <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-500 dark:text-emerald-400 hover:underline font-semibold break-all" />
                              ),
                              code: ({ node, inline, className, children, ...props }) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                if (!inline) {
                                  return (
                                    <div className="my-3 rounded-2xl border border-slate-700/60 dark:border-white/10 bg-[#0d131f] dark:bg-[#070b13] overflow-hidden shadow-xl text-left">
                                      <div className="flex items-center justify-between px-3.5 py-2 bg-[#141b2a] dark:bg-[#0c121e] border-b border-slate-700/50 dark:border-white/10 text-[11px] font-mono font-bold text-slate-300">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded-full bg-red-400/80 inline-block" />
                                          <span className="w-2 h-2 rounded-full bg-amber-400/80 inline-block" />
                                          <span className="w-2 h-2 rounded-full bg-emerald-400/80 inline-block" />
                                          <span className="ml-1 uppercase text-emerald-400 text-[10px] tracking-wider">{match ? match[1] : 'CODE'}</span>
                                        </div>
                                        <button
                                          onClick={() => copyToClipboard(codeString, `code-${i}`)}
                                          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/10 hover:bg-emerald-500 hover:text-white text-slate-200 text-[10px] font-sans font-bold transition-all cursor-pointer active:scale-95"
                                        >
                                          {copiedIndex === `code-${i}` ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
                                          <span>{copiedIndex === `code-${i}` ? 'COPIED' : 'COPY'}</span>
                                        </button>
                                      </div>
                                      <pre className="p-3.5 text-[11px] sm:text-[12px] font-mono overflow-x-auto custom-scrollbar text-emerald-300 leading-relaxed font-medium m-0 border-0 bg-transparent">
                                        <code>{codeString}</code>
                                      </pre>
                                    </div>
                                  );
                                }
                                return (
                                  <code className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-semibold" {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Action Bar for AI Messages */}
                        {!isUser && msg.content && (
                          <div className="flex items-center justify-between gap-3 mt-3 pt-2.5 border-t border-slate-200 dark:border-white/10 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => copyToClipboard(msg.content, i)}
                                className="flex items-center gap-1 hover:text-emerald-500 transition-colors cursor-pointer"
                                title="Copy Answer"
                              >
                                {copiedIndex === i ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                <span>{copiedIndex === i ? 'Copied' : 'Copy'}</span>
                              </button>

                              <button
                                onClick={() => speakText(msg.content, i)}
                                className="flex items-center gap-1 hover:text-emerald-500 transition-colors cursor-pointer"
                                title="Read Aloud"
                              >
                                {speakingIndex === i ? <VolumeX size={12} className="text-red-500" /> : <Volume2 size={12} />}
                                <span>{speakingIndex === i ? 'Stop' : 'Listen'}</span>
                              </button>
                            </div>

                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                              {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* User Avatar */}
                    {isUser && (
                      <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-white/10 border border-slate-300 dark:border-white/10 overflow-hidden shrink-0 mt-1 flex items-center justify-center">
                        {user?.avatar ? (
                          <img src={user.avatar} alt="User" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Bot size={15} className="text-emerald-500" />
              </div>
              <div className="bg-white dark:bg-[#121620] border border-slate-200 dark:border-white/10 p-3 sm:p-4 rounded-2xl rounded-tl-xs flex items-center gap-3 shadow-sm">
                 <div className="flex gap-1.5">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 </div>
                 <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                   Generating response...
                 </span>
              </div>
            </motion.div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Form Bar */}
        <form onSubmit={handleSendMessage} className="p-2.5 sm:p-4 bg-white/90 dark:bg-[#0e121b]/90 border-t border-slate-200 dark:border-white/10 backdrop-blur-xl shrink-0">
          <div className="flex gap-2 items-center bg-slate-50 dark:bg-[#121620] border border-slate-200 dark:border-white/10 rounded-2xl p-1 sm:p-1.5 shadow-lg focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all duration-300">
            <input 
              id="ai-message-input"
              name="ai-message"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask anything or request code analysis..."
              aria-label="AI message input"
              disabled={isLoading}
              className="flex-1 bg-transparent px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:opacity-50 min-w-0"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="h-9 sm:h-10 px-3 sm:px-4 bg-red-500/15 border border-red-500/30 text-red-500 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-red-500 hover:text-white transition-all shrink-0 cursor-pointer shadow-sm active:scale-95"
                title="Stop Generation"
              >
                <Square size={12} className="fill-current" /> Stop
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={!message.trim()}
                className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl text-white shadow-md shadow-emerald-500/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shrink-0 cursor-pointer"
                title="Send message"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AIChatSection;
