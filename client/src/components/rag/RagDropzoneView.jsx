import React, { useState } from 'react';
import { 
  UploadCloud, FileText, Sparkles, BookOpen, 
  HelpCircle, CheckCircle, Database, Layers, ArrowRight,
  FolderOpen, ArrowUpRight
} from 'lucide-react';
import { motion } from 'framer-motion';

const RAG_SUGGESTED_QUESTIONS = [
  {
    icon: BookOpen,
    label: 'Executive Summary',
    prompt: 'Please provide a comprehensive summary of this document, highlighting the key objectives, findings, and conclusions.'
  },
  {
    icon: HelpCircle,
    label: 'Key Action Items',
    prompt: 'Extract all action items, milestones, deadlines, and responsible parties mentioned in the document.'
  },
  {
    icon: Layers,
    label: 'Core Topics & Structure',
    prompt: 'Outline the main topics and structural themes covered in this document with bulleted breakdowns.'
  },
  {
    icon: Sparkles,
    label: 'Risks & Limitations',
    prompt: 'What potential risks, limitations, caveats, or challenges are discussed in the uploaded text?'
  }
];

const RagDropzoneView = ({
  documents = [],
  selectedDoc = null,
  onUploadFile,
  onSelectDoc,
  onSelectPrompt,
  isUploading = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedExistingId, setSelectedExistingId] = useState(documents[0]?._id || '');

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && onUploadFile) {
      onUploadFile(file);
    }
  };

  // If no document is selected for this chat, show the clean upload dropzone UI
  if (!selectedDoc) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full py-8 px-4 max-w-2xl mx-auto my-auto text-center font-sans space-y-6">
        {/* Main Upload Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full p-8 sm:p-12 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center ${
            isDragOver
              ? 'border-violet-500 bg-violet-500/15 scale-[1.01]'
              : 'border-slate-300 dark:border-white/15 bg-white/60 dark:bg-[#161826]/70 hover:border-violet-500/40'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-4 text-violet-400 shadow-xl shadow-indigo-500/10">
            <UploadCloud size={32} />
          </div>

          <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-2">
            Upload Knowledge Document
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-md font-medium leading-relaxed">
            Drop your file here to start asking questions directly from your document.
          </p>

          {/* Formats Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/30">
              .PDF
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-500/30">
              .DOCX
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/30">
              .TXT
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/30">
              .MD
            </span>
          </div>

          <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all active:scale-95">
            <UploadCloud size={16} />
            <span>Browse Files</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt,.md"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && onUploadFile) onUploadFile(file);
              }}
              className="hidden"
            />
          </label>

          {/* Highlights Checklist */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10 w-full flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle size={13} className="text-emerald-500" />
              Smart Semantic Search
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={13} className="text-emerald-500" />
              Direct Exact Answers
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle size={13} className="text-emerald-500" />
              Source Citations Included
            </span>
          </div>
        </div>

        {/* Optional Secondary Option: Pick from Existing Documents in Library */}
        {documents.length > 0 && onSelectDoc && (
          <div className="w-full p-4 rounded-2xl bg-slate-50/80 dark:bg-[#161826]/40 border border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300">
              <FolderOpen size={16} className="text-violet-400 shrink-0" />
              <span>Or link an existing document from your library:</span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedExistingId}
                onChange={(e) => setSelectedExistingId(e.target.value)}
                className="bg-white dark:bg-[#1f2238] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none cursor-pointer flex-1 sm:max-w-[200px] truncate"
              >
                {documents.map(d => (
                  <option key={d._id} value={d._id}>
                    {d.title || d.originalName} ({d.fileType.toUpperCase()})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  if (selectedExistingId) onSelectDoc(selectedExistingId);
                }}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
              >
                Use Document
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Document is selected: show document overview and quick questions
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-6 px-4 max-w-2xl mx-auto my-auto text-center font-sans">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 border border-violet-500/30 flex items-center justify-center mb-3 text-violet-400 shadow-xl shadow-indigo-500/10">
        <FileText size={28} />
      </div>

      <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mb-1">
        Ask about "{selectedDoc.title || selectedDoc.originalName}"
      </h3>
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-6 max-w-md font-medium leading-relaxed">
        Indexed into {selectedDoc.totalChunks || 0} sections. Ask any question about this document below.
      </p>

      {/* Suggested RAG Questions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {RAG_SUGGESTED_QUESTIONS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={idx}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelectPrompt && onSelectPrompt(item.prompt)}
              className="p-3.5 bg-white dark:bg-[#161826] hover:bg-slate-50 dark:hover:bg-[#1d2033] border border-slate-200 dark:border-white/10 hover:border-violet-500/50 rounded-2xl text-left transition-all duration-300 group cursor-pointer flex items-start gap-3 shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center group-hover:border-violet-500/50 group-hover:scale-105 shrink-0 transition-all text-violet-400">
                <Icon size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-violet-400 transition-colors mb-0.5 flex items-center justify-between">
                  <span>{item.label}</span>
                  <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-violet-500" />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed font-normal">
                  {item.prompt}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default RagDropzoneView;
