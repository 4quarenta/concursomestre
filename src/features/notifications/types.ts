/**
 * Notifications Feature Types
 */

import { Notification } from '../../../types';

export interface NotificationsContextType {
    // Data
    notifications: Notification[];
    unreadCount: number;

    // Actions
    markAsRead: (notificationId: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (notificationId: string) => Promise<void>;

    // Helpers
    getUnreadNotifications: () => Notification[];
    getNotificationsByCategory: (category: string) => Notification[];
}

export type { Notification };
