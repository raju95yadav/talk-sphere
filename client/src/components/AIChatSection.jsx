import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Trash2, Sparkles, Plus, MessageSquare, History, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

const AIChatSection = () => {
  const { token } = useAuth();
  const socket = useSocket();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('talk_sphere_ai_sessions');
    return saved ? JSON.parse(saved) : [{ id: Date.now(), title: 'Initial Query', messages: [] }];
  });
  const [activeSessionId, setActiveSessionId] = useState(sessions[0]?.id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const scrollRef = useRef();

  // Setup real-time AI status synchronization listeners
  useEffect(() => {
    if (socket) {
      socket.on('ai_generating', ({ sessionId }) => {
        if (sessionId === activeSessionId) {
          setIsLoading(true);
        }
      });

      socket.on('ai_response_received', ({ sessionId, userMessage, aiMessage }) => {
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            const messages = [...s.messages];
            // Ensure no duplicate messages
            const hasUserMsg = messages.some(m => m.content === userMessage.content && m.role === 'user');
            if (!hasUserMsg) {
              messages.push(userMessage);
            }
            const hasAiMsg = messages.some(m => m.content === aiMessage.content && m.role === 'assistant');
            if (!hasAiMsg) {
              messages.push(aiMessage);
            }
            return {
              ...s,
              messages,
              title: s.messages.length === 0 ? userMessage.content.slice(0, 20) + '...' : s.title
            };
          }
          return s;
        }));
        
        if (sessionId === activeSessionId) {
          setIsLoading(false);
        }
      });

      socket.on('ai_error', ({ sessionId, error }) => {
        if (sessionId === activeSessionId) {
          setIsLoading(false);
          toast.error(error || 'AI Synthesis Failed');
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('ai_generating');
        socket.off('ai_response_received');
        socket.off('ai_error');
      }
    };
  }, [socket, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  useEffect(() => {
    localStorage.setItem('talk_sphere_ai_sessions', JSON.stringify(sessions));
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId]);

  const startNewChat = () => {
    const newSession = {
      id: Date.now(),
      title: 'New Transmission',
      messages: []
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;

    const userMsg = { role: 'user', content: message, createdAt: new Date() };
    
    // Update active session (optimistic user message)
    const updatedSessions = sessions.map(s => {
      if (s.id === activeSessionId) {
        return { 
          ...s, 
          messages: [...s.messages, userMsg],
          title: s.messages.length === 0 ? message.slice(0, 20) + '...' : s.title
        };
      }
      return s;
    });
    
    setSessions(updatedSessions);
    setMessage('');
    setIsLoading(true);

    try {
      await apiClient.post('/api/ai/chat', {
        message,
        history: activeSession.messages.slice(-10),
        sessionId: activeSessionId // Pass sessionId to identify the tab/context on backend
      });
      // The AI response is appended dynamically via the socket listener to prevent double insertion and sync across tabs
    } catch (err) {
      setIsLoading(false);
      if (err.response?.status === 429) {
        toast.error('AI Rate Limit Reached');
      } else {
        toast.error(err.response?.data?.error || 'AI Link Severed');
      }
    }
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length === 0) {
      const defaultSess = { id: Date.now(), title: 'Initial Query', messages: [] };
      setSessions([defaultSess]);
      setActiveSessionId(defaultSess.id);
    } else {
      setSessions(filtered);
      if (activeSessionId === id) setActiveSessionId(filtered[0].id);
    }
    toast.success('Transmission Deleted');
  };

  return (
    <div className="glass-card flex h-full overflow-hidden shadow-2xl relative">
      {/* Sidebar */}
      <motion.div 
        initial={false}
        animate={{ width: isSidebarOpen ? '280px' : '0px' }}
        className="bg-bg-card-secondary border-r border-border-main flex flex-col overflow-hidden transition-all duration-300"
      >
        <div className="p-4 border-b border-border-main flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-text-muted">Archives</h3>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden"><X size={14} /></button>
        </div>
        
        <div className="p-4">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-3 bg-accent-primary/10 border border-accent-primary/20 rounded-xl text-accent-primary text-[10px] font-black uppercase tracking-widest hover:bg-accent-primary hover:text-white transition-all shadow-lg shadow-accent-primary/5"
          >
            <Plus size={14} /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {sessions.map(s => (
            <div 
              key={s.id}
              onClick={() => setActiveSessionId(s.id)}
              className={`p-3 rounded-xl cursor-pointer group transition-all border ${
                  activeSessionId === s.id 
                    ? 'bg-accent-primary/20 border-accent-primary/30 text-white' 
                    : 'bg-bg-card border-transparent text-text-muted dark:hover:bg-white/10 hover:bg-black/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 truncate">
                  <MessageSquare size={12} className={activeSessionId === s.id ? 'text-accent-primary' : ''} />
                  <span className="text-[9px] font-bold uppercase truncate">{s.title}</span>
                </div>
                <button 
                  onClick={(e) => deleteSession(e, s.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
                >
                  <X size={10} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-black/5 relative">
        {/* Toggle Sidebar Button */}
        {!isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-20 p-2 bg-bg-card border border-border-main rounded-xl text-text-muted hover:text-text-main shadow-xl"
          >
            <History size={18} />
          </button>
        )}

        {/* Header */}
        <div className="p-5 border-b border-border-main flex items-center justify-between bg-bg-card-secondary">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-accent-primary/20 flex items-center justify-center border border-border-main overflow-hidden">
                <Bot className="text-accent-primary" size={20} />
              </div>
            </div>
            <div>
              <h4 className="font-black text-xs uppercase tracking-wider truncate max-w-[200px]">
                {activeSession.title}
              </h4>
              <p className="text-[8px] text-accent-primary font-black uppercase tracking-[0.2em] animate-pulse">Neural Link Active</p>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {activeSession.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-20 text-center px-10">
               <Sparkles size={48} className="mb-4 text-accent-primary animate-pulse" />
               <h2 className="text-[10px] font-black uppercase tracking-[0.3em] mb-2">New Transmission Ready</h2>
               <p className="text-[8px] font-bold leading-relaxed uppercase tracking-widest">Connect to the quantum core to begin.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {activeSession.messages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-4 rounded-2xl shadow-lg text-[11px] font-medium leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-accent-primary text-white rounded-tr-none' 
                        : 'bg-bg-card-secondary text-text-main rounded-tl-none border border-border-main backdrop-blur-sm'
                    }`}>
                      <div className="markdown-container prose-invert max-w-none">
                        <ReactMarkdown 
                          components={{
                            a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline font-bold" />
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-2 opacity-30 text-[7px] font-bold uppercase tracking-widest">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-bg-card-secondary border border-border-main p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
                 <div className="flex gap-1">
                   <div className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce"></div>
                   <div className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                   <div className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 </div>
                 <span className="text-[8px] font-black uppercase tracking-[0.2em] text-accent-primary">Synthesizing...</span>
              </div>
            </motion.div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-5 bg-bg-card-secondary border-t border-border-main flex gap-4 items-center">
          <input 
            id="ai-message-input"
            name="ai-message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="ENTER TRANSMISSION..."
            aria-label="AI message input"
            disabled={isLoading}
            className="flex-1 bg-bg-card-secondary border border-border-main rounded-2xl px-5 py-4 text-[11px] font-bold text-text-main placeholder:text-text-muted/30 focus:border-accent-primary outline-none transition-all uppercase tracking-widest disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={isLoading || !message.trim()}
            className="w-14 h-14 bg-accent-primary rounded-2xl text-white shadow-xl shadow-accent-primary/30 flex items-center justify-center hover:scale-110 active:scale-90 transition-transform disabled:opacity-50 disabled:scale-100"
          >
            {isLoading ? <Loader2 className="animate-spin" size={22} /> : <Send size={22} />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChatSection;
