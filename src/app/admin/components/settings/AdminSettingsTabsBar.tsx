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
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[11px] font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <Save size={18} />
        {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
      </button>
    </div>
  );
};

export default AdminSettingsTabsBar;
