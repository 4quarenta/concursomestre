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
  marketplaceSectionKey: string;
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
  const marketplaceUsesDatabaseSurface = ['materials', 'blocked'].includes(props.marketplaceSectionKey);
  const supportUsesDatabaseSurface = ['rankings'].includes(props.supportSectionKey);
  const supportUsesFinanceSurface = ['refunds'].includes(props.supportSectionKey);

  switch (props.activeTab) {
    case 'panel':
      return <AdminPanelSection key={props.panelSectionKey} {...props.panelSectionProps} />;
    case 'operation':
      return <AdminDatabaseManager key={props.databaseSectionKey} {...props.databaseSectionProps} />;
    case 'marketplace':
      if (marketplaceUsesDatabaseSurface) {
        return (
          <AdminDatabaseManager
            key={`marketplace-${props.marketplaceSectionKey}`}
            {...props.databaseSectionProps}
            initialTab={props.marketplaceSectionKey}
            standaloneSection
          />
        );
      }
      return (
        <AdminFinanceSection
          key="marketplace-vendors"
          {...props.financeSectionProps}
          initialSection="subscriptions"
          standaloneSection
        />
      );
    case 'finance':
      return <AdminFinanceSection key={props.financeSectionKey} {...props.financeSectionProps} />;
    case 'marketing':
      return <AdminMarketingSection key={props.marketingSectionKey} {...props.marketingSectionProps} />;
    case 'support':
      if (supportUsesFinanceSurface) {
        return (
          <AdminFinanceSection
            key={`support-${props.supportSectionKey}`}
            {...props.financeSectionProps}
            initialSection="refunds"
            standaloneSection
          />
        );
      }
      if (supportUsesDatabaseSurface) {
        return (
          <AdminDatabaseManager
            key={`support-${props.supportSectionKey}`}
            {...props.databaseSectionProps}
            initialTab={props.supportSectionKey}
            standaloneSection
          />
        );
      }
      return <AdminSupportSection key={props.supportSectionKey} {...props.supportSectionProps} />;
    case 'settings':
      return <AdminSettingsSection key={props.settingsSectionKey} {...props.settingsSectionProps} />;
    default:
      return null;
  }
};

export default AdminPageContent;
