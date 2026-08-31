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
import { LayoutTemplate, Link2, Megaphone, Palette } from 'lucide-react';
import type { SystemSettings } from '@types';
import type { AdminMarketingSection as AdminMarketingSectionKey } from '../shared/useAdminPageController';
import {
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_SEGMENTED_TABS_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
} from '../shared/adminPanelStyles';
import AdminMarketing from '../finance/AdminMarketing';
import AdminLandingPagesManager from './AdminLandingPagesManager';
import AdminSocialLinksManager from './AdminSocialLinksManager';

interface AdminMarketingSectionProps {
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: SystemSettings) => void;
  saveSystemSettingsNow: (settings?: SystemSettings) => Promise<SystemSettings>;
  initialSection?: AdminMarketingSectionKey;
  onSectionChange?: (section: AdminMarketingSectionKey) => void;
  standaloneSection?: boolean;
}

const SECTIONS: Array<{
  key: AdminMarketingSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'landing-pages',
    label: 'Landing Pages',
    description: 'Paginas comerciais para aquisicao, campanhas e testes futuros.',
  },
  {
    key: 'campaigns',
    label: 'Campanhas',
    description: 'Promocoes ativas, campanha global e countdown comercial.',
  },
  {
    key: 'visual-themes',
    label: 'Temas visuais',
    description: 'Identidade visual promocional aplicada na plataforma.',
  },
  {
    key: 'social-links',
    label: 'Redes sociais',
    description: 'Links sociais exibidos na homepage da plataforma.',
  },
];

/**
 * Dominio administrativo de marketing.
 * Centraliza landing pages, campanhas e temas visuais sem misturar
 * a operacao comercial com financeiro ou settings.
 *
 * @since v1.0.0
 */
const AdminMarketingSection = ({
  systemSettings,
  updateSystemSettings,
  saveSystemSettingsNow,
  initialSection = 'landing-pages',
  onSectionChange,
  standaloneSection = false,
}: AdminMarketingSectionProps) => {
  const [activeSection, setActiveSection] = useState<AdminMarketingSectionKey>(initialSection);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setActiveSection(initialSection);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialSection]);

  const changeSection = (section: AdminMarketingSectionKey) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  const activeSectionMeta = SECTIONS.find((section) => section.key === activeSection) || SECTIONS[0];

  return (
    <div className="space-y-6">
      <div className={ADMIN_PAGE_PANEL_CLASS}>
        {standaloneSection ? null : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Marketing comercial
              </p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
                Aquisicao, campanhas e paginas de conversao
              </p>
            </div>

            <div className={`${ADMIN_SEGMENTED_TABS_CLASS} max-w-full`}>
              {SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => changeSection(section.key)}
                  className={`rounded-md border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                    activeSection === section.key
                      ? ADMIN_TAB_BUTTON_ACTIVE_CLASS
                      : ADMIN_TAB_BUTTON_IDLE_CLASS
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`mt-5 p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
              {activeSection === 'landing-pages' ? (
                <LayoutTemplate size={18} />
              ) : activeSection === 'campaigns' ? (
                <Megaphone size={18} />
              ) : activeSection === 'visual-themes' ? (
                <Palette size={18} />
              ) : (
                <Link2 size={18} />
              )}
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">
                {activeSectionMeta.label}
              </p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {activeSectionMeta.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {activeSection === 'landing-pages' ? (
        <AdminLandingPagesManager
          systemSettings={systemSettings}
          updateSystemSettings={updateSystemSettings}
          saveSystemSettingsNow={saveSystemSettingsNow}
        />
      ) : null}

      {activeSection === 'campaigns' ? (
        <AdminMarketing
          systemSettings={systemSettings}
          updateSystemSettings={updateSystemSettings}
          saveSystemSettingsNow={saveSystemSettingsNow}
          forcedSection="promo"
          hideSectionTabs
        />
      ) : null}

      {activeSection === 'visual-themes' ? (
        <AdminMarketing
          systemSettings={systemSettings}
          updateSystemSettings={updateSystemSettings}
          saveSystemSettingsNow={saveSystemSettingsNow}
          forcedSection="themes"
          hideSectionTabs
        />
      ) : null}

      {activeSection === 'social-links' ? (
        <AdminSocialLinksManager
          systemSettings={systemSettings}
          updateSystemSettings={updateSystemSettings}
          saveSystemSettingsNow={saveSystemSettingsNow}
        />
      ) : null}
    </div>
  );
};

export default AdminMarketingSection;
