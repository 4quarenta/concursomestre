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
import { Home, LogOut, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@providers/AuthProvider';
import LogoutConfirmButton from '../../../../components/shared/layout/LogoutConfirmButton';

interface AdminNavigationSidebarProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  tabs: { key: string; label: string; icon: any; badge?: number; group?: string; description: string }[];
  isMobileOpen?: boolean;
  onRequestClose?: () => void;
}

const AdminNavigationSidebar = ({
  activeTab,
  onTabChange,
  tabs,
  isMobileOpen = false,
  onRequestClose,
}: AdminNavigationSidebarProps) => {
  const { currentUser } = useAuth();

  const tabsByGroup = React.useMemo(() => {
    const grouped = new Map<string, typeof tabs>();

    tabs.forEach((tab) => {
      const group = tab.group || 'Admin';
      grouped.set(group, [...(grouped.get(group) || []), tab]);
    });

    return Array.from(grouped.entries());
  }, [tabs]);

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[88vw] max-w-[280px] flex-col overflow-hidden border-r border-slate-800 bg-[#1d2327] text-slate-200 transition-transform duration-200 ease-out md:w-[280px] md:max-w-[280px] md:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="border-b border-slate-700/80 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-lg font-black text-white">
              Q
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">ConcursoMestre Admin</p>
              <p className="truncate text-xs text-slate-400">Painel administrativo</p>
            </div>
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

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {tabsByGroup.map(([group, groupedTabs]) => (
          <div key={group} className="mb-6">
            <p className="px-2 pb-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              {group}
            </p>

            <div className="space-y-1">
              {groupedTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                const badgeCount = Number(tab.badge || 0);

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      onTabChange(tab.key);
                      onRequestClose?.();
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                      <span className="truncate text-sm font-medium">{tab.label}</span>
                    </span>

                    {badgeCount > 0 ? (
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-slate-200'
                      }`}>
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-700/80 px-4 py-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
          <p className="truncate text-sm font-semibold text-white">{currentUser?.name || 'Administrador'}</p>
          <p className="mt-1 truncate text-xs text-slate-400">{currentUser?.email || 'Sem email carregado'}</p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/"
            onClick={() => onRequestClose?.()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
          >
            <Home size={14} />
            Inicio
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
  );
};

export default AdminNavigationSidebar;
