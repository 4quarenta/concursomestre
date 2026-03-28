/**
 * Notifications Feature Module
 * Public API exports for notifications feature
 */

// Context and hooks
export { NotificationsProvider, useNotifications } from './context/NotificationsContext';
export { useNotificationActions } from './hooks/useNotificationActions';

// Services
export { notificationService } from './services/notificationService';

// Types
export type * from './types';
