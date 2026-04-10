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
import { Save, type LucideIcon } from 'lucide-react';

interface AdminSettingsTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface AdminSettingsTabsBarProps {
  tabs: AdminSettingsTabItem[];
  activeTab: string;
  isSaving: boolean;
  onChange: (section: string) => void;
  onSave: () => void;
}

/**
 * Renderiza a navegacao local e o CTA de persistencia da aba de configuracoes.
 * Mantem o header da tela enxuto e reaproveitavel sem mover regra de negocio.
 *
 * @since 1.0.0
 */
const AdminSettingsTabsBar = ({
  tabs,
  activeTab,
  isSaving,
  onChange,
  onSave,
}: AdminSettingsTabsBarProps) => {
  return (
    <div className="mb-4 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/50 bg-slate-100/50 p-1.5 dark:border-slate-800/50 dark:bg-slate-800/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id
                ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-3 text-xs font-bold uppercase tracking-widest text-white shadow-xl shadow-indigo-200 transition-all active:scale-95 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 dark:shadow-indigo-900/20"
      >
        <Save size={18} />
        {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
      </button>
    </div>
  );
};

export default AdminSettingsTabsBar;
