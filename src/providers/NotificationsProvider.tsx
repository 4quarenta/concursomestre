'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@providers/AuthProvider';
import { buildNotificationsQueryKey, fetchNotificationsList } from '@/state/notifications/notificationsQuery';
import { useNotificationsStore } from '@/state/notifications/notificationsStore';
import { clientLog } from '@services/monitoring/clientLog';

interface NotificationsProviderProps {
  children: React.ReactNode;
}

const ACTIVE_POLL_INTERVAL_MS = 60_000;
const IDLE_POLL_INTERVAL_MS = 180_000;
const DELETED_NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const FOCUS_REFRESH_THROTTLE_MS = 15_000;
const INITIAL_FETCH_DELAY_DEFAULT_MS = 2500;
const INITIAL_FETCH_DELAY_HEAVY_ROUTE_MS = 8000;

const shouldUseHeavyBootstrapDelay = (pathname: string) => (
  pathname.startsWith('/dashboard')
  || pathname.startsWith('/practice')
  || pathname.startsWith('/admin/panel')
);

const scheduleNotificationsBootstrapFetch = (task: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const pathname = window.location.pathname || '/';
  const delayMs = shouldUseHeavyBootstrapDelay(pathname)
    ? INITIAL_FETCH_DELAY_HEAVY_ROUTE_MS
    : INITIAL_FETCH_DELAY_DEFAULT_MS;
  const timeoutId = window.setTimeout(task, delayMs);
  return () => {
    window.clearTimeout(timeoutId);
  };
};

/**
 * Bootstrap enxuto de notificacoes globais.
 * Substitui os efeitos pesados do provider legado com cache/polling controlado.
 *
 * @since 1.0.0
 */
export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const replaceNotifications = useNotificationsStore((state) => state.replaceNotifications);
  const cleanupDeletedNotifications = useNotificationsStore((state) => state.cleanupDeletedNotifications);
  const resetNotifications = useNotificationsStore((state) => state.resetNotifications);

  const currentUserId = currentUser?.id ?? null;
  const shouldFetchNotifications = Boolean(currentUserId);
  const fetchInFlightRef = React.useRef(false);
  const lastFetchAtRef = React.useRef(0);

  const fetchNotifications = React.useCallback(async (userId: string, force = false) => {
    if (!userId || fetchInFlightRef.current) {
      return;
    }

    const now = Date.now();
    if (force && (now - lastFetchAtRef.current) < FOCUS_REFRESH_THROTTLE_MS) {
      return;
    }

    fetchInFlightRef.current = true;
    try {
      const notifications = await queryClient.fetchQuery({
        queryKey: buildNotificationsQueryKey(userId),
        queryFn: () => fetchNotificationsList(userId),
        staleTime: force ? 0 : 30_000,
      });
      replaceNotifications(userId, notifications);
      lastFetchAtRef.current = Date.now();
    } catch (error) {
      clientLog.warn('[NotificationsProvider] Failed to load notifications:', error);
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [queryClient, replaceNotifications]);

  React.useEffect(() => {
    if (authIsLoading) {
      return;
    }

    if (!currentUserId) {
      resetNotifications();
    }
  }, [authIsLoading, currentUserId, resetNotifications]);

  React.useEffect(() => {
    if (!shouldFetchNotifications || !currentUserId) {
      return;
    }

    let cancelBootstrapFetch = () => {};
    if (document.visibilityState === 'visible') {
      cancelBootstrapFetch = scheduleNotificationsBootstrapFetch(() => {
        void fetchNotifications(currentUserId, true);
      });
    }

    let timeoutId: number | null = null;
    let cancelled = false;

    const schedulePoll = (delayMs: number) => {
      timeoutId = window.setTimeout(async () => {
        if (cancelled) {
          return;
        }

        await fetchNotifications(currentUserId);
        const nextDelay = document.visibilityState === 'visible' ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
        schedulePoll(nextDelay);
      }, delayMs);
    };

    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') {
        return;
      }
      void fetchNotifications(currentUserId, true);
    };

    schedulePoll(ACTIVE_POLL_INTERVAL_MS);
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      cancelled = true;
      cancelBootstrapFetch();
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [currentUserId, fetchNotifications, shouldFetchNotifications]);

  React.useEffect(() => {
    cleanupDeletedNotifications(DELETED_NOTIFICATION_RETENTION_MS);
  }, [cleanupDeletedNotifications]);

  return <>{children}</>;
};

export default NotificationsProvider;
