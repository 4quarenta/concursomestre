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
import {
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SEGMENTED_TABS_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
} from '../shared/adminPanelStyles';

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
      <div className={ADMIN_SEGMENTED_TABS_CLASS}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 rounded-md border px-4 py-2 text-[11px] font-semibold transition-colors ${
              activeTab === tab.id
                ? ADMIN_TAB_BUTTON_ACTIVE_CLASS
                : ADMIN_TAB_BUTTON_IDLE_CLASS
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className={`${ADMIN_PRIMARY_BUTTON_CLASS} px-6 py-3`}
      >
        <Save size={18} />
        {isSaving ? 'Salvando...' : 'Salvar alteracoes'}
      </button>
    </div>
  );
};

export default AdminSettingsTabsBar;
