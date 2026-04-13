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
import { Bell, Menu, Moon, Sun } from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown';
import { buildProfilePath } from '../../../profile/profileNavigation';

interface AdminTopBarProps {
  theme: string;
  onToggleTheme: () => void;
  notificationsEnabled: boolean;
  isNotifOpen: boolean;
  setIsNotifOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onCloseNotifications: () => void;
  notifications: any[];
  markNotificationAsRead: (id: string | number) => Promise<any> | any;
  unreadCount: number;
  navigate: (path: string) => void;
  currentUserName?: string;
  userInitials: string;
  showSidebarToggle?: boolean;
  onToggleSidebar?: () => void;
}

const AdminTopBar = ({
  theme,
  onToggleTheme,
  notificationsEnabled,
  isNotifOpen,
  setIsNotifOpen,
  onCloseNotifications,
  notifications,
  markNotificationAsRead,
  unreadCount,
  navigate,
  currentUserName,
  userInitials,
  showSidebarToggle = false,
  onToggleSidebar,
}: AdminTopBarProps) => (
  <header className="sticky top-0 z-40 shrink-0 border-b border-slate-200 bg-white transition-colors dark:border-slate-800 dark:bg-slate-900">
    <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
      <div className="flex h-16 items-center justify-between gap-3 md:h-20 md:gap-8">
        <div className="flex items-center gap-3">
          {showSidebarToggle ? (
            <button
              onClick={onToggleSidebar}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-indigo-400 md:hidden"
              aria-label="Abrir menu do admin"
            >
              <Menu size={18} />
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleTheme}
            className="rounded-xl border border-transparent p-3 text-slate-400 transition-all hover:border-slate-100 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-500 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {notificationsEnabled && (
            <div className="relative">
              <button
                onClick={() => setIsNotifOpen((open) => !open)}
                className="rounded-xl border border-transparent p-3 text-slate-400 transition-all hover:border-slate-100 hover:bg-slate-50 hover:text-indigo-600 dark:text-slate-500 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
              >
                <Bell size={20} />
                {unreadCount > 0 && <span className="absolute right-3 top-3 h-2 w-2 rounded-full border-2 border-white bg-red-500 dark:border-slate-900" />}
              </button>

              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={onCloseNotifications} />
                  <div className="absolute right-0 top-full mt-2">
                    <NotificationDropdown
                      notifications={notifications}
                      markNotificationAsRead={markNotificationAsRead}
                      unreadCount={unreadCount}
                      setIsNotifOpen={setIsNotifOpen}
                      navigate={navigate}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mx-2 h-8 w-px bg-slate-200 dark:bg-slate-800" />

          <div className="group flex cursor-pointer items-center gap-3" onClick={() => navigate(buildProfilePath('personal'))}>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-slate-100">
                {currentUserName}
              </p>
              <p className="text-[9px] font-bold uppercase leading-tight tracking-widest text-slate-400">Master Admin</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white shadow-lg transition-all group-hover:scale-105 dark:bg-indigo-600">
              {userInitials}
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>
);

export default AdminTopBar;
