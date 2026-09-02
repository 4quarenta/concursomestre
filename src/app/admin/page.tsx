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
      onNavigateAdmin={(tab, section) => controller.navigateAdminDestination(tab as Parameters<typeof controller.navigateAdminDestination>[0], section)}
      adminTabs={controller.adminTabs}
      sectionBadges={controller.sectionBadges}
      pageTitle={controller.activeTabLabel ?? 'Admin'}
      pageDescription={controller.activeTabDescription}
      topBarProps={{
        ...controller.topBarProps,
        markNotificationAsRead: (id) => controller.topBarProps.markNotificationAsRead(String(id)),
      }}
      showPageHeader={shouldShowPageHeader}
    >
      <AdminPageContent
        {...controller}
        databaseSectionProps={{
          ...controller.databaseSectionProps,
          resolveReport: (reportId, status, reason) => controller.databaseSectionProps.resolveReport(
            String(reportId),
            status === 'ignored' ? 'ignored' : 'resolved',
            reason,
          ),
          moderateMaterial: (...args) => controller.databaseSectionProps.moderateMaterial(
            String(args[0]),
            args[1] === 'approved' ? 'approved' : 'rejected',
            typeof args[2] === 'string' ? args[2] : undefined,
            typeof args[3] === 'string' ? args[3] : undefined,
          ),
        }}
      />
    </AdminShellLayout>
  );
};

export default Admin;
