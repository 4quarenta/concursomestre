'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Inbox,
  Info,
  Loader2,
  MailOpen,
  MessageSquare,
  RefreshCcw,
  Shield,
  ShoppingBag,
  Trash2,
  XCircle,
} from 'lucide-react';
import BrandLink from '@/components/shared/BrandLink';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';
import { notificationService } from '@/services/notifications/notificationService';
import type { Notification } from '@/types';
import { readApiErrorMessage } from '@/lib/browserApi';

type TabType = 'all' | 'marketplace' | 'report' | 'social' | 'system' | 'trash';

const ITEMS_PER_PAGE = 7;
const TRASH_RETENTION_DAYS = 30;

const tabMeta: Array<{
  icon: React.ComponentType<{ size?: number }>;
  id: TabType;
  label: string;
}> = [
  { id: 'all', label: 'Geral', icon: Inbox },
  { id: 'system', label: 'Sistema', icon: Info },
  { id: 'social', label: 'Social', icon: MessageSquare },
  { id: 'marketplace', label: 'Loja', icon: ShoppingBag },
  { id: 'report', label: 'Relatorios', icon: Shield },
  { id: 'trash', label: 'Lixeira', icon: Trash2 },
];

const getBackgroundClassName = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return 'border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300';
    case 'warning':
      return 'border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
    case 'error':
      return 'border-red-100 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300';
    default:
      return 'border-indigo-100 bg-indigo-50 text-indigo-600 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300';
  }
};

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 size={24} />;
    case 'warning':
      return <AlertTriangle size={24} />;
    case 'error':
      return <XCircle size={24} />;
    default:
      return <Info size={24} />;
  }
};

const sortNotifications = (notifications: Notification[]) => (
  [...notifications].sort((left, right) => Number(right.timestamp || 0) - Number(left.timestamp || 0))
);

const formatTimestamp = (timestamp: number) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString('pt-BR');
  }
};

export default function NotificationsPageClient() {
  const router = useRouter();
  const { currentUser, isAuthenticated, isLoading: authLoading } = useAuthSession();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isAuthenticated || !currentUser) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadNotifications = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const nextNotifications = await notificationService.getNotifications();
        if (!isMounted) {
          return;
        }

        setNotifications(sortNotifications(nextNotifications));
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setError(readApiErrorMessage(requestError, 'Nao foi possivel carregar as notificacoes.'));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadNotifications();

    return () => {
      isMounted = false;
    };
  }, [authLoading, currentUser, isAuthenticated]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'trash') {
      return notifications.filter((notification) => notification.deletedAt);
    }

    const visibleNotifications = notifications.filter((notification) => !notification.deletedAt);
    if (activeTab === 'all') {
      return visibleNotifications;
    }

    return visibleNotifications.filter((notification) => notification.category === activeTab);
  }, [activeTab, notifications]);

  const paginatedNotifications = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredNotifications.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, filteredNotifications]);

  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE));

  const patchNotification = (notificationId: string, applyPatch: (item: Notification) => Notification) => {
    setNotifications((currentNotifications) => sortNotifications(
      currentNotifications.map((notification) => (
        notification.id === notificationId ? applyPatch(notification) : notification
      )),
    ));
  };

  const handleOpenNotification = async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await notificationService.markAsRead(notification.id);
        patchNotification(notification.id, (item) => ({ ...item, isRead: true }));
      } catch (requestError) {
        setError(readApiErrorMessage(requestError, 'Nao foi possivel marcar a notificacao como lida.'));
      }
    }

    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsMutating(true);
    setError(null);

    try {
      await notificationService.markAllAsRead();
      setNotifications((currentNotifications) => currentNotifications.map((notification) => ({
        ...notification,
        isRead: true,
      })));
    } catch (requestError) {
      setError(readApiErrorMessage(requestError, 'Nao foi possivel marcar todas como lidas.'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleClearNotifications = async () => {
    setIsMutating(true);
    setError(null);

    try {
      await notificationService.clearAll();
      setNotifications([]);
    } catch (requestError) {
      setError(readApiErrorMessage(requestError, 'Nao foi possivel limpar as notificacoes.'));
    } finally {
      setIsMutating(false);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.isRead && !notification.deletedAt).length;
  const visibleNotificationCount = notifications.filter((notification) => !notification.deletedAt).length;

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 size={40} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando notificacoes...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 dark:bg-slate-950">
        <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center text-center">
          <BrandLink className="mb-8" />
          <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Bell size={30} />
            </div>
            <h1 className="mt-6 text-2xl font-black text-slate-900 dark:text-slate-100">Entre para ver suas notificacoes</h1>
            <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              Seus alertas, mensagens do sistema e avisos da plataforma ficam centralizados aqui.
            </p>
            <button
              type="button"
              onClick={() => router.push('/auth?mode=login&redirect=/notifications')}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-4 text-xs font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700"
            >
              Entrar agora
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <BrandLink className="mb-4" />
            <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900 dark:text-slate-100">
              <Bell className="text-indigo-600 dark:text-indigo-400" />
              Notificacoes
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Acompanhe avisos, leitura de mensagens e atualizacoes da sua conta.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              disabled={isMutating || unreadCount === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/20 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
            >
              <MailOpen size={14} />
              Ler todas
            </button>
            {activeTab !== 'trash' ? (
              <button
                type="button"
                onClick={handleClearNotifications}
                disabled={isMutating || visibleNotificationCount === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/20 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                <Trash2 size={14} />
                Limpar
              </button>
            ) : null}
          </div>
        </header>

        <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
          {tabMeta.map(({ icon: Icon, id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-colors ${
                activeTab === id
                  ? 'bg-slate-900 text-white dark:bg-indigo-600'
                  : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="space-y-4">
          {paginatedNotifications.length > 0 ? (
            paginatedNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex flex-col gap-4 rounded-[1.5rem] border p-5 shadow-sm transition-colors md:flex-row md:items-center ${
                  notification.isRead
                    ? 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                    : 'border-indigo-200 bg-white ring-1 ring-indigo-50 dark:border-indigo-500/30 dark:bg-slate-900 dark:ring-indigo-500/10'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleOpenNotification(notification)}
                  className="flex flex-1 items-start gap-4 text-left"
                >
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${getBackgroundClassName(notification.type)}`}>
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className={`text-sm font-black ${notification.isRead ? 'text-slate-800 dark:text-slate-100' : 'text-indigo-700 dark:text-indigo-300'}`}>
                        {notification.title}
                      </h2>
                      {!notification.isRead ? (
                        <span className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      ) : null}
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {notification.category}
                      </span>
                    </div>

                    <p className="text-sm leading-7 text-slate-500 dark:text-slate-400">{notification.message}</p>

                    {notification.evidenceUrl ? (
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
                        <img
                          src={notification.evidenceUrl}
                          alt="Evidencia da notificacao"
                          className="max-h-64 w-full object-contain"
                        />
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                      <span>{formatTimestamp(notification.timestamp)}</span>
                      {notification.link ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
                          Ver conteudo
                          <ArrowRight size={12} />
                        </span>
                      ) : null}
                      {activeTab === 'trash' && notification.deletedAt ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          <RefreshCcw size={12} />
                          {Math.max(
                            0,
                            TRASH_RETENTION_DAYS - Math.floor((Date.now() - notification.deletedAt) / (1000 * 60 * 60 * 24)),
                          )} dias
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {activeTab === 'trash' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => patchNotification(notification.id, (item) => ({ ...item, deletedAt: undefined }))}
                        className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                        title="Restaurar"
                      >
                        <RefreshCcw size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifications((currentNotifications) => currentNotifications.filter((item) => item.id !== notification.id))}
                        className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                        title="Excluir permanentemente"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      {!notification.isRead ? (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await notificationService.markAsRead(notification.id);
                              patchNotification(notification.id, (item) => ({ ...item, isRead: true }));
                            } catch (requestError) {
                              setError(readApiErrorMessage(requestError, 'Nao foi possivel marcar a notificacao como lida.'));
                            }
                          }}
                          className="rounded-lg p-2 text-indigo-600 transition-colors hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                          title="Marcar como lida"
                        >
                          <Check size={18} />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => patchNotification(notification.id, (item) => ({ ...item, deletedAt: Date.now() }))}
                        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10 dark:hover:text-red-300"
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
            <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <Inbox size={36} />
              </div>
              <h2 className="mt-6 text-xl font-black text-slate-900 dark:text-slate-100">Nada por aqui</h2>
              <p className="mt-2 max-w-md text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                Nenhuma notificacao foi encontrada para esta categoria no momento.
              </p>
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setCurrentPage(pageNumber)}
                className={`h-10 w-10 rounded-xl text-xs font-black transition-colors ${
                  currentPage === pageNumber
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
