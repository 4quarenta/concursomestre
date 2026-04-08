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
import AdminDatabaseManager from '../database/AdminDatabaseManager';
import AdminFinanceSection from '../finance/AdminFinance';
import AdminPanelSection from '../panel/AdminPanelSection';
import AdminSettingsSection from '../settings/AdminSettings';
import AdminSupportSection from '../support/AdminSupportSection';
import type { AdminPageTab } from './useAdminPageController';

interface AdminPageContentProps {
  activeTab: AdminPageTab;
  panelSectionProps: React.ComponentProps<typeof AdminPanelSection>;
  panelSectionKey: string;
  databaseSectionProps: React.ComponentProps<typeof AdminDatabaseManager>;
  databaseSectionKey: string;
  financeSectionProps: React.ComponentProps<typeof AdminFinanceSection>;
  financeSectionKey: string;
  supportSectionProps: React.ComponentProps<typeof AdminSupportSection>;
  supportSectionKey: string;
  settingsSectionProps: React.ComponentProps<typeof AdminSettingsSection>;
  settingsSectionKey: string;
}

/**
 * Roteia o conteudo principal pelos cinco dominios oficiais do admin.
 *
 * @since 1.0.0
 */
const AdminPageContent = ({
  activeTab,
  panelSectionProps,
  panelSectionKey,
  databaseSectionProps,
  databaseSectionKey,
  financeSectionProps,
  financeSectionKey,
  supportSectionProps,
  supportSectionKey,
  settingsSectionProps,
  settingsSectionKey,
}: AdminPageContentProps) => {
  if (activeTab === 'panel') {
    return <AdminPanelSection {...panelSectionProps} key={panelSectionKey} />;
  }

  if (activeTab === 'operation') {
    return <AdminDatabaseManager {...databaseSectionProps} key={databaseSectionKey} />;
  }

  if (activeTab === 'finance') {
    return <AdminFinanceSection {...financeSectionProps} key={financeSectionKey} />;
  }

  if (activeTab === 'support') {
    return <AdminSupportSection {...supportSectionProps} key={supportSectionKey} />;
  }

  if (activeTab === 'settings') {
    return <AdminSettingsSection {...settingsSectionProps} key={settingsSectionKey} />;
  }

  return null;
};

export default AdminPageContent;
