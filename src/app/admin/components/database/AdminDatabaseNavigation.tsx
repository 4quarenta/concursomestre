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
import { Plus, Search, type LucideIcon } from 'lucide-react';

interface AdminDatabaseCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  tabs: string[];
}

interface AdminDatabaseNavigationProps {
  categories: AdminDatabaseCategory[];
  activeCategory: string;
  onSelectCategory: (categoryId: string, firstTab: string) => void;
  activeSubTab: string;
  onSelectSubTab: (tab: string) => void;
  subTabLabels: Record<string, string>;
  filter: string;
  onFilterChange: (value: string) => void;
  bulkImportEnabled: boolean;
  onCreateQuestion: () => void;
}

const AdminDatabaseNavigation = ({
  categories,
  activeCategory,
  onSelectCategory,
  activeSubTab,
  onSelectSubTab,
  subTabLabels,
  filter,
  onFilterChange,
  bulkImportEnabled,
  onCreateQuestion,
}: AdminDatabaseNavigationProps) => {
  const visibleTabs = (categories.find((category) => category.id === activeCategory)?.tabs || []).filter((tab) => (
    tab !== 'import' || bulkImportEnabled
  ));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-1 shadow-sm transition-all duration-300 dark:border-slate-800 dark:bg-slate-900">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelectCategory(category.id, category.tabs[0])}
            className={`flex flex-1 items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black uppercase tracking-widest transition-all ${activeCategory === category.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-none' : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'}`}
          >
            <category.icon size={18} />
            {category.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-dashed border-slate-200 bg-white/50 p-4 transition-colors duration-300 md:flex-row dark:border-slate-800 dark:bg-slate-900/50">
        <div className="no-scrollbar flex gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onSelectSubTab(tab)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${activeSubTab === tab ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-300' : 'text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400'}`}
            >
              {subTabLabels[tab] || tab}
            </button>
          ))}
        </div>

        <div className="flex w-full items-center gap-2 md:w-auto">
          {activeSubTab !== 'questions' ? (
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Filtrar dados..."
                value={filter}
                onChange={(event) => onFilterChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 text-[11px] font-bold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onCreateQuestion}
                className="flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-bold uppercase text-white shadow-md transition-all active:scale-95 hover:bg-indigo-700"
              >
                <Plus size={16} /> Nova Questao
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDatabaseNavigation;
