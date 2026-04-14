export type MobileNotificationType = 'info' | 'success' | 'warning' | 'error' | string;

export type MobileNotificationCategory =
  | 'system'
  | 'social'
  | 'marketplace'
  | 'report'
  | 'moderation'
  | string;

export interface MobileNotification {
  id: string;
  userId?: string;
  title: string;
  message: string;
  type: MobileNotificationType;
  category: MobileNotificationCategory;
  isRead: boolean;
  timestamp?: number | string;
  link?: string;
  evidenceUrl?: string;
  deletedAt?: number | string | null;
}
