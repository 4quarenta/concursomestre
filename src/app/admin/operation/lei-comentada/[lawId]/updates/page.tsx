'use client';

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

import React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Edit3, FileText, Loader2, RefreshCcw, XCircle } from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
import { legalCommentaryApiService } from '@services/legal-commentary';
import type { LawDetail, LawUpdate, LegalSyncLog } from '@types';

const normalizeParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Sem registro';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
};

const changeLabel: Record<string, string> = {
  created: 'Incluido',
  changed: 'Alterado',
  revoked: 'Revogado',
  renumbered: 'Renumerado',
};

const AdminLegalCommentaryUpdatesPage = () => {
  const params = useParams<{ lawId?: string | string[] }>();
  const router = useRouter();
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const lawId = normalizeParam(params.lawId) || '';
  const [law, setLaw] = React.useState<LawDetail | null>(null);
  const [updates, setUpdates] = React.useState<LawUpdate[]>([]);
  const [syncLogs, setSyncLogs] = React.useState<LegalSyncLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const loadUpdates = React.useCallback(async () => {
    if (!lawId) return;
    setIsLoading(true);
    try {
      const payload = await legalCommentaryApiService.getAdminLawUpdates(lawId);
      setLaw(payload.law);
      setUpdates(payload.updates || []);
      setSyncLogs(payload.syncLogs || []);
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel carregar as atualizacoes.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast, lawId]);

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) {
      router.replace('/');
    }
  }, [currentUser, isAuthLoading, router]);

  React.useEffect(() => {
    void loadUpdates();
  }, [loadUpdates]);

  const syncLaw = async () => {
    if (!lawId) return;
    setIsSyncing(true);
    try {
      const result = await legalCommentaryApiService.syncAdminLaw(lawId);
      const sync = result.sync || { insertedArticles: 0, changedArticles: 0, revokedArticles: 0 };
      const hasChanges = sync.insertedArticles > 0 || sync.changedArticles > 0 || sync.revokedArticles > 0;
      addToast(
        hasChanges
          ? `Sincronizacao concluida: ${sync.changedArticles} alterado(s), ${sync.insertedArticles} novo(s), ${sync.revokedArticles} revogado(s).`
          : 'Sincronizacao concluida sem alteracoes.',
        hasChanges ? 'success' : 'info',
      );
      await loadUpdates();
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel sincronizar esta lei.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 p-6 dark:bg-slate-950">
        <div className="mx-auto flex max-w-6xl items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-12 text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 className="mr-3 animate-spin" size={18} /> Carregando atualizacoes da lei...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-6 dark:bg-slate-950 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Link href="/admin/operation/lei-comentada" className="mt-1 rounded-xl border border-slate-200 p-3 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Admin / Lei Comentada</p>
              <h1 className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">
                Atualizacoes da Lei
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                {law?.shortTitle || law?.title || 'Lei selecionada'} · ultima sincronizacao: {formatDateTime(law?.lastSyncedAt)}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {law?.id ? (
              <Link
                href={`/admin/operation/lei-comentada/${encodeURIComponent(law.id)}/edit`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Edit3 size={15} /> Editar
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void syncLaw()}
              disabled={isSyncing}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSyncing ? <Loader2 className="animate-spin" size={15} /> : <RefreshCcw size={15} />}
              Sincronizar agora
            </button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Historico</p>
                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">Eventos de alteracao</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {updates.length} evento(s)
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {updates.length > 0 ? updates.map((update) => (
                <article key={update.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600 dark:text-indigo-300">
                        {changeLabel[update.changeType] || update.changeType} · {formatDateTime(update.changedAt)}
                      </p>
                      <h3 className="mt-1 text-base font-black text-slate-900 dark:text-slate-100">{update.title}</h3>
                      <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">{update.summary}</p>
                    </div>
                    <a href={update.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-600 dark:text-indigo-300">
                      Fonte oficial
                    </a>
                  </div>

                  {(update.previousText || update.currentText) ? (
                    <div className="mt-4 grid gap-3 xl:grid-cols-2">
                      <div className="rounded-xl border border-red-100 bg-white p-3 dark:border-red-500/20 dark:bg-slate-900">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-500">Redacao anterior</p>
                        <p className="mt-2 max-h-56 overflow-y-auto text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                          {update.previousText || 'Sem redacao anterior registrada.'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-emerald-500/20 dark:bg-slate-900">
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Redacao atual</p>
                        <p className="mt-2 max-h-56 overflow-y-auto text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                          {update.currentText || 'Sem redacao atual registrada.'}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </article>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-slate-950">
                  <FileText className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={36} />
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">Nenhuma alteracao registrada ainda.</p>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Quando uma sincronizacao detectar mudanca no texto oficial, o diff aparecera aqui.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sincronizacoes</p>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Logs recentes</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {syncLogs.length}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {syncLogs.length > 0 ? syncLogs.map((log) => (
                <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-start gap-3">
                    {log.status === 'failed' ? (
                      <XCircle className="mt-0.5 text-red-500" size={16} />
                    ) : (
                      <CheckCircle2 className="mt-0.5 text-emerald-500" size={16} />
                    )}
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {log.status} · {formatDateTime(log.startedAt)}
                      </p>
                      <p className="mt-1 text-sm font-medium leading-5 text-slate-600 dark:text-slate-300">{log.message}</p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                        {log.changedArticles || 0} alt. · {log.insertedArticles || 0} novos · {log.revokedArticles || 0} revog.
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Nenhum log de sincronizacao encontrado.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AdminLegalCommentaryUpdatesPage;
