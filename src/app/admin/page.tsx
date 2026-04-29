'use client';

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

// Entrada oficial da area administrativa: casca fina entre controller, shell e conteudo por aba.
const Admin: React.FC = () => {
  const controller = useAdminPageController();
  const shouldShowPageHeader = controller.activeTab !== 'operation' && controller.activeTabLabel !== 'Conteudo';

  return (
    <AdminShellLayout
      activeTab={controller.activeTab}
      activeSectionKey={controller.activeSectionKey}
      onNavigateAdmin={controller.navigateAdminDestination}
      adminTabs={controller.adminTabs}
      sectionBadges={controller.sectionBadges}
      pageTitle={controller.activeTabLabel ?? 'Admin'}
      pageDescription={controller.activeTabDescription}
      topBarProps={controller.topBarProps}
      showPageHeader={shouldShowPageHeader}
    >
      <AdminPageContent {...controller} />
    </AdminShellLayout>
  );
};

export default Admin;
