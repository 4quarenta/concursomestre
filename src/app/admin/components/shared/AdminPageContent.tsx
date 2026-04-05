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
import AdminDashboardSection from '../dashboard/AdminDashboard';
import AdminFinanceSection from '../finance/AdminFinance';
import AdminSettingsSection from '../settings/AdminSettings';
import { AdminFeedback } from '../support/AdminFeedback';
import type { AdminPageTab } from './useAdminPageController';

interface AdminPageContentProps {
  activeTab: AdminPageTab;
  dashboardSectionProps: React.ComponentProps<typeof AdminDashboardSection>;
  databaseSectionProps: React.ComponentProps<typeof AdminDatabaseManager>;
  databaseSectionKey: string;
  financeSectionProps: React.ComponentProps<typeof AdminFinanceSection>;
  financeSectionKey: string;
  settingsSectionProps: React.ComponentProps<typeof AdminSettingsSection>;
}

/**
 * Roteia o conteudo principal do painel administrativo.
 * Ele recebe os props prontos do controller da pagina e monta a feature correta para cada aba do admin.
 */
const AdminPageContent = ({
  activeTab,
  dashboardSectionProps,
  databaseSectionProps,
  databaseSectionKey,
  financeSectionProps,
  financeSectionKey,
  settingsSectionProps,
}: AdminPageContentProps) => {
  if (activeTab === 'dashboard') {
    return <AdminDashboardSection {...dashboardSectionProps} />;
  }

  if (activeTab === 'database') {
    return <AdminDatabaseManager {...databaseSectionProps} key={databaseSectionKey} />;
  }

  if (activeTab === 'finance') {
    return <AdminFinanceSection {...financeSectionProps} key={financeSectionKey} />;
  }

  if (activeTab === 'feedback') {
    return <AdminFeedback />;
  }

  if (activeTab === 'settings') {
    return <AdminSettingsSection {...settingsSectionProps} />;
  }

  return null;
};

export default AdminPageContent;
