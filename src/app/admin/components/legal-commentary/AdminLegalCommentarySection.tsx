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
import { AlertTriangle, BookOpen, CheckCircle2, Edit3, ExternalLink, FileText, History, Loader2, Plus, RefreshCcw, Search, Trash2, X, XCircle } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import { legalCommentaryApiService, type PlanaltoCatalogItem, type PlanaltoCatalogSource } from '@services/legal-commentary';
import type { LawSummary, LawUpdate, LegalHomeSnapshot, LegalSyncLog } from '@types';
import {
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import { buildAdminLawEditPath } from '../../config/adminPageNavigationConfig';

interface AdminLegalCommentarySectionProps {
  filter?: string;
}

interface SyncLogEntry {
  id: string;
  label: string;
  status: 'info' | 'success' | 'error';
  message: string;
}

interface UpdateCandidate {
  item: PlanaltoCatalogItem;
  sync: {
    insertedArticles: number;
    changedArticles: number;
    revokedArticles: number;
  };
}

const EMPTY_HOME: LegalHomeSnapshot = {
  areas: [],
  lawsByArea: [],
  mostAccessed: [],
  favoriteLaws: [],
  recentlyStudied: [],
  recentlyUpdated: [],
  totals: {
    laws: 0,
    articles: 0,
    commentedArticles: 0,
    updatedRecently: 0,
  },
};

const getLawEditPath = (lawId: string | number) => buildAdminLawEditPath(lawId);

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
);

const LAW_UPDATE_CHANGE_LABEL: Record<string, string> = {
  created: 'Incluido',
  changed: 'Alterado',
  revoked: 'Revogado',
  renumbered: 'Renumerado',
};

const AdminLegalCommentarySection = ({ filter = '' }: AdminLegalCommentarySectionProps) => {
  const { addToast } = useToast();
  const [query, setQuery] = React.useState(filter);
  const [laws, setLaws] = React.useState<LawSummary[]>([]);
  const [home, setHome] = React.useState<LegalHomeSnapshot>(EMPTY_HOME);
  const [isLoading, setIsLoading] = React.useState(true);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [syncingId, setSyncingId] = React.useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = React.useState(false);
  const [updatesModalLaw, setUpdatesModalLaw] = React.useState<LawSummary | null>(null);
  const [isUpdatesModalLoading, setIsUpdatesModalLoading] = React.useState(false);
  const [updatesModalItems, setUpdatesModalItems] = React.useState<LawUpdate[]>([]);
  const [updatesModalLogs, setUpdatesModalLogs] = React.useState<LegalSyncLog[]>([]);
  const [catalogSources, setCatalogSources] = React.useState<PlanaltoCatalogSource[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = React.useState<string[]>([]);
  const [catalogItems, setCatalogItems] = React.useState<PlanaltoCatalogItem[]>([]);
  const [hasCatalogConsulted, setHasCatalogConsulted] = React.useState(false);
  const [isConsultingCatalog, setIsConsultingCatalog] = React.useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = React.useState(false);
  const [checkTotal, setCheckTotal] = React.useState(0);
  const [checkCompleted, setCheckCompleted] = React.useState(0);
  const [checkCurrentItem, setCheckCurrentItem] = React.useState<PlanaltoCatalogItem | null>(null);
  const [updateCandidates, setUpdateCandidates] = React.useState<UpdateCandidate[]>([]);
  const [busyUrls, setBusyUrls] = React.useState<string[]>([]);
  const [importProgress, setImportProgress] = React.useState({
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    currentLabel: '',
  });
  const [syncLogs, setSyncLogs] = React.useState<SyncLogEntry[]>([]);
  const syncRunRef = React.useRef(0);

  const areaNameById = React.useMemo(() => {
    const entries: Array<[string, string]> = home.areas.map((area) => [area.id, area.name]);
    return new Map<string, string>(entries);
  }, [home.areas]);
  const selectedSourceLookup = React.useMemo(() => new Set(selectedSourceIds), [selectedSourceIds]);

  const loadLaws = React.useCallback(async (nextQuery = query) => {
    setIsLoading(true);
    try {
      const payload = await legalCommentaryApiService.getAdminList(nextQuery);
      setLaws(payload.laws || []);
      setHome(payload.home || EMPTY_HOME);
    } catch {
      addToast('Nao foi possivel carregar as leis comentadas.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast, query]);

  React.useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      void loadLaws(query);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [loadLaws, query]);

  const appendSyncLog = React.useCallback((entry: Omit<SyncLogEntry, 'id'>) => {
    setSyncLogs((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...entry,
      },
      ...current,
    ].slice(0, 60));
  }, []);

  const toggleCatalogSource = React.useCallback((sourceId: string) => {
    setSelectedSourceIds((current) => (
      current.includes(sourceId)
        ? current.filter((entry) => entry !== sourceId)
        : [...current, sourceId]
    ));
  }, []);

  const handleDelete = async (law: LawSummary) => {
    const confirmed = window.confirm(`Remover "${law.shortTitle}" da base da Lei Comentada?`);
    if (!confirmed) return;

    setDeletingId(law.id);
    try {
      await legalCommentaryApiService.deleteAdminLaw(law.id);
      addToast('Lei removida com sucesso.', 'success');
      await loadLaws(query);
    } catch {
      addToast('Nao foi possivel remover a lei.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSyncLaw = async (law: LawSummary) => {
    setSyncingId(law.id);
    try {
      const result = await legalCommentaryApiService.syncAdminLaw(law.id);
      const sync = result.sync || { insertedArticles: 0, changedArticles: 0, revokedArticles: 0 };
      const hasChanges = sync.insertedArticles > 0 || sync.changedArticles > 0 || sync.revokedArticles > 0;
      addToast(
        hasChanges
          ? `Sincronizacao concluida: ${sync.changedArticles} alterado(s), ${sync.insertedArticles} novo(s), ${sync.revokedArticles} revogado(s).`
          : 'Sincronizacao concluida sem alteracoes.',
        hasChanges ? 'success' : 'info',
      );
      await loadLaws(query);
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel sincronizar esta lei.'), 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const handleOpenUpdatesModal = async (law: LawSummary) => {
    setUpdatesModalLaw(law);
    setIsUpdatesModalLoading(true);

    try {
      const payload = await legalCommentaryApiService.getAdminLawUpdates(law.id);
      setUpdatesModalItems(payload.updates || []);
      setUpdatesModalLogs(payload.syncLogs || []);

      if (payload.law) {
        setUpdatesModalLaw((current) => current ? {
          ...current,
          title: payload.law?.title || current.title,
          shortTitle: payload.law?.shortTitle || current.shortTitle,
          lastSyncedAt: payload.law?.lastSyncedAt || current.lastSyncedAt,
          officialUrl: payload.law?.officialUrl || current.officialUrl,
        } : current);
      }
    } catch (error: unknown) {
      addToast(getErrorMessage(error, 'Nao foi possivel carregar o historico de atualizacoes.'), 'error');
    } finally {
      setIsUpdatesModalLoading(false);
    }
  };

  const handleCloseUpdatesModal = () => {
    if (isUpdatesModalLoading) return;
    setUpdatesModalLaw(null);
    setUpdatesModalItems([]);
    setUpdatesModalLogs([]);
  };

  const handleSyncUpdatesModalLaw = async () => {
    if (!updatesModalLaw) return;
    await handleSyncLaw(updatesModalLaw);
    await handleOpenUpdatesModal(updatesModalLaw);
  };

  const runUpdateCheck = async (items: PlanaltoCatalogItem[], runId: number) => {
    const existingItems = items.filter((item) => item.exists);
    setUpdateCandidates([]);
    setIsCheckingUpdates(true);
    setCheckTotal(existingItems.length);
    setCheckCompleted(0);
    setCheckCurrentItem(null);

    let completed = 0;
    for (const item of existingItems) {
      if (syncRunRef.current !== runId) {
        return;
      }

      setCheckCurrentItem(item);

      try {
        const result = await legalCommentaryApiService.importLawFromPlanalto(item.url, false);
        const sync = result.sync || {
          insertedArticles: 0,
          changedArticles: 0,
          revokedArticles: 0,
        };
        const hasUpdates = sync.insertedArticles > 0 || sync.changedArticles > 0 || sync.revokedArticles > 0;

        if (hasUpdates) {
          setUpdateCandidates((current) => {
            const next = current.filter((candidate) => candidate.item.url !== item.url);
            return [...next, { item, sync }];
          });
          appendSyncLog({
            label: item.platformTitle || item.label,
            status: 'success',
            message: `${sync.changedArticles} alterados, ${sync.insertedArticles} novos e ${sync.revokedArticles} revogados disponiveis para atualizar.`,
          });
        }
      } catch (error: unknown) {
        appendSyncLog({
          label: item.platformTitle || item.label,
          status: 'error',
          message: getErrorMessage(error, 'Nao foi possivel verificar atualizacoes desta lei.'),
        });
      } finally {
        completed += 1;
        setCheckCompleted(completed);
      }
    }

    if (syncRunRef.current === runId) {
      setIsCheckingUpdates(false);
      setCheckCurrentItem(null);
    }
  };

  const handleOpenSyncModal = async () => {
    const runId = Date.now();
    syncRunRef.current = runId;
    setIsSyncModalOpen(true);
    setCatalogSources([]);
    setSelectedSourceIds([]);
    setCatalogItems([]);
    setHasCatalogConsulted(false);
    setIsConsultingCatalog(true);
    setIsCheckingUpdates(false);
    setCheckTotal(0);
    setCheckCompleted(0);
    setCheckCurrentItem(null);
    setUpdateCandidates([]);
    setBusyUrls([]);
    setImportProgress({
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      currentLabel: '',
    });
    setSyncLogs([]);

    try {
      appendSyncLog({
        label: 'Catalogo oficial',
        status: 'info',
        message: 'Carregando as categorias oficiais disponiveis para consulta...',
      });
      const payload = await legalCommentaryApiService.getSyncCatalog();
      if (syncRunRef.current !== runId) return;

      const sources = payload.sources || [];
      setCatalogSources(sources);
      setSelectedSourceIds([]);
      setIsConsultingCatalog(false);

      appendSyncLog({
        label: 'Catalogo oficial',
        status: 'success',
        message: `${sources.length} fonte(s) oficiais prontas para consulta. Selecione as categorias desejadas e inicie a varredura.`,
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Nao foi possivel consultar as leis do Planalto.');
      appendSyncLog({
        label: 'Catalogo oficial',
        status: 'error',
        message: getErrorMessage(error, 'Nao foi possivel montar o catalogo do Planalto.'),
      });
      addToast(message, 'error');
    } finally {
      if (syncRunRef.current === runId) {
        setIsConsultingCatalog(false);
      }
    }
  };

  const handleConsultSelectedSources = async () => {
    if (selectedSourceIds.length === 0) {
      addToast('Selecione pelo menos uma categoria oficial para consultar.', 'warning');
      return;
    }

    const runId = Date.now();
    syncRunRef.current = runId;
    setCatalogItems([]);
    setHasCatalogConsulted(true);
    setIsConsultingCatalog(true);
    setIsCheckingUpdates(false);
    setCheckTotal(0);
    setCheckCompleted(0);
    setCheckCurrentItem(null);
    setUpdateCandidates([]);
    setBusyUrls([]);
    setImportProgress({
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      currentLabel: '',
    });

    appendSyncLog({
      label: 'Catalogo oficial',
      status: 'info',
      message: `Consultando ${selectedSourceIds.length} categoria(s) oficial(is) no Portal do Planalto...`,
    });

    try {
      const payload = await legalCommentaryApiService.getSyncCatalog(selectedSourceIds);
      if (syncRunRef.current !== runId) return;

      const items = payload.items || [];
      setCatalogItems(items);
      setCatalogSources(payload.sources || []);
      setIsConsultingCatalog(false);

      if (!items.length) {
        appendSyncLog({
          label: 'Catalogo oficial',
          status: 'error',
          message: 'Nenhuma norma disponivel foi encontrada nas categorias selecionadas.',
        });
        addToast('Nenhuma lei foi encontrada nas categorias selecionadas.', 'warning');
        return;
      }

      appendSyncLog({
        label: 'Catalogo oficial',
        status: 'success',
        message: `${items.length} norma(s) localizadas nas categorias selecionadas.`,
      });
      void runUpdateCheck(items, runId);
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Nao foi possivel consultar as leis do Planalto.');
      appendSyncLog({
        label: 'Catalogo oficial',
        status: 'error',
        message: getErrorMessage(error, 'Nao foi possivel consultar as categorias selecionadas.'),
      });
      addToast(message, 'error');
      setIsConsultingCatalog(false);
    }
  };

  const runImport = async (items: PlanaltoCatalogItem[]) => {
    if (!items.length) {
      return;
    }

    const runId = Date.now();
    syncRunRef.current = runId;
    setBusyUrls(items.map((item) => item.url));
    setImportProgress({
      total: items.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      currentLabel: '',
    });

    let completed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      if (syncRunRef.current !== runId) {
        return;
      }

      setImportProgress((current) => ({
        ...current,
        currentLabel: item.platformTitle || item.label,
      }));

      try {
        const result = await legalCommentaryApiService.importLawFromPlanalto(item.url, true);
        completed += 1;
        succeeded += 1;

        setCatalogItems((current) => current.map((entry) => entry.url === item.url ? {
          ...entry,
          exists: true,
          lawId: result.law?.id || entry.lawId || null,
          platformTitle: result.law?.shortTitle || result.law?.title || entry.platformTitle || entry.label,
          lastSyncedAt: result.law?.lastSyncedAt || new Date().toISOString(),
          lastUpdatedAt: result.law?.lastUpdatedAt || result.law?.lastSyncedAt || new Date().toISOString(),
        } : entry));
        setUpdateCandidates((current) => current.filter((candidate) => candidate.item.url !== item.url));
        appendSyncLog({
          label: result.law?.shortTitle || result.law?.title || item.label,
          status: 'success',
          message: result.created ? 'Lei adicionada na plataforma.' : 'Lei atualizada com sucesso.',
        });
      } catch (error: unknown) {
        completed += 1;
        failed += 1;
        appendSyncLog({
          label: item.platformTitle || item.label,
          status: 'error',
          message: getErrorMessage(error, 'Falha ao importar esta lei.'),
        });
      } finally {
        setImportProgress({
          total: items.length,
          completed,
          succeeded,
          failed,
          currentLabel: item.platformTitle || item.label,
        });
      }
    }

    setBusyUrls([]);
    setImportProgress((current) => ({ ...current, currentLabel: '' }));
    await loadLaws(query);
    addToast(`Importacao concluida: ${succeeded} sucesso(s) e ${failed} falha(s).`, failed > 0 ? 'warning' : 'success');
  };

  const pendingItems = React.useMemo(() => catalogItems.filter((item) => !item.exists), [catalogItems]);
  const existingItems = React.useMemo(() => catalogItems.filter((item) => item.exists), [catalogItems]);
  const stableUpdateCandidates = React.useMemo(
    () => updateCandidates.slice().sort((left, right) => (left.item.platformTitle || left.item.label).localeCompare(right.item.platformTitle || right.item.label, 'pt-BR')),
    [updateCandidates],
  );
  const checkProgressPercent = checkTotal > 0 ? Math.min(100, Math.round((checkCompleted / checkTotal) * 100)) : 0;
  const importProgressPercent = importProgress.total > 0 ? Math.min(100, Math.round((importProgress.completed / importProgress.total) * 100)) : 0;
  const hasImportInFlight = busyUrls.length > 0;
  const canCloseSyncModal = !isConsultingCatalog && !isCheckingUpdates && !hasImportInFlight;
  const formatDateTime = (value?: string | null) => {
    if (!value) return 'Nunca sincronizada';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR');
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Leis</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{home.totals.laws}</p>
        </div>
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Artigos</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{home.totals.articles}</p>
        </div>
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Comentados</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{home.totals.commentedArticles}</p>
        </div>
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Atualizadas</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{home.totals.updatedRecently}</p>
        </div>
      </div>

      <AdminCollectionToolbar
        title="Lei Comentada"
        description="Gerencie leis, artigos, comentarios editoriais, jurisprudencia, sumulas e vinculos com materias."
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Buscar por nome, numero, apelido, area ou ementa"
        primaryActionLabel="Adicionar nova"
        primaryActionHref={getLawEditPath('new')}
        itemCount={laws.length}
        itemCountLabel="leis"
        actions={(
          <>
            <button
              type="button"
              onClick={() => void loadLaws(query)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Search size={14} />
              Buscar
            </button>
            <button
              type="button"
              onClick={() => void loadLaws(query)}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCcw size={14} />
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => void handleOpenSyncModal()}
              disabled={isConsultingCatalog}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-sm border border-sky-700 bg-sky-700 px-3 text-xs font-semibold text-white transition-colors hover:border-sky-800 hover:bg-sky-800 disabled:opacity-60"
            >
              {isConsultingCatalog ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
              Sincronizar leis
            </button>
          </>
        )}
      />

      <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leis cadastradas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="p-4">Lei</th>
                <th className="p-4">Area</th>
                <th className="p-4">Artigos</th>
                <th className="p-4">Editorial</th>
                <th className="p-4">Fonte</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-sm font-bold text-slate-500">Carregando leis...</td>
                </tr>
              ) : laws.length > 0 ? laws.map((law) => (
                <tr key={law.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                        <FileText size={17} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{law.shortTitle}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{law.number}{law.year ? ` / ${law.year}` : ''}</p>
                        <p className="mt-1 line-clamp-1 max-w-xl text-xs font-medium text-slate-400">{law.description || law.summary}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-bold text-slate-600 dark:text-slate-300">{areaNameById.get(law.areaId) || '-'}</td>
                  <td className="p-4">
                    <span className="rounded-xl bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {law.articleCount} artigos
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      <span>{law.commentedArticleCount} comentados</span>
                      <span>{law.jurisprudenceCount} jurisprudencias</span>
                      <span>{law.examTipCount} macetes</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <a href={law.officialUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-indigo-600 hover:text-indigo-700 dark:text-indigo-300">
                      Planalto
                    </a>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {law.syncStatus || law.status}
                      </span>
                      {law.isRecentlyUpdated ? (
                        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          <AlertTriangle size={11} /> atualizada
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {formatDateTime(law.lastSyncedAt)}
                    </p>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <Link
                        href={getLawEditPath(law.id)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                        title="Editar lei"
                      >
                        <Edit3 size={16} />
                      </Link>
                      <button
                        type="button"
                        disabled={syncingId === law.id}
                        onClick={() => void handleSyncLaw(law)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-40 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
                        title="Sincronizar lei"
                      >
                        {syncingId === law.id ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleOpenUpdatesModal(law)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
                        title="Ver atualizacoes"
                      >
                        <History size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === law.id}
                        onClick={() => void handleDelete(law)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:hover:bg-red-500/10"
                        title="Remover lei"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="p-10 text-center">
                    <BookOpen className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={34} />
                    <p className="text-sm font-black text-slate-900 dark:text-slate-100">Nenhuma lei cadastrada no banco.</p>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Crie a primeira lei para publicar o modulo Lei Comentada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {updatesModalLaw ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/65 px-4 py-8 backdrop-blur-sm">
          <div className={`${ADMIN_MODAL_PANEL_CLASS} w-full max-w-6xl`}>
            <div className={ADMIN_MODAL_HEADER_CLASS}>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300">
                  Lei Comentada / O que mudou
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {updatesModalLaw.shortTitle || updatesModalLaw.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Ultima sincronizacao: {formatDateTime(updatesModalLaw.lastSyncedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseUpdatesModal}
                className="rounded-sm border border-slate-300 bg-white p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                aria-label="Fechar atualizacoes"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="min-h-[420px] border-b border-slate-300 p-5 dark:border-slate-700 lg:border-b-0 lg:border-r">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Eventos de alteracao</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      Historico em formato editorial, sem sair da listagem.
                    </p>
                  </div>
                  <span className="inline-flex w-fit rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {updatesModalItems.length} evento(s)
                  </span>
                </div>

                <div className="mt-4 max-h-[62vh] space-y-3 overflow-y-auto pr-1">
                  {isUpdatesModalLoading ? (
                    <div className="flex min-h-[260px] items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                      <Loader2 className="mr-2 animate-spin" size={16} /> Carregando historico...
                    </div>
                  ) : updatesModalItems.length > 0 ? updatesModalItems.map((update) => (
                    <article key={update.id} className="rounded-sm border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
                              {LAW_UPDATE_CHANGE_LABEL[update.changeType] || update.changeType} - {formatDateTime(update.changedAt)}
                            </p>
                            <h5 className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{update.title}</h5>
                          </div>
                          {update.sourceUrl ? (
                            <a
                              href={update.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.14em] text-sky-700 hover:underline dark:text-sky-300"
                            >
                              Fonte <ExternalLink size={12} />
                            </a>
                          ) : null}
                        </div>
                        <p className="mt-2 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">{update.summary}</p>
                      </div>

                      {(update.previousText || update.currentText) ? (
                        <div className="grid gap-0 md:grid-cols-2">
                          <div className="border-b border-slate-200 p-4 dark:border-slate-800 md:border-b-0 md:border-r">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Antes</p>
                            <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                              {update.previousText || 'Sem redacao anterior registrada.'}
                            </p>
                          </div>
                          <div className="p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Depois</p>
                            <p className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">
                              {update.currentText || 'Sem redacao atual registrada.'}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  )) : (
                    <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-950">
                      <FileText className="mx-auto mb-3 text-slate-300 dark:text-slate-600" size={30} />
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nenhuma alteracao registrada.</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Quando uma sincronizacao detectar mudanca no texto oficial, o diff aparece aqui.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <aside className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Logs</h4>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Sincronizacoes recentes.</p>
                  </div>
                  <span className="rounded-sm border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {updatesModalLogs.length}
                  </span>
                </div>

                <div className="mt-4 max-h-[62vh] space-y-2 overflow-y-auto pr-1">
                  {isUpdatesModalLoading ? (
                    <div className="rounded-sm border border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Atualizando logs...
                    </div>
                  ) : updatesModalLogs.length > 0 ? updatesModalLogs.map((log) => (
                    <div key={log.id} className="rounded-sm border border-slate-300 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-start gap-2">
                        {log.status === 'failed' ? (
                          <XCircle className="mt-0.5 text-rose-500" size={15} />
                        ) : (
                          <CheckCircle2 className="mt-0.5 text-emerald-600" size={15} />
                        )}
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            {log.status} - {formatDateTime(log.startedAt)}
                          </p>
                          <p className="mt-1 text-xs font-medium leading-5 text-slate-600 dark:text-slate-300">{log.message}</p>
                          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                            {log.changedArticles || 0} alt. - {log.insertedArticles || 0} novos - {log.revokedArticles || 0} revog.
                          </p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-sm border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Nenhum log encontrado.
                    </div>
                  )}
                </div>
              </aside>
            </div>

            <div className={`${ADMIN_MODAL_FOOTER_CLASS} flex flex-col gap-2 sm:flex-row sm:justify-end`}>
              <button type="button" onClick={handleCloseUpdatesModal} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                Fechar
              </button>
              {updatesModalLaw.officialUrl ? (
                <a
                  href={updatesModalLaw.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  <ExternalLink size={14} /> Fonte oficial
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => void handleOpenUpdatesModal(updatesModalLaw)}
                disabled={isUpdatesModalLoading}
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                {isUpdatesModalLoading ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                Recarregar
              </button>
              <button
                type="button"
                onClick={() => void handleSyncUpdatesModalLaw()}
                disabled={isUpdatesModalLoading || syncingId === updatesModalLaw.id}
                className={ADMIN_PRIMARY_BUTTON_CLASS}
              >
                {syncingId === updatesModalLaw.id ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                Sincronizar agora
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isSyncModalOpen ? (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 backdrop-blur-sm">
          <div className="flex min-h-full items-start justify-center p-4">
          <div className="my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Portal do Planalto</p>
                <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">Consulta e sincronizacao de leis</h3>
                <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                  Primeiro voce escolhe as categorias oficiais do acervo. Depois o modal consulta apenas essas fontes, mostra o que ainda nao foi adicionado na plataforma e detecta atualizacoes nas leis ja salvas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => canCloseSyncModal ? setIsSyncModalOpen(false) : undefined}
                disabled={!canCloseSyncModal}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
            <section className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Fontes oficiais</p>
                  <h4 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Selecione as categorias do Portal do Planalto</h4>
                  <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500 dark:text-slate-400">
                    Isso evita consultas aleatorias e deixa claro se voce quer varrer, por exemplo, Constituicao, Codigos, Leis Complementares, Decretos ou Medidas Provisorias.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void handleConsultSelectedSources()}
                  disabled={isConsultingCatalog || isCheckingUpdates || hasImportInFlight || selectedSourceIds.length === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isConsultingCatalog ? <Loader2 className="animate-spin" size={15} /> : <Search size={15} />}
                  Consultar fontes selecionadas
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {catalogSources.length > 0 ? catalogSources.map((source) => {
                  const isSelected = selectedSourceLookup.has(source.id);
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => toggleCatalogSource(source.id)}
                      disabled={isConsultingCatalog || isCheckingUpdates || hasImportInFlight}
                      className={[
                        'inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-left text-xs font-black uppercase tracking-[0.14em] transition-colors disabled:opacity-60',
                        isSelected
                          ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                      ].join(' ')}
                      title={source.description}
                    >
                      {source.label}
                    </button>
                  );
                }) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                    {isConsultingCatalog ? 'Carregando as categorias oficiais...' : 'Nenhuma categoria oficial foi carregada.'}
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {selectedSourceIds.length > 0
                    ? `${selectedSourceIds.length} categoria(s) selecionada(s) para a proxima consulta.`
                    : 'Selecione pelo menos uma categoria antes de consultar o acervo.'}
                </p>

                {catalogSources.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSourceIds(catalogSources.map((source) => source.id))}
                      disabled={isConsultingCatalog || isCheckingUpdates || hasImportInFlight}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Marcar tudo
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSourceIds([])}
                      disabled={isConsultingCatalog || isCheckingUpdates || hasImportInFlight}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      Limpar
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <div className="mt-5 grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Catalogo</p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{catalogItems.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Pendentes</p>
                <p className="mt-2 text-2xl font-black text-slate-900 dark:text-slate-100">{pendingItems.length}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">Ja integradas</p>
                <p className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">{existingItems.length}</p>
              </div>
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700 dark:text-red-300">Atualizacoes</p>
                <p className="mt-2 text-2xl font-black text-red-700 dark:text-red-300">{stableUpdateCandidates.length}</p>
              </div>
            </div>

            {(isConsultingCatalog || isCheckingUpdates) ? (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {isConsultingCatalog
                      ? hasCatalogConsulted
                        ? 'Consultando normas nas categorias selecionadas'
                        : 'Carregando categorias oficiais'
                      : 'Verificando atualizacoes das leis salvas'}
                  </p>
                  <p className="text-sm font-black text-indigo-600 dark:text-indigo-300">
                    {isConsultingCatalog ? '...' : `${checkProgressPercent}%`}
                  </p>
                </div>
                {!isConsultingCatalog ? (
                  <>
                    <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className="h-full rounded-full bg-indigo-600 transition-all duration-300" style={{ width: `${checkProgressPercent}%` }} />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {checkCurrentItem ? (
                        <>Analisando agora: <strong className="font-black text-slate-900 dark:text-slate-100">{checkCurrentItem.platformTitle || checkCurrentItem.label}</strong></>
                      ) : (
                        <>Concluido: {checkCompleted} de {checkTotal} lei(s) verificadas.</>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-300">
                    <Loader2 className="animate-spin" size={15} /> {hasCatalogConsulted ? 'Consultando o acervo oficial nas categorias selecionadas...' : 'Carregando as categorias oficiais do Portal do Planalto...'}
                  </p>
                )}
              </div>
            ) : null}

            {importProgress.total > 0 ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">Progresso da importacao</p>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">{importProgressPercent}%</p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-emerald-200/70 dark:bg-emerald-950/60">
                  <div className="h-full rounded-full bg-emerald-600 transition-all duration-300" style={{ width: `${importProgressPercent}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <span>Processadas: <strong className="font-black">{importProgress.completed}/{importProgress.total}</strong></span>
                  <span>Sucesso: <strong className="font-black text-emerald-700 dark:text-emerald-300">{importProgress.succeeded}</strong></span>
                  <span>Falhas: <strong className="font-black text-red-700 dark:text-red-300">{importProgress.failed}</strong></span>
                </div>
                {importProgress.currentLabel ? (
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Importando agora: <strong className="font-black text-slate-900 dark:text-slate-100">{importProgress.currentLabel}</strong>
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Disponiveis</p>
                    <h4 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Leis ainda nao adicionadas</h4>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      Aqui aparecem as leis consultadas no Planalto que ainda nao existem na plataforma.
                    </p>
                  </div>
                  {pendingItems.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void runImport(pendingItems)}
                      disabled={isConsultingCatalog || isCheckingUpdates || hasImportInFlight}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {hasImportInFlight ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                      Adicionar pendentes
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {pendingItems.length > 0 ? pendingItems.map((item) => {
                    const isBusy = busyUrls.includes(item.url);
                    return (
                      <div key={item.url} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">{item.label}</p>
                            {item.sourceLabel ? (
                              <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                {item.sourceLabel}
                              </p>
                            ) : null}
                            <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{item.url}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void runImport([item])}
                            disabled={isConsultingCatalog || isCheckingUpdates || hasImportInFlight}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                          >
                            {isBusy ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                            Adicionar
                          </button>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      {hasCatalogConsulted ? 'Nenhuma lei pendente encontrada na consulta atual.' : 'Consulte primeiro as categorias selecionadas para listar as leis pendentes.'}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Atualizacoes</p>
                    <h4 className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">Leis com mudancas disponiveis</h4>
                    <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                      A comparacao considera as leis ja salvas na plataforma e a ultima sincronizacao registrada para cada uma.
                    </p>
                  </div>
                  {stableUpdateCandidates.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void runImport(stableUpdateCandidates.map((candidate) => candidate.item))}
                      disabled={isConsultingCatalog || isCheckingUpdates || hasImportInFlight}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-slate-700 disabled:opacity-60 dark:bg-white dark:text-slate-950"
                    >
                      {hasImportInFlight ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                      Atualizar leis
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {stableUpdateCandidates.length > 0 ? stableUpdateCandidates.map((candidate) => {
                    const isBusy = busyUrls.includes(candidate.item.url);
                    return (
                      <div key={candidate.item.url} className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">{candidate.item.platformTitle || candidate.item.label}</p>
                            {candidate.item.sourceLabel ? (
                              <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                                {candidate.item.sourceLabel}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              Ultima sincronizacao: {formatDateTime(candidate.item.lastSyncedAt)}
                            </p>
                            <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">
                              {candidate.sync.changedArticles} alterados, {candidate.sync.insertedArticles} novos, {candidate.sync.revokedArticles} revogados
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void runImport([candidate.item])}
                            disabled={isConsultingCatalog || isCheckingUpdates || hasImportInFlight}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                          >
                            {isBusy ? <Loader2 className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                            Atualizar
                          </button>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                      {isCheckingUpdates
                        ? 'A verificacao ainda esta em andamento.'
                        : hasCatalogConsulted
                          ? 'Nenhuma atualizacao disponivel foi encontrada nesta rodada.'
                          : 'Consulte primeiro as categorias selecionadas para verificar atualizacoes.'}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100">Ultimos eventos</p>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{syncLogs.length} registro(s)</p>
              </div>

              <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {syncLogs.length > 0 ? syncLogs.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="mt-0.5">
                      {entry.status === 'success' ? (
                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-300" />
                      ) : entry.status === 'error' ? (
                        <XCircle size={16} className="text-red-600 dark:text-red-300" />
                      ) : (
                        <Loader2 size={16} className="animate-spin text-indigo-600 dark:text-indigo-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{entry.label}</p>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{entry.message}</p>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    O modal vai registrar aqui a consulta, a verificacao de atualizacoes e o andamento das importacoes.
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminLegalCommentarySection;
