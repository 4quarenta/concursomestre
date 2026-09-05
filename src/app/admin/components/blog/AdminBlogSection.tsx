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
import { ExternalLink, Newspaper, RefreshCcw } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import { blogService, type BlogArticle } from '@services/blog';
import { buildAdminBlogEditPath } from '../../config/adminPageNavigationConfig';
import AdminCollectionPagination from '../shared/AdminCollectionPagination';
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
import AdminCollectionTablePanel from '../shared/AdminCollectionTablePanel';
import { AdminRowActions } from '../shared/AdminDesignSystem';

const PAGE_SIZE = 30;

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const AdminBlogSection = () => {
  const { addToast } = useToast();
  const [items, setItems] = React.useState<BlogArticle[]>([]);
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [pendingArchive, setPendingArchive] = React.useState<BlogArticle | null>(null);
  const [archiving, setArchiving] = React.useState(false);
  const cursorsByPage = React.useRef<Record<number, string | null>>({ 1: null });
  const requestSequence = React.useRef(0);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = search.trim();
      if (nextSearch === appliedSearch) return;
      cursorsByPage.current = { 1: null };
      setPage(1);
      setAppliedSearch(nextSearch);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [appliedSearch, search]);

  const load = React.useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setErrorMessage('');
    try {
      const result = await blogService.adminList({
        limit: PAGE_SIZE,
        ...(appliedSearch ? { search: appliedSearch } : {}),
        ...(status ? { status } : {}),
        ...(cursorsByPage.current[page] ? { cursor: cursorsByPage.current[page] || undefined } : {}),
      });
      if (sequence !== requestSequence.current) return;

      setItems(result.items || []);
      setTotal(Number(result.pageInfo.total ?? result.items.length));
      if (result.pageInfo.nextCursor) {
        cursorsByPage.current[page + 1] = result.pageInfo.nextCursor;
      }
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setItems([]);
      setErrorMessage(error instanceof Error ? error.message : 'Não foi possível carregar os posts.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [appliedSearch, page, status]);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const archiveArticle = async () => {
    if (!pendingArchive) return;
    setArchiving(true);
    try {
      await blogService.archive(pendingArchive.id);
      addToast('Post arquivado.', 'success');
      setPendingArchive(null);
      await load();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Não foi possível arquivar o post.', 'error');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="space-y-4">
      <AdminCollectionToolbar
        title="Blog"
        description="Cadastro, revisão editorial, agendamento e publicação dos posts do blog."
        itemCount={total}
        itemCountLabel="posts"
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar posts..."
        primaryActionLabel="Adicionar novo"
        primaryActionHref={buildAdminBlogEditPath('new')}
        actions={(
          <>
            <select
              aria-label="Filtrar posts por status"
              value={status}
              onChange={(event) => {
                cursorsByPage.current = { 1: null };
                setPage(1);
                setStatus(event.target.value);
              }}
              className={`${ADMIN_FIELD_CLASS} h-10 min-w-40`}
            >
              <option value="">Todos os status</option>
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendado</option>
              <option value="published">Publicado</option>
              <option value="archived">Arquivado</option>
            </select>
            <button type="button" onClick={() => void load()} className={ADMIN_SECONDARY_BUTTON_CLASS}>
              <RefreshCcw size={14} /> Atualizar
            </button>
          </>
        )}
      />

      <AdminCollectionTablePanel title="Biblioteca de posts">
        <table className={ADMIN_COLLECTION_TABLE_CLASS}>
            <thead className={ADMIN_COLLECTION_TABLE_HEAD_CLASS}>
              <tr>
                <th className="p-4">Post</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Autor</th>
                <th className="p-4">Engajamento</th>
                <th className="p-4">Atualização</th>
                <th className="p-4">Publicação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={6} className="p-10 text-center text-sm text-slate-500">Carregando posts...</td></tr>
              ) : errorMessage ? (
                <tr><td colSpan={6} className="p-10 text-center text-sm text-red-600 dark:text-red-400">{errorMessage}</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Newspaper size={20} />
                      <p className="text-sm font-semibold">Nenhum post encontrado.</p>
                    </div>
                  </td>
                </tr>
              ) : items.map((article) => (
                <tr key={article.id} className={ADMIN_COLLECTION_TABLE_ROW_CLASS}>
                  <td className="max-w-md p-4">
                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{article.title}</p>
                    <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{article.excerpt || 'Sem resumo editorial.'}</p>
                    <div className="mt-2">
                      <AdminRowActions>
                      <Link href={buildAdminBlogEditPath(article.id)} prefetch={false} className="font-medium text-sky-700 hover:underline dark:text-sky-300">Editar</Link>
                      {article.status === 'published' ? (
                        <>
                          <span className="text-slate-300 dark:text-slate-700">|</span>
                          <Link href={`/blog/${article.slug}`} prefetch={false} target="_blank" className="inline-flex items-center gap-1 font-medium text-sky-700 hover:underline dark:text-sky-300">
                            Ver <ExternalLink size={11} />
                          </Link>
                        </>
                      ) : null}
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <button type="button" onClick={() => setPendingArchive(article)} className="font-medium text-red-600 hover:underline dark:text-red-400">Arquivar</button>
                      </AdminRowActions>
                    </div>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{article.taxonomy.category.label || '-'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{article.author?.name || '-'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">
                    {article.engagement?.likesCount || 0} curtidas · {article.engagement?.commentsCount || 0} comentários
                  </td>
                  <td className="whitespace-nowrap p-4 text-slate-600 dark:text-slate-300">{formatDate(article.updatedAt)}</td>
                  <td className="p-4"><AdminPublishStateBadge state={resolveAdminPublishState(article as unknown as Record<string, unknown>)} /></td>
                </tr>
              ))}
            </tbody>
        </table>
      </AdminCollectionTablePanel>

      <AdminCollectionPagination
        visibleCount={items.length}
        totalCount={total}
        itemLabel="posts"
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <AdminConfirmDialog
        isOpen={Boolean(pendingArchive)}
        title="Arquivar post"
        description={`O post "${pendingArchive?.title || ''}" deixará de aparecer no blog público, mas seu histórico será preservado.`}
        confirmLabel="Arquivar post"
        loading={archiving}
        onCancel={() => setPendingArchive(null)}
        onConfirm={() => void archiveArticle()}
      />
    </div>
  );
};

export default AdminBlogSection;
