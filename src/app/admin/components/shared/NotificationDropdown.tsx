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
import { ArrowRight, Check, X } from 'lucide-react';

export interface AdminNotificationItem {
  id: string | number;
  title: string;
  message: string;
  timestamp: string | number;
  type?: 'error' | 'success' | 'info' | 'warning' | string;
  isRead?: boolean;
  deletedAt?: string | number | null;
  link?: string;
}

interface NotificationDropdownProps {
  notifications: AdminNotificationItem[];
  markNotificationAsRead: (id: string | number) => void;
  markAllNotificationsAsRead?: () => void;
  unreadCount: number;
  setIsNotifOpen: (value: boolean) => void;
  navigate: (path: string) => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  notifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  unreadCount,
  setIsNotifOpen,
  navigate,
}) => {
  const visibleNotifications = notifications.filter((notification) => !notification.deletedAt);

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(420px,calc(100vw-1rem))] flex-col overflow-hidden border-l border-slate-200 bg-white text-left shadow-2xl dark:border-slate-800 dark:bg-slate-950 animate-slide-left">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
            Notificações
          </h3>
          <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Central de alertas administrativos.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                markAllNotificationsAsRead?.();
              }}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
            >
              <Check size={10} />
              Marcar vistas
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setIsNotifOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
            aria-label="Fechar notificações"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {visibleNotifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 dark:text-slate-500">
            Nenhuma notificação.
          </div>
        ) : (
          visibleNotifications.map((notification) => (
            <button
              type="button"
              key={notification.id}
              onClick={() => {
                markNotificationAsRead(notification.id);
                if (notification.link) {
                  navigate(notification.link);
                }
                setIsNotifOpen(false);
              }}
              className={`block w-full border-b border-slate-50 p-4 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${!notification.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
            >
              <div className="flex justify-between gap-3">
                <span className={`text-xs font-bold ${notification.type === 'error' ? 'text-red-600 dark:text-red-400' : notification.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                  {notification.title}
                </span>
                <span className="shrink-0 text-[9px] text-slate-400 dark:text-slate-500">
                  {new Date(notification.timestamp).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                {notification.message}
              </p>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => {
            setIsNotifOpen(false);
            navigate('/notifications');
          }}
          className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
        >
          Ver todas <ArrowRight size={12} />
        </button>
      </div>
    </aside>
  );
};
