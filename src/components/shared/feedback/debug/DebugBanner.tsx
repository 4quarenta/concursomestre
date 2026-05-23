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

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, ChevronUp, ChevronDown, Activity, AlertCircle, Trash2, Globe, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger, LogEntry } from '../../../../utils/helpers/DebugLogger';

const DEBUG_MONITOR_STORAGE_KEY = 'cm:debug-monitor';
const DEBUG_MONITOR_QUERY_PARAM = 'debug-monitor';

/**
 * Resolve se o monitor de debug deve iniciar visivel no ambiente local.
 * Ele so entra em cena quando o dev pediu explicitamente via query string ou storage.
 * @since v1.0.0
 */
const getInitialDebugMonitorState = () => {
  if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return false;

  const url = new URL(window.location.href);
  const queryValue = url.searchParams.get(DEBUG_MONITOR_QUERY_PARAM);

  if (queryValue === '1' || queryValue === 'true') {
    window.localStorage.setItem(DEBUG_MONITOR_STORAGE_KEY, '1');
    return true;
  }

  return window.localStorage.getItem(DEBUG_MONITOR_STORAGE_KEY) === '1';
};

/**
 * Monitor visual de logs do ambiente de desenvolvimento.
 * Ele pode ser aberto para depurar requests e erros, mas não deve sobrepor a home por padrao.
 * @since v1.0.0
 */
const DebugBanner: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(getInitialDebugMonitorState);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'errors' | 'network'>('all');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEnabled) return;

    const unsub = logger.subscribe(newLogs => {
      setLogs([...newLogs]);
    });
    return unsub;
  }, [isEnabled]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey && event.shiftKey && event.code === 'KeyD')) {
        return;
      }

      event.preventDefault();
      setIsEnabled((previous) => {
        const next = !previous;
        window.localStorage.setItem(DEBUG_MONITOR_STORAGE_KEY, next ? '1' : '0');
        return next;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isEnabled, isOpen, logs]);

  if (process.env.NODE_ENV !== 'development' || !isEnabled) return null;

  const filteredLogs = logs.filter(log => {
    if (filter === 'errors') return log.type === 'error' || log.type === 'api-error';
    if (filter === 'network') return log.type === 'request' || log.type === 'response';
    return true;
  });

  const errorCount = logs.filter(l => l.type === 'error' || l.type === 'api-error').length;
  const networkCount = logs.filter(l => l.type === 'request' || l.type === 'response').length;

  /**
   * Copia os logs atualmente visiveis para facilitar triagem manual em debug.
   * O texto copiado respeita o filtro ativo do monitor.
   * @since v1.0.0
   */
  const handleCopyLogs = () => {
    const text = filteredLogs.map(log => {
      const time = log.timestamp.toLocaleTimeString([], { hour12: false });
      let detailsText = '';
      if (log.details) {
        detailsText = `\nDetails: ${JSON.stringify(log.details, null, 2)}`;
      }
      return `[${time}] [${log.type.toUpperCase()}] ${log.message}${detailsText}`;
    }).join('\n' + '-'.repeat(40) + '\n');

    const header = `--- DEBUG MONITOR LOGS (${new Date().toLocaleString()}) ---\nFilters: ${filter}\nTotal: ${filteredLogs.length}\n` + '='.repeat(40) + '\n';
    
    navigator.clipboard.writeText(header + text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-[450px] max-h-[600px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col mb-4 pointer-events-auto"
          >
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center bg-gradient-to-r from-slate-800 to-indigo-950">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-indigo-400" />
                <span className="text-xs font-black text-white uppercase tracking-widest">Debug Monitor</span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleCopyLogs} 
                  className={`p-2 rounded-lg transition-colors ${copied ? 'bg-emerald-600 text-white' : 'hover:bg-slate-700 text-slate-400'}`}
                  title="Copiar logs visíveis"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <button onClick={() => logger.clear()} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400" title="Limpar logs">
                  <Trash2 size={16} />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 p-2 border-b border-slate-700 flex gap-2">
              <button 
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-widest transition-all ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Tudo ({logs.length})
              </button>
              <button 
                onClick={() => setFilter('errors')}
                className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-widest transition-all ${filter === 'errors' ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/40' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Erros ({errorCount})
              </button>
              <button 
                onClick={() => setFilter('network')}
                className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-widest transition-all ${filter === 'network' ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/40' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Rede ({networkCount})
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {filteredLogs.map(log => (
                <div key={log.id} className="group animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className={`p-4 rounded-2xl border ${
                    log.type === 'error' || log.type === 'api-error' ? 'bg-rose-950/30 border-rose-900/50' :
                    log.type === 'request' || log.type === 'response' ? 'bg-indigo-950/30 border-indigo-900/50' :
                    'bg-slate-800/50 border-slate-700/50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {log.type === 'error' || log.type === 'api-error' ? (
                          <AlertCircle size={14} className="text-rose-500" />
                        ) : log.type === 'request' || log.type === 'response' ? (
                          <Globe size={14} className="text-indigo-400" />
                        ) : (
                          <Activity size={14} className="text-slate-400" />
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                          log.type === 'error' ? 'text-rose-500' : 
                          log.type === 'request' ? 'text-amber-500' :
                          log.type === 'response' ? 'text-emerald-500' :
                          'text-slate-400'
                        }`}>
                          {log.type}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono italic">
                        {log.timestamp.toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-xs font-bold font-mono break-all leading-relaxed ${
                      log.type === 'error' ? 'text-rose-300' : 'text-slate-200'
                    }`}>
                      {log.message}
                    </p>
                    {log.details && (
                      <pre className="mt-3 p-3 bg-black/40 rounded-xl text-[10px] font-mono text-slate-400 overflow-x-auto border border-white/5 no-scrollbar">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`pointer-events-auto flex items-center gap-2 px-6 py-3 rounded-2xl shadow-2xl transition-all border ${
          errorCount > 0 
            ? 'bg-rose-600 hover:bg-rose-700 border-rose-500 text-white animate-pulse' 
            : 'bg-slate-900/90 backdrop-blur-md hover:bg-slate-800 border-slate-700 text-slate-300'
        }`}
      >
        <Activity size={16} />
        <span className="text-[10px] font-black uppercase tracking-widest transition-all">
          {isOpen ? 'Ocultar Monitor' : `Debug Monitor ${errorCount > 0 ? `(${errorCount})` : ''}`}
        </span>
        {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  );
};

export default DebugBanner;
