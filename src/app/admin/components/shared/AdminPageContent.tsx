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
import AdminMarketingSection from '../marketing/AdminMarketingSection';
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
  marketingSectionProps: React.ComponentProps<typeof AdminMarketingSection>;
  marketingSectionKey: string;
  supportSectionProps: React.ComponentProps<typeof AdminSupportSection>;
  supportSectionKey: string;
  settingsSectionProps: React.ComponentProps<typeof AdminSettingsSection>;
  settingsSectionKey: string;
}

const AdminPageContent = (props: AdminPageContentProps) => {
  switch (props.activeTab) {
    case 'panel':
      return <AdminPanelSection key={props.panelSectionKey} {...props.panelSectionProps} />;
    case 'operation':
      return <AdminDatabaseManager key={props.databaseSectionKey} {...props.databaseSectionProps} />;
    case 'finance':
      return <AdminFinanceSection key={props.financeSectionKey} {...props.financeSectionProps} />;
    case 'marketing':
      return <AdminMarketingSection key={props.marketingSectionKey} {...props.marketingSectionProps} />;
    case 'support':
      return <AdminSupportSection key={props.supportSectionKey} {...props.supportSectionProps} />;
    case 'settings':
      return <AdminSettingsSection key={props.settingsSectionKey} {...props.settingsSectionProps} />;
    default:
      return null;
  }
};

export default AdminPageContent;
