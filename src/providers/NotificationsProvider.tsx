'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@providers/AuthProvider';
import { buildNotificationsQueryKey, fetchNotificationsList } from '@/state/notifications/notificationsQuery';
import { useNotificationsStore } from '@/state/notifications/notificationsStore';
import { clientLog } from '@services/monitoring/clientLog';
import { getAccessToken, isAccessTokenExpired } from '@services/auth/session';

interface NotificationsProviderProps {
  children: React.ReactNode;
}

const DELETED_NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

interface NotificationsLoaderContextValue {
  refreshNotifications: (force?: boolean) => Promise<void>;
}

const NotificationsLoaderContext = React.createContext<NotificationsLoaderContextValue | null>(null);

export const useNotificationsLoader = () => {
  const context = React.useContext(NotificationsLoaderContext);
  if (!context) {
    throw new Error('useNotificationsLoader must be used within NotificationsProvider');
  }
  return context;
};

/** Loads notifications only when a consumer explicitly requests a refresh. */
export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children }) => {
  const queryClient = useQueryClient();
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const replaceNotifications = useNotificationsStore((state) => state.replaceNotifications);
  const loadedUserId = useNotificationsStore((state) => state.loadedUserId);
  const cleanupDeletedNotifications = useNotificationsStore((state) => state.cleanupDeletedNotifications);
  const resetNotifications = useNotificationsStore((state) => state.resetNotifications);

  const currentUserId = currentUser?.id ? String(currentUser.id) : null;
  const accessToken = getAccessToken();
  const hasValidAccessToken = Boolean(accessToken) && !isAccessTokenExpired(accessToken, 10);
  const inFlightByUserRef = React.useRef(new Map<string, Promise<void>>());

  const refreshNotifications = React.useCallback(async (force = false) => {
    const userId = currentUserId;
    const accessToken = getAccessToken();
    if (!userId || !accessToken || isAccessTokenExpired(accessToken, 10)) {
      return;
    }

    const existingRequest = inFlightByUserRef.current.get(userId);
    if (existingRequest) {
      await existingRequest;
      return;
    }

    const request = (async () => {
      try {
        const notifications = await queryClient.fetchQuery({
          queryKey: buildNotificationsQueryKey(userId),
          queryFn: ({ signal }) => fetchNotificationsList(userId, signal),
          staleTime: force ? 0 : 30_000,
        });
        replaceNotifications(userId, notifications);
      } catch (error) {
        clientLog.warn('[NotificationsProvider] Failed to load notifications:', error);
      }
    })();

    inFlightByUserRef.current.set(userId, request);
    try {
      await request;
    } finally {
      if (inFlightByUserRef.current.get(userId) === request) {
        inFlightByUserRef.current.delete(userId);
      }
    }
  }, [currentUserId, queryClient, replaceNotifications]);

  React.useEffect(() => {
    if (!authIsLoading && (
      !currentUserId
      || !hasValidAccessToken
      || (loadedUserId !== null && loadedUserId !== currentUserId)
    )) {
      resetNotifications();
    }
  }, [authIsLoading, currentUserId, hasValidAccessToken, loadedUserId, resetNotifications]);

  React.useEffect(() => {
    cleanupDeletedNotifications(DELETED_NOTIFICATION_RETENTION_MS);
  }, [cleanupDeletedNotifications]);

  const value = React.useMemo(() => ({ refreshNotifications }), [refreshNotifications]);
  return (
    <NotificationsLoaderContext.Provider value={value}>
      {children}
    </NotificationsLoaderContext.Provider>
  );
};

export default NotificationsProvider;
