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
  const { token } = useAuth();
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
          width: isSidebarOpen ? '270px' : '0px',
          opacity: isSidebarOpen ? 1 : 0
        }}
        className="bg-bg-card-secondary border-r border-border-main flex flex-col overflow-hidden transition-all duration-300 z-30 absolute md:relative inset-y-0 left-0 h-full shadow-2xl md:shadow-none shrink-0"
      >
        <div className="p-4 border-b border-border-main flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent-primary" />
            <h3 className="text-xs font-bold tracking-wide text-text-main">Chat History</h3>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="p-1 hover:bg-white/10 rounded cursor-pointer text-text-muted hover:text-text-main"><X size={16} /></button>
        </div>
        
        <div className="p-3">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent-primary/10 border border-accent-primary/20 rounded-xl text-accent-primary text-xs font-semibold hover:bg-accent-primary hover:text-white transition-all shadow-sm cursor-pointer"
          >
            <Plus size={15} /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {sessions.map(s => {
            const sId = s._id || s.id;
            return (
              <div 
                key={sId}
                onClick={() => {
                  setActiveSessionId(sId);
                  if (s.modelPreference) setSelectedModel(s.modelPreference);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`p-2.5 rounded-xl cursor-pointer group transition-all border ${
                    activeSessionId === sId 
                      ? 'bg-accent-primary/15 border-accent-primary/30 text-text-main font-semibold shadow-sm' 
                      : 'bg-bg-card/50 border-transparent text-text-muted hover:bg-white/5 hover:text-text-main'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare size={14} className={activeSessionId === sId ? 'text-accent-primary shrink-0' : 'shrink-0'} />
                    <span className="text-xs truncate">{s.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(e, sId)}
                    className="opacity-60 md:opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all shrink-0"
                    title="Delete Chat"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer Export */}
        <div className="p-3 border-t border-border-main">
          <button
            onClick={exportChatSession}
            className="w-full flex items-center justify-center gap-2 py-2 text-text-muted hover:text-text-main text-xs font-medium bg-bg-card rounded-xl border border-border-main hover:border-accent-primary/40 transition-all cursor-pointer"
          >
            <Download size={13} /> Export Chat (.md)
          </button>
        </div>
      </motion.div>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col bg-bg-main/50 relative min-w-0 h-full overflow-hidden">
        {/* Header Bar - Fully Responsive */}
        <div className="p-2.5 sm:p-4 border-b border-border-main flex items-center justify-between bg-bg-card-secondary gap-1.5 sm:gap-3 min-w-0">
          {/* Left Title & Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 bg-bg-card border border-border-main rounded-xl text-text-muted hover:text-text-main shadow-sm transition-all shrink-0 cursor-pointer"
              title="Chat History"
            >
              <History size={17} />
            </button>
            
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-accent-primary/10 flex items-center justify-center border border-accent-primary/20 shrink-0">
              <Sparkles size={17} className="text-accent-primary animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs sm:text-sm text-text-main truncate">
                {activeSession?.title || 'New Chat'}
              </h4>
              <div className="flex items-center gap-1.5 mt-0.5 whitespace-nowrap overflow-hidden">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse"></span>
                <span className="text-[10px] text-accent-primary font-medium truncate">
                  Real-time AI Active
                </span>
                {serverPingMs && (
                  <span className="text-[9px] font-mono text-text-muted/60 hidden md:inline">
                    • {serverPingMs}ms
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Controls: Model Select & Regenerate */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="relative max-w-[125px] sm:max-w-[170px]">
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
                className="w-full bg-bg-card text-text-main border border-border-main hover:border-accent-primary/40 rounded-xl px-2.5 py-1.5 text-[11px] sm:text-xs font-medium outline-none cursor-pointer appearance-none pr-7 truncate shadow-sm transition-all"
              >
                {AI_MODELS.map(m => (
                  <option key={m.id} value={m.id} className="bg-bg-card-secondary text-text-main text-xs">
                    {m.name}
                  </option>
                ))}
              </select>
              <Cpu size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-accent-primary pointer-events-none" />
            </div>

            {activeSession?.messages?.length > 0 && (
              <button
                onClick={regenerateResponse}
                disabled={isLoading}
                className="p-1.5 sm:p-2 bg-bg-card border border-border-main rounded-xl text-text-muted hover:text-accent-primary hover:border-accent-primary/40 shadow-sm transition-all cursor-pointer disabled:opacity-40 shrink-0"
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
              className="bg-amber-500/10 border-b border-amber-500/20 px-3 py-2 flex items-center justify-between gap-2 text-amber-300 text-[11px] font-medium"
            >
              <div className="flex items-center gap-2 min-w-0 truncate">
                <AlertTriangle size={14} className="animate-bounce shrink-0 text-amber-400" />
                <span className="truncate">Waking up server... (Free-tier server spinning up)</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping"></div>
                <span className="text-[9px] font-mono text-amber-400/80">Connecting</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-4 min-w-0">
          {(!activeSession || activeSession.messages.length === 0) ? (
            <div className="flex flex-col items-center justify-center min-h-full py-6 px-2 sm:px-4 max-w-2xl mx-auto my-auto text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-accent-primary/20 to-pink-500/20 border border-accent-primary/30 flex items-center justify-center mb-3 sm:mb-4 shadow-xl shadow-accent-primary/10">
                <Sparkles size={24} className="text-accent-primary" />
              </div>
              
              <h2 className="text-lg sm:text-2xl font-bold text-text-main mb-1.5 tracking-tight">
                How can I help you today?
              </h2>
              <p className="text-xs sm:text-sm text-text-muted mb-5 sm:mb-8 leading-relaxed max-w-md">
                Ask a question, analyze code, or summarize documents in real-time.
              </p>

              {/* 2x2 Quick Action Cards Grid - Fully Responsive & Light Mode Adapted */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 w-full">
                {PRESET_PROMPTS.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setMessage(p.prompt + ' ');
                        document.getElementById('ai-message-input')?.focus();
                      }}
                      className="p-3.5 sm:p-4 bg-bg-card hover:bg-bg-card-secondary border border-border-main hover:border-accent-primary/50 hover:shadow-[0_0_20px_rgba(255,0,85,0.15)] rounded-2xl text-left transition-all duration-300 group cursor-pointer flex items-start gap-3 backdrop-blur-md shadow-sm"
                    >
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center group-hover:border-accent-primary/50 group-hover:scale-105 shrink-0 transition-all">
                        <Icon size={17} className="text-accent-primary group-hover:text-accent-primary transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-text-main group-hover:text-accent-primary transition-colors mb-0.5">
                          {p.label}
                        </div>
                        <div className="text-[11px] font-medium text-text-muted leading-snug line-clamp-2">
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
              {activeSession.messages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} min-w-0`}
                >
                  <div className={`max-w-[92%] sm:max-w-[85%] flex flex-col min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-3 sm:p-4 rounded-2xl shadow-md text-xs font-normal leading-relaxed min-w-0 overflow-hidden break-words [word-break:break-word] ${
                      msg.role === 'user' 
                        ? 'bg-accent-primary text-white rounded-tr-none' 
                        : 'bg-bg-card-secondary text-text-main rounded-tl-none border border-border-main backdrop-blur-sm'
                    }`}>
                      <div className="markdown-container prose-invert max-w-none break-words [word-break:break-word] overflow-hidden text-xs">
                        <ReactMarkdown 
                          components={{
                            a: ({ node, ...props }) => (
                              <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline font-medium break-all" />
                            ),
                            code: ({ node, inline, className, children, ...props }) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const codeString = String(children).replace(/\n$/, '');
                              if (!inline) {
                                return (
                                  <div className="my-2 rounded-xl border border-border-main bg-bg-card-secondary overflow-hidden shadow-sm">
                                    <div className="flex items-center justify-between px-3 py-1.5 bg-bg-card border-b border-border-main text-[10px] font-mono text-text-muted">
                                      <span>{match ? match[1] : 'code'}</span>
                                      <button
                                        onClick={() => copyToClipboard(codeString, `code-${i}`)}
                                        className="flex items-center gap-1 text-accent-primary hover:underline cursor-pointer"
                                      >
                                        <Copy size={11} /> Copy
                                      </button>
                                    </div>
                                    <pre className="p-3 text-xs font-mono overflow-x-auto custom-scrollbar text-text-main dark:text-amber-200/90 leading-relaxed font-semibold">
                                      <code>{codeString}</code>
                                    </pre>
                                  </div>
                                );
                              }
                              return (
                                <code className="px-1.5 py-0.5 rounded bg-bg-card border border-border-main text-accent-primary font-mono text-[11px]" {...props}>
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
                      {msg.role === 'assistant' && msg.content && (
                        <div className="flex items-center justify-between gap-3 mt-2.5 pt-2 border-t border-border-main/40 text-[10px] font-medium text-text-muted">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => copyToClipboard(msg.content, i)}
                              className="flex items-center gap-1 hover:text-accent-primary transition-colors cursor-pointer"
                              title="Copy Answer"
                            >
                              {copiedIndex === i ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              <span>{copiedIndex === i ? 'Copied' : 'Copy'}</span>
                            </button>

                            <button
                              onClick={() => speakText(msg.content, i)}
                              className="flex items-center gap-1 hover:text-accent-primary transition-colors cursor-pointer"
                              title="Read Aloud"
                            >
                              {speakingIndex === i ? <VolumeX size={12} className="text-red-400" /> : <Volume2 size={12} />}
                              <span>{speakingIndex === i ? 'Stop' : 'Listen'}</span>
                            </button>
                          </div>

                          <span className="opacity-50 font-mono">
                            {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-bg-card-secondary border border-border-main p-3 sm:p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                 <div className="flex gap-1.5">
                   <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                   <div className="w-2 h-2 bg-accent-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 </div>
                 <span className="text-xs font-medium text-accent-primary">
                   Thinking...
                 </span>
              </div>
            </motion.div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Form Bar */}
        <form onSubmit={handleSendMessage} className="p-2.5 sm:p-4 bg-bg-card-secondary/80 border-t border-border-main backdrop-blur-md shrink-0">
          <div className="flex gap-2 items-center bg-bg-card border border-border-main rounded-2xl p-1 sm:p-1.5 shadow-lg focus-within:border-pink-500/60 focus-within:ring-2 focus-within:ring-pink-500/20 transition-all duration-300">
            <input 
              id="ai-message-input"
              name="ai-message"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask anything or type '/' for prompts..."
              aria-label="AI message input"
              disabled={isLoading}
              className="flex-1 bg-transparent px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-normal text-text-main placeholder:text-text-muted/50 outline-none disabled:opacity-50 min-w-0"
            />

            {isLoading ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="h-9 sm:h-10 px-3 sm:px-4 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 hover:bg-red-500 hover:text-white transition-all shrink-0 cursor-pointer shadow-sm"
                title="Stop Generation"
              >
                <Square size={12} className="fill-current" /> Stop
              </button>
            ) : (
              <button 
                type="submit" 
                disabled={!message.trim()}
                className="w-9 h-9 sm:w-10 sm:h-10 bg-accent-primary rounded-xl text-white shadow-md shadow-accent-primary/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-40 shrink-0 cursor-pointer"
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
