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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Info, Loader2, RefreshCcw, Terminal, Trash2, X } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import { adminService, type SystemLogsPayload } from '@services/admin/adminService';
import {
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';

interface LogViewerProps {
  isOpen: boolean;
  onClose?: () => void;
  embedded?: boolean;
}

type LogSeverity = 'error' | 'warning' | 'info';
type LogDomainCategory = 'auth' | 'database' | 'api' | 'email' | 'php' | 'other';
type LogCategoryFilter = 'all' | 'errors' | 'warnings' | LogDomainCategory;

interface ParsedLogLine {
  index: number;
  line: string;
  severity: LogSeverity;
  domain: LogDomainCategory;
  domainLabel: string;
  toneClass: string;
  fingerprint: string;
  frequency: number;
}

const LOG_CATEGORY_OPTIONS: Array<{ key: LogCategoryFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'errors', label: 'Erros' },
  { key: 'warnings', label: 'Alertas' },
  { key: 'auth', label: 'Acesso' },
  { key: 'database', label: 'Banco' },
  { key: 'api', label: 'API' },
  { key: 'email', label: 'Email' },
  { key: 'php', label: 'PHP' },
  { key: 'other', label: 'Outros' },
];

const LOG_DOMAIN_LABELS: Record<LogDomainCategory, string> = {
  auth: 'Acesso',
  database: 'Banco',
  api: 'API',
  email: 'Email',
  php: 'PHP',
  other: 'Sistema',
};

const detectLogSeverity = (line: string): LogSeverity => {
  const lowerLine = line.toLowerCase();

  if (lowerLine.includes('[error]') || lowerLine.includes('fatal') || lowerLine.includes('exception') || lowerLine.includes('uncaught') || lowerLine.includes('critical')) {
    return 'error';
  }

  if (lowerLine.includes('[warn]') || lowerLine.includes('warning') || lowerLine.includes('deprecated') || lowerLine.includes('notice')) {
    return 'warning';
  }

  return 'info';
};

const detectLogDomain = (line: string): LogDomainCategory => {
  const lowerLine = line.toLowerCase();

  if (lowerLine.includes('unauthorized') || lowerLine.includes('forbidden') || lowerLine.includes('login') || lowerLine.includes('token') || lowerLine.includes('session') || /\b40[13]\b/.test(lowerLine)) {
    return 'auth';
  }

  if (lowerLine.includes('sql') || lowerLine.includes('database') || lowerLine.includes('mysqli') || lowerLine.includes('mysql') || lowerLine.includes('pdo') || lowerLine.includes('transaction')) {
    return 'database';
  }

  if (lowerLine.includes('smtp') || lowerLine.includes('mail') || lowerLine.includes('email') || lowerLine.includes('mailer')) {
    return 'email';
  }

  if (lowerLine.includes('api') || lowerLine.includes('fetch') || lowerLine.includes('endpoint') || lowerLine.includes('request') || lowerLine.includes('curl') || /\b50[0234]\b/.test(lowerLine)) {
    return 'api';
  }

  if (lowerLine.includes('php') || lowerLine.includes('stack trace') || lowerLine.includes('.php') || lowerLine.includes('vendor')) {
    return 'php';
  }

  return 'other';
};

const getLogToneClass = (severity: LogSeverity) => {
  if (severity === 'error') return 'text-red-400';
  if (severity === 'warning') return 'text-amber-400';
  return 'text-slate-300';
};

const createLogFingerprint = (line: string) => line
  .replace(/\[[^\]]*(?:\d{2}:\d{2}|\d{4})[^\]]*\]/g, '[time]')
  .replace(/\b\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '{datetime}')
  .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '{ip}')
  .replace(/[A-Z]:\\[^\s)]+/gi, '{path}')
  .replace(/\b(?:id|user|usuario|question|questao|post|line|linha)\s*[:=#-]?\s*\d+\b/gi, '$1:{n}')
  .replace(/\b\d+\b/g, '{n}')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()
  .slice(0, 220);

const matchesLogFilter = (line: ParsedLogLine, filter: LogCategoryFilter) => {
  if (filter === 'all') return true;
  if (filter === 'errors') return line.severity === 'error';
  if (filter === 'warnings') return line.severity === 'warning';
  return line.domain === filter;
};

const formatLogSize = (value?: number) => {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatUpdatedAt = (value?: string | null) => {
  if (!value) return 'Sem data';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sem data' : date.toLocaleString('pt-BR');
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

/**
 * Visualizador de logs administrativos, em modal ou embutido na aba Logs.
 */
export const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose, embedded = false }) => {
  const { addToast } = useToast();
  const [logPayload, setLogPayload] = useState<SystemLogsPayload>({ lines: [] });
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeCategory, setActiveCategory] = useState<LogCategoryFilter>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const nextPayload = await adminService.getSystemLogPayload();
      setLogPayload(nextPayload);
      setLogs(Array.isArray(nextPayload.lines) ? nextPayload.lines : []);
    } catch (error: unknown) {
      console.error('Erro ao buscar logs:', error);
      addToast(getErrorMessage(error, 'Nao foi possivel carregar os logs.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleDownloadLogs = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await adminService.downloadSystemLogs();
      addToast('Arquivo de logs baixado.', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel baixar os logs.'), 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleClearLogs = async () => {
    if (clearing) return;
    if (!window.confirm('Limpar o arquivo de logs do servidor?')) return;

    setClearing(true);
    try {
      const nextPayload = await adminService.clearSystemLogs();
      setLogPayload(nextPayload);
      setLogs(Array.isArray(nextPayload.lines) ? nextPayload.lines : []);
      addToast('Logs limpos com sucesso.', 'success');
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel limpar os logs.'), 'error');
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      void fetchLogs();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [fetchLogs, isOpen]);

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
  }, [autoRefresh, fetchLogs, isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, activeCategory]);

  const parsedLogs = useMemo<ParsedLogLine[]>(() => {
    const baseLogs = logs.map((line, index) => {
      const severity = detectLogSeverity(line);
      const domain = detectLogDomain(line);

      return {
        index,
        line,
        severity,
        domain,
        domainLabel: LOG_DOMAIN_LABELS[domain],
        toneClass: getLogToneClass(severity),
        fingerprint: createLogFingerprint(line),
        frequency: 1,
      };
    });

    const frequencies = new Map<string, number>();
    baseLogs.forEach((item) => {
      frequencies.set(item.fingerprint, (frequencies.get(item.fingerprint) || 0) + 1);
    });

    return baseLogs.map((item) => ({
      ...item,
      frequency: frequencies.get(item.fingerprint) || 1,
    }));
  }, [logs]);

  const categoryCounts = useMemo(() => Object.fromEntries(
    LOG_CATEGORY_OPTIONS.map((option) => [
      option.key,
      parsedLogs.filter((line) => matchesLogFilter(line, option.key)).length,
    ]),
  ) as Record<LogCategoryFilter, number>, [parsedLogs]);

  const frequentGroups = useMemo(() => {
    const groups = new Map<string, ParsedLogLine>();

    parsedLogs.forEach((line) => {
      if (!groups.has(line.fingerprint) || line.severity === 'error') {
        groups.set(line.fingerprint, line);
      }
    });

    return Array.from(groups.values())
      .filter((line) => line.frequency >= 3)
      .sort((a, b) => b.frequency - a.frequency || a.index - b.index)
      .slice(0, 5);
  }, [parsedLogs]);

  const visibleLogs = useMemo(
    () => parsedLogs.filter((line) => matchesLogFilter(line, activeCategory)),
    [activeCategory, parsedLogs],
  );

  if (!isOpen) {
    return null;
  }

  const panel = (
    <div className={embedded
      ? `${ADMIN_SURFACE_CLASS} flex h-[min(84vh,900px)] flex-col overflow-hidden`
      : `relative z-10 flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden ${ADMIN_MODAL_PANEL_CLASS}`}
    >
      <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-sm bg-sky-50 p-2 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
            <Terminal size={18} />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-900 dark:text-white">Visualizador de logs</h2>
            <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {logPayload.path || 'C:\\xampp\\apache\\logs\\error.log'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`${autoRefresh ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300' : ''} ${ADMIN_SECONDARY_BUTTON_CLASS}`}
          >
            <RefreshCcw size={12} className={autoRefresh ? 'animate-spin-slow' : ''} />
            {autoRefresh ? 'Auto on' : 'Auto off'}
          </button>
          <button type="button" onClick={() => void fetchLogs()} disabled={loading} className={ADMIN_SECONDARY_BUTTON_CLASS}>
            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button type="button" onClick={() => void handleDownloadLogs()} disabled={downloading} className={ADMIN_SECONDARY_BUTTON_CLASS}>
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Baixar
          </button>
          <button type="button" onClick={() => void handleClearLogs()} disabled={clearing} className={`${ADMIN_SECONDARY_BUTTON_CLASS} text-rose-700 dark:text-rose-300`}>
            {clearing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Limpar
          </button>
          {!embedded && (
            <button type="button" onClick={onClose} className="rounded-sm p-2 text-slate-500 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 border-b border-slate-300 bg-slate-100 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="flex flex-wrap gap-2">
          {LOG_CATEGORY_OPTIONS.map((option) => {
            const count = categoryCounts[option.key] || 0;
            const isActive = activeCategory === option.key;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setActiveCategory(option.key)}
                className={`inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition-colors ${
                  isActive
                    ? 'border-sky-500 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {option.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  isActive ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {count > 999 ? '999+' : count}
                </span>
              </button>
            );
          })}
        </div>

        {frequentGroups.length > 0 ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {frequentGroups.map((group) => (
              <div
                key={group.fingerprint}
                className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                    Repetido {group.frequency}x
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    {group.domainLabel}
                  </span>
                </div>
                <p className="line-clamp-2 font-mono text-[11px] leading-relaxed">
                  {group.line}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className="min-h-[520px] flex-1 overflow-y-auto bg-slate-950 p-5 font-mono text-[11px] leading-relaxed selection:bg-sky-700/30 selection:text-white md:min-h-[620px]"
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            {loading ? 'Carregando logs...' : 'Nenhum log encontrado.'}
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            Nenhum log nesta categoria.
          </div>
        ) : (
          visibleLogs.map((item) => {
            const isFrequent = item.frequency >= 3;

            return (
              <div
                key={`${item.index}-${item.line.slice(0, 24)}`}
                className={`mb-1 border-l pl-3 transition-colors hover:border-sky-700/50 hover:text-white ${
                  isFrequent ? 'border-amber-500/60 bg-amber-500/5 py-0.5' : 'border-transparent'
                }`}
              >
                <span className="mr-2 tabular-nums text-slate-600">[{item.index + 1}]</span>
                <span className="mr-2 rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">
                  {item.domainLabel}
                </span>
                {isFrequent ? (
                  <span className="mr-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-300">
                    {item.frequency}x
                  </span>
                ) : null}
                <span className={item.toneClass}>{item.line}</span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-300 bg-slate-100 px-5 py-4 dark:border-slate-700 dark:bg-slate-950/50 md:flex-row md:items-center md:justify-between">
        <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          <Info size={12} /> {visibleLogs.length}/{logs.length} linhas | {formatLogSize(logPayload.size_bytes)} | {formatUpdatedAt(logPayload.updated_at)}
        </span>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Erros
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Alertas
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-amber-300" /> Repetidos
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return panel;
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      {panel}
    </div>,
    document.body,
  );
};
