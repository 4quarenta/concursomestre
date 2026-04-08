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
import AdminPageContent from './components/shared/AdminPageContent';
import AdminShellLayout from './components/shared/AdminShellLayout';
import { useAdminPageController } from './components/shared/useAdminPageController';

/**
 * Entrada oficial da area administrativa.
 * Esta pagina funciona apenas como casca final do painel, conectando o controller central ao shell visual e ao conteúdo por aba.
 */
const Admin: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeTabLabel,
    activeTabDescription,
    activeSectionLabel,
    adminTabs,
    topBarProps,
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
  } = useAdminPageController();

  return (
    <AdminShellLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      adminTabs={adminTabs}
      pageTitle={activeTabLabel ?? 'Admin'}
      pageDescription={activeTabDescription}
      activeSectionLabel={activeSectionLabel}
      topBarProps={topBarProps}
    >
      <AdminPageContent
        activeTab={activeTab}
        panelSectionProps={panelSectionProps}
        panelSectionKey={panelSectionKey}
        databaseSectionProps={databaseSectionProps}
        databaseSectionKey={databaseSectionKey}
        financeSectionProps={financeSectionProps}
        financeSectionKey={financeSectionKey}
        supportSectionProps={supportSectionProps}
        supportSectionKey={supportSectionKey}
        settingsSectionProps={settingsSectionProps}
        settingsSectionKey={settingsSectionKey}
      />
    </AdminShellLayout>
  );
};

export default Admin;
