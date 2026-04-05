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

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Inbox,
  Info,
  MailOpen,
  MessageSquare,
  RefreshCcw,
  Shield,
  ShoppingBag,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import type { Notification } from '@types';

type TabType = 'all' | 'system' | 'social' | 'marketplace' | 'report' | 'trash';

const Page: React.FC = () => {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    restoreNotification,
    permanentDeleteNotification,
    clearNotifications,
  } = useData();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  if (!currentUser) {
    return null;
  }

  const getFilteredNotifications = () => {
    if (activeTab === 'trash') {
      return notifications.filter((notification) => notification.deletedAt);
    }

    const visibleNotifications = notifications.filter((notification) => !notification.deletedAt);
    if (activeTab === 'all') {
      return visibleNotifications;
    }

    return visibleNotifications.filter((notification) => notification.category === activeTab);
  };

  const filteredNotifications = getFilteredNotifications();
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const paginatedNotifications = filteredNotifications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="text-emerald-500 dark:text-emerald-400" size={24} />;
      case 'warning':
        return <AlertTriangle className="text-amber-500 dark:text-amber-400" size={24} />;
      case 'error':
        return <XCircle className="text-red-500 dark:text-red-400" size={24} />;
      default:
        return <Info className="text-indigo-500 dark:text-indigo-400" size={24} />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30';
      case 'warning':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30';
      default:
        return 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/30';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markNotificationAsRead(notification.id);

    if (notification.link) {
      navigate(notification.link);

      if (notification.link.includes('#')) {
        const targetId = notification.link.split('#')[1];
        setTimeout(() => {
          const targetElement = document.getElementById(targetId);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetElement.classList.add('ring-4', 'ring-indigo-500/50', 'transition-all');
            setTimeout(() => targetElement.classList.remove('ring-4', 'ring-indigo-500/50'), 2000);
          }
        }, 600);
      }
    }
  };

  const TabButton = ({ id, label, icon: Icon }: { id: TabType; label: string; icon: React.ComponentType<{ size?: number }> }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
        activeTab === id
          ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg'
          : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20 space-y-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 transition-colors">
            <Bell className="text-indigo-600 dark:text-indigo-400" /> Notificacoes
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 transition-colors">
            Acompanhe suas novidades e alertas do sistema.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => markAllNotificationsAsRead(currentUser.id)}
            className="px-4 py-2 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-2 shadow-sm"
            disabled={notifications.every((notification) => notification.isRead)}
          >
            <MailOpen size={14} /> Ler todas
          </button>
          {activeTab !== 'trash' && (
            <button
              onClick={() => {
                if (confirm('Tem certeza que deseja mover todas as notificacoes para a lixeira?')) {
                  clearNotifications(currentUser.id);
                }
              }}
              className="px-4 py-2 bg-white dark:bg-slate-900 text-red-500 dark:text-red-400 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-100 dark:hover:border-red-900/30 transition-all flex items-center gap-2 shadow-sm"
              disabled={notifications.filter((notification) => !notification.deletedAt).length === 0}
            >
              <Trash2 size={14} /> Limpar
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2 pb-2 overflow-x-auto no-scrollbar">
        <TabButton id="all" label="Geral" icon={Inbox} />
        <TabButton id="system" label="Sistema" icon={Info} />
        <TabButton id="social" label="Social" icon={MessageSquare} />
        <TabButton id="marketplace" label="Loja" icon={ShoppingBag} />
        <TabButton id="report" label="Relatorios" icon={Shield} />
        <TabButton id="trash" label="Lixeira" icon={Trash2} />
      </div>

      <div className="space-y-4">
        {paginatedNotifications.length > 0 ? (
          paginatedNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`relative p-6 rounded-2xl border shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row gap-4 items-start md:items-center cursor-pointer transition-colors ${
                notification.isRead
                  ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                  : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/50 ring-1 ring-indigo-50 dark:ring-indigo-900/20'
              }`}
            >
              <div className={`p-3 rounded-2xl flex-shrink-0 transition-colors ${getBgColor(notification.type)}`}>
                {getTypeIcon(notification.type)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className={`text-sm font-black transition-colors ${notification.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-indigo-900 dark:text-indigo-400'}`}>
                    {notification.title}
                  </h3>
                  {!notification.isRead && <span className="bg-indigo-600 dark:bg-indigo-500 w-2 h-2 rounded-full animate-pulse" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium transition-colors">{notification.message}</p>

                {notification.evidenceUrl && (
                  <div className="mt-3">
                    <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1 transition-colors">
                      <Info size={10} /> Prova anexada
                    </p>
                    <img
                      src={notification.evidenceUrl}
                      alt="Prova"
                      className="rounded-xl border border-slate-200 dark:border-slate-800 max-h-48 object-contain bg-slate-50 dark:bg-slate-800 transition-colors"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider transition-colors">
                    {new Date(notification.timestamp).toLocaleString()}
                  </p>
                  {notification.link && (
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                      Ver conteudo <ArrowRight size={10} />
                    </span>
                  )}
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase transition-colors">
                    {notification.category}
                  </span>
                  {activeTab === 'trash' && notification.deletedAt && (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-800/30 transition-colors">
                      <RefreshCcw size={10} />
                      {Math.max(0, 30 - Math.floor((Date.now() - notification.deletedAt) / (1000 * 60 * 60 * 24)))} dias p/ excluir
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 self-end md:self-center" onClick={(event) => event.stopPropagation()}>
                {activeTab === 'trash' ? (
                  <>
                    <button
                      onClick={() => restoreNotification(notification.id)}
                      className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                      title="Restaurar"
                    >
                      <RefreshCcw size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Excluir permanentemente?')) {
                          permanentDeleteNotification(notification.id);
                        }
                      }}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Excluir permanentemente"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    {!notification.isRead && (
                      <button
                        onClick={() => markNotificationAsRead(notification.id)}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                        title="Marcar como lida"
                      >
                        <Check size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Mover para lixeira"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed text-slate-300 dark:text-slate-700 space-y-4 transition-colors">
            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-full transition-colors">
              <Inbox size={48} className="opacity-50" />
            </div>
            <p className="text-sm font-medium transition-colors">Nenhuma notificacao nesta categoria.</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              onClick={() => setCurrentPage(pageNumber)}
              className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                currentPage === pageNumber
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            >
              {pageNumber}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Page;
