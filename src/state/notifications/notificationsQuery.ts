import { notificationService } from '@services/notifications';
import type { Notification } from '@types';

export const buildNotificationsQueryKey = (userId: string) => (
  ['notifications', userId] as const
);

export const fetchNotificationsList = async (userId: string, signal?: AbortSignal): Promise<Notification[]> => {
  const notifications = await notificationService.getUserNotifications(userId, { signal });
  return Array.isArray(notifications) ? notifications : [];
};

export default fetchNotificationsList;
