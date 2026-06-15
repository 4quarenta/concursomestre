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
import { ArrowRight, Check } from 'lucide-react';

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

/**
 * Dropdown enxuto de notificações do admin.
 * Mantém a mesma UX já aprovada, mas fora do arquivo principal do painel.
 */
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
    <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-scale-in">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-widest">Notificações</h3>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              markAllNotificationsAsRead?.();
            }}
            className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
          >
            <Check size={10} />
            Marcar vistas
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto no-scrollbar">
        {visibleNotifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">Nenhuma notificação.</div>
        ) : (
          visibleNotifications.slice(0, 5).map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                markNotificationAsRead(notification.id);
                if (notification.link) {
                  navigate(notification.link);
                }
                setIsNotifOpen(false);
              }}
              className={`p-4 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!notification.isRead ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}
            >
              <div className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs font-bold ${notification.type === 'error' ? 'text-red-600 dark:text-red-400' : notification.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {notification.title}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
                      {new Date(notification.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{notification.message}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
        <button
          onClick={() => {
            setIsNotifOpen(false);
            navigate('/notifications');
          }}
          className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-black uppercase tracking-widest text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
        >
          Ver Todas <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
};
