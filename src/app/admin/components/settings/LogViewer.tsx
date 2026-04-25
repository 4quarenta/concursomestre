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
import {
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';

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
      <div className={`relative z-10 flex h-full max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden ${ADMIN_MODAL_PANEL_CLASS}`}>
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex items-center justify-between gap-4 px-5 py-4`}>
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-sky-50 p-2 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              <Terminal size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-900 dark:text-white">Visualizador de logs</h2>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">C:\xampp\apache\logs\error.log</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`${autoRefresh ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300' : ''} ${ADMIN_SECONDARY_BUTTON_CLASS}`}
            >
              <RefreshCcw size={12} className={autoRefresh ? 'animate-spin-slow' : ''} />
              {autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}
            </button>
            <button onClick={() => void fetchLogs()} className={ADMIN_SECONDARY_BUTTON_CLASS}>
              <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <button onClick={onClose} className="rounded-sm p-2 text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800">
              <X size={18} />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-slate-950 p-5 font-mono text-[11px] leading-relaxed selection:bg-sky-700/30 selection:text-white"
        >
          {logs.length === 0 ? (
            <div className="flex h-full items-center justify-center text-slate-600 italic">
              Nenhum log encontrado ou carregando...
            </div>
          ) : (
            logs.map((line, index) => (
              <div key={`${index}-${line.slice(0, 24)}`} className="mb-1 border-l border-transparent pl-3 text-slate-300 transition-colors hover:border-sky-700/50 hover:text-white">
                <span className="mr-2 tabular-nums text-slate-600">[{index + 1}]</span>
                <span className={line.includes('[error]') ? 'text-red-400' : line.includes('[warn]') ? 'text-amber-400' : 'text-slate-300'}>
                  {line}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-300 bg-slate-100 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/50">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <Info size={12} /> Exibindo as últimas 100 linhas
          </span>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Erros
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Alertas
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
