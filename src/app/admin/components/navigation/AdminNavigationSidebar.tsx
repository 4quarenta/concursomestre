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
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, Home, LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@providers/AuthProvider';
import LogoutConfirmButton from '../../../../components/shared/layout/LogoutConfirmButton';
import BrandLogo from '../../../../components/shared/layout/BrandLogo';
import { ADMIN_DATABASE_CATEGORIES, ADMIN_DATABASE_SUBTAB_META } from '../database/adminDatabaseNavigationConfig';
import {
  ADMIN_SECTION_CONFIG,
  filterAdminSectionsForRole,
  normalizeAdminUserRole,
  type AdminPageTab,
} from '../../config/adminPageNavigationConfig';

type AdminTabItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
  group?: string;
  description: string;
};

type SidebarSubmenuItem = {
  section: string;
  label: string;
  description: string;
  badge?: number;
};

type SidebarSubmenuGroup = {
  id: string;
  label: string;
  items: SidebarSubmenuItem[];
};

const estimateFlyoutHeight = (groups: SidebarSubmenuGroup[]) => {
  const basePadding = 24;
  const groupSpacing = Math.max(0, groups.length - 1) * 32;
  const groupHeights = groups.reduce((total, group) => (
    total + 24 + (group.items.length * 40)
  ), 0);

  return basePadding + groupSpacing + groupHeights;
};

interface AdminNavigationSidebarProps {
  activeTab: string;
  activeSectionKey?: string;
  onNavigateAdmin: (tab: string, section?: string) => void;
  tabs: AdminTabItem[];
  sectionBadges?: Record<string, Record<string, number>>;
  isMobileOpen?: boolean;
  onRequestClose?: () => void;
}

const buildSidebarSubmenuGroups = (
  tabKey: string,
  sectionBadges: Record<string, number> = {},
  role?: string | null,
): SidebarSubmenuGroup[] => {
  const getSectionBadge = (section: string) => {
    const count = Number(sectionBadges[section] || 0);
    return count > 0 ? count : undefined;
  };

  if (tabKey === 'operation') {
    return ADMIN_DATABASE_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      items: category.tabs
        .filter((tab) => filterAdminSectionsForRole('operation', [{ key: tab }], role).length > 0)
        .map((tab) => {
          const meta = ADMIN_DATABASE_SUBTAB_META[tab];
          if (!meta) {
            return null;
          }

          return {
            section: tab,
            label: meta.label,
            description: meta.description,
            badge: getSectionBadge(tab),
          };
        })
        .filter(Boolean) as SidebarSubmenuItem[],
    })).filter((group) => group.items.length > 0);
  }

  if (tabKey === 'marketplace') {
    return [
      {
        id: 'marketplace-sections',
        label: 'Marketplace',
        items: [
          { section: 'vendors', label: 'Vendedores', description: '', badge: getSectionBadge('vendors') },
          { section: 'materials', label: 'Materiais', description: '', badge: getSectionBadge('materials') },
          { section: 'blocked', label: 'Revisão bloqueada', description: '', badge: getSectionBadge('blocked') },
        ],
      },
    ];
  }

  if (tabKey === 'support') {
    return [
      {
        id: 'support-care',
        label: 'Atendimento',
        items: [
          { section: 'feedback', label: 'Feedback', description: '', badge: getSectionBadge('feedback') },
          { section: 'reports', label: 'Denúncias', description: '', badge: getSectionBadge('reports') },
          { section: 'threads', label: 'Threads', description: '', badge: getSectionBadge('threads') },
        ],
      },
      {
        id: 'support-moderation',
        label: 'Moderação',
        items: [
          { section: 'comments', label: 'Comentários', description: '', badge: getSectionBadge('comments') },
          { section: 'rankings', label: 'Rankings', description: '', badge: getSectionBadge('rankings') },
        ],
      },
      {
        id: 'support-finance',
        label: 'Financeiro',
        items: [
          { section: 'refunds', label: 'Reembolsos', description: '', badge: getSectionBadge('refunds') },
        ],
      },
    ].map((group) => ({
      ...group,
      items: group.items.filter((item) => filterAdminSectionsForRole('support', [{ key: item.section }], role).length > 0),
    })).filter((group) => group.items.length > 0);
  }

  const sections = filterAdminSectionsForRole(
    tabKey as AdminPageTab,
    ADMIN_SECTION_CONFIG[tabKey as AdminPageTab] || [],
    role,
  );
  if (!sections.length) {
    return [];
  }

  return [{
    id: `${tabKey}-sections`,
    label: 'Seções',
    items: sections.map((section) => ({
      section: section.key,
      label: section.label,
      description: '',
      badge: getSectionBadge(section.key),
    })),
  }];
};

const AdminNavigationSidebar = ({
  activeTab,
  activeSectionKey,
  onNavigateAdmin,
  tabs,
  sectionBadges = {},
  isMobileOpen = false,
  onRequestClose,
}: AdminNavigationSidebarProps) => {
  const { currentUser } = useAuth();
  const [desktopFlyoutKey, setDesktopFlyoutKey] = React.useState<string | null>(null);
  const [desktopFlyoutPosition, setDesktopFlyoutPosition] = React.useState<{
    left: number;
    top: number;
    maxHeight: number;
  } | null>(null);
  const [mobileExpandedKeys, setMobileExpandedKeys] = React.useState<string[]>([]);
  const closeFlyoutTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminUserRole = React.useMemo(() => normalizeAdminUserRole(
    currentUser?.role || (currentUser?.isAdmin ? 'admin' : currentUser?.isStaff ? 'staff' : ''),
  ), [currentUser?.isAdmin, currentUser?.isStaff, currentUser?.role]);

  const clearCloseFlyoutTimeout = React.useCallback(() => {
    if (closeFlyoutTimeoutRef.current) {
      clearTimeout(closeFlyoutTimeoutRef.current);
      closeFlyoutTimeoutRef.current = null;
    }
  }, []);

  const closeDesktopFlyout = React.useCallback(() => {
    clearCloseFlyoutTimeout();
    setDesktopFlyoutKey(null);
    setDesktopFlyoutPosition(null);
  }, [clearCloseFlyoutTimeout]);

  const scheduleDesktopFlyoutClose = React.useCallback(() => {
    clearCloseFlyoutTimeout();
    closeFlyoutTimeoutRef.current = setTimeout(() => {
      setDesktopFlyoutKey(null);
      setDesktopFlyoutPosition(null);
    }, 120);
  }, [clearCloseFlyoutTimeout]);

  const openDesktopFlyout = React.useCallback((
    tabKey: string,
    anchorRect: DOMRect,
    submenuGroups: SidebarSubmenuGroup[],
  ) => {
    clearCloseFlyoutTimeout();

    const flyoutWidth = 288;
    const gutter = 12;
    const viewportPadding = 16;
    const estimatedHeight = estimateFlyoutHeight(submenuGroups);
    const safeLeft = Math.min(anchorRect.right + gutter, window.innerWidth - flyoutWidth - 16);
    const preferredTop = anchorRect.top - 8;
    const maxTop = Math.max(viewportPadding, window.innerHeight - estimatedHeight - viewportPadding);
    const safeTop = Math.max(viewportPadding, Math.min(preferredTop, maxTop));
    const maxHeight = Math.max(180, window.innerHeight - safeTop - viewportPadding);

    setDesktopFlyoutKey(tabKey);
    setDesktopFlyoutPosition({
      left: safeLeft,
      top: safeTop,
      maxHeight,
    });
  }, [clearCloseFlyoutTimeout]);

  React.useEffect(() => {
    if (!activeTab) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setMobileExpandedKeys((current) => (
        current.includes(activeTab) ? current : [...current, activeTab]
      ));
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [activeTab]);

  React.useEffect(() => () => {
    clearCloseFlyoutTimeout();
  }, [clearCloseFlyoutTimeout]);

  React.useEffect(() => {
    const handleViewportChange = () => {
      setDesktopFlyoutKey(null);
      setDesktopFlyoutPosition(null);
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, []);

  const tabsByGroup = React.useMemo(() => {
    const grouped = new Map<string, AdminTabItem[]>();

    tabs.forEach((tab) => {
      const group = tab.group || 'Admin';
      grouped.set(group, [...(grouped.get(group) || []), tab]);
    });

    return Array.from(grouped.entries());
  }, [tabs]);

  const submenuGroupsByTab = React.useMemo(() => Object.fromEntries(
    tabs.map((tab) => [tab.key, buildSidebarSubmenuGroups(tab.key, sectionBadges[tab.key] || {}, adminUserRole)]),
  ) as Record<string, SidebarSubmenuGroup[]>, [adminUserRole, tabs, sectionBadges]);

  const toggleMobileExpansion = (tabKey: string) => {
    setMobileExpandedKeys((current) => (
      current.includes(tabKey)
        ? current.filter((key) => key !== tabKey)
        : [...current, tabKey]
    ));
  };

  const handleNavigate = (tabKey: string, section?: string) => {
    closeDesktopFlyout();
    onNavigateAdmin(tabKey, section);
    onRequestClose?.();
  };

  const activeDesktopFlyoutGroups = desktopFlyoutKey ? (submenuGroupsByTab[desktopFlyoutKey] || []) : [];

  return (
    <>
      <aside
      className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[88vw] max-w-[280px] flex-col overflow-visible border-r border-slate-800 bg-[#1d2327] text-slate-200 transition-transform duration-200 ease-out md:w-[280px] md:max-w-[280px] md:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
      >
      <div className="border-b border-slate-700/80 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <BrandLogo width={172} surface="dark" />
            <p className="truncate text-xs text-slate-400">Painel administrativo</p>
          </div>

          <button
            type="button"
            onClick={onRequestClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white md:hidden"
            aria-label="Fechar menu admin"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4" onScroll={closeDesktopFlyout}>
        {tabsByGroup.map(([group, groupedTabs]) => (
          <div key={group} className="mb-6">
            <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              {group}
            </p>

            <div className="space-y-1">
              {groupedTabs.map((tab) => {
                const Icon = tab.icon;
                const isActiveTab = activeTab === tab.key;
                const badgeCount = Number(tab.badge || 0);
                const submenuGroups = submenuGroupsByTab[tab.key] || [];
                const hasSubmenu = submenuGroups.length > 0;
                const isMobileExpanded = mobileExpandedKeys.includes(tab.key);
                return (
                  <div
                    key={tab.key}
                    className="relative"
                    onMouseEnter={(event) => {
                      if (hasSubmenu) {
                        openDesktopFlyout(tab.key, event.currentTarget.getBoundingClientRect(), submenuGroups);
                      }
                    }}
                    onMouseLeave={() => {
                      if (hasSubmenu) {
                        scheduleDesktopFlyoutClose();
                      }
                    }}
                  >
                    <div className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => handleNavigate(tab.key)}
                        className={`flex min-w-0 flex-1 items-center justify-between gap-2.5 rounded-md px-3 py-2 text-left transition-colors ${
                          isActiveTab
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <Icon size={16} className={isActiveTab ? 'text-white' : 'text-slate-400'} />
                          <span className="block truncate text-[13px] font-medium leading-none">{tab.label}</span>
                        </span>

                        <span className="flex shrink-0 items-center gap-2">
                          {badgeCount > 0 ? (
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black ${
                              isActiveTab ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-200'
                            }`}>
                              {badgeCount > 99 ? '99+' : badgeCount}
                            </span>
                          ) : null}

                          {hasSubmenu ? (
                            <ChevronRight size={14} className={isActiveTab ? 'text-white' : 'text-slate-500'} />
                          ) : null}
                        </span>
                      </button>

                      {hasSubmenu ? (
                        <button
                          type="button"
                          onClick={() => toggleMobileExpansion(tab.key)}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors md:hidden ${
                            isActiveTab
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:bg-slate-800 hover:text-white'
                          }`}
                          aria-label={`Abrir submenu de ${tab.label}`}
                        >
                          <ChevronDown size={16} className={isMobileExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        </button>
                      ) : null}
                    </div>

                    {hasSubmenu && isMobileExpanded ? (
                      <div className="mt-2 space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-3 md:hidden">
                        {submenuGroups.map((groupConfig) => (
                          <div key={groupConfig.id}>
                            <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                              {groupConfig.label}
                            </p>
                            <div className="mt-2 space-y-1">
                              {groupConfig.items.map((item) => {
                                const isActiveChild = isActiveTab && activeSectionKey === item.section;
                                const itemBadge = Number(item.badge || 0);

                                return (
                                  <button
                                    key={`${tab.key}-${item.section}`}
                                    type="button"
                                    onClick={() => handleNavigate(tab.key, item.section)}
                                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                                      isActiveChild
                                        ? 'bg-blue-600/15 text-blue-200'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                    }`}
                                  >
                                    <span className="truncate text-[13px] font-medium">{item.label}</span>
                                    <span className="flex shrink-0 items-center gap-2">
                                      {itemBadge > 0 ? (
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                          isActiveChild ? 'bg-blue-500/25 text-blue-100' : 'bg-slate-700 text-slate-200'
                                        }`}>
                                          {itemBadge > 99 ? '99+' : itemBadge}
                                        </span>
                                      ) : null}
                                      <ChevronRight size={14} className={isActiveChild ? 'text-blue-300' : 'text-slate-500'} />
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {hasSubmenu ? (
                      <span className="hidden md:block" aria-hidden />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700/80 px-4 py-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <p className="truncate text-sm font-semibold text-white">{currentUser?.name || 'Administrador'}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{currentUser?.email || 'Sem e-mail carregado'}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/"
            prefetch={false}
            onClick={() => onRequestClose?.()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          >
            <Home size={14} />
            Início
          </Link>

          <LogoutConfirmButton>
            {({ isLoggingOut, openConfirm }) => (
              <button
                type="button"
                onClick={openConfirm}
                disabled={isLoggingOut}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogOut size={14} />
                {isLoggingOut ? 'Saindo' : 'Sair'}
              </button>
            )}
          </LogoutConfirmButton>
        </div>
      </div>
      </aside>

      {desktopFlyoutKey && desktopFlyoutPosition && activeDesktopFlyoutGroups.length > 0 && typeof document !== 'undefined'
        ? createPortal(
          <div
            className="fixed z-[70] hidden md:block"
            style={{
              left: `${desktopFlyoutPosition.left}px`,
              top: `${desktopFlyoutPosition.top}px`,
              width: '288px',
            }}
            onMouseEnter={clearCloseFlyoutTimeout}
            onMouseLeave={scheduleDesktopFlyoutClose}
          >
            <div
              className="overflow-y-auto rounded-lg border border-slate-800 bg-[#23282d] p-3 shadow-2xl"
              style={{ maxHeight: `${desktopFlyoutPosition.maxHeight}px` }}
            >
              {activeDesktopFlyoutGroups.map((groupConfig, groupIndex) => (
                <div key={groupConfig.id} className={groupIndex > 0 ? 'mt-4 border-t border-slate-800 pt-4' : ''}>
                  <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {groupConfig.label}
                  </p>
                  <div className="mt-2 space-y-1">
                    {groupConfig.items.map((item) => {
                      const isActiveChild = activeTab === desktopFlyoutKey && activeSectionKey === item.section;
                      const itemBadge = Number(item.badge || 0);

                      return (
                        <button
                          key={`${desktopFlyoutKey}-${item.section}`}
                          type="button"
                          onClick={() => handleNavigate(desktopFlyoutKey, item.section)}
                          className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                            isActiveChild
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <span className="block min-w-0 truncate text-[13px] font-medium">{item.label}</span>
                          <span className="flex shrink-0 items-center gap-2">
                            {itemBadge > 0 ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                                isActiveChild ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-200'
                              }`}>
                                {itemBadge > 99 ? '99+' : itemBadge}
                              </span>
                            ) : null}
                            <ChevronRight size={14} className={isActiveChild ? 'text-white' : 'text-slate-500'} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
};

export default AdminNavigationSidebar;
