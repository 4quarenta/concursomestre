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
import { ArrowRight, Plus, Search, type LucideIcon } from 'lucide-react';

interface AdminDatabaseCategory {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tabs: string[];
}

interface AdminDatabaseSubTabMeta {
  label: string;
  description: string;
  category: string;
}

interface AdminDatabaseNavigationProps {
  categories: AdminDatabaseCategory[];
  activeCategory: string;
  onSelectCategory: (categoryId: string, firstTab: string) => void;
  activeSubTab: string;
  onSelectSubTab: (tab: string) => void;
  subTabLabels: Record<string, string>;
  subTabMeta: Record<string, AdminDatabaseSubTabMeta>;
  filter: string;
  onFilterChange: (value: string) => void;
  bulkImportEnabled: boolean;
  onCreateQuestion: () => void;
}

/**
 * Navegacao interna da aba Operacao.
 * Organiza as secoes por dominio para deixar claro o que pertence a cada grupo.
 *
 * @since 1.0.0
 */
const AdminDatabaseNavigation = ({
  categories,
  activeCategory,
  onSelectCategory,
  activeSubTab,
  onSelectSubTab,
  subTabLabels,
  subTabMeta,
  filter,
  onFilterChange,
  bulkImportEnabled,
  onCreateQuestion,
}: AdminDatabaseNavigationProps) => {
  const activeCategoryConfig = categories.find((category) => category.id === activeCategory);
  const visibleTabs = (activeCategoryConfig?.tabs || []).filter((tab) => (
    tab !== 'import' || bulkImportEnabled
  ));
  const activeSectionMeta = subTabMeta[activeSubTab];

  const searchPlaceholder = activeSubTab === 'users'
    ? 'Buscar usuarios...'
    : activeSubTab === 'exams'
      ? 'Buscar provas...'
    : activeSubTab === 'materials'
      ? 'Buscar materiais...'
      : activeSubTab === 'reports'
        ? 'Buscar denuncias...'
        : activeSubTab === 'filters'
          ? 'Buscar taxonomias...'
          : 'Filtrar dados...';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-4 md:grid-cols-3">
          {categories.map((category) => {
            const isActive = activeCategory === category.id;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id, category.tabs[0])}
                className={`rounded-lg border p-5 text-left transition-colors ${
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={`rounded-lg p-3 ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                    <category.icon size={18} />
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
                    {category.tabs.length} secoes
                  </span>
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.18em]">{category.label}</p>
                <p className={`mt-2 text-xs font-medium leading-relaxed ${isActive ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                  {category.description}
                </p>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Pertence a</p>
          <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">{activeCategoryConfig?.label || 'Operacao'}</p>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {activeCategoryConfig?.description}
          </p>

          {activeSectionMeta ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Secao ativa</p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{activeSectionMeta.label}</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                {activeSectionMeta.description}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Secoes do dominio</p>
            <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
              {activeCategoryConfig?.label || 'Operacao'} organizado por responsabilidade
            </p>
          </div>

          <div className="flex w-full items-center gap-2 lg:w-auto">
            {activeSubTab !== 'questions' ? (
              <div className="relative flex-1 lg:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={filter}
                  onChange={(event) => onFilterChange(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-4 text-[11px] font-bold text-slate-900 outline-none transition-colors focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={onCreateQuestion}
                className="flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Plus size={16} /> Nova questao
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleTabs.map((tab) => {
            const isActive = activeSubTab === tab;
            const meta = subTabMeta[tab];

            return (
              <button
                key={tab}
                type="button"
                onClick={() => onSelectSubTab(tab)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  isActive
                    ? 'border-blue-500 bg-blue-50 shadow-sm dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${isActive ? 'text-blue-600 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      {subTabLabels[tab] || tab}
                    </p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {meta?.description || 'Secao operacional do admin.'}
                    </p>
                  </div>
                  <ArrowRight size={16} className={isActive ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminDatabaseNavigation;
