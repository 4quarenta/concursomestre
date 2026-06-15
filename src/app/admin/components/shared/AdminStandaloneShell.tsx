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
import { useRouter } from 'next/navigation';
import type { Notification } from '@types';
import {
  BookOpen,
  DollarSign,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  ShoppingBag,
} from 'lucide-react';
import { useAuth } from '@providers/AuthProvider';
import { useTheme } from '@providers/ThemeProvider';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import { useNotificationsStore } from '@/state/notifications/notificationsStore';
import { useNotificationsActions } from '@/state/notifications/useNotificationsActions';
import {
  ADMIN_SECTION_CONFIG,
  DEFAULT_SECTION_BY_TAB,
  TAB_DESCRIPTIONS,
  buildAdminPath,
  filterAdminTabsForRole,
  normalizeAdminUserRole,
  resolveAdminRouteForRole,
  type AdminNavigationTab,
  type AdminPageTab,
} from '../../config/adminPageNavigationConfig';
import AdminShellLayout from './AdminShellLayout';

interface AdminStandaloneShellProps {
  activeTab: AdminPageTab;
  activeSectionKey?: string;
  pageTitle: string;
  pageDescription?: string;
  showPageHeader?: boolean;
  children: React.ReactNode;
}

const buildSearchTargets = (adminTabs: AdminNavigationTab[]) => {
  const tabTargets = adminTabs.map((tab) => ({
    label: tab.label,
    description: tab.description,
    path: buildAdminPath(tab.key, DEFAULT_SECTION_BY_TAB[tab.key]),
    group: tab.group || 'Admin',
  }));

  const allowedTabKeys = new Set(adminTabs.map((tab) => tab.key));
  const sectionTargets = (Object.entries(ADMIN_SECTION_CONFIG) as [AdminPageTab, { key: string; label: string }[]][])
    .filter(([tabKey]) => allowedTabKeys.has(tabKey))
    .flatMap(([tabKey, sections]) => (
      sections.map((section) => ({
        label: section.label,
        description: adminTabs.find((tab) => tab.key === tabKey)?.label || tabKey,
        path: buildAdminPath(tabKey, section.key),
        group: adminTabs.find((tab) => tab.key === tabKey)?.group || 'Admin',
      }))
    ));

  return [...tabTargets, ...sectionTargets];
};

const AdminStandaloneShell = ({
  activeTab,
  activeSectionKey,
  pageTitle,
  pageDescription,
  showPageHeader = true,
  children,
}: AdminStandaloneShellProps) => {
  const router = useRouter();
  const { currentUser } = useAuth();
  const adminUserRole = React.useMemo(() => normalizeAdminUserRole(
    currentUser?.role || (currentUser?.isAdmin ? 'admin' : currentUser?.isStaff ? 'staff' : ''),
  ), [currentUser?.isAdmin, currentUser?.isStaff, currentUser?.role]);
  const { theme, toggleTheme } = useTheme();
  const notifications = useNotificationsStore((store) => store.notifications);
  const { markNotificationAsRead, markAllNotificationsAsRead } = useNotificationsActions();
  const systemSettings = useAppConfigStore((store) => store.systemSettings);
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);

  const adminTabs = React.useMemo<AdminNavigationTab[]>(() => filterAdminTabsForRole([
    { key: 'panel', label: 'Dashboard', icon: LayoutDashboard, group: 'Conteudo', description: TAB_DESCRIPTIONS.panel },
    { key: 'operation', label: 'Conteudo', icon: BookOpen, group: 'Conteudo', description: TAB_DESCRIPTIONS.operation },
    { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag, group: 'Comercial', description: TAB_DESCRIPTIONS.marketplace },
    { key: 'finance', label: 'Financeiro', icon: DollarSign, group: 'Comercial', description: TAB_DESCRIPTIONS.finance },
    { key: 'marketing', label: 'Marketing', icon: Megaphone, group: 'Comercial', description: TAB_DESCRIPTIONS.marketing },
    { key: 'support', label: 'Suporte', icon: MessageSquare, group: 'Relacionamento', description: TAB_DESCRIPTIONS.support },
    { key: 'settings', label: 'Configuracoes', icon: Settings, group: 'Sistema', description: TAB_DESCRIPTIONS.settings },
  ], adminUserRole), [adminUserRole]);

  const searchTargets = React.useMemo(() => buildSearchTargets(adminTabs), [adminTabs]);
  const adminNotifications = (notifications || []) as Notification[];
  const unreadCount = adminNotifications.filter((notification) => !notification.isRead && !notification.deletedAt).length;
  const activeSectionLabel = ADMIN_SECTION_CONFIG[activeTab]?.find((section) => section.key === activeSectionKey)?.label || '';

  const navigateAdmin = React.useCallback((tab: string, section?: string) => {
    const nextTab = tab as AdminPageTab;
    const resolved = resolveAdminRouteForRole(nextTab, section || DEFAULT_SECTION_BY_TAB[nextTab], adminUserRole);
    router.push(buildAdminPath(resolved.tab, resolved.section));
  }, [adminUserRole, router]);

  React.useEffect(() => {
    const resolved = resolveAdminRouteForRole(activeTab, activeSectionKey, adminUserRole);

    if (resolved.tab !== activeTab) {
      router.replace(buildAdminPath(resolved.tab, resolved.section));
    }
  }, [activeSectionKey, activeTab, adminUserRole, router]);

  const navigate = React.useCallback((path: string) => {
    router.push(path);
  }, [router]);

  return (
    <AdminShellLayout
      activeTab={activeTab}
      activeSectionKey={activeSectionKey}
      onNavigateAdmin={navigateAdmin}
      adminTabs={adminTabs}
      pageTitle={pageTitle}
      pageDescription={pageDescription}
      showPageHeader={showPageHeader}
      topBarProps={{
        theme,
        onToggleTheme: toggleTheme,
        notificationsEnabled: Boolean(systemSettings?.features?.notificationsEnabled),
        isNotifOpen,
        setIsNotifOpen,
        onCloseNotifications: () => setIsNotifOpen(false),
        notifications: adminNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        unreadCount,
        navigate,
        currentUserName: currentUser?.name,
        currentUserFirstName: currentUser?.name?.trim().split(/\s+/)[0] || undefined,
        currentTabLabel: adminTabs.find((tab) => tab.key === activeTab)?.label,
        currentSectionLabel: activeSectionLabel,
        userInitials: currentUser?.name?.charAt(0) || 'A',
        searchTargets,
        primaryActionLabel: null,
      }}
    >
      {children}
    </AdminShellLayout>
  );
};

export default AdminStandaloneShell;
