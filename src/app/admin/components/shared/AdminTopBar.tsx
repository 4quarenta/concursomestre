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
import { Bell, Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { NotificationDropdown, type AdminNotificationItem } from './NotificationDropdown';
import { buildProfilePath } from '../../../profile/profileNavigation';
import { clientLog } from '@services/monitoring/clientLog';

export interface AdminTopBarSearchTarget {
  label: string;
  description?: string;
  path: string;
  group?: string;
}

interface AdminTopBarProps {
  theme: string;
  onToggleTheme: () => void;
  notificationsEnabled: boolean;
  isNotifOpen: boolean;
  setIsNotifOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onCloseNotifications: () => void;
  notifications: AdminNotificationItem[];
  markNotificationAsRead: (id: AdminNotificationItem['id']) => Promise<unknown> | unknown;
  markAllNotificationsAsRead?: () => Promise<unknown> | unknown;
  unreadCount: number;
  navigate: (path: string) => void;
  currentUserName?: string;
  currentUserFirstName?: string;
  currentTabLabel?: string;
  currentSectionLabel?: string;
  userInitials: string;
  showSidebarToggle?: boolean;
  onToggleSidebar?: () => void;
  searchTargets?: AdminTopBarSearchTarget[];
  primaryActionLabel?: string | null;
  primaryActionPath?: string;
}

const renderNotificationDot = (unreadCount: number) => (
  unreadCount > 0 ? (
    <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  ) : null
);

const AdminTopBar = ({
  theme,
  onToggleTheme,
  notificationsEnabled,
  isNotifOpen,
  setIsNotifOpen,
  onCloseNotifications,
  notifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  unreadCount,
  navigate,
  currentUserName,
  currentUserFirstName,
  userInitials,
  showSidebarToggle = false,
  onToggleSidebar,
  searchTargets = [],
  primaryActionLabel = null,
  primaryActionPath = '/admin/operation/questions',
}: AdminTopBarProps) => {
  const [query, setQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredTargets = React.useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return searchTargets.slice(0, 6);
    }

    return searchTargets
      .filter((target) => {
        const haystack = [target.label, target.description, target.group].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 6);
  }, [query, searchTargets]);

  const handleSearchNavigation = React.useCallback((path: string) => {
    setIsSearchOpen(false);
    setQuery('');
    navigate(path);
  }, [navigate]);

  const handleNotificationsToggle = React.useCallback(() => {
    setIsNotifOpen((current) => {
      const next = !current;
      if (next && unreadCount > 0 && markAllNotificationsAsRead) {
        void Promise.resolve(markAllNotificationsAsRead()).catch((error) => {
          clientLog.warn('[admin-notifications] Não foi possível marcar notificações como vistas ao abrir o box.', error);
        });
      }
      return next;
    });
  }, [markAllNotificationsAsRead, setIsNotifOpen, unreadCount]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (filteredTargets[0]) {
      handleSearchNavigation(filteredTargets[0].path);
    }
  };

  const firstName = currentUserFirstName || currentUserName?.trim().split(/\s+/)[0] || 'Admin';

  return (
    <header className="sticky top-0 z-40 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex h-14 items-center gap-3 px-3 sm:px-4 md:px-6">
        <div className="flex items-center gap-2">
          {showSidebarToggle ? (
            <button
              onClick={onToggleSidebar}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white md:hidden"
              aria-label="Abrir menu do admin"
            >
              <Menu size={18} />
            </button>
          ) : null}
        </div>

        <div className="relative hidden flex-1 md:block">
          <form onSubmit={handleSearchSubmit} className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setIsSearchOpen(false), 120)}
              placeholder="Buscar questões, usuários, provas..."
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
            />
          </form>

          {isSearchOpen && filteredTargets.length > 0 ? (
            <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-full max-w-md overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Atalhos do admin</p>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {filteredTargets.map((target) => (
                  <button
                    key={`${target.path}-${target.label}`}
                    type="button"
                    onClick={() => handleSearchNavigation(target.path)}
                    className="flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{target.label}</p>
                      {target.description ? (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{target.description}</p>
                      ) : null}
                    </div>
                    {target.group ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {target.group}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {primaryActionLabel ? (
            <button
              type="button"
              onClick={() => navigate(primaryActionPath)}
              className="hidden h-9 items-center gap-2 rounded-md bg-blue-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 sm:inline-flex"
            >
              <Plus size={16} />
              {primaryActionLabel}
            </button>
          ) : null}

          <button
            onClick={onToggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {notificationsEnabled ? (
            <div className="relative">
              <button
                onClick={handleNotificationsToggle}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
                aria-label="Abrir notificações"
              >
                <Bell size={18} />
                {renderNotificationDot(unreadCount)}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => navigate(buildProfilePath('personal'))}
            className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{firstName}</p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white transition-transform group-hover:scale-[1.02]">
              {userInitials}
            </div>
          </button>
        </div>
      </div>

      {notificationsEnabled && isNotifOpen && isMounted ? createPortal(
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] cursor-default bg-slate-950/30 backdrop-blur-[1px]"
            onClick={onCloseNotifications}
            aria-label="Fechar notificações"
          />
          <NotificationDropdown
            notifications={notifications}
            markNotificationAsRead={markNotificationAsRead}
            markAllNotificationsAsRead={() => {
              void Promise.resolve(markAllNotificationsAsRead?.()).catch((error) => {
                clientLog.warn('[admin-notifications] Não foi possível marcar todas como vistas pelo botão.', error);
              });
            }}
            unreadCount={unreadCount}
            setIsNotifOpen={setIsNotifOpen}
            navigate={navigate}
          />
        </>,
        document.body,
      ) : null}
    </header>
  );
};

export default AdminTopBar;
