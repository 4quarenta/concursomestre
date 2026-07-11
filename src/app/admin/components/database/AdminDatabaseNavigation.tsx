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
import { ArrowRight, type LucideIcon } from 'lucide-react';
import {
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
} from '../shared/adminPanelStyles';

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
  bulkImportEnabled: boolean;
  standaloneSection?: boolean;
}

/**
 * Navegação interna da aba Operação.
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
  bulkImportEnabled,
}: AdminDatabaseNavigationProps) => {
  const activeCategoryConfig = categories.find((category) => category.id === activeCategory);
  const visibleTabs = (activeCategoryConfig?.tabs || []).filter((tab) => (
    tab !== 'import' || bulkImportEnabled
  ));
  const activeSectionMeta = subTabMeta[activeSubTab];

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
                className={`rounded-md border p-5 text-left transition-colors ${
                  isActive
                    ? ADMIN_TAB_BUTTON_ACTIVE_CLASS
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={`rounded-md p-3 ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
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

        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Pertence a</p>
          <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">{activeCategoryConfig?.label || 'Conteúdo'}</p>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            {activeCategoryConfig?.description}
          </p>

          {activeSectionMeta ? (
            <div className={`mt-4 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Seção ativa</p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{activeSectionMeta.label}</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                {activeSectionMeta.description}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className={ADMIN_PAGE_PANEL_CLASS}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Seções do domínio</p>
          <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
            {activeCategoryConfig?.label || 'Conteúdo'} organizado por responsabilidade
          </p>
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
                className={`rounded-md border p-4 text-left transition-colors ${
                  isActive
                    ? 'border-sky-700 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/20'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.18em] ${isActive ? 'text-sky-700 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      {subTabLabels[tab] || tab}
                    </p>
                    <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                      {meta?.description || 'Secao operacional do admin.'}
                    </p>
                  </div>
                  <ArrowRight size={16} className={isActive ? 'text-sky-700 dark:text-sky-300' : 'text-slate-300 dark:text-slate-600'} />
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
