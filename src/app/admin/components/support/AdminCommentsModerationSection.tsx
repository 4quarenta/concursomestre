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

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Search } from 'lucide-react';
import { downloadAuthenticatedFile } from '@services/api';
import { ENDPOINTS } from '@services/api';
import {
  adminService,
  type AdminCommentModerationCounts,
  type AdminCommentModerationFilter,
  type AdminCommentModerationItem,
  type AdminCommentModerationListPayload,
  type AdminCommentModerationStatus,
} from '@services/admin/adminService';
import { useToast } from '@providers/ToastProvider';
import { buildAdminUserEditPath } from '../../config/adminPageNavigationConfig';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';

type ModerationOrigin = 'all' | 'question' | 'material' | 'law';
type BulkModerationAction = AdminCommentModerationStatus | '';

interface AdminCommentsModerationSectionProps {
  onCountsChange?: (counts: AdminCommentModerationCounts) => void;
}

const EMPTY_COUNTS: AdminCommentModerationCounts = {
  all: 0,
  pending: 0,
  approved: 0,
  spam: 0,
  trash: 0,
};

const EMPTY_PAYLOAD: AdminCommentModerationListPayload = {
  items: [],
  total: 0,
  page: 1,
  perPage: 20,
  pages: 1,
  counts: EMPTY_COUNTS,
};

const TABS: Array<{ key: AdminCommentModerationFilter; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'approved', label: 'Aprovados' },
  { key: 'spam', label: 'Spam' },
  { key: 'trash', label: 'Lixeira' },
];

const ORIGIN_LABELS: Record<AdminCommentModerationItem['origin'], string> = {
  question: 'Questao',
  material: 'Material',
  law: 'Lei',
};

const STATUS_LABELS: Record<AdminCommentModerationStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  spam: 'Spam',
  trash: 'Lixeira',
};

const BULK_ACTION_LABELS: Record<AdminCommentModerationStatus, string> = {
  approved: 'Aprovar',
  pending: 'Mover para pendente',
  spam: 'Marcar como spam',
  trash: 'Mover para lixeira',
};

const STATUS_BADGE_CLASSES: Record<AdminCommentModerationStatus, string> = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300',
  pending: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300',
  spam: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-300',
  trash: 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const ROW_ACTION_CLASSES: Record<AdminCommentModerationStatus, string> = {
  approved: 'text-emerald-700 hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-emerald-200',
  pending: 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200',
  spam: 'text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-200',
  trash: 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100',
};

const buildExportUrl = (status: AdminCommentModerationFilter, origin: ModerationOrigin, search: string) => {
  const query = new URLSearchParams({
    status,
    origin,
    search,
  });

  return `${ENDPOINTS.admin.commentsModerationExport}?${query.toString()}`;
};

const compactModerationText = (value: unknown, maxLength = 220) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '-';
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength).trim()}...`;
};

const formatModerationDate = (value?: string) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('pt-BR');
};

const getRowActions = (item: AdminCommentModerationItem): Array<{
  status: AdminCommentModerationStatus;
  label: string;
}> => {
  const actions: Array<{ status: AdminCommentModerationStatus; label: string }> = [];

  if (item.status !== 'approved') {
    actions.push({ status: 'approved', label: 'Aprovar' });
  }

  if (item.status !== 'pending') {
    actions.push({
      status: 'pending',
      label: item.status === 'approved' ? 'Desaprovar' : 'Pendente',
    });
  }

  if (item.status !== 'spam') {
    actions.push({ status: 'spam', label: 'Spam' });
  }

  if (item.status !== 'trash') {
    actions.push({ status: 'trash', label: 'Lixeira' });
  }

  return actions;
};

const ModerationBadge = ({ status }: { status: AdminCommentModerationStatus }) => (
  <span className={`inline-flex rounded-sm border px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_CLASSES[status]}`}>
    {STATUS_LABELS[status]}
  </span>
);

/**
 * Caixa de entrada unificada de comentarios no padrao de list table do admin.
 * A secao consolida questoes, materiais e Lei Comentada dentro da area Suporte.
 *
 * @since 1.0.0
 */
const AdminCommentsModerationSection = ({ onCountsChange }: AdminCommentsModerationSectionProps) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<AdminCommentModerationFilter>('pending');
  const [origin, setOrigin] = useState<ModerationOrigin>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<AdminCommentModerationListPayload>(EMPTY_PAYLOAD);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkModerationAction>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextPayload = await adminService.getModerationComments({
        status: activeTab,
        origin,
        search,
        page,
        perPage: 20,
      });
      setPayload(nextPayload);
      onCountsChange?.(nextPayload.counts);
      setSelectedIds((current) => current.filter((id) => nextPayload.items.some((item) => item.id === id)));

      if (page > nextPayload.pages) {
        setPage(nextPayload.pages);
      }
    } catch (error) {
      console.error('Failed to load moderation comments:', error);
      addToast('Nao foi possivel carregar a fila de comentarios.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, addToast, onCountsChange, origin, page, search]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const allVisibleSelected = useMemo(
    () => payload.items.length > 0 && payload.items.every((item) => selectedIds.includes(item.id)),
    [payload.items, selectedIds],
  );

  const selectedSummary = selectedIds.length > 0
    ? `${selectedIds.length} selecionado(s)`
    : `${payload.total} comentario(s)`;

  const changeTab = (tab: AdminCommentModerationFilter) => {
    setSelectedIds([]);
    setPage(1);
    setActiveTab(tab);
  };

  const changeOrigin = (nextOrigin: ModerationOrigin) => {
    setSelectedIds([]);
    setPage(1);
    setOrigin(nextOrigin);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    ));
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !payload.items.some((item) => item.id === id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...payload.items.map((item) => item.id)])));
  };

  const applySingleAction = async (item: AdminCommentModerationItem, status: AdminCommentModerationStatus) => {
    setActionLoading(`${item.id}:${status}`);
    try {
      await adminService.updateModerationComment(item.id, status);
      addToast('Comentario atualizado.', 'success');
      await loadComments();
    } catch (error) {
      console.error('Failed to update moderation item:', error);
      addToast('Nao foi possivel atualizar o comentario.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const applyBulkAction = async () => {
    if (!bulkAction) {
      addToast('Escolha uma acao em massa.', 'warning');
      return;
    }

    if (selectedIds.length === 0) {
      addToast('Selecione pelo menos um comentario.', 'warning');
      return;
    }

    setActionLoading(`bulk:${bulkAction}`);
    try {
      await adminService.bulkUpdateModerationComments(selectedIds, bulkAction);
      addToast('Comentarios atualizados em lote.', 'success');
      setSelectedIds([]);
      await loadComments();
    } catch (error) {
      console.error('Failed to bulk update moderation items:', error);
      addToast('Nao foi possivel atualizar os comentarios selecionados.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      await downloadAuthenticatedFile(buildExportUrl(activeTab, origin, search), 'moderacao-comentarios.csv');
    } catch (error) {
      console.error('Failed to export moderation comments:', error);
      addToast('Nao foi possivel exportar os comentarios agora.', 'error');
    }
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSelectedIds([]);
    setPage(1);
    setSearch(searchDraft.trim());
  };

  const clearSearch = () => {
    setSearchDraft('');
    setSearch('');
    setPage(1);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Comentarios
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Modere comentarios de questoes, materiais e Lei Comentada na mesma fila.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadComments()}
            disabled={isLoading}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className={ADMIN_SECONDARY_BUTTON_CLASS}
          >
            <ExternalLink size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {TABS.map((tab, index) => (
          <React.Fragment key={tab.key}>
            {index > 0 ? <span className="text-slate-300 dark:text-slate-700">|</span> : null}
            <button
              type="button"
              onClick={() => changeTab(tab.key)}
              className={`font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-sky-700 dark:text-sky-300'
                  : 'text-slate-600 hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-slate-400 dark:text-slate-500">
                ({payload.counts[tab.key] || 0})
              </span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className={`${ADMIN_SURFACE_CLASS} p-3`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <select
              value={bulkAction}
              onChange={(event) => setBulkAction(event.target.value as BulkModerationAction)}
              className={`${ADMIN_FIELD_CLASS} w-56`}
            >
              <option value="">Acoes em massa</option>
              {Object.entries(BULK_ACTION_LABELS).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void applyBulkAction()}
              disabled={actionLoading?.startsWith('bulk:') || selectedIds.length === 0}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              <CheckCircle2 size={14} />
              Aplicar
            </button>
            <select
              value={origin}
              onChange={(event) => changeOrigin(event.target.value as ModerationOrigin)}
              className={`${ADMIN_FIELD_CLASS} w-48`}
            >
              <option value="all">Todas as origens</option>
              <option value="question">Questoes</option>
              <option value="material">Materiais</option>
              <option value="law">Lei Comentada</option>
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Buscar comentarios"
              className={`${ADMIN_FIELD_CLASS} w-full sm:w-72`}
            />
            <button type="submit" className={ADMIN_PRIMARY_BUTTON_CLASS}>
              <Search size={14} />
              Pesquisar
            </button>
            {search ? (
              <button type="button" onClick={clearSearch} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                Limpar
              </button>
            ) : null}
          </form>
        </div>
      </div>

      <div className={ADMIN_SURFACE_CLASS}>
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {selectedSummary} na visualizacao atual
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pagina {payload.page} de {payload.pages}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[48px]" />
              <col className="w-[210px]" />
              <col />
              <col className="w-[270px]" />
              <col className="w-[170px]" />
              <col className="w-[130px]" />
            </colgroup>
            <thead className="border-b border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
              <tr className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    aria-label="Selecionar comentarios visiveis"
                    className="h-4 w-4 rounded-sm border-slate-300 text-sky-700 focus:ring-sky-700"
                  />
                </th>
                <th className="px-4 py-3">Autor</th>
                <th className="px-4 py-3">Comentario</th>
                <th className="px-4 py-3">Em resposta a</th>
                <th className="px-4 py-3">Enviado em</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16">
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 size={16} className="animate-spin" />
                      Carregando fila de comentarios...
                    </div>
                  </td>
                </tr>
              ) : payload.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum comentario encontrado para esse recorte.
                  </td>
                </tr>
              ) : payload.items.map((item) => {
                const rowActions = getRowActions(item);
                const isRowBusy = Boolean(actionLoading?.startsWith(`${item.id}:`));

                return (
                  <tr
                    key={item.id}
                    className="border-b border-slate-200 align-top last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-950"
                  >
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        aria-label={`Selecionar comentario ${item.id}`}
                        className="h-4 w-4 rounded-sm border-slate-300 text-sky-700 focus:ring-sky-700"
                      />
                    </td>
                    <td className="px-4 py-4">
                      {item.authorId ? (
                        <a
                          href={buildAdminUserEditPath(item.authorId)}
                          className="font-semibold text-sky-700 hover:underline dark:text-sky-300"
                        >
                          {item.authorName || 'Usuario'}
                        </a>
                      ) : (
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.authorName || 'Usuario'}
                        </span>
                      )}
                      <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                        #{item.authorId || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p
                        className="line-clamp-4 text-sm leading-6 text-slate-800 dark:text-slate-200"
                        title={String(item.excerpt || '')}
                      >
                        {compactModerationText(item.excerpt)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                        {rowActions.map((action, index) => (
                          <React.Fragment key={action.status}>
                            {index > 0 ? <span className="text-slate-300 dark:text-slate-700">|</span> : null}
                            <button
                              type="button"
                              onClick={() => void applySingleAction(item, action.status)}
                              disabled={isRowBusy}
                              className={`font-medium disabled:opacity-50 ${ROW_ACTION_CLASSES[action.status]}`}
                            >
                              {action.label}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex rounded-sm border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {ORIGIN_LABELS[item.origin]}
                      </span>
                      <a
                        href={item.targetPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={String(item.targetLabel || '')}
                        className="mt-2 flex items-start gap-1 text-sm font-medium text-sky-700 hover:underline dark:text-sky-300"
                      >
                        <span className="line-clamp-3 break-words">{compactModerationText(item.targetLabel, 150)}</span>
                        <ExternalLink size={13} className="mt-1 shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {formatModerationDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <ModerationBadge status={item.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-300 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {payload.total} item(ns) encontrados
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={payload.page <= 1 || isLoading}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(payload.pages, current + 1))}
              disabled={payload.page >= payload.pages || isLoading}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              Proxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCommentsModerationSection;
