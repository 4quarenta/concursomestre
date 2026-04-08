/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, RefreshCcw, Terminal, X } from 'lucide-react';
import { adminService } from '@services/admin/adminService';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Visualizador de logs administrativos.
 * Mantem o fluxo preso ao dominio de settings, que e o unico consumidor real.
 */
export const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const nextLogs = await adminService.getSystemLogs();
      setLogs(nextLogs);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    if (isOpen && autoRefresh) {
      interval = setInterval(() => {
        void fetchLogs();
      }, 5000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isOpen, autoRefresh]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-2xl animate-scale-in dark:border-slate-800 dark:bg-slate-900">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Terminal size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Visualizador de Logs</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">C:\xampp\apache\logs\error.log</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${autoRefresh ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
            >
              <RefreshCcw size={12} className={autoRefresh ? 'animate-spin-slow' : ''} />
              {autoRefresh ? 'Auto-refresh On' : 'Auto-refresh Off'}
            </button>
            <button onClick={() => void fetchLogs()} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500">
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-slate-400">
              <X size={20} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 p-6 overflow-y-auto bg-slate-950 font-mono text-[11px] leading-relaxed selection:bg-indigo-500/30 selection:text-white scroll-smooth"
        >
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-600 italic">
              Nenhum log encontrado ou carregando...
            </div>
          ) : (
            logs.map((line, index) => (
              <div key={`${index}-${line.slice(0, 24)}`} className="mb-1 text-slate-300 hover:text-white transition-colors border-l border-transparent hover:border-indigo-500/50 pl-3">
                <span className="text-slate-600 mr-2 tabular-nums">[{index + 1}]</span>
                <span className={line.includes('[error]') ? 'text-red-400' : line.includes('[warn]') ? 'text-amber-400' : 'text-slate-300'}>
                  {line}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Info size={12} /> Exibindo as ultimas 100 linhas
          </span>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Erros
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Alertas
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
