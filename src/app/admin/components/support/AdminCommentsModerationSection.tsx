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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { downloadAuthenticatedFile } from '@services/api';
import { ENDPOINTS } from '@services/api';
import {
  adminService,
  type AdminCommentModerationItem,
  type AdminCommentModerationListPayload,
  type AdminCommentModerationStatus,
} from '@services/admin/adminService';
import { useToast } from '@providers/ToastProvider';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
} from '../shared/adminPanelStyles';

type ModerationTab = AdminCommentModerationStatus;

const TABS: Array<{ key: ModerationTab; label: string }> = [
  { key: 'pending', label: 'Pendente' },
  { key: 'approved', label: 'Aprovado' },
  { key: 'spam', label: 'Spam' },
];

const ORIGIN_LABELS: Record<AdminCommentModerationItem['origin'], string> = {
  question: 'Questão',
  material: 'Material',
  law: 'Lei',
};

const buildExportUrl = (status: ModerationTab, origin: 'all' | 'question' | 'material' | 'law', search: string) => {
  const query = new URLSearchParams({
    status,
    origin,
    search,
  });

  return `${ENDPOINTS.admin.commentsModerationExport}?${query.toString()}`;
};

const compactModerationText = (value: unknown, maxLength = 180) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '-';
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength).trim()}...`;
};

const ModerationBadge = ({ status }: { status: ModerationTab }) => {
  const className = status === 'approved'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
    : status === 'spam'
      ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${className}`}>
      {status}
    </span>
  );
};

/**
 * Caixa de entrada unificada de moderação de comentários.
 *
 * @since 1.0.0
 */
const AdminCommentsModerationSection = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<ModerationTab>('pending');
  const [origin, setOrigin] = useState<'all' | 'question' | 'material' | 'law'>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<AdminCommentModerationListPayload>({
    items: [],
    total: 0,
    page: 1,
    perPage: 20,
    pages: 1,
    counts: {
      pending: 0,
      approved: 0,
      spam: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
      setSelectedIds((current) => current.filter((id) => nextPayload.items.some((item) => item.id === id)));
    } catch (error) {
      console.error('Failed to load moderation comments:', error);
      addToast('Não foi possível carregar a fila de comentários.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, addToast, origin, page, search]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, origin, search]);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    ));
  };

  const applySingleAction = async (item: AdminCommentModerationItem, status: ModerationTab) => {
    setActionLoading(item.id);
    try {
      await adminService.updateModerationComment(item.id, status);
      addToast('Comentário atualizado.', 'success');
      await loadComments();
    } catch (error) {
      console.error('Failed to update moderation item:', error);
      addToast('Não foi possível atualizar o comentário.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const applyBulkAction = async (status: ModerationTab) => {
    if (selectedIds.length === 0) {
      addToast('Selecione pelo menos um comentário.', 'warning');
      return;
    }

    setActionLoading(`bulk:${status}`);
    try {
      await adminService.bulkUpdateModerationComments(selectedIds, status);
      addToast('Comentários atualizados em lote.', 'success');
      setSelectedIds([]);
      await loadComments();
    } catch (error) {
      console.error('Failed to bulk update moderation items:', error);
      addToast('Não foi possível atualizar os comentários selecionados.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const allVisibleSelected = useMemo(
    () => payload.items.length > 0 && payload.items.every((item) => selectedIds.includes(item.id)),
    [payload.items, selectedIds],
  );

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !payload.items.some((item) => item.id === id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...payload.items.map((item) => item.id)])));
  };

  const handleExport = async () => {
    try {
      await downloadAuthenticatedFile(buildExportUrl(activeTab, origin, search), 'moderacao-comentarios.csv');
    } catch (error) {
      console.error('Failed to export moderation comments:', error);
      addToast('Não foi possível exportar os comentários agora.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className={`${ADMIN_SURFACE_CLASS} p-4`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Moderação unificada
            </p>
            <h3 className="mt-2 text-xl font-black text-slate-900 dark:text-slate-100">
              Comentários
            </h3>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Questões, materiais e Lei Comentada em uma fila única.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition-all ${
                  activeTab === tab.key
                    ? `${ADMIN_TAB_BUTTON_ACTIVE_CLASS} shadow-sm`
                    : `border ${ADMIN_TAB_BUTTON_IDLE_CLASS}`
                }`}
              >
                <span>{tab.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                }`}>
                  {payload.counts[tab.key] || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar autor, trecho ou alvo"
            className={ADMIN_FIELD_CLASS}
          />

          <select
            value={origin}
            onChange={(event) => setOrigin(event.target.value as typeof origin)}
            className={ADMIN_FIELD_CLASS}
          >
            <option value="all">Todas as origens</option>
            <option value="question">Questões</option>
            <option value="material">Materiais</option>
            <option value="law">Lei Comentada</option>
          </select>

          <button
            type="button"
            onClick={() => void handleExport()}
            className={`${ADMIN_SECONDARY_BUTTON_CLASS} h-10 justify-center`}
          >
            <ExternalLink size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      <div className={ADMIN_SURFACE_CLASS}>
        <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void applyBulkAction('approved')}
              disabled={actionLoading === 'bulk:approved'}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white disabled:opacity-60"
            >
              <CheckCircle2 size={14} />
              Aprovar seleção
            </button>
            <button
              type="button"
              onClick={() => void applyBulkAction('spam')}
              disabled={actionLoading === 'bulk:spam'}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white disabled:opacity-60"
            >
              <Trash2 size={14} />
              Marcar spam
            </button>
            <button
              type="button"
              onClick={() => void applyBulkAction('pending')}
              disabled={actionLoading === 'bulk:pending'}
              className={`${ADMIN_SECONDARY_BUTTON_CLASS} disabled:opacity-60`}
            >
              <ShieldAlert size={14} />
              Voltar para pendente
            </button>
          </div>

          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {payload.total} comentário(s) na aba atual
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] table-fixed text-left">
            <colgroup>
              <col className="w-[56px]" />
              <col className="w-[150px]" />
              <col className="w-[230px]" />
              <col className="w-[240px]" />
              <col className="w-[260px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[220px]" />
            </colgroup>
            <thead className="border-b border-slate-100 dark:border-slate-800">
              <tr className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                <th className="px-5 py-4">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-5 py-4">Origem</th>
                <th className="px-5 py-4">Autor</th>
                <th className="px-5 py-4">Trecho</th>
                <th className="px-5 py-4">Alvo</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Data</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16">
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 size={16} className="animate-spin" />
                      Carregando fila de comentários...
                    </div>
                  </td>
                </tr>
              ) : payload.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum comentário encontrado para esse recorte.
                  </td>
                </tr>
              ) : payload.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                  <td className="px-5 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleSelection(item.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-5 py-4 align-top">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {ORIGIN_LABELS[item.origin]}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p
                      className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
                      title={String(item.authorName || 'Usuario')}
                    >
                      {item.authorName || 'Usuario'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">#{item.authorId || '-'}</p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <p
                      className="line-clamp-3 max-h-[4.5rem] overflow-hidden text-sm leading-6 text-slate-700 dark:text-slate-300"
                      title={String(item.excerpt || '')}
                    >
                      {compactModerationText(item.excerpt)}
                    </p>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <a
                      href={item.targetPath}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={String(item.targetLabel || '')}
                      className="inline-flex max-w-full items-start gap-2 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300"
                    >
                      <span className="line-clamp-3 break-words">{compactModerationText(item.targetLabel, 160)}</span>
                      <ExternalLink size={14} className="mt-1 shrink-0" />
                    </a>
                  </td>
                  <td className="px-5 py-4 align-top">
                    <ModerationBadge status={item.status} />
                  </td>
                  <td className="px-5 py-4 align-top text-sm text-slate-500 dark:text-slate-400">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : '-'}
                  </td>
                  <td className="px-5 py-4 align-top">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void applySingleAction(item, 'approved')}
                        disabled={actionLoading === item.id}
                        className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                      >
                        <ShieldCheck size={12} />
                        Aprovar
                      </button>
                      <button
                        type="button"
                        onClick={() => void applySingleAction(item, 'spam')}
                        disabled={actionLoading === item.id}
                        className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
                      >
                        <Trash2 size={12} />
                        Spam
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 p-5 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Página {payload.page} de {payload.pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={payload.page <= 1}
              className="rounded-md border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(payload.pages, current + 1))}
              disabled={payload.page >= payload.pages}
              className="rounded-md border border-slate-200 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCommentsModerationSection;
