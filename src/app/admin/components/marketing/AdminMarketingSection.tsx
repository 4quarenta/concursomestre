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

import React, { useEffect, useState } from 'react';
import { LayoutTemplate, Megaphone } from 'lucide-react';
import type { SystemSettings } from '@types';
import type { AdminMarketingSection as AdminMarketingSectionKey } from '../shared/useAdminPageController';
import AdminLandingPagesManager from './AdminLandingPagesManager';

interface AdminMarketingSectionProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
  initialSection?: AdminMarketingSectionKey;
  onSectionChange?: (section: AdminMarketingSectionKey) => void;
}

const SECTIONS: Array<{
  key: AdminMarketingSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'landing-pages',
    label: 'Landing Pages',
    description: 'Páginas comerciais para aquisição, campanhas e testes futuros.',
  },
];

/**
 * Domínio administrativo de marketing.
 * Centraliza a gestão de landing pages sem misturar a operação comercial com financeiro ou settings.
 *
 * @since v1.0.0
 */
const AdminMarketingSection = ({
  systemSettings,
  updateSystemSettings,
  saveSystemSettingsNow,
  initialSection = 'landing-pages',
  onSectionChange,
}: AdminMarketingSectionProps) => {
  const [activeSection, setActiveSection] = useState<AdminMarketingSectionKey>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const changeSection = (section: AdminMarketingSectionKey) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Marketing comercial</p>
            <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">Aquisição, campanhas e páginas de conversão</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => changeSection(section.key)}
                className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                  activeSection === section.key
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
              {activeSection === 'landing-pages' ? <LayoutTemplate size={18} /> : <Megaphone size={18} />}
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                {SECTIONS.find((section) => section.key === activeSection)?.label}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {SECTIONS.find((section) => section.key === activeSection)?.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AdminLandingPagesManager
        systemSettings={systemSettings}
        updateSystemSettings={updateSystemSettings}
        saveSystemSettingsNow={saveSystemSettingsNow}
      />
    </div>
  );
};

export default AdminMarketingSection;
