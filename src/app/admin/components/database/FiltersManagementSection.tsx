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
import { ChevronDown, Edit3, Loader2, Plus, PlusCircle, Search, Trash2, X } from 'lucide-react';
import type { TaxonomyItem, TaxonomyUsage, TaxonomyUsageSummary } from '@types';
import { filtersService, type AdminFilterListItem } from '@services/filters';
import { ADMIN_FIELD_CLASS, ADMIN_PAGE_PANEL_CLASS, ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';
import AdminCollectionPagination from '../shared/AdminCollectionPagination';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';

interface FilterTypeOption {
  key: string;
  label: string;
  hierarchical?: boolean;
}

interface FiltersManagementSectionProps {
  filterTypes: FilterTypeOption[];
  activeFilterType: string;
  onActiveFilterTypeChange: (value: string) => void;
  filterSearch: string;
  onFilterSearchChange: (value: string) => void;
  onCreate: () => void;
  onAddChild: (type: string, parentId: number | string) => void;
  onEdit: (item: FilterListItem) => void;
  onDelete: (item: FilterListItem) => void;
  onDeleteMany: (ids: number[]) => Promise<boolean>;
  isDeleting: boolean;
}

type FilterListItem = Omit<TaxonomyItem, 'id' | 'type' | 'parentId' | 'taxonomyLevel'> & {
  id: number;
  type: string;
  parentId?: string | number | null;
  parent_id?: string | number | null;
  parentName?: string | null;
  taxonomyLevel?: string;
};

const EMPTY_USAGE: TaxonomyUsage = { questions: 0, exams: 0, laws: 0, total: 0 };
const EMPTY_USAGE_SUMMARY: TaxonomyUsageSummary = { taxonomies: 0, ...EMPTY_USAGE };

const getUsageForType = (
  usage: { all: TaxonomyUsageSummary; byType: Record<string, TaxonomyUsageSummary> } | null,
  type: string,
): TaxonomyUsageSummary => {
  if (!usage) return EMPTY_USAGE_SUMMARY;
  return type === 'all'
    ? usage.all || EMPTY_USAGE_SUMMARY
    : usage.byType[type] || EMPTY_USAGE_SUMMARY;
};

const formatUsageSummary = (usage: TaxonomyUsageSummary) => (
  `${usage.taxonomies} tax. | ${usage.total} vinculos`
);

const normalizeListItem = (item: AdminFilterListItem): FilterListItem => ({
  id: item.id,
  type: item.type,
  name: item.name,
  slug: item.slug,
  sigla: item.sigla || undefined,
  parentId: item.parentId ?? undefined,
  parent_id: item.parentId ?? undefined,
  parentName: item.parentName ?? undefined,
  description: item.description || undefined,
  website: item.website || undefined,
  assetUrl: item.assetUrl || undefined,
  iconKey: item.iconKey || undefined,
  aliases: item.aliases || [],
  keywords: item.keywords || [],
  taxonomyLevel: item.taxonomyLevel || undefined,
  usage: item.usage || EMPTY_USAGE,
});

const FiltersManagementSection = ({
  filterTypes,
  activeFilterType,
  onActiveFilterTypeChange,
  filterSearch,
  onFilterSearchChange,
  onCreate,
  onAddChild,
  onEdit,
  onDelete,
  onDeleteMany,
  isDeleting,
}: FiltersManagementSectionProps) => {
  const [visibleItems, setVisibleItems] = React.useState<FilterListItem[]>([]);
  const [pagination, setPagination] = React.useState({
    page: 1,
    perPage: 50,
    total: 0,
    pages: 1,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState('');
  const [usageSummary, setUsageSummary] = React.useState<{
    all: TaxonomyUsageSummary;
    byType: Record<string, TaxonomyUsageSummary>;
  } | null>(null);
  const [refreshVersion, setRefreshVersion] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = React.useState(false);
  const selectAllRef = React.useRef<HTMLInputElement>(null);
  const deferredSearch = React.useDeferredValue(filterSearch.trim());

  React.useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setLoadError('');

    void filtersService.listAdminPage({
      page: pagination.page,
      perPage: pagination.perPage,
      type: activeFilterType,
      search: deferredSearch,
    }).then((response) => {
      if (!isActive) return;
      setVisibleItems(response.rows.map(normalizeListItem));
      setPagination({
        page: response.page,
        perPage: response.perPage,
        total: response.total,
        pages: response.pages,
      });
      setUsageSummary(response.usage);
    }).catch(() => {
      if (!isActive) return;
      setVisibleItems([]);
      setLoadError('Nao foi possivel carregar as taxonomias desta pagina.');
    }).finally(() => {
      if (isActive) setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, [activeFilterType, deferredSearch, pagination.page, pagination.perPage, refreshVersion]);

  React.useEffect(() => {
    const refresh = () => setRefreshVersion((current) => current + 1);
    window.addEventListener('admin-taxonomies-changed', refresh);
    return () => window.removeEventListener('admin-taxonomies-changed', refresh);
  }, []);

  const visibleIds = React.useMemo(() => visibleItems.map((item) => item.id), [visibleItems]);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleItemSelection = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmBulkDelete = async () => {
    const success = await onDeleteMany([...selectedIds]);
    if (success) {
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
    }
  };

  const changeFilterType = (type: string) => {
    setSelectedIds(new Set());
    setIsBulkDeleteOpen(false);
    onActiveFilterTypeChange(type);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const changeSearch = (value: string) => {
    setSelectedIds(new Set());
    setIsBulkDeleteOpen(false);
    onFilterSearchChange(value);
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const changePage = (page: number) => {
    setSelectedIds(new Set());
    setIsBulkDeleteOpen(false);
    setPagination((current) => ({ ...current, page }));
  };

  return (
    <>
    <div className="grid grid-cols-1 gap-6 animate-slide-up md:grid-cols-4">
      <div className={`${ADMIN_PAGE_PANEL_CLASS} h-fit md:col-span-1`}>
        <h3 className="mb-4 ml-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Filtrar por tipo</h3>
        <div className="space-y-1">
          {filterTypes.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => changeFilterType(type.key)}
              className={`flex w-full items-center justify-between rounded-md px-4 py-2.5 text-left text-sm font-medium transition-colors ${activeFilterType === type.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
            >
              <span className="min-w-0">
                <span className="block truncate">{type.label}</span>
                <span className={`mt-0.5 block text-[10px] font-semibold ${activeFilterType === type.key ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                  {formatUsageSummary(getUsageForType(usageSummary, type.key))}
                </span>
              </span>
              <ChevronDown size={14} className={activeFilterType === type.key ? 'shrink-0 rotate-[-90deg]' : 'shrink-0 opacity-0'} />
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-md border border-indigo-100 bg-indigo-50 p-4 text-xs font-medium text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300">Regra de estudo</p>
          <p className="font-bold">Materia -&gt; Topico -&gt; Assunto</p>
          <p className="mt-2 text-indigo-700 dark:text-indigo-300">Todo topico pertence a uma materia. Todo assunto pertence a um topico.</p>
        </div>
      </div>

      <div className="space-y-4 md:col-span-3">
        <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col items-center justify-between gap-4 md:flex-row`}>
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Pesquisar em todas as taxonomias..."
              value={filterSearch}
              onChange={(event) => changeSearch(event.target.value)}
              className={`${ADMIN_FIELD_CLASS} w-full pl-10 pr-4`}
            />
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 md:w-auto"
          >
            <Plus size={18} /> Novo filtro
          </button>
        </div>

        <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden overflow-x-auto no-scrollbar`}>
          <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex min-h-[57px] flex-wrap items-center justify-between gap-3`}>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Taxonomias e filtros</p>
              {selectedIds.size > 0 && (
                <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">{selectedIds.size} selecionada(s) nesta pagina</p>
              )}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={isDeleting}
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X size={14} /> Limpar selecao
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteOpen(true)}
                  disabled={isDeleting}
                  className="inline-flex h-9 items-center gap-2 rounded-md bg-red-700 px-3 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Excluir selecionadas
                </button>
              </div>
            )}
          </div>
          <table className="min-w-[800px] w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 font-bold uppercase text-slate-400 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-500">
              <tr>
                <th className="w-12 p-4 text-center">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleSelection}
                    disabled={visibleItems.length === 0 || isLoading || isDeleting}
                    aria-label="Selecionar todas as taxonomias desta pagina"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                </th>
                <th className="p-4">Nome / hierarquia</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Slug (URL)</th>
                <th className="p-4">Vinculos</th>
                <th className="p-4 text-center">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Carregando taxonomias...</span>
                  </td>
                </tr>
              )}
              {!isLoading && loadError && (
                <tr><td colSpan={6} className="p-10 text-center text-sm text-rose-600 dark:text-rose-400">{loadError}</td></tr>
              )}
              {!isLoading && !loadError && visibleItems.length === 0 && (
                <tr><td colSpan={6} className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhuma taxonomia encontrada.</td></tr>
              )}
              {!isLoading && !loadError && visibleItems.map((item) => {
                const usage = item.usage || EMPTY_USAGE;
                const hasParent = Boolean(item.parentId || item.parent_id);
                return (
                  <tr key={`${item.type}-${item.id}`} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        disabled={isDeleting}
                        aria-label={`Selecionar ${item.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                        {item.assetUrl && <img src={item.assetUrl} alt="" className="h-7 w-7 rounded object-contain" loading="lazy" />}
                        <span>{item.name}</span>
                        {item.sigla && item.sigla.toLowerCase() !== item.name.toLowerCase() && (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">{item.sigla}</span>
                        )}
                      </div>
                      {hasParent && (
                        <div className="flex items-center gap-1 text-[10px] font-medium text-slate-400">
                          <span className="opacity-50">Subitem de:</span>{item.parentName || 'Item raiz'}
                        </div>
                      )}
                      {item.type === 'materia' && <div className="text-[10px] font-medium text-slate-400">Raiz do conhecimento</div>}
                      {(item.type === 'topico' || item.type === 'assunto' || item.type === 'cargo') && !hasParent && (
                        <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Sem raiz definida</div>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        {filterTypes.find((type) => type.key === item.type)?.label || item.type}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-[10px] text-slate-500 dark:text-slate-400">{item.slug}</td>
                    <td className="p-4">
                      <div className="space-y-1 text-[10px] leading-none text-slate-500 dark:text-slate-400">
                        <div className="font-bold text-slate-700 dark:text-slate-200">{usage.total} vinculo{usage.total === 1 ? '' : 's'}</div>
                        <div className="whitespace-nowrap">{usage.questions} questoes | {usage.exams} provas | {usage.laws} leis</div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        {(item.type === 'materia' || item.type === 'topico' || item.type === 'carreira') && (
                          <button
                            type="button"
                            onClick={() => onAddChild(item.type, item.id)}
                            title={item.type === 'materia' ? 'Adicionar topico' : item.type === 'topico' ? 'Adicionar assunto' : 'Adicionar cargo'}
                            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600 dark:text-slate-500 dark:hover:bg-emerald-900/30 dark:hover:text-emerald-400"
                          >
                            <PlusCircle size={14} />
                          </button>
                        )}
                        <button type="button" onClick={() => onEdit(item)} className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"><Edit3 size={14} /></button>
                        <button type="button" onClick={() => onDelete(item)} className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AdminCollectionPagination
          visibleCount={visibleItems.length}
          totalCount={pagination.total}
          itemLabel="taxonomias"
          page={pagination.page}
          totalPages={pagination.pages}
          onPageChange={changePage}
        />
      </div>
    </div>
    <AdminConfirmDialog
      isOpen={isBulkDeleteOpen}
      title="Excluir taxonomias selecionadas"
      description={`${selectedIds.size} taxonomia(s) serao removida(s). Itens vinculados a questoes, provas, leis ou hierarquias protegidas nao podem ser excluidos.`}
      confirmLabel="Excluir selecionadas"
      loading={isDeleting}
      onCancel={() => {
        if (!isDeleting) setIsBulkDeleteOpen(false);
      }}
      onConfirm={() => void confirmBulkDelete()}
    />
    </>
  );
};

export default FiltersManagementSection;
