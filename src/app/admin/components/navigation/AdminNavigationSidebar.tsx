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
import { Home, LogOut, Shield, X } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@providers/AuthProvider';
import LogoutConfirmButton from '../../../../components/shared/layout/LogoutConfirmButton';

interface AdminNavigationSidebarProps {
  activeTab: string;
  onTabChange: (tab: any) => void;
  tabs: { key: string; label: string; icon: any; badge?: number; description: string }[];
  isMobileOpen?: boolean;
  onRequestClose?: () => void;
}

/**
 * Sidebar enxuta do admin.
 * Mantem apenas os cinco dominios principais visiveis no primeiro nivel.
 *
 * @since 1.0.0
 */
const AdminNavigationSidebar = ({
  activeTab,
  onTabChange,
  tabs,
  isMobileOpen = false,
  onRequestClose,
}: AdminNavigationSidebarProps) => {
  const { currentUser } = useAuth();

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-[100dvh] w-[86vw] max-w-72 flex-none flex-col overflow-hidden border-r border-slate-200 bg-white transition-transform duration-200 ease-out dark:border-slate-800 dark:bg-slate-900 md:translate-x-0 ${
        isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="border-b border-slate-100 p-6 dark:border-slate-800">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-rose-100 p-3 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300">
              <Shield size={18} />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Painel Admin</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Navegacao por dominio</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 md:hidden"
            aria-label="Fechar menu admin"
          >
            <X size={16} />
          </button>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/60">
          <p className="truncate text-xs font-black text-slate-900 dark:text-slate-100">{currentUser?.name}</p>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{currentUser?.email}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => {
                onTabChange(tab.key);
                onRequestClose?.();
              }}
              className={`w-full rounded-3xl border px-4 py-4 text-left transition-all ${
                isActive
                  ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                  : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-2xl p-2 ${isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.16em]">{tab.label}</p>
                    <p className={`mt-1 text-[11px] font-medium leading-relaxed ${isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                      {tab.description}
                    </p>
                  </div>
                </div>

                {tab.badge !== undefined && (
                  <span className={`rounded-full px-2 py-1 text-[10px] font-black ${isActive ? 'bg-white/15 text-white' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-300'}`}>
                    {tab.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4 dark:border-slate-800">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/"
            onClick={() => onRequestClose?.()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 transition-all hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Home size={14} />
            Inicio
          </Link>
          <LogoutConfirmButton>
            {({ isLoggingOut, openConfirm }) => (
              <button
                onClick={openConfirm}
                disabled={isLoggingOut}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-50 px-3 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-red-600 transition-all hover:bg-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <LogOut size={14} />
                {isLoggingOut ? 'Saindo...' : 'Sair'}
              </button>
            )}
          </LogoutConfirmButton>
        </div>
      </div>
    </aside>
  );
};

export default AdminNavigationSidebar;
