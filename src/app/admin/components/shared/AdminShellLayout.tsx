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
  adminTabs: { key: string; label: string; icon: any; badge?: number; group?: string; description: string }[];
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
}: AdminShellLayoutProps) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full overflow-hidden bg-slate-100 transition-colors duration-300 dark:bg-slate-950">
      <AdminNavigationSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        tabs={adminTabs}
        isMobileOpen={isMobileSidebarOpen}
        onRequestClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="hidden w-[280px] flex-none md:block" aria-hidden />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden transition-colors duration-300">
        <AdminTopBar
          {...topBarProps}
          showSidebarToggle
          onToggleSidebar={() => setIsMobileSidebarOpen((previous) => !previous)}
        />

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className={`no-scrollbar mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} px-3 py-5 sm:px-4 md:px-6 md:py-8 lg:px-8`}>
          <AdminPageHeader title={pageTitle} description={pageDescription} activeSectionLabel={activeSectionLabel} />

            <div className="min-h-[500px] pb-10">{children}</div>
          </div>
        </div>
      </div>

      {isMobileSidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Fechar menu admin"
        />
      ) : null}
    </div>
  );
};

export default AdminShellLayout;
