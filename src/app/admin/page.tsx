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

  return (
    <AdminShellLayout
      activeTab={controller.activeTab}
      onTabChange={controller.setActiveTab}
      adminTabs={controller.adminTabs}
      pageTitle={controller.activeTabLabel ?? 'Admin'}
      pageDescription={controller.activeTabDescription}
      activeSectionLabel={controller.activeSectionLabel}
      topBarProps={controller.topBarProps}
    >
      <AdminPageContent {...controller} />
    </AdminShellLayout>
  );
};

export default Admin;
