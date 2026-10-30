import React from 'react';
import { X, FileText, Trash2, Calendar, Database, UploadCloud, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'pdf': return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
    case 'docx': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
    case 'txt': return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
    case 'md': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
    default: return 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/30';
  }
};

const RagDocumentsModal = ({
  isOpen,
  onClose,
  documents = [],
  onDeleteDocument,
  onUploadClick,
  isDeleting
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white dark:bg-[#141624] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Database size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                RAG Document Knowledge Base
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Documents & 768-dim embeddings stored permanently in MongoDB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Documents List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
          {documents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                <FileText size={28} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                No Documents Uploaded Yet
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                Upload `.pdf`, `.docx`, `.txt`, or `.md` files to embed them into your personalized knowledge base.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onUploadClick();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
              >
                <UploadCloud size={15} /> Upload First Document
              </button>
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc._id}
                className="p-3.5 sm:p-4 rounded-xl bg-slate-50 dark:bg-[#191b2e] border border-slate-200/90 dark:border-white/5 flex items-center justify-between gap-3 transition-all hover:border-violet-500/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                    <FileText size={18} className="text-violet-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {doc.title || doc.originalName}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getFileTypeColor(
                          doc.fileType
                        )}`}
                      >
                        {doc.fileType}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                      <span>{formatBytes(doc.fileSize)}</span>
                      <span>•</span>
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {doc.totalChunks || 0} chunks (768-dim)
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} />
                        {new Date(doc.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDeleteDocument(doc._id, doc.title || doc.originalName)}
                  disabled={isDeleting}
                  className="p-2 hover:bg-red-500/15 rounded-xl text-slate-400 hover:text-red-500 dark:hover:text-red-400 border border-transparent hover:border-red-500/30 transition-all cursor-pointer shrink-0 disabled:opacity-40"
                  title="Cascade Delete Document, Chunks & Chats"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Modal Footer with Warning Banner */}
        <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-[#10121d] border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <AlertCircle size={14} className="text-amber-500 shrink-0" />
            <span>Deleting a document cascade-removes its vectors, chunks, and linked chats.</span>
          </div>
          <button
            onClick={() => {
              onClose();
              onUploadClick();
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
          >
            <UploadCloud size={14} /> Upload New Document
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default RagDocumentsModal;

