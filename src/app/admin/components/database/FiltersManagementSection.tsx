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
import { ChevronDown, Edit3, Plus, PlusCircle, Search, Trash2 } from 'lucide-react';
import type { GlobalTaxonomies, SystemSettings, TaxonomyItem } from '@types';
import { ADMIN_FIELD_CLASS, ADMIN_PAGE_PANEL_CLASS, ADMIN_SURFACE_CLASS, ADMIN_SURFACE_HEADER_CLASS } from '../shared/adminPanelStyles';

interface FilterTypeOption {
  key: string;
  label: string;
  hierarchical?: boolean;
}

interface FiltersManagementSectionProps {
  systemSettings: SystemSettings;
  filterTypes: FilterTypeOption[];
  activeFilterType: string;
  onActiveFilterTypeChange: (value: string) => void;
  filterSearch: string;
  onFilterSearchChange: (value: string) => void;
  onCreate: () => void;
  onAddChild: (type: string, parentId: number | string) => void;
  onEdit: (item: FilterListItem) => void;
  onDelete: (item: FilterListItem) => void;
}

type FilterListItem = TaxonomyItem & {
  id: string | number;
  type: string;
  parent_id?: string | number | null;
  taxonomyLevel?: string;
};

const withType = (items: TaxonomyItem[] | undefined, type: string): FilterListItem[] => (
  (items || []).map((item) => ({
    ...item,
    id: item.id,
    type,
  }))
);

const getUnifiedTaxonomyList = (systemSettings: SystemSettings, activeFilterType: string): FilterListItem[] => {
  if (!systemSettings.taxonomies) {
    return [];
  }

  const taxonomies: GlobalTaxonomies = systemSettings.taxonomies;
  const subjectTopics = taxonomies.subjectTopics?.length
    ? taxonomies.subjectTopics
    : (taxonomies.topics || []).filter((item) => item.taxonomyLevel === 'topico');
  const specificSubjects = taxonomies.specificSubjects?.length
    ? taxonomies.specificSubjects
    : (taxonomies.topics || []).filter((item) => item.taxonomyLevel === 'assunto');

  const allItems = [
    ...withType(taxonomies.agencies, 'banca'),
    ...withType(taxonomies.organizations, 'orgao'),
    ...withType(taxonomies.roles, 'cargo'),
    ...withType(taxonomies.subjects, 'materia'),
    ...withType(subjectTopics, 'topico'),
    ...withType(specificSubjects, 'assunto'),
    ...withType(taxonomies.careers, 'carreira'),
    ...withType(taxonomies.areas, 'area'),
    ...(taxonomies.years || []).map((year) => ({
      id: year,
      name: String(year),
      slug: String(year),
      type: 'ano',
    } satisfies FilterListItem)),
  ];

  if (activeFilterType === 'all') {
    return allItems;
  }

  return allItems.filter((item) => item.type === activeFilterType);
};

const getParentName = (systemSettings: SystemSettings, parentId: string | number | null | undefined) => {
  if (!parentId || !systemSettings.taxonomies) {
    return 'Item Raiz';
  }

  const taxonomies = systemSettings.taxonomies;
  const allLists = [
    ...(taxonomies.agencies || []),
    ...(taxonomies.organizations || []),
    ...(taxonomies.roles || []),
    ...(taxonomies.subjects || []),
    ...(taxonomies.topics || []),
    ...(taxonomies.subjectTopics || []),
    ...(taxonomies.specificSubjects || []),
    ...(taxonomies.careers || []),
    ...(taxonomies.areas || []),
  ];

  const parent = allLists.find((item) => String(item.id) === String(parentId));
  return parent ? parent.name : 'Item Raiz';
};

const FiltersManagementSection = ({
  systemSettings,
  filterTypes,
  activeFilterType,
  onActiveFilterTypeChange,
  filterSearch,
  onFilterSearchChange,
  onCreate,
  onAddChild,
  onEdit,
  onDelete,
}: FiltersManagementSectionProps) => {
  const visibleItems = getUnifiedTaxonomyList(systemSettings, activeFilterType).filter((item) => (
    (item.name || '').toLowerCase().includes(filterSearch.toLowerCase())
    || (item.sigla || '').toLowerCase().includes(filterSearch.toLowerCase())
    || (item.slug || '').toLowerCase().includes(filterSearch.toLowerCase())
    || (item.aliases || []).some((alias) => alias.toLowerCase().includes(filterSearch.toLowerCase()))
    || (item.keywords || []).some((keyword) => keyword.toLowerCase().includes(filterSearch.toLowerCase()))
  ));

  return (
    <div className="grid grid-cols-1 gap-6 animate-slide-up md:grid-cols-4">
      <div className={`${ADMIN_PAGE_PANEL_CLASS} h-fit md:col-span-1`}>
        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-2">Filtrar por Tipo</h3>
        <div className="space-y-1">
          {filterTypes.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => onActiveFilterTypeChange(type.key)}
              className={`flex w-full items-center justify-between rounded-md px-4 py-2.5 text-left text-sm font-medium transition-colors ${activeFilterType === type.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
            >
              {type.label}
              <ChevronDown size={14} className={activeFilterType === type.key ? 'rotate-[-90deg]' : 'opacity-0'} />
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-md border border-indigo-100 bg-indigo-50 p-4 text-xs font-medium text-indigo-900 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-200">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-indigo-500 dark:text-indigo-300">Regra de estudo</p>
          <p className="font-bold">Materia -&gt; Topico -&gt; Assunto</p>
          <p className="mt-2 text-indigo-700 dark:text-indigo-300">
            Todo topico pertence a uma materia. Todo assunto pertence a um topico.
          </p>
        </div>
      </div>

      <div className="md:col-span-3 space-y-4">
        <div className={`${ADMIN_PAGE_PANEL_CLASS} flex flex-col items-center justify-between gap-4 md:flex-row`}>
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Pesquisar em todas as taxonomias..."
              value={filterSearch}
              onChange={(event) => onFilterSearchChange(event.target.value)}
              className={`${ADMIN_FIELD_CLASS} w-full pl-10 pr-4`}
            />
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 md:w-auto"
          >
            <Plus size={18} /> Novo Filtro
          </button>
        </div>

        <div className={`${ADMIN_SURFACE_CLASS} overflow-hidden overflow-x-auto no-scrollbar`}>
          <div className={ADMIN_SURFACE_HEADER_CLASS}>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Taxonomias e filtros</p>
          </div>
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-4">Nome / Hierarquia</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Slug (URL)</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {visibleItems.map((item) => (
                <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
                      {item.assetUrl && (
                        <img src={item.assetUrl} alt="" className="h-7 w-7 rounded object-contain" loading="lazy" />
                      )}
                      <span>{item.name}</span>
                      {item.sigla && item.sigla.toLowerCase() !== item.name.toLowerCase() && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
                          {item.sigla}
                        </span>
                      )}
                    </div>
                    {(item.parentId || item.parent_id) && (
                      <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <span className="opacity-50">Subitem de:</span>
                        {getParentName(systemSettings, item.parentId || item.parent_id)}
                      </div>
                    )}
                    {item.type === 'materia' && (
                      <div className="text-[10px] text-slate-400 font-medium">Raiz do conhecimento</div>
                    )}
                    {(item.type === 'topico' || item.type === 'assunto' || item.type === 'cargo') && !(item.parentId || item.parent_id) && (
                      <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400">Sem raiz definida</div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-slate-700">
                      {filterTypes.find((type) => type.key === item.type)?.label || item.type}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-[10px]">{item.slug}</td>
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
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="rounded-md p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FiltersManagementSection;
