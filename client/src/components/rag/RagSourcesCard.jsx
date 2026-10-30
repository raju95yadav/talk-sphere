import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, FileText, CheckCircle2, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Renders the grounded sources and citations retrieved from MongoDB chunks
 */
const RagSourcesCard = ({ sources = [] }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-white/10">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full p-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/15 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-bold transition-all cursor-pointer group"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-violet-500 dark:text-violet-400 group-hover:scale-110 transition-transform" />
          <span>Grounded Sources & Citations</span>
          <span className="px-1.5 py-0.2 rounded-md bg-violet-500/20 text-[10px] font-mono">
            {sources.length} {sources.length === 1 ? 'chunk' : 'chunks'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
          <span>{isOpen ? 'Hide citations' : 'View cited context'}</span>
          {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2.5 space-y-2">
              {sources.map((src, idx) => {
                const similarityScore = src.similarity !== undefined ? src.similarity : null;
                const isHighMatch = similarityScore && similarityScore >= 75;

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-[#121422] border border-slate-200 dark:border-white/5 text-xs text-slate-700 dark:text-slate-300 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white truncate">
                        <FileText size={13} className="text-violet-500 shrink-0" />
                        <span className="truncate">{src.documentTitle || 'Document'}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                          Chunk #{src.chunkIndex}
                        </span>
                        {src.pageNumber && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            (p. {src.pageNumber})
                          </span>
                        )}
                      </div>

                      {similarityScore !== null && (
                        <div
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isHighMatch
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                              : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                          }`}
                        >
                          <CheckCircle2 size={10} />
                          <span>{similarityScore}% relevance</span>
                        </div>
                      )}
                    </div>

                    <p className="font-mono text-[11px] leading-relaxed bg-white/70 dark:bg-[#0b0c14] p-2 rounded-lg border border-slate-200/60 dark:border-white/5 text-slate-600 dark:text-slate-300 italic">
                      "{src.snippet}"
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RagSourcesCard;

