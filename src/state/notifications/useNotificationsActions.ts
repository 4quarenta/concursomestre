'use client';

import { useCallback } from 'react';
import { notificationService } from '@services/notifications';
import { useNotificationsStore } from './notificationsStore';

/**
 * Exposes notification mutations using the dedicated notifications store.
 * This keeps notification behavior isolated from unrelated UI domains.
 *
 * @since 1.0.0
 */
export const useNotificationsActions = () => {
  const markLocalNotificationAsRead = useNotificationsStore((store) => store.markNotificationAsRead);
  const markAllLocalNotificationsAsRead = useNotificationsStore((store) => store.markAllNotificationsAsRead);
  const softDeleteLocalNotification = useNotificationsStore((store) => store.softDeleteNotification);
  const restoreLocalNotification = useNotificationsStore((store) => store.restoreNotification);
  const removeLocalNotification = useNotificationsStore((store) => store.permanentDeleteNotification);
  const clearLocalNotifications = useNotificationsStore((store) => store.clearNotifications);

  const markNotificationAsRead = useCallback(async (id: string) => {
    await notificationService.markAsRead(id);
    markLocalNotificationAsRead(id);
  }, [markLocalNotificationAsRead]);

  const markAllNotificationsAsRead = useCallback(async (_userId?: string) => {
    void _userId;
    await notificationService.markAllAsRead();
    markAllLocalNotificationsAsRead();
  }, [markAllLocalNotificationsAsRead]);

  const deleteNotification = useCallback(async (id: string) => {
    softDeleteLocalNotification(id, Date.now());
  }, [softDeleteLocalNotification]);

  const restoreNotification = useCallback(async (id: string) => {
    restoreLocalNotification(id);
  }, [restoreLocalNotification]);

  const permanentDeleteNotification = useCallback(async (id: string) => {
    removeLocalNotification(id);
  }, [removeLocalNotification]);

  const clearNotifications = useCallback(async (_userId?: string) => {
    void _userId;
    await notificationService.clearAll();
    clearLocalNotifications(Date.now());
  }, [clearLocalNotifications]);

  return {
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    restoreNotification,
    permanentDeleteNotification,
    clearNotifications,
  };
};

export default useNotificationsActions;
