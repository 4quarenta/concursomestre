
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, Trash2, Info, CheckCircle2, AlertTriangle, XCircle, Search, Inbox, MailOpen, ArrowRight, DollarSign, Shield, ShoppingBag, MessageSquare, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../types';

type TabType = 'all' | 'system' | 'social' | 'marketplace' | 'report' | 'trash';

const NotificationsPage: React.FC = () => {
  const { notifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, restoreNotification, permanentDeleteNotification, clearNotifications } = useData();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const navigate = useNavigate();

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 7;

  if (!currentUser) return null;

  const getFilteredNotifications = () => {
    if (activeTab === 'trash') return notifications.filter(n => n.deletedAt);
    const visible = notifications.filter(n => !n.deletedAt);

    if (activeTab === 'all') return visible;
    return visible.filter(n => n.category === activeTab);
  };

  const filteredNotifications = getFilteredNotifications();

  // Reset page when tab changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  const totalPages = Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-500 dark:text-emerald-400" size={24} />;
      case 'warning': return <AlertTriangle className="text-amber-500 dark:text-amber-400" size={24} />;
      case 'error': return <XCircle className="text-red-500 dark:text-red-400" size={24} />;
      default: return <Info className="text-indigo-500 dark:text-indigo-400" size={24} />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30';
      case 'warning': return 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30';
      case 'error': return 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30';
      default: return 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/30';
    }
  };

  const handleNotificationClick = (n: Notification) => {
    markNotificationAsRead(n.id);
    if (n.link) {
      navigate(n.link);
      if (n.link.includes('#')) {
        const id = n.link.split('#')[1];
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-indigo-500/50', 'transition-all');
            setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-500/50'), 2000);
          }
        }, 600);
      }
    }
  };

  const TabButton = ({ id, label, icon: Icon }: { id: TabType, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === id ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-100 dark:border-slate-800'}`}
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
            <Bell className="text-indigo-600 dark:text-indigo-400" /> Notificações
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 transition-colors">Acompanhe suas novidades e alertas do sistema.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => markAllNotificationsAsRead(currentUser.id)}
            className="px-4 py-2 bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all flex items-center gap-2 shadow-sm"
            disabled={notifications.every(n => n.isRead)}
          >
            <MailOpen size={14} /> Ler Todas
          </button>
          {activeTab !== 'trash' && (
            <button
              onClick={() => { if (confirm('Tem certeza que deseja mover todas as notificações para a lixeira?')) clearNotifications(currentUser.id); }}
              className="px-4 py-2 bg-white dark:bg-slate-900 text-red-500 dark:text-red-400 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-100 dark:hover:border-red-900/30 transition-all flex items-center gap-2 shadow-sm"
              disabled={notifications.filter(n => !n.deletedAt).length === 0}
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
        <TabButton id="report" label="Relatórios" icon={Shield} />
        <TabButton id="trash" label="Lixeira" icon={Trash2} />
      </div>

      <div className="space-y-4">
        {paginatedNotifications.length > 0 ? (
          paginatedNotifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`relative p-6 rounded-2xl border shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row gap-4 items-start md:items-center cursor-pointer transition-colors ${notification.isRead ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-900/50 ring-1 ring-indigo-50 dark:ring-indigo-900/20'}`}
            >
              <div className={`p-3 rounded-2xl flex-shrink-0 transition-colors ${getBgColor(notification.type)}`}>
                {getTypeIcon(notification.type)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className={`text-sm font-black transition-colors ${notification.isRead ? 'text-slate-700 dark:text-slate-300' : 'text-indigo-900 dark:text-indigo-400'}`}>{notification.title}</h3>
                  {!notification.isRead && <span className="bg-indigo-600 dark:bg-indigo-500 w-2 h-2 rounded-full animate-pulse" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium transition-colors">{notification.message}</p>
                {notification.evidenceUrl && (
                  <div className="mt-3">
                    <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-1 flex items-center gap-1 transition-colors"><Info size={10} /> Prova Anexada:</p>
                    <img src={notification.evidenceUrl} alt="Prova" className="rounded-xl border border-slate-200 dark:border-slate-800 max-h-48 object-contain bg-slate-50 dark:bg-slate-800 transition-colors" />
                  </div>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider transition-colors">{new Date(notification.timestamp).toLocaleString()}</p>
                  {notification.link && (
                    <span className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                      Ver Conteúdo <ArrowRight size={10} />
                    </span>
                  )}
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase transition-colors">{notification.category}</span>
                  {activeTab === 'trash' && notification.deletedAt && (
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-800/30 transition-colors">
                      <RefreshCcw size={10} />
                      {Math.max(0, 30 - Math.floor((Date.now() - notification.deletedAt) / (1000 * 60 * 60 * 24)))} dias p/ excluir
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 self-end md:self-center" onClick={e => e.stopPropagation()}>
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
                      onClick={() => { if (confirm("Excluir permanentemente?")) permanentDeleteNotification(notification.id); }}
                      className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Excluir Permanentemente"
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
                      title="Mover para Lixeira"
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
            <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-full transition-colors"><Inbox size={48} className="opacity-50" /></div>
            <p className="text-sm font-medium transition-colors">Nenhuma notificação nesta categoria.</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 transition-colors">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black transition-colors ${currentPage === i + 1 ? 'bg-indigo-600 dark:bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;
