import React, { useRef } from 'react';
import { 
  FileText, UploadCloud, Trash2, FolderOpen, 
  Loader2, CheckCircle, Database, Sparkles, ChevronDown 
} from 'lucide-react';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const RagDocumentSelector = ({
  documents = [],
  selectedDocId = 'all',
  onSelectDoc,
  onUploadFile,
  onDeleteCurrentDoc,
  onOpenManageModal,
  isUploading = false,
  uploadStep = ''
}) => {
  const fileInputRef = useRef(null);

  const selectedDoc = documents.find(d => d._id === selectedDocId);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file);
      e.target.value = ''; // Reset for next selection
    }
  };

  return (
    <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-slate-50/90 dark:bg-[#131522]/90 border-b border-slate-200 dark:border-white/10 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.md"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Left: Document Selector & Manage */}
      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
        <div className="relative flex-1 max-w-xs sm:max-w-md">
          <select
            value={selectedDocId}
            onChange={(e) => onSelectDoc(e.target.value)}
            disabled={isUploading}
            aria-label="Select RAG Document"
            className="w-full bg-white dark:bg-[#1a1c2e] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 hover:border-violet-500/50 rounded-xl pl-8 pr-8 py-1.5 text-xs font-bold outline-none cursor-pointer appearance-none truncate shadow-sm transition-all focus:border-violet-500"
          >
            <option value="all">
              📚 All Uploaded Documents ({documents.length})
            </option>
            {documents.map(d => (
              <option key={d._id} value={d._id}>
                📄 {d.title || d.originalName} ({d.fileType.toUpperCase()} • {d.totalChunks || 0} chunks)
              </option>
            ))}
          </select>
          <FileText size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        </div>

        <button
          type="button"
          onClick={onOpenManageModal}
          className="p-1.5 sm:px-2.5 sm:py-1.5 bg-white dark:bg-[#1a1c2e] border border-slate-200 dark:border-white/10 hover:border-violet-500/40 rounded-xl text-slate-700 dark:text-slate-300 hover:text-violet-500 dark:hover:text-violet-400 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
          title="Manage Knowledge Documents"
        >
          <FolderOpen size={14} />
          <span className="hidden sm:inline">Docs ({documents.length})</span>
        </button>

        {selectedDoc && (
          <button
            type="button"
            onClick={() => onDeleteCurrentDoc(selectedDoc._id, selectedDoc.title || selectedDoc.originalName)}
            disabled={isUploading}
            className="p-1.5 sm:p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
            title="Delete Selected Document & Cascade Chunks"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Right: Upload Button & Status Badges */}
      <div className="flex items-center gap-2 shrink-0">
        {isUploading ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl text-xs font-semibold text-violet-600 dark:text-violet-400">
            <Loader2 size={14} className="animate-spin text-violet-500" />
            <span className="text-[11px] font-mono">{uploadStep || 'Processing document...'}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer active:scale-95"
            title="Upload Document (.pdf, .docx, .txt, .md)"
          >
            <UploadCloud size={14} />
            <span>Upload Document</span>
          </button>
        )}

        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-200/60 dark:bg-white/5 border border-slate-300/60 dark:border-white/10 rounded-xl text-[10px] font-mono text-slate-600 dark:text-slate-400">
          <Database size={11} className="text-violet-400" />
          <span>768-dim MongoDB</span>
        </div>
      </div>
    </div>
  );
};

export default RagDocumentSelector;

