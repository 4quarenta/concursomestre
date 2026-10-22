'use client';

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
import Image from 'next/image';
import {
  AlertTriangle,
  ArrowRight,
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
import { useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { useConfirm } from '@providers/ModalProvider';
import type { Notification } from '@types';
import { useNotificationsStore } from '@/state/notifications/notificationsStore';
import { useNotificationsActions } from '@/state/notifications/useNotificationsActions';
import PlatformPageHeader from '@/components/shared/layout/PlatformPageHeader';
import { PLATFORM_MAIN_CONTENT_WIDTH_CLASS } from '@constants/layout';

type TabType = 'all' | 'system' | 'social' | 'marketplace' | 'report' | 'trash';

const TRASH_RETENTION_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;
const CATEGORY_LABELS: Record<Exclude<TabType, 'all' | 'trash'>, string> = {
  system: 'Sistema',
  social: 'Interações',
  marketplace: 'Loja',
  report: 'Suporte',
};

const normalizeNotificationText = (value: string): string => (
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
);

const resolveNotificationCategory = (notification: Notification): Exclude<TabType, 'all' | 'trash'> => {
  const rawCategory = String(notification.category || '').toLowerCase();
  const haystack = normalizeNotificationText([
    rawCategory,
    notification.title,
    notification.message,
    notification.link || '',
  ].join(' '));

  if (/(pagamento|assinatura|plano|checkout|compra|cartao|fatura|loja|marketplace|material|cortesia|voucher)/.test(haystack)) {
    return 'marketplace';
  }

  if (/(suporte|atendimento|denuncia|denuncias|report|reembolso|feedback|avaliacao|moderacao|moderar|erro|bug|cancelamento)/.test(haystack)) {
    return 'report';
  }

  if (/(comentario|resposta|curtiu|like|favorito|salvo|anotacao|social|ranking|xp|sequencia|estudo)/.test(haystack)) {
    return 'social';
  }

  if (rawCategory === 'marketplace') {
    return 'marketplace';
  }

  if (rawCategory === 'report') {
    return 'report';
  }

  if (rawCategory === 'social') {
    return 'social';
  }

  return 'system';
};

const getNotificationCategoryLabel = (notification: Notification): string => (
  CATEGORY_LABELS[resolveNotificationCategory(notification)]
);

const getTrashDaysLeft = (deletedAt: number, referenceTimeMs: number): number | null => {
  if (!referenceTimeMs) {
    return null;
  }

  return Math.max(0, TRASH_RETENTION_DAYS - Math.floor((referenceTimeMs - deletedAt) / MS_PER_DAY));
};

const formatNotificationDateTime = (timestamp: string | number | Date): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

type TabButtonProps = {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  count: number;
  activeTab: TabType;
  onSelect: (id: TabType) => void;
};

const TabButton: React.FC<TabButtonProps> = ({ id, label, icon: Icon, count, activeTab, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(id)}
    role="tab"
    aria-selected={activeTab === id}
    className={`inline-flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors ${
      activeTab === id
        ? 'border-indigo-600 text-indigo-700 dark:border-indigo-400 dark:text-indigo-300'
        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100'
    }`}
  >
    <Icon size={16} aria-hidden="true" />
    {label}
    <span className={`ml-1 min-w-5 rounded px-1 text-center text-xs tabular-nums ${activeTab === id ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
      {count}
    </span>
  </button>
);

const Page: React.FC = () => {
  const notifications = useNotificationsStore((store) => store.notifications);
  const {
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    restoreNotification,
    permanentDeleteNotification,
    clearNotifications,
  } = useNotificationsActions();
  const { currentUser } = useAuth();
  const confirmDialog = useConfirm();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [referenceTimeMs, setReferenceTimeMs] = useState(0);
  const itemsPerPage = 7;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setReferenceTimeMs(Date.now());
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

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

    return visibleNotifications.filter((notification) => resolveNotificationCategory(notification) === activeTab);
  };

  const filteredNotifications = getFilteredNotifications();
  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const paginatedNotifications = filteredNotifications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const unreadCount = notifications.filter((notification) => !notification.deletedAt && !notification.isRead).length;
  const activeCount = notifications.filter((notification) => !notification.deletedAt).length;

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

  const handleNotificationClick = (notification: Notification) => {
    markNotificationAsRead(notification.id);

    if (notification.link) {
      router.push(notification.link);

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

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const tabItems: Array<{ id: TabType; label: string; icon: TabButtonProps['icon'] }> = [
    { id: 'all', label: 'Todas', icon: Inbox },
    { id: 'system', label: 'Sistema', icon: Info },
    { id: 'social', label: 'Interações', icon: MessageSquare },
    { id: 'marketplace', label: 'Loja', icon: ShoppingBag },
    { id: 'report', label: 'Suporte', icon: Shield },
    { id: 'trash', label: 'Lixeira', icon: Trash2 },
  ];

  const getTabCount = (tab: TabType) => {
    if (tab === 'trash') {
      return notifications.filter((notification) => notification.deletedAt).length;
    }
    const activeNotifications = notifications.filter((notification) => !notification.deletedAt);
    if (tab === 'all') return activeNotifications.length;
    return activeNotifications.filter((notification) => resolveNotificationCategory(notification) === tab).length;
  };

  const iconTone = (type: string) => {
    switch (type) {
      case 'success': return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-400/10';
      case 'warning': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10';
      case 'error': return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-400/10';
      default: return 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-400/10';
    }
  };

  return (
    <main className={`mx-auto w-full ${PLATFORM_MAIN_CONTENT_WIDTH_CLASS} animate-fade-in pb-12`}>
      <PlatformPageHeader
        breadcrumbs={[{ label: 'Início', path: '/' }, { label: 'Notificações', path: '/notifications' }]}
        title="Notificações"
        description={
          <>
            {unreadCount > 0 ? `${unreadCount} não lidas` : 'Tudo em dia'}
            <span className="px-2 text-slate-300 dark:text-slate-700" aria-hidden="true">·</span>
            {activeCount} {activeCount === 1 ? 'notificação' : 'notificações'}
          </>
        }
        action={<div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => markAllNotificationsAsRead(currentUser.id)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            disabled={unreadCount === 0}
          >
            <MailOpen size={16} aria-hidden="true" /> Marcar todas como lidas
          </button>
          {activeTab !== 'trash' && (
            <button
              type="button"
              onClick={async () => {
                const confirmed = await confirmDialog({
                  title: 'Mover notificações para a lixeira?',
                  description: 'Todas as notificações visíveis serão movidas para a lixeira.',
                  confirmText: 'Mover para lixeira',
                  cancelText: 'Cancelar',
                  type: 'warning',
                });
                if (!confirmed) return;
                clearNotifications(currentUser.id);
              }}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-900 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
              disabled={activeCount === 0}
            >
              <Trash2 size={16} aria-hidden="true" /> Limpar
            </button>
          )}
        </div>}
      />

      <nav className="-mx-2 mt-3 overflow-x-auto px-2" aria-label="Categorias de notificações">
        <div className="flex min-w-max border-b border-slate-200 dark:border-slate-800" role="tablist">
          {tabItems.map((item) => (
            <TabButton key={item.id} id={item.id} label={item.label} icon={item.icon} count={getTabCount(item.id)} activeTab={activeTab} onSelect={handleSelectTab} />
          ))}
        </div>
      </nav>

      <section className="mt-2" aria-label="Lista de notificações" role="tabpanel">
        {paginatedNotifications.length > 0 ? (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {paginatedNotifications.map((notification) => (
              <li key={notification.id} className={`group flex gap-3 py-5 sm:gap-4 ${notification.isRead ? '' : 'bg-indigo-50/40 dark:bg-indigo-400/[0.035]'}`}>
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${iconTone(notification.type)}`} aria-hidden="true">
                  {React.cloneElement(getTypeIcon(notification.type), { size: 18 })}
                </div>

                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className="block w-full rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
                    aria-label={`${notification.isRead ? '' : 'Não lida: '}${notification.title}. ${notification.link ? 'Abrir notificação' : 'Marcar como lida'}`}
                  >
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`text-sm font-semibold ${notification.isRead ? 'text-slate-800 dark:text-slate-100' : 'text-slate-950 dark:text-white'}`}>
                        {notification.title}
                      </span>
                      {!notification.isRead && <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" aria-label="Não lida" />}
                      <span className="text-xs text-slate-500 dark:text-slate-400">{getNotificationCategoryLabel(notification)}</span>
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">{notification.message}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>{formatNotificationDateTime(notification.timestamp)}</span>
                      {notification.link && <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 dark:text-indigo-300">Ver conteúdo <ArrowRight size={13} aria-hidden="true" /></span>}
                      {activeTab === 'trash' && notification.deletedAt && (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                          <RefreshCcw size={13} aria-hidden="true" /> {getTrashDaysLeft(notification.deletedAt, referenceTimeMs) ?? TRASH_RETENTION_DAYS} dias para excluir
                        </span>
                      )}
                    </span>
                  </button>

                  {notification.evidenceUrl && (
                    <div className="mt-3">
                      <p className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400"><Info size={13} aria-hidden="true" /> Evidência anexada</p>
                      <Image src={notification.evidenceUrl} alt="Evidência da notificação" width={420} height={192} unoptimized className="max-h-48 rounded-md border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-900" />
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-start gap-1" aria-label="Ações da notificação">
                  {activeTab === 'trash' ? (
                    <>
                      <button type="button" onClick={() => restoreNotification(notification.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:text-slate-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300" title="Restaurar" aria-label="Restaurar notificação">
                        <RefreshCcw size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const confirmed = await confirmDialog({
                            title: 'Excluir permanentemente?',
                            description: 'Essa ação remove a notificação e não pode ser desfeita.',
                            confirmText: 'Excluir',
                            cancelText: 'Cancelar',
                            type: 'danger',
                          });
                          if (confirmed) permanentDeleteNotification(notification.id);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                        title="Excluir permanentemente"
                        aria-label="Excluir notificação permanentemente"
                      ><Trash2 size={17} /></button>
                    </>
                  ) : (
                    <>
                      {!notification.isRead && (
                        <button type="button" onClick={() => markNotificationAsRead(notification.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700 dark:text-slate-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300" title="Marcar como lida" aria-label="Marcar notificação como lida"><Check size={17} /></button>
                      )}
                      <button type="button" onClick={() => deleteNotification(notification.id)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300" title="Mover para lixeira" aria-label="Mover notificação para lixeira"><Trash2 size={17} /></button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center border-b border-slate-200 px-4 text-center dark:border-slate-800">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400"><Inbox size={23} aria-hidden="true" /></span>
            <h2 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">Nenhuma notificação por aqui</h2>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">Quando houver novidades nesta categoria, elas aparecerão nesta lista.</p>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-1 border-t border-slate-200 pt-4 dark:border-slate-800" aria-label="Paginação de notificações">
          <span className="mr-3 text-sm text-slate-500 dark:text-slate-400">Página {currentPage} de {totalPages}</span>
          {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setCurrentPage(pageNumber)}
              aria-current={currentPage === pageNumber ? 'page' : undefined}
              aria-label={`Página ${pageNumber}`}
              className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold transition-colors ${currentPage === pageNumber ? 'bg-indigo-600 text-white dark:bg-indigo-500' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >{pageNumber}</button>
          ))}
        </nav>
      )}
    </main>
  );
};

export default Page;
