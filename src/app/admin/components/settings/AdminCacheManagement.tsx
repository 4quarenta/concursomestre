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

import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Database, Loader2, RefreshCcw, Trash2, X } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import { adminService, type CacheStatsPayload } from '@services/admin/adminService';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';
import { AdminConfirmDialog } from '../ui/AdminConfirmDialog';

/**
 * Controle operacional do cache administrativo.
 * Mantem leitura, limpeza e configuração de TTL dentro do service oficial.
 */
const AdminCacheManagement = () => {
  const { addToast } = useToast();
  const [cacheStats, setCacheStats] = useState<CacheStatsPayload | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [draftTtl, setDraftTtl] = useState('300');
  const [isClearCacheDialogOpen, setIsClearCacheDialogOpen] = useState(false);

  const fetchCacheStats = useCallback(async () => {
    setLoadingKey((current) => current || 'refresh');
    try {
      const data = await adminService.getCacheStats();
      setCacheStats(data);
      setDraftTtl(String(data.default_ttl || 300));
    } catch {
      setCacheStats({
        total_files: 0,
        valid_entries: 0,
        expired_entries: 0,
        total_size_mb: 0,
        enabled: true,
        default_ttl: 300,
        table_name: null,
        source: 'none',
        supports_expiration: false,
        supports_size_estimate: false,
      });
      addToast('Não foi possível carregar as estatisticas de cache.', 'error');
    } finally {
      setLoadingKey(null);
    }
  }, [addToast]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void fetchCacheStats();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [fetchCacheStats]);

  const runAction = async (actionKey: string, operation: () => Promise<string>) => {
    if (loadingKey) {
      return;
    }

    setLoadingKey(actionKey);
    try {
      const nextMessage = await operation();
      setMessage(nextMessage);
      addToast(nextMessage, 'success');
      await fetchCacheStats();
      window.setTimeout(() => setMessage(''), 3500);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error && error.message
        ? error.message
        : 'Não foi possível executar a operação de cache.';
      setMessage(errorMessage);
      addToast(errorMessage, 'error');
    } finally {
      setLoadingKey(null);
      setIsClearCacheDialogOpen(false);
    }
  };

  if (!cacheStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  const nextEnabled = !cacheStats.enabled;

  return (
    <div className="space-y-6">
      <AdminConfirmDialog
        isOpen={isClearCacheDialogOpen}
        title="Limpar todo o cache"
        description="Essa ação remove todas as entradas do cache administrativo e operacional. Use apenas quando precisar forcar uma nova reconstrucao do runtime."
        confirmLabel="Limpar cache"
        tone="danger"
        loading={loadingKey === 'clear'}
        onConfirm={() => void runAction('clear', () => adminService.clearCache())}
        onCancel={() => setIsClearCacheDialogOpen(false)}
      />

      {message && (
        <div className="flex items-center gap-2 rounded-sm border border-emerald-300 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-300">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Entradas</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{cacheStats.total_files || 0}</p>
        </div>
        <div className="rounded-sm border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900/30 dark:bg-emerald-900/10">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Validas</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{cacheStats.valid_entries || 0}</p>
        </div>
        <div className="rounded-sm border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Expiradas</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{cacheStats.expired_entries || 0}</p>
        </div>
        <div className="rounded-sm border border-sky-300 bg-sky-50 p-4 dark:border-sky-900/30 dark:bg-sky-900/10">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">Tamanho</p>
          <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{cacheStats.total_size_mb || 0} MB</p>
        </div>
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Tabela ativa</p>
          <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{cacheStats.table_name || 'Nao encontrada'}</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{cacheStats.source || 'none'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr),minmax(0,1fr)]">
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">Status do cache</h4>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {cacheStats.enabled ? 'Cache ativo e pronto para servir respostas.' : 'Cache desligado. As respostas seráo calculadas sem armazenamento intermediario.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runAction('toggle', () => adminService.saveCacheSettings({ enabled: nextEnabled, default_ttl: Number(draftTtl) || 300 }))}
              disabled={!!loadingKey}
              className={`relative inline-flex h-9 w-16 items-center rounded-full border transition-all ${
                cacheStats.enabled ? 'border-emerald-500 bg-emerald-500/90' : 'border-slate-200 bg-slate-200 dark:border-slate-700 dark:bg-slate-800'
              } ${loadingKey ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <span className={`inline-block h-7 w-7 rounded-full bg-white shadow transition-transform ${cacheStats.enabled ? 'translate-x-8' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr),auto]">
            <div className="space-y-1.5">
              <label className="ml-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">TTL padrao (segundos)</label>
              <input
                type="number"
                min={1}
                value={draftTtl}
                onChange={(event) => setDraftTtl(event.target.value)}
                className={`w-full ${ADMIN_FIELD_CLASS}`}
              />
            </div>
            <button
              type="button"
              onClick={() => void runAction('settings', () => adminService.saveCacheSettings({ enabled: !!cacheStats.enabled, default_ttl: Number(draftTtl) || 300 }))}
              disabled={!!loadingKey}
              className={`${ADMIN_PRIMARY_BUTTON_CLASS} justify-center px-6 py-2 text-xs uppercase tracking-[0.18em] disabled:cursor-not-allowed`}
            >
              {loadingKey === 'settings' ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
              Salvar TTL
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Expiração por linha</p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{cacheStats.supports_expiration ? 'Suportada' : 'Nao suportada'}</p>
            </div>
            <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Estimativa de tamanho</p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{cacheStats.supports_size_estimate ? 'Disponível' : 'Nao suportada'}</p>
            </div>
          </div>
        </div>

        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">Operacoes</h4>
          <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Executa limpeza real e recarrega o estado vindo do backend oficial.</p>
          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={() => void runAction('clean', () => adminService.cleanExpiredCache())}
              disabled={!!loadingKey}
              className="flex w-full items-center justify-center gap-2 rounded-sm border border-amber-600 bg-amber-600 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingKey === 'clean' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Limpar expirados
            </button>
            <button
              type="button"
              onClick={() => setIsClearCacheDialogOpen(true)}
              disabled={!!loadingKey}
              className="flex w-full items-center justify-center gap-2 rounded-sm border border-rose-700 bg-rose-700 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <X size={14} />
              Limpar todo cache
            </button>
            <button
              type="button"
              onClick={() => void fetchCacheStats()}
              disabled={!!loadingKey}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} flex w-full items-center justify-center px-6 py-3 text-xs uppercase tracking-[0.18em] disabled:cursor-not-allowed`}
            >
              {loadingKey === 'refresh' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Atualizar leitura
            </button>
          </div>

          <div className={`mt-6 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
            <div className="flex items-center gap-2">
              <Database size={16} className="text-sky-700 dark:text-sky-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Fonte detectada</p>
            </div>
            <p className="mt-3 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              {cacheStats.table_name
                ? `A leitura atual usa a tabela ${cacheStats.table_name}.`
                : 'Nenhuma tabela de cache ativa foi encontrada no banco.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCacheManagement;
