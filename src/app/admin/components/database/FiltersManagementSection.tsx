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
import type { SystemSettings } from '@types';

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
  onAddChild: (type: string, parentId: number) => void;
  onEdit: (item: any) => void;
  onDelete: (id: number) => void;
}

const getUnifiedTaxonomyList = (systemSettings: SystemSettings, activeFilterType: string) => {
  if (!systemSettings.taxonomies) {
    return [];
  }

  const taxonomies = systemSettings.taxonomies;
  const safeMap = (items: any[] | undefined, type: string) => (items || []).map((item: any) => ({ ...item, type }));

  const allItems = [
    ...safeMap(taxonomies.agencies, 'banca'),
    ...safeMap(taxonomies.organizations, 'orgao'),
    ...safeMap(taxonomies.roles, 'cargo'),
    ...safeMap(taxonomies.subjects, 'assunto'),
    ...safeMap(taxonomies.topics, 'assunto'),
    ...safeMap(taxonomies.careers, 'carreira'),
    ...safeMap(taxonomies.areas, 'area'),
    ...(taxonomies.years || []).map((year: any) => ({
      id: year,
      name: String(year),
      slug: String(year),
      type: 'ano',
    })),
  ];

  if (activeFilterType === 'all') {
    return allItems;
  }

  return allItems.filter((item) => item.type === activeFilterType);
};

const getParentName = (systemSettings: SystemSettings, parentId: number | null | undefined) => {
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
    ...(taxonomies.careers || []),
    ...(taxonomies.areas || []),
  ];

  const parent = allLists.find((item: any) => item.id === parentId);
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
  const visibleItems = getUnifiedTaxonomyList(systemSettings, activeFilterType).filter((item: any) => (
    (item.name || '').toLowerCase().includes(filterSearch.toLowerCase())
    || (item.slug || '').toLowerCase().includes(filterSearch.toLowerCase())
  ));

  return (
    <div className="grid grid-cols-1 gap-6 animate-slide-up md:grid-cols-4">
      <div className="md:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm h-fit">
        <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-2">Filtrar por Tipo</h3>
        <div className="space-y-1">
          {filterTypes.map((type) => (
            <button
              key={type.key}
              type="button"
              onClick={() => onActiveFilterTypeChange(type.key)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${activeFilterType === type.key ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            >
              {type.label}
              <ChevronDown size={14} className={activeFilterType === type.key ? 'rotate-[-90deg]' : 'opacity-0'} />
            </button>
          ))}
        </div>
      </div>

      <div className="md:col-span-3 space-y-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Pesquisar em todas as taxonomias..."
              value={filterSearch}
              onChange={(event) => onFilterSearchChange(event.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={onCreate}
            className="w-full md:w-auto h-11 px-6 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus size={18} /> Novo Filtro
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 uppercase font-bold border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="p-4">Nome / Parentesco</th>
                <th className="p-4">Tipo</th>
                <th className="p-4">Slug (URL)</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {visibleItems.map((item: any) => (
                <tr key={`${item.type}-${item.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{item.name}</div>
                    {(item.parentId || item.parent_id) && (
                      <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <span className="opacity-50">Subitem de:</span>
                        {getParentName(systemSettings, item.parentId || item.parent_id)}
                      </div>
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
                      {filterTypes.find((type) => type.key === item.type)?.hierarchical && (
                        <button
                          type="button"
                          onClick={() => onAddChild(item.type, item.id)}
                          title="Adicionar Subitem"
                          className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all"
                        >
                          <PlusCircle size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all"
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
