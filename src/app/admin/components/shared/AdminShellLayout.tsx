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
import AdminTopBar from './AdminTopBar';
import AdminPageHeader from './AdminPageHeader';
import { DashboardSidebar } from '../../../../components/shared/layout/DashboardSidebar';

interface AdminShellLayoutProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  adminTabs: { key: string; label: string; icon: any; badge?: number }[];
  pageTitle: string;
  topBarProps: React.ComponentProps<typeof AdminTopBar>;
  children: React.ReactNode;
}

const AdminShellLayout = ({
  activeTab,
  onTabChange,
  adminTabs,
  pageTitle,
  topBarProps,
  children,
}: AdminShellLayoutProps) => (
  <div className="flex h-[100dvh] max-h-screen w-full overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950">
    <div className="h-[100dvh] max-h-screen w-64 flex-none overflow-hidden md:fixed z-50">
      <DashboardSidebar
        type="admin"
        activeTab={activeTab}
        onTabChange={onTabChange}
        tabs={adminTabs}
      />
    </div>

    <div className="ml-0 flex min-w-0 flex-1 flex-col overflow-hidden transition-colors duration-300 md:ml-64">
      <AdminTopBar {...topBarProps} />

      <div className="no-scrollbar mx-auto flex-1 w-full max-w-7xl overflow-y-auto px-4 py-8 animate-fade-in md:px-8">
        <AdminPageHeader title={pageTitle} />

        <div className="min-h-[500px]">{children}</div>
      </div>
    </div>
  </div>
);

export default AdminShellLayout;
