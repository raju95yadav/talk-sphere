import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, Loader2, Trash2, Sparkles, Plus, MessageSquare, 
  History, X, Square, Copy, Check, Volume2, VolumeX, RefreshCw, 
  Download, Cpu, AlertTriangle, Zap, Code2, BookOpen, Lightbulb, Wrench,
  FileText, UploadCloud, Database, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import apiClient from '../api/apiClient';

// RAG Subcomponents
import RagSourcesCard from './rag/RagSourcesCard';
import RagDocumentSelector from './rag/RagDocumentSelector';
import RagDocumentsModal from './rag/RagDocumentsModal';
import RagDropzoneView from './rag/RagDropzoneView';

const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://talk-sphere-server.onrender.com';
  }
  return 'http://localhost:5000';
};

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
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');

  // Mode Switch State: 'general' vs 'rag'
  const [assistantMode, setAssistantMode] = useState('general');
  
  // Sessions & Active Chat
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [isColdStarting, setIsColdStarting] = useState(false);
  const [serverPingMs, setServerPingMs] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [speakingIndex, setSpeakingIndex] = useState(null);

  // RAG Document State
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadStep, setUploadStep] = useState('');
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

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
        // Find matching active session for current mode if possible
        const matching = res.data.find(s => assistantMode === 'rag' ? s.mode === 'rag' : s.mode !== 'rag');
        const activeSess = matching || res.data[0];
        setActiveSessionId(activeSess._id || activeSess.id);
        if (assistantMode === 'rag') {
          const docId = activeSess?.ragDocument?._id || (typeof activeSess?.ragDocument === 'string' ? activeSess.ragDocument : null);
          setSelectedDocId(docId || null);
        }
        if (res.data[0].modelPreference) {
          setSelectedModel(res.data[0].modelPreference);
        }
      } else {
        // Create initial MongoDB session
        const createRes = await apiClient.post('/api/ai/sessions', {
          title: assistantMode === 'rag' ? 'New Document Chat' : 'New Chat',
          modelPreference: 'gemini-3.6-flash',
          mode: assistantMode,
          ragDocument: null,
          messages: []
        });
        setSessions([createRes.data]);
        setActiveSessionId(createRes.data._id);
        setSelectedDocId(null);
      }
    } catch (err) {
      console.error('Failed to load AI sessions:', err);
    }
  };

  // Load RAG Documents from MongoDB
  const fetchDocuments = async () => {
    try {
      const res = await apiClient.get('/api/rag/documents');
      if (res.data) {
        setDocuments(res.data);
        // Keep selectedDocId only if it still exists in the fetched documents
        setSelectedDocId(prev => {
          if (!prev || prev === 'all') return prev;
          return res.data.some(d => d._id === prev) ? prev : null;
        });
      }
    } catch (err) {
      console.error('Failed to fetch RAG documents:', err);
    }
  };

  const checkServerPing = async () => {
    const startTime = Date.now();
    try {
      const apiBase = getApiBase();
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
      fetchDocuments();
    }
  }, [token]);

  // When switching modes, auto-select a session of that mode or create one
  useEffect(() => {
    const modeSessions = sessions.filter(s => assistantMode === 'rag' ? s.mode === 'rag' : s.mode !== 'rag');
    if (modeSessions.length > 0) {
      const currentExists = modeSessions.some(s => (s._id || s.id) === activeSessionId);
      const nextSess = currentExists 
        ? modeSessions.find(s => (s._id || s.id) === activeSessionId) 
        : modeSessions[0];
      if (!currentExists) {
        setActiveSessionId(nextSess._id || nextSess.id);
      }
      if (assistantMode === 'rag') {
        const docId = nextSess?.ragDocument?._id || (typeof nextSess?.ragDocument === 'string' ? nextSess.ragDocument : null);
        setSelectedDocId(docId || null);
      }
    } else {
      if (assistantMode === 'rag') {
        setSelectedDocId(null);
      }
    }
    if (assistantMode === 'rag') {
      fetchDocuments();
    }
  }, [assistantMode]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, activeSessionId]);

  // Filter sessions by mode for the sidebar
  const visibleSessions = sessions.filter(s => assistantMode === 'rag' ? s.mode === 'rag' : s.mode !== 'rag');
  const activeSession = sessions.find(s => (s._id || s.id) === activeSessionId) || visibleSessions[0];
  const selectedDoc = documents.find(d => d._id === selectedDocId);

  const startNewChat = async () => {
    try {
      if (assistantMode === 'rag') {
        // Fresh document chat with NO document pre-selected -> shows clean upload dropzone UI
        const res = await apiClient.post('/api/ai/sessions', {
          title: 'New Document Chat',
          modelPreference: selectedModel,
          mode: 'rag',
          ragDocument: null,
          messages: []
        });
        setSelectedDocId(null);
        setSessions(prev => [res.data, ...prev]);
        setActiveSessionId(res.data._id);
      } else {
        const res = await apiClient.post('/api/ai/sessions', {
          title: 'New Chat',
          modelPreference: selectedModel,
          mode: 'general',
          ragDocument: null,
          messages: []
        });
        setSessions(prev => [res.data, ...prev]);
        setActiveSessionId(res.data._id);
      }
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

  // Upload document handler
  const handleUploadDocument = async (file) => {
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext)) {
      return toast.error('Supported formats: .pdf, .docx, .txt, .md');
    }

    if (file.size > 25 * 1024 * 1024) {
      return toast.error('File size must be under 25MB');
    }

    setIsUploadingDoc(true);
    setUploadStep('Extracting text & chunking...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

    try {
      const stepTimer = setTimeout(() => {
        setUploadStep('Generating 768-dim embeddings with Gemini...');
      }, 1200);

      const res = await apiClient.post('/api/rag/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      clearTimeout(stepTimer);
      setUploadStep('Saving to MongoDB...');

      const uploadedDoc = res.data.document;
      const docTitle = uploadedDoc.title || uploadedDoc.originalName;

      toast.success(`"${docTitle}" embedded (${uploadedDoc.totalChunks} chunks)`);
      await fetchDocuments();
      setSelectedDocId(uploadedDoc._id);

      // Check if current active session is a RAG session with no messages yet
      const currentActive = sessions.find(s => (s._id || s.id) === activeSessionId && s.mode === 'rag');
      if (currentActive && (!currentActive.ragDocument || currentActive.messages.length === 0)) {
        await apiClient.put(`/api/ai/sessions/${currentActive._id || currentActive.id}`, {
          title: docTitle,
          ragDocument: uploadedDoc._id
        });
        setSessions(prev => prev.map(s => {
          if ((s._id || s.id) === (currentActive._id || currentActive.id)) {
            return {
              ...s,
              title: docTitle,
              ragDocument: uploadedDoc._id
            };
          }
          return s;
        }));
      } else {
        // Create new RAG session strictly named after the uploaded document
        const newSessionRes = await apiClient.post('/api/ai/sessions', {
          title: docTitle,
          modelPreference: selectedModel,
          mode: 'rag',
          ragDocument: uploadedDoc._id,
          messages: []
        });
        setSessions(prev => [newSessionRes.data, ...prev]);
        setActiveSessionId(newSessionRes.data._id);
      }
    } catch (err) {
      console.error('Upload document error:', err);
      toast.error(err.response?.data?.message || 'Failed to upload document');
    } finally {
      setIsUploadingDoc(false);
      setUploadStep('');
    }
  };

  // Handler for selecting document from selector or dropzone library picker
  const handleSelectDocument = async (docId) => {
    setSelectedDocId(docId);
    if (!docId) return;

    if (docId !== 'all') {
      const matched = documents.find(d => d._id === docId);
      const docTitle = matched?.title || matched?.originalName;

      const currentActive = sessions.find(s => (s._id || s.id) === activeSessionId && s.mode === 'rag');
      if (currentActive && (!currentActive.ragDocument || currentActive.messages.length === 0)) {
        try {
          await apiClient.put(`/api/ai/sessions/${currentActive._id || currentActive.id}`, {
            title: docTitle || currentActive.title,
            ragDocument: docId
          });
          setSessions(prev => prev.map(s => {
            if ((s._id || s.id) === (currentActive._id || currentActive.id)) {
              return {
                ...s,
                title: docTitle || s.title,
                ragDocument: docId
              };
            }
            return s;
          }));
        } catch (e) {
          console.error('Failed to link document to session:', e);
        }
      }
    }
  };

  // Delete document with cascade delete
  const handleDeleteDocument = async (docId, docTitle) => {
    const confirmDelete = window.confirm(
      `Permanently delete "${docTitle}"?\n\nThis will CASCADE DELETE:\n• The document record\n• All 768-dim vector embeddings & text chunks\n• All associated chat messages from MongoDB.`
    );
    if (!confirmDelete) return;

    setIsDeletingDoc(true);
    try {
      const res = await apiClient.delete(`/api/rag/documents/${docId}`);
      toast.success(res.data.message || 'Document, embeddings, and chat sessions cascade-deleted from MongoDB.');
      await fetchDocuments();
      if (selectedDocId === docId) {
        setSelectedDocId(null);
      }
      // Refresh sessions to remove any cascade deleted sessions
      await fetchSessions();
    } catch (err) {
      console.error('Delete document error:', err);
      toast.error(err.response?.data?.message || 'Failed to delete document');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // Clear RAG history
  const handleClearRagHistory = async () => {
    const confirmClear = window.confirm(
      'Clear Document RAG conversation history?\n\nThis will remove all RAG chat sessions from MongoDB.'
    );
    if (!confirmClear) return;

    try {
      await apiClient.post('/api/rag/clear-history', { documentId: selectedDocId });
      toast.success('RAG conversation history cleared');
      await fetchSessions();
    } catch (err) {
      toast.error('Failed to clear RAG history');
    }
  };

  const handleSendMessage = async (e, customPrompt = null) => {
    if (e) e.preventDefault();
    const promptToSend = customPrompt || message;
    if (!promptToSend.trim() || isLoading) return;

    // In RAG mode, require a document to be uploaded or selected
    if (assistantMode === 'rag') {
      if (!selectedDocId) {
        toast.error('Please upload or select a document for this chat first.', { icon: '📄' });
        return;
      }
    }

    const userMsg = { role: 'user', content: promptToSend, createdAt: new Date().toISOString() };
    
    let targetSessionId = activeSessionId;
    let currentHistory = [];

    const targetDoc = documents.find(d => d._id === selectedDocId);
    const sessionDocTitle = targetDoc ? (targetDoc.title || targetDoc.originalName) : 'Document Chat';

    if (!targetSessionId || !sessions.find(s => (s._id || s.id) === targetSessionId)) {
      try {
        const sessionTitle = assistantMode === 'rag'
          ? sessionDocTitle
          : promptToSend.slice(0, 24) + '...';

        const createRes = await apiClient.post('/api/ai/sessions', {
          title: sessionTitle,
          modelPreference: selectedModel,
          mode: assistantMode,
          ragDocument: (assistantMode === 'rag' && targetDoc) ? targetDoc._id : null,
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
          let sessionTitle = s.title;
          if (assistantMode === 'rag') {
            sessionTitle = sessionDocTitle;
          } else {
            if (s.messages.length === 0) {
              sessionTitle = promptToSend.slice(0, 24) + '...';
            }
          }

          return {
            ...s,
            messages: [...s.messages, userMsg],
            title: sessionTitle,
            ragDocument: s.ragDocument || (targetDoc ? targetDoc._id : null)
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
    }, 6000);

    const aiPlaceholderMsg = { 
      role: 'assistant', 
      content: '', 
      sources: [], 
      createdAt: new Date().toISOString() 
    };

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
      const apiBase = getApiBase();
      const endpoint = assistantMode === 'rag' ? `${apiBase}/api/rag/stream` : `${apiBase}/api/ai/stream`;
      
      const payload = assistantMode === 'rag' 
        ? {
            question: promptToSend,
            documentId: selectedDocId,
            sessionId: targetSessionId,
            model: 'gemini-3.5-flash-lite',
            history: currentHistory.slice(-4)
          }
        : {
            message: promptToSend,
            history: currentHistory.slice(-10),
            sessionId: targetSessionId,
            model: selectedModel
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
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
              } else if (parsed.type === 'sources') {
                attachSourcesToSession(targetSessionId, parsed.sources);
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
          mode: assistantMode,
          ragDocument: updatedSess.ragDocument || (selectedDocId !== 'all' ? selectedDocId : null),
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

  const attachSourcesToSession = (sessionId, sources) => {
    setSessions(prev => prev.map(s => {
      if ((s._id || s.id) === sessionId) {
        const msgs = [...s.messages];
        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
          msgs[msgs.length - 1] = {
            ...msgs[msgs.length - 1],
            sources: sources
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
          title: assistantMode === 'rag' ? 'New Document Chat' : 'New Chat',
          modelPreference: selectedModel,
          mode: assistantMode,
          ragDocument: null,
          messages: []
        });
        setSessions([createRes.data]);
        setActiveSessionId(createRes.data._id);
        setSelectedDocId(null);
      } else {
        setSessions(filtered);
        if (activeSessionId === id) {
          const nextSess = filtered.find(s => assistantMode === 'rag' ? s.mode === 'rag' : s.mode !== 'rag') || filtered[0];
          setActiveSessionId(nextSess ? (nextSess._id || nextSess.id) : null);
          if (assistantMode === 'rag') {
            const docId = nextSess?.ragDocument?._id || (typeof nextSess?.ragDocument === 'string' ? nextSess.ragDocument : null);
            setSelectedDocId(docId || null);
          }
        }
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
    let content = `# ${activeSession.title}\n\n*Exported from Talk Sphere AI Assistant (${assistantMode.toUpperCase()} Mode) on ${new Date().toLocaleString()}*\n\n---\n\n`;
    activeSession.messages.forEach(m => {
      const sender = m.role === 'user' ? '👤 User' : '🤖 AI Assistant';
      content += `### ${sender}\n${m.content}\n\n`;
      if (m.sources && m.sources.length > 0) {
        content += `> **Grounded Sources (${m.sources.length} chunks):**\n`;
        m.sources.forEach(src => {
          content += `> - ${src.documentTitle} (Chunk #${src.chunkIndex}, ${src.similarity || 0}% match): "${src.snippet}"\n`;
        });
        content += '\n';
      }
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
    <div className="glass-card flex h-full overflow-hidden shadow-2xl relative w-full border border-border-main font-sans min-w-0">
      {/* Background Depth Ambient Layer */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-28 -left-28 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-28 -right-28 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg-main/15 to-bg-main/50 pointer-events-none" />
      </div>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="md:hidden absolute inset-0 bg-black/75 z-20 backdrop-blur-sm transition-opacity" 
        />
      )}

      {/* Sidebar Drawer */}
      <motion.div 
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (typeof window !== 'undefined' && window.innerWidth < 640 ? '260px' : '290px') : '0px',
          opacity: isSidebarOpen ? 1 : 0
        }}
        className="bg-white/98 dark:bg-[#11131E]/98 backdrop-blur-2xl border-r border-slate-200 dark:border-white/10 flex flex-col overflow-hidden transition-all duration-300 z-30 absolute md:relative inset-y-0 left-0 h-full shadow-2xl md:shadow-none shrink-0"
      >
        <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              {assistantMode === 'rag' ? <BookOpen size={15} /> : <Sparkles size={15} />}
            </div>
            <h3 className="text-xs font-black tracking-wider uppercase text-slate-900 dark:text-white">
              {assistantMode === 'rag' ? 'RAG Q&A History' : 'Chat History'}
            </h3>
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
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/25 active:scale-95 cursor-pointer"
          >
            <Plus size={15} /> {assistantMode === 'rag' ? 'New Document Chat' : 'New Conversation'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {visibleSessions.length === 0 ? (
            <div className="text-center py-8 px-2 text-xs text-slate-500 dark:text-slate-400">
              No previous {assistantMode === 'rag' ? 'RAG' : 'chat'} sessions.
            </div>
          ) : (
            visibleSessions.map(s => {
              const sId = s._id || s.id;
              const isActive = activeSessionId === sId;

              // Dynamically resolve clean document title in RAG mode so it shows the uploaded PDF/file name
              let sessionTitle = s.title;
              if (s.mode === 'rag') {
                const sessionDocId = s.ragDocument?._id || (typeof s.ragDocument === 'string' ? s.ragDocument : null);
                const matchedDoc = sessionDocId ? documents.find(d => d._id === sessionDocId) : null;
                if (matchedDoc) {
                  sessionTitle = matchedDoc.title || matchedDoc.originalName;
                } else if (!sessionTitle || sessionTitle === 'Document Q&A' || sessionTitle === 'New Chat') {
                  sessionTitle = 'New Document Chat';
                }
              }

              return (
                <div 
                  key={sId}
                  onClick={() => {
                    setActiveSessionId(sId);
                    if (s.mode === 'rag') {
                      const docId = s.ragDocument?._id || (typeof s.ragDocument === 'string' ? s.ragDocument : null);
                      setSelectedDocId(docId || null);
                    }
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`p-3 rounded-xl cursor-pointer group transition-all border ${
                      isActive 
                        ? 'bg-violet-500/15 border-violet-500/40 text-violet-600 dark:text-violet-300 font-bold shadow-sm' 
                        : 'bg-slate-50/80 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 truncate">
                      {s.mode === 'rag' ? (
                        <FileText size={14} className={isActive ? 'text-violet-500 dark:text-violet-400 shrink-0' : 'text-slate-400 dark:text-slate-500 shrink-0'} />
                      ) : (
                        <MessageSquare size={14} className={isActive ? 'text-violet-500 dark:text-violet-400 shrink-0' : 'text-slate-400 dark:text-slate-500 shrink-0'} />
                      )}
                      <span className="text-xs truncate">{sessionTitle}</span>
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
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-white/10 space-y-2">
          {assistantMode === 'rag' && (
            <button
              onClick={handleClearRagHistory}
              className="w-full flex items-center justify-center gap-2 py-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-semibold rounded-xl border border-red-500/20 transition-all cursor-pointer"
            >
              <Trash2 size={13} /> Clear RAG History
            </button>
          )}

          <button
            onClick={exportChatSession}
            className="w-full flex items-center justify-center gap-2 py-2 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white text-xs font-semibold bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-violet-500/40 transition-all cursor-pointer"
          >
            <Download size={13} /> Export Session (.md)
          </button>
        </div>
      </motion.div>

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col bg-transparent relative z-10 min-w-0 h-full overflow-hidden">
        
        {/* Header Bar with Mode Switcher & Model Controls */}
        <div className="p-2.5 sm:p-4 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between bg-white/95 dark:bg-[#11131E]/95 backdrop-blur-xl gap-2 sm:gap-3 min-w-0 shrink-0">
          
          {/* Left Title & Status */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 sm:p-2.5 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-200 hover:text-violet-400 hover:border-violet-500/40 shadow-sm transition-all shrink-0 cursor-pointer active:scale-95"
              title="Toggle History"
            >
              <History size={16} />
            </button>
            
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
              {assistantMode === 'rag' ? (
                <BookOpen size={17} className="text-violet-400 animate-pulse" />
              ) : (
                <Sparkles size={17} className="text-violet-400 animate-pulse" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                {assistantMode === 'rag' 
                  ? (selectedDoc ? (selectedDoc.title || selectedDoc.originalName) : (activeSession?.title || 'New Document Chat')) 
                  : (activeSession?.title || 'New Chat')}
              </h4>
            </div>
          </div>

          {/* Right Controls: Mode Switcher & Model Select */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Mode Switcher Pill */}
            <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-[#161826] border border-slate-200 dark:border-white/10 rounded-xl shadow-inner">
              <button
                type="button"
                onClick={() => setAssistantMode('general')}
                className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  assistantMode === 'general'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
                title="General AI Conversational Assistant"
              >
                <span>💬</span>
                <span className="hidden sm:inline">General Chat</span>
                <span className="sm:hidden">Chat</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAssistantMode('rag');
                  fetchDocuments();
                }}
                className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                  assistantMode === 'rag'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                }`}
                title="Document RAG Grounded Q&A"
              >
                <span>📄</span>
                <span className="hidden sm:inline">Document RAG Mode</span>
                <span className="sm:hidden">RAG</span>
              </button>
            </div>

            {activeSession?.messages?.length > 0 && (
              <button
                onClick={regenerateResponse}
                disabled={isLoading}
                className="p-1.5 sm:p-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-700 dark:text-slate-200 hover:text-violet-400 hover:border-violet-500/40 shadow-sm transition-all cursor-pointer disabled:opacity-40 shrink-0 active:scale-95"
                title="Regenerate Last Response"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>

        {/* In RAG Mode: Document Toolbar with Selector & Upload */}
        {assistantMode === 'rag' && (
          <RagDocumentSelector
            documents={documents}
            selectedDocId={selectedDocId}
            onSelectDoc={handleSelectDocument}
            onUploadFile={handleUploadDocument}
            onDeleteCurrentDoc={handleDeleteDocument}
            onOpenManageModal={() => setIsManageModalOpen(true)}
            isUploading={isUploadingDoc}
            uploadStep={uploadStep}
          />
        )}

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
            assistantMode === 'rag' ? (
              <RagDropzoneView
                documents={documents}
                selectedDoc={selectedDoc}
                onUploadFile={handleUploadDocument}
                onSelectDoc={handleSelectDocument}
                onSelectPrompt={(p) => {
                  setMessage(p);
                  document.getElementById('ai-message-input')?.focus();
                }}
                isUploading={isUploadingDoc}
              />
            ) : (
              <div className="flex flex-col items-center justify-center min-h-full py-8 px-2 sm:px-4 max-w-2xl mx-auto my-auto text-center font-sans">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/15">
                  <Sparkles size={26} className="text-violet-400" />
                </div>
                
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                  How can I assist you today?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6 sm:mb-8 leading-relaxed max-w-md font-medium">
                  Ask questions, inspect code, draft documents, or compare concepts in real-time.
                </p>

                {/* 2x2 Quick Action Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
                  {PRESET_PROMPTS.map((p, idx) => {
                    const Icon = p.icon;
                    return (
                      <motion.button
                        key={idx}
                        whileHover={{ y: -3, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setMessage(p.prompt + ' ');
                          document.getElementById('ai-message-input')?.focus();
                        }}
                        className="p-4 bg-white dark:bg-[#161826] hover:bg-slate-50 dark:hover:bg-[#1d2033] border border-slate-200 dark:border-white/10 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 rounded-2xl text-left transition-all duration-300 group cursor-pointer flex items-start gap-3.5 shadow-sm"
                      >
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:border-violet-500/50 group-hover:scale-105 shrink-0 transition-all">
                          <Icon size={18} className="text-violet-400 transition-colors" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-400 transition-colors mb-0.5">
                            {p.label}
                          </div>
                          <div className="text-xs font-normal text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                            {p.prompt}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )
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
                    className={`flex items-start gap-2.5 sm:gap-3 ${isUser ? 'justify-end' : 'justify-start'} min-w-0 font-sans`}
                  >
                    {/* Bot Avatar Icon */}
                    {!isUser && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-indigo-600 p-[1px] shrink-0 shadow-md shadow-indigo-500/25 mt-1">
                        <div className="w-full h-full bg-[#090A0F] rounded-[11px] flex items-center justify-center">
                          {assistantMode === 'rag' ? (
                            <BookOpen size={14} className="text-violet-400" />
                          ) : (
                            <Bot size={15} className="text-violet-400" />
                          )}
                        </div>
                      </div>
                    )}

                    <div className={`max-w-[95%] sm:max-w-[88%] lg:max-w-[85%] flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
                      <div className={`p-4 sm:p-5 rounded-2xl shadow-lg leading-relaxed min-w-0 overflow-hidden break-words [word-break:break-word] ${
                        isUser 
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-tr-xs shadow-indigo-500/20 text-xs sm:text-sm font-medium' 
                          : 'bg-white dark:bg-[#161826] text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200/90 dark:border-white/10 shadow-black/5 dark:shadow-black/35 text-xs sm:text-sm font-normal'
                      }`}>
                        <div className="markdown-container max-w-none break-words [word-break:break-word] overflow-hidden text-xs sm:text-sm">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ node, ...props }) => (
                                <a {...props} target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:underline font-semibold break-all" />
                              ),
                              h1: ({ node, ...props }) => (
                                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white mt-4 mb-2 tracking-tight" {...props} />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2 className="text-sm sm:text-base font-bold text-violet-600 dark:text-violet-300 mt-3.5 mb-2 tracking-tight" {...props} />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 mt-3 mb-1.5" {...props} />
                              ),
                              p: ({ node, ...props }) => (
                                <p className="mb-3 last:mb-0 leading-relaxed text-xs sm:text-sm text-slate-800 dark:text-slate-200 font-normal" {...props} />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul className="list-disc pl-5 my-2.5 space-y-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200" {...props} />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol className="list-decimal pl-5 my-2.5 space-y-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200" {...props} />
                              ),
                              li: ({ node, ...props }) => (
                                <li className="leading-relaxed" {...props} />
                              ),
                              strong: ({ node, ...props }) => (
                                <strong className="font-bold text-slate-950 dark:text-white" {...props} />
                              ),
                              blockquote: ({ node, ...props }) => (
                                <blockquote className="border-l-3 border-violet-500 pl-3.5 py-1.5 my-3 bg-violet-500/10 rounded-r-xl italic text-xs sm:text-sm text-slate-700 dark:text-slate-300" {...props} />
                              ),
                              table: ({ node, ...props }) => (
                                <div className="my-3.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#11131E]/95 shadow-md custom-scrollbar max-w-full">
                                  <table className="w-full text-left border-collapse min-w-[500px]" {...props} />
                                </div>
                              ),
                              thead: ({ node, ...props }) => (
                                <thead className="bg-slate-100/90 dark:bg-violet-950/40 border-b border-slate-200 dark:border-white/10" {...props} />
                              ),
                              tbody: ({ node, ...props }) => (
                                <tbody className="divide-y divide-slate-200/70 dark:divide-white/5" {...props} />
                              ),
                              tr: ({ node, ...props }) => (
                                <tr className="transition-colors hover:bg-violet-500/5 dark:hover:bg-white/[0.03] even:bg-white/40 dark:even:bg-white/[0.015]" {...props} />
                              ),
                              th: ({ node, ...props }) => (
                                <th className="px-4 py-3 text-[11px] sm:text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wider border-r border-slate-200/70 dark:border-white/5 last:border-r-0 whitespace-nowrap" {...props} />
                              ),
                              td: ({ node, ...props }) => (
                                <td className="px-4 py-2.5 text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed align-top border-r border-slate-200/70 dark:border-white/5 last:border-r-0 font-normal" {...props} />
                              ),
                              code: ({ node, inline, className, children, ...props }) => {
                                const match = /language-(\w+)/.exec(className || '');
                                const codeString = String(children).replace(/\n$/, '');
                                const isMultiLine = codeString.includes('\n');
                                if (!inline && (match || isMultiLine)) {
                                  return (
                                    <div className="my-3.5 rounded-2xl border border-slate-700/60 dark:border-white/10 bg-[#0c0d16] dark:bg-[#0a0b12] overflow-hidden shadow-xl text-left">
                                      <div className="flex items-center justify-between px-3.5 py-2 bg-[#12131C] dark:bg-[#12131F] border-b border-slate-700/50 dark:border-white/[0.08] text-[11px] font-mono font-bold text-slate-300">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80 inline-block" />
                                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80 inline-block" />
                                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80 inline-block" />
                                          <span className="ml-1 uppercase text-violet-400 text-[10px] tracking-wider font-semibold">{match ? match[1] : 'CODE'}</span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(codeString, `code-${i}`)}
                                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-indigo-600 hover:text-white text-slate-200 text-[11px] font-sans font-bold transition-all cursor-pointer active:scale-95 shadow-sm"
                                        >
                                          {copiedIndex === `code-${i}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                          <span>{copiedIndex === `code-${i}` ? 'COPIED' : 'COPY'}</span>
                                        </button>
                                      </div>
                                      <pre className="p-4 text-xs sm:text-[13px] font-mono overflow-x-auto custom-scrollbar text-violet-200 leading-relaxed font-normal m-0 border-0 bg-transparent">
                                        <code>{codeString}</code>
                                      </pre>
                                    </div>
                                  );
                                }
                                return (
                                  <code className="px-1.5 py-0.5 rounded-md bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/25 font-mono text-xs font-semibold" {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>

                        {/* Grounded Document Citations (For RAG messages) */}
                        {!isUser && msg.sources && msg.sources.length > 0 && (
                          <RagSourcesCard sources={msg.sources} />
                        )}

                        {/* Action Bar for AI Messages */}
                        {!isUser && msg.content && (
                          <div className="flex items-center justify-between gap-3 mt-3.5 pt-2.5 border-t border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => copyToClipboard(msg.content, i)}
                                className="flex items-center gap-1.5 hover:text-violet-400 transition-colors cursor-pointer"
                                title="Copy Answer"
                              >
                                {copiedIndex === i ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                <span>{copiedIndex === i ? 'Copied' : 'Copy'}</span>
                              </button>

                              <button
                                onClick={() => speakText(msg.content, i)}
                                className="flex items-center gap-1.5 hover:text-violet-400 transition-colors cursor-pointer"
                                title="Read Aloud"
                              >
                                {speakingIndex === i ? <VolumeX size={13} className="text-red-500" /> : <Volume2 size={13} />}
                                <span>{speakingIndex === i ? 'Stop' : 'Listen'}</span>
                              </button>
                            </div>

                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
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
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                {assistantMode === 'rag' ? (
                  <BookOpen size={15} className="text-violet-400 animate-spin" />
                ) : (
                  <Bot size={15} className="text-violet-400" />
                )}
              </div>
              <div className="bg-white dark:bg-[#161826] border border-slate-200/90 dark:border-white/10 p-3 sm:p-4 rounded-2xl rounded-tl-xs flex items-center gap-3 shadow-md">
                 <div className="flex gap-1.5">
                   <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce"></div>
                   <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                   <div className="w-2 h-2 bg-violet-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                 </div>
                 <span className="text-xs font-bold text-violet-600 dark:text-violet-300">
                   {assistantMode === 'rag' ? 'Retrieving vector chunks & generating answer...' : 'Generating response...'}
                 </span>
              </div>
            </motion.div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Form Bar */}
        <form onSubmit={handleSendMessage} className="p-2.5 sm:p-4 bg-white/95 dark:bg-[#11131E]/95 border-t border-slate-200 dark:border-white/10 backdrop-blur-xl shrink-0">
          <div className="flex gap-2 items-center bg-slate-50 dark:bg-[#161826] border border-slate-200 dark:border-white/10 rounded-2xl p-1.5 shadow-lg focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 transition-all duration-300">
            <input 
              id="ai-message-input"
              name="ai-message"
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                assistantMode === 'rag'
                  ? (selectedDoc 
                      ? `Ask grounded question about "${selectedDoc.title || selectedDoc.originalName}"...` 
                      : (documents.length > 0 ? "Ask a grounded question across uploaded documents..." : "Upload a document above to begin grounded Q&A..."))
                  : "Ask anything or request code analysis..."
              }
              aria-label="AI message input"
              disabled={isLoading || (assistantMode === 'rag' && documents.length === 0)}
              className="flex-1 bg-transparent px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none disabled:opacity-50 min-w-0"
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
                disabled={!message.trim() || (assistantMode === 'rag' && documents.length === 0)}
                className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl text-white shadow-md shadow-indigo-500/25 flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-30 shrink-0 cursor-pointer"
                title="Send message"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* RAG Documents Manager Modal */}
      <RagDocumentsModal
        isOpen={isManageModalOpen}
        onClose={() => setIsManageModalOpen(false)}
        documents={documents}
        onDeleteDocument={handleDeleteDocument}
        onUploadClick={() => {
          document.querySelector('input[type="file"]')?.click();
        }}
        isDeleting={isDeletingDoc}
      />
    </div>
  );
};

export default AIChatSection;
