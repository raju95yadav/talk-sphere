import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Calendar, Loader2, X, FileText, Share2, User } from 'lucide-react';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import useSocket from '../hooks/useSocket';
import { motion, AnimatePresence } from 'framer-motion';

const NoteSection = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const { token } = useAuth();
  const socket = useSocket();

  // Edit note states
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', content: '' });

  // Share note states
  const [sharingNote, setSharingNote] = useState(null);
  const [shareSearch, setShareSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);

  const fetchNotes = async () => {
    try {
      const res = await apiClient.get('/api/notes');
      setNotes(res.data);
    } catch (err) {
      toast.error('Failed to fetch notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchNotes();
  }, [token]);

  // Setup real-time note sync listeners
  useEffect(() => {
    if (socket) {
      socket.on('note_created', (newNoteObj) => {
        setNotes(prev => {
          if (prev.some(n => n._id === newNoteObj._id)) return prev;
          return [newNoteObj, ...prev];
        });
      });

      socket.on('note_updated', (updatedNoteObj) => {
        setNotes(prev => prev.map(n => n._id === updatedNoteObj._id ? updatedNoteObj : n));
      });

      socket.on('note_deleted', (deletedNoteId) => {
        setNotes(prev => prev.filter(n => n._id !== deletedNoteId));
      });
    }

    return () => {
      if (socket) {
        socket.off('note_created');
        socket.off('note_updated');
        socket.off('note_deleted');
      }
    };
  }, [socket]);

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.title) return;

    try {
      const res = await apiClient.post('/api/notes', newNote);
      setNotes([res.data, ...notes]);
      setNewNote({ title: '', content: '' });
      setIsAdding(false);
      toast.success('Note archived');
    } catch (err) {
      toast.error('Failed to save note');
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      await apiClient.delete(`/api/notes/${id}`);
      setNotes(notes.filter(n => n._id !== id));
      toast.success('Note deleted');
    } catch (err) {
      toast.error('Failed to delete note');
    }
  };

  const handleStartEdit = (note) => {
    setEditingNoteId(note._id);
    setEditForm({ title: note.title, content: note.content });
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditForm({ title: '', content: '' });
  };

  const handleSaveEdit = async (id) => {
    if (!editForm.title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      const res = await apiClient.put(`/api/notes/${id}`, editForm);
      setNotes(notes.map(n => n._id === id ? res.data : n));
      setEditingNoteId(null);
      toast.success('Note updated');
    } catch (err) {
      toast.error('Failed to update note');
    }
  };

  const handleStartShare = (note) => {
    setSharingNote(note);
    setShareSearch('');
    setUsers([]);
    setShareLoading(false);
  };

  const handleShareSearchChange = async (val) => {
    setShareSearch(val);
    if (!val || !val.trim()) {
      setUsers([]);
      return;
    }
    setShareLoading(true);
    try {
      const res = await apiClient.get(`/api/users?search=${encodeURIComponent(val.trim())}`);
      setUsers(res.data);
    } catch (err) {
      console.error('Share search failed');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCancelShare = () => {
    setSharingNote(null);
    setUsers([]);
  };

  const handleShareNote = async (noteId, targetUserId, targetUserName) => {
    try {
      await apiClient.post(`/api/notes/share/${noteId}`, { targetUserId });
      toast.success(`Note shared with ${targetUserName}`);
      handleCancelShare();
    } catch (err) {
      toast.error('Failed to share note');
    }
  };

  const filteredUsers = users;

  return (
    <div className="glass-card flex flex-col h-full overflow-hidden p-6 relative">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent-secondary/20 rounded-lg text-accent-secondary">
             <FileText size={18} />
          </div>
          <h3 className="text-sm font-black uppercase tracking-[0.2em]">Archived Notes</h3>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className={`p-2 rounded-lg transition-all ${isAdding ? 'dark:bg-white/10 bg-black/10 dark:text-white text-text-main' : 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20'}`}
        >
          {isAdding ? <X size={18} /> : <Plus size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAddNote} 
            className="mb-6 space-y-4 bg-bg-card-secondary p-4 rounded-2xl border border-border-main overflow-hidden"
          >
            <input 
              type="text" 
              placeholder="NOTE TITLE" 
              value={newNote.title} 
              onChange={(e) => setNewNote({...newNote, title: e.target.value})} 
              className="w-full bg-transparent border-b border-border-main py-2 text-text-main focus:border-accent-primary outline-none transition-all text-xs font-bold uppercase tracking-wider" 
              autoFocus 
            />
            <textarea 
              placeholder="CONTENT BODY"
              value={newNote.content}
              onChange={(e) => setNewNote({...newNote, content: e.target.value})}
              className="w-full bg-transparent text-text-muted text-xs resize-none h-20 outline-none"
            />
            <div className="flex justify-end gap-3">
              <button type="submit" className="bg-text-main text-bg-main text-[10px] font-black px-4 py-2 rounded-lg uppercase tracking-widest hover:bg-accent-primary hover:text-white transition-all">
                ARCHIVE NOTE
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin text-accent-primary" /></div>
        ) : notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 opacity-30">
             <FileText size={40} className="mb-2" />
             <p className="text-[10px] font-bold uppercase tracking-widest">No active notes</p>
          </div>
        ) : (
          notes.map((note) => (
            <motion.div 
              layout
              key={note._id} 
              className={`flex flex-col p-4 rounded-2xl bg-bg-card-secondary transition-all border ${editingNoteId === note._id ? 'border-accent-primary' : 'border-border-main group dark:hover:bg-white/5 hover:bg-bg-card'}`}
            >
              {editingNoteId === note._id ? (
                <div className="space-y-3">
                  <input 
                    type="text" 
                    value={editForm.title} 
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    className="w-full bg-transparent border-b border-border-main py-1.5 text-text-main focus:border-accent-primary outline-none text-xs font-bold uppercase tracking-wider" 
                    placeholder="EDIT NOTE TITLE"
                    autoFocus
                  />
                  <textarea 
                    value={editForm.content} 
                    onChange={(e) => setEditForm({...editForm, content: e.target.value})}
                    className="w-full bg-transparent text-text-muted text-xs resize-none h-16 outline-none py-1 border-b border-border-main/50"
                    placeholder="EDIT CONTENT BODY"
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={handleCancelEdit} 
                      className="px-3 py-1.5 rounded-lg bg-bg-card-secondary dark:hover:bg-white/10 hover:bg-black/5 text-text-main border border-border-main transition-all text-[9px] font-black uppercase tracking-widest"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={() => handleSaveEdit(note._id)} 
                      className="px-3 py-1.5 rounded-lg bg-accent-primary text-white hover:bg-accent-primary/80 transition-all text-[9px] font-black uppercase tracking-widest shadow shadow-accent-primary/20"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs uppercase tracking-wider truncate mr-4">{note.title}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => handleStartShare(note)} className="p-1.5 dark:hover:bg-white/10 hover:bg-black/5 rounded text-text-muted hover:text-text-main transition-colors" title="Share Note"><Share2 size={14} /></button>
                      <button onClick={() => handleStartEdit(note)} className="p-1.5 dark:hover:bg-white/10 hover:bg-black/5 rounded text-text-muted hover:text-text-main transition-colors" title="Edit Note"><Edit3 size={14} /></button>
                      <button onClick={() => handleDeleteNote(note._id)} className="p-1.5 hover:bg-red-500/20 rounded text-text-muted hover:text-red-500 transition-colors" title="Delete Note"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {note.content && <p className="text-[10px] text-text-muted line-clamp-2 leading-relaxed">{note.content}</p>}
                  <div className="mt-3 flex items-center gap-2 text-[8px] text-text-muted/50 font-bold uppercase tracking-widest">
                    <Calendar size={10} />
                    {new Date(note.createdAt).toLocaleDateString()}
                  </div>
                </>
              )}
            </motion.div>
          ))
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-border-main flex justify-between items-center text-[9px] text-text-muted font-black uppercase tracking-[0.2em]">
        <span>SYSTEM LOG</span>
        <span className="text-accent-primary">{notes.length} RECORDS</span>
      </div>

      {/* Share Overlay */}
      <AnimatePresence>
        {sharingNote && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-bg-main/95 backdrop-blur-md z-30 p-6 flex flex-col"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex flex-col">
                <h4 className="text-xs font-black uppercase tracking-widest text-text-main">Share Note</h4>
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider truncate max-w-[200px] mt-0.5">"{sharingNote.title}"</p>
              </div>
              <button 
                onClick={handleCancelShare} 
                className="p-1.5 dark:hover:bg-white/10 hover:bg-black/5 rounded-lg text-text-muted hover:text-text-main transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <input 
              type="text" 
              placeholder="ENTER EXACT USERNAME OR GMAIL..."
              value={shareSearch}
              onChange={(e) => handleShareSearchChange(e.target.value)}
              className="w-full bg-bg-card-secondary border border-border-main rounded-xl px-4 py-2 text-xs text-text-main placeholder-text-muted focus:border-accent-primary outline-none transition-all uppercase tracking-wider font-bold mb-4"
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {shareLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-accent-primary" /></div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-30">
                  <User size={24} className="mb-1" />
                  <p className="text-[9px] font-bold uppercase tracking-widest">No users found</p>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => handleShareNote(sharingNote._id, u._id, u.name || u.username)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl dark:hover:bg-white/5 hover:bg-black/5 border border-transparent hover:border-border-main transition-all text-left group"
                  >
                    <div className="w-8 h-8 rounded-full bg-accent-primary/20 border border-border-main overflow-hidden flex items-center justify-center flex-shrink-0">
                      {u.avatar ? (
                        <img src={u.avatar} className="w-full h-full object-cover" alt="avatar" />
                      ) : (
                        <User size={14} className="text-accent-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-text-main uppercase tracking-wider truncate">{u.name || u.username}</p>
                      <p className="text-[8px] text-text-muted uppercase tracking-widest font-semibold truncate">@{u.username || 'user'}</p>
                    </div>
                    <span className="text-[8px] font-black uppercase bg-accent-primary/10 text-accent-primary px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all tracking-widest text-center">SHARE</span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NoteSection;
