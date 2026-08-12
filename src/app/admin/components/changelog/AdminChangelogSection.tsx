'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Lightbulb, RefreshCcw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import {
  changelogService,
  type ChangelogEntry,
  type ChangelogSuggestion,
  type ChangelogStatus,
  type SuggestionProductStatus,
} from '@services/changelog';
import { buildAdminChangelogEditPath } from '../../config/adminPageNavigationConfig';
import AdminCollectionPagination from '../shared/AdminCollectionPagination';
import AdminCollectionTablePanel from '../shared/AdminCollectionTablePanel';
import AdminCollectionToolbar from '../shared/AdminCollectionToolbar';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';
import AdminPublishStateBadge, { resolveAdminPublishState } from '../shared/AdminPublishStateBadge';
import {
  ADMIN_COLLECTION_TABLE_CLASS,
  ADMIN_COLLECTION_TABLE_HEAD_CLASS,
  ADMIN_COLLECTION_TABLE_ROW_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
} from '../shared/adminPanelStyles';

const PAGE_SIZE = 20;
const PRODUCT_STATUS_OPTIONS: Array<{ value: SuggestionProductStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'under_review', label: 'Em análise' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'planned', label: 'Planejada' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'completed', label: 'Concluída' },
  { value: 'declined', label: 'Não aprovada' },
];

const suggestionBadgeClass: Record<SuggestionProductStatus, string> = {
  pending: 'border-slate-200 bg-slate-50 text-slate-600',
  under_review: 'border-sky-200 bg-sky-50 text-sky-700',
  approved: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  planned: 'border-violet-200 bg-violet-50 text-violet-700',
  in_progress: 'border-amber-200 bg-amber-50 text-amber-700',
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  declined: 'border-rose-200 bg-rose-50 text-rose-700',
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '-'
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const AdminChangelogSection = () => {
  const { addToast } = useToast();
  const [view, setView] = React.useState<'entries' | 'suggestions'>('entries');
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [items, setItems] = React.useState<ChangelogEntry[]>([]);
  const [suggestions, setSuggestions] = React.useState<ChangelogSuggestion[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [updatingSuggestionId, setUpdatingSuggestionId] = React.useState<number | null>(null);
  const [pendingArchive, setPendingArchive] = React.useState<ChangelogEntry | null>(null);
  const [archiving, setArchiving] = React.useState(false);
  const requestSequence = React.useRef(0);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = search.trim();
      if (next !== appliedSearch) {
        setAppliedSearch(next);
        setPage(1);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [appliedSearch, search]);

  const load = React.useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setErrorMessage('');
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(status ? { status } : {}),
      };
      if (view === 'entries') {
        const result = await changelogService.adminList(params);
        if (sequence !== requestSequence.current) return;
        setItems(result.items);
        setSuggestions([]);
        setTotal(result.pageInfo.total);
        setTotalPages(result.pageInfo.totalPages);
      } else {
        const result = await changelogService.listSuggestions(params);
        if (sequence !== requestSequence.current) return;
        setSuggestions(result.items);
        setItems([]);
        setTotal(result.pageInfo.total);
        setTotalPages(result.pageInfo.totalPages);
      }
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setItems([]);
      setSuggestions([]);
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar esta biblioteca.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [appliedSearch, page, status, view]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const changeView = (next: 'entries' | 'suggestions') => {
    setView(next);
    setStatus('');
    setSearch('');
    setAppliedSearch('');
    setPage(1);
  };

  const updateSuggestionStatus = async (suggestion: ChangelogSuggestion, nextStatus: SuggestionProductStatus) => {
    setUpdatingSuggestionId(suggestion.id);
    try {
      const updated = await changelogService.updateSuggestion({
        id: suggestion.id,
        status: nextStatus,
        adminNote: suggestion.adminNote || undefined,
        changelogId: suggestion.changelogId,
      });
      setSuggestions((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      addToast('Status da sugestão atualizado.', 'success');
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível atualizar a sugestão.', 'error');
    } finally {
      setUpdatingSuggestionId(null);
    }
  };

  const archiveEntry = async () => {
    if (!pendingArchive) return;
    setArchiving(true);
    try {
      await changelogService.archive(pendingArchive.id);
      addToast('Novidade arquivada.', 'success');
      setPendingArchive(null);
      await load();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível arquivar a novidade.', 'error');
    } finally {
      setArchiving(false);
    }
  };

  const visibleCount = view === 'entries' ? items.length : suggestions.length;

  return (
    <div className="space-y-4">
      <AdminCollectionToolbar
        title="Novidades"
        description="Publique melhorias em linguagem simples e acompanhe as sugestões enviadas pelo suporte."
        itemCount={total}
        itemCountLabel={view === 'entries' ? 'novidades' : 'sugestões'}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={view === 'entries' ? 'Buscar novidades...' : 'Buscar sugestões...'}
        primaryActionLabel={view === 'entries' ? 'Adicionar novidade' : undefined}
        primaryActionHref={view === 'entries' ? buildAdminChangelogEditPath('new') : undefined}
        actions={(
          <>
            <select
              aria-label="Filtrar por status"
              value={status}
              onChange={(event) => { setStatus(event.target.value); setPage(1); }}
              className={`${ADMIN_FIELD_CLASS} h-10 min-w-40`}
            >
              <option value="">Todos os status</option>
              {view === 'entries' ? (
                <>
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Arquivado</option>
                </>
              ) : PRODUCT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => void load()} className={ADMIN_SECONDARY_BUTTON_CLASS}>
              <RefreshCcw size={14} /> Atualizar
            </button>
          </>
        )}
      />

      <div className="flex gap-1 rounded-sm border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" role="tablist" aria-label="Conteúdo de novidades">
        <button type="button" role="tab" aria-selected={view === 'entries'} onClick={() => changeView('entries')} className={`inline-flex h-10 items-center gap-2 rounded-sm px-4 text-sm font-bold ${view === 'entries' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <Sparkles size={16} /> Arquivo de novidades
        </button>
        <button type="button" role="tab" aria-selected={view === 'suggestions'} onClick={() => changeView('suggestions')} className={`inline-flex h-10 items-center gap-2 rounded-sm px-4 text-sm font-bold ${view === 'suggestions' ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <Lightbulb size={16} /> Sugestões dos usuários
        </button>
      </div>

      <AdminCollectionTablePanel title={view === 'entries' ? 'Arquivo de novidades' : 'Sugestões recebidas pelo suporte'}>
        <table className={ADMIN_COLLECTION_TABLE_CLASS}>
          <thead className={ADMIN_COLLECTION_TABLE_HEAD_CLASS}>
            {view === 'entries' ? (
              <tr><th className="p-4">Novidade</th><th className="p-4">Data</th><th className="p-4">Responsável</th><th className="p-4">Publicação</th></tr>
            ) : (
              <tr><th className="p-4">Sugestão</th><th className="p-4">Usuário</th><th className="p-4">Votos</th><th className="p-4">Status do produto</th></tr>
            )}
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={4} className="p-10 text-center text-sm text-slate-500">Carregando...</td></tr>
            ) : errorMessage ? (
              <tr><td colSpan={4} className="p-10 text-center text-sm text-red-600 dark:text-red-400">{errorMessage}</td></tr>
            ) : visibleCount === 0 ? (
              <tr><td colSpan={4} className="p-10 text-center text-sm font-semibold text-slate-400">Nenhum item encontrado.</td></tr>
            ) : view === 'entries' ? items.map((entry) => (
              <tr key={entry.id} className={ADMIN_COLLECTION_TABLE_ROW_CLASS}>
                <td className="max-w-xl p-4">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{entry.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{entry.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <Link href={buildAdminChangelogEditPath(entry.id)} prefetch={false} className="font-medium text-sky-700 hover:underline dark:text-sky-300">Editar</Link>
                    {entry.status === 'published' ? <><span className="text-slate-300">|</span><Link href={`/novidades#${entry.slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline dark:text-sky-300">Ver <ExternalLink size={11} /></Link></> : null}
                    <span className="text-slate-300">|</span>
                    <button type="button" onClick={() => setPendingArchive(entry)} className="font-medium text-red-600 hover:underline dark:text-red-400">Arquivar</button>
                  </div>
                </td>
                <td className="whitespace-nowrap p-4 text-slate-600 dark:text-slate-300">{formatDate(entry.publishedAt || entry.releaseDate)}</td>
                <td className="p-4 text-slate-600 dark:text-slate-300">{entry.updatedBy?.name || entry.createdBy?.name || '-'}</td>
                <td className="p-4"><AdminPublishStateBadge state={resolveAdminPublishState(entry as unknown as Record<string, unknown>)} /></td>
              </tr>
            )) : suggestions.map((suggestion) => {
              const label = PRODUCT_STATUS_OPTIONS.find((option) => option.value === suggestion.status)?.label || 'Pendente';
              return (
                <tr key={suggestion.id} className={ADMIN_COLLECTION_TABLE_ROW_CLASS}>
                  <td className="max-w-xl p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{suggestion.title}</p>
                      <span className={`rounded-sm border px-2 py-1 text-[10px] font-black uppercase ${suggestionBadgeClass[suggestion.status]}`}>{label}</span>
                      <span className="rounded-sm border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        Vers&atilde;o {suggestion.platformVersion || '1.0.0'}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-xs leading-5 text-slate-500">{suggestion.details || 'Sem detalhes adicionais.'}</p>
                    <p className="mt-2 text-[11px] text-slate-400">Enviada em {formatDate(suggestion.createdAt)} · Atendimento: {suggestion.supportStatus}</p>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    <p className="font-medium">{suggestion.user.name || 'Usuário'}</p>
                    <p className="mt-1 text-xs text-slate-400">{suggestion.user.email || '-'}</p>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1"><ThumbsUp size={13} /> {suggestion.likes}</span>
                    <span className="ml-3 inline-flex items-center gap-1"><ThumbsDown size={13} /> {suggestion.dislikes}</span>
                  </td>
                  <td className="p-4">
                    <select
                      aria-label={`Status da sugestão ${suggestion.id}`}
                      value={suggestion.status}
                      disabled={updatingSuggestionId === suggestion.id}
                      onChange={(event) => void updateSuggestionStatus(suggestion, event.target.value as SuggestionProductStatus)}
                      className={`${ADMIN_FIELD_CLASS} h-10 min-w-40`}
                    >
                      {PRODUCT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCollectionTablePanel>

      <AdminCollectionPagination
        visibleCount={visibleCount}
        totalCount={total}
        itemLabel={view === 'entries' ? 'novidades' : 'sugestões'}
        page={page}
        totalPages={Math.max(1, totalPages)}
        onPageChange={setPage}
      />

      <AdminConfirmDialog
        isOpen={Boolean(pendingArchive)}
        title="Arquivar novidade"
        description={`A novidade "${pendingArchive?.title || ''}" deixará de aparecer na página pública.`}
        confirmLabel="Arquivar"
        loading={archiving}
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => void archiveEntry()}
      />
    </div>
  );
};

export default AdminChangelogSection;
