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
import AdminNavigationSidebar from '../navigation/AdminNavigationSidebar';
import { PLATFORM_MAIN_CONTENT_WIDTH_CLASS } from '@constants/layout';

interface AdminShellLayoutProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  adminTabs: { key: string; label: string; icon: any; badge?: number; group?: string }[];
  pageTitle: string;
  pageDescription?: string;
  activeSectionLabel?: string;
  topBarProps: React.ComponentProps<typeof AdminTopBar>;
  children: React.ReactNode;
}

const AdminShellLayout = ({
  activeTab,
  onTabChange,
  adminTabs,
  pageTitle,
  pageDescription,
  activeSectionLabel,
  topBarProps,
  children,
}: AdminShellLayoutProps) => (
  <div className="flex h-[100dvh] max-h-screen w-full overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950">
    <div className="h-[100dvh] max-h-screen w-72 flex-none overflow-hidden md:fixed z-50">
      <AdminNavigationSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        tabs={adminTabs}
      />
    </div>

    <div className="ml-0 flex min-w-0 flex-1 flex-col overflow-hidden transition-colors duration-300 md:ml-72">
      <AdminTopBar {...topBarProps} />

      <div className={`no-scrollbar mx-auto flex-1 w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} overflow-y-auto px-4 py-8 md:px-8`}>
        <AdminPageHeader title={pageTitle} description={pageDescription} activeSectionLabel={activeSectionLabel} />

        <div className="min-h-[500px]">{children}</div>
      </div>
    </div>
  </div>
);

export default AdminShellLayout;
