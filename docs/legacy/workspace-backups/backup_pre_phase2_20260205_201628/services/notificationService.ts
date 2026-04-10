
import { Notification } from '../types';
import { api } from '../data/api';

export const notificationService = {

  // Obter notificações de um usuário
  getUserNotifications: async (userId: string): Promise<Notification[]> => {
    console.log('[NotificationService] Fetching notifications for:', userId);
    try {
      const response = await api.get<Notification[]>('api/notifications/list.php', { user_id: userId });
      console.log('[NotificationService] API response:', response);

      if (response.success && response.data) {
        const mapped = response.data.map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          title: n.title,
          message: n.message,
          type: n.type || 'info',
          category: n.category || 'system',
          isRead: Boolean(n.is_read),
          timestamp: new Date(n.created_at || Date.now()).getTime(),
          link: n.link,
          evidenceUrl: n.evidence_url,
          deletedAt: n.deleted_at ? new Date(n.deleted_at).getTime() : undefined
        }));
        console.log('[NotificationService] Mapped notifications:', mapped);
        return mapped;
      }
      console.log('[NotificationService] No data in response');
      return [];
    } catch (error) {
      console.error('[NotificationService] Failed to fetch notifications:', error);
      return [];
    }
  },

  // Enviar nova notificação
  sendNotification: async (
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    category: 'system' | 'social' | 'marketplace' | 'report' = 'system',
    link?: string,
    evidenceUrl?: string
  ): Promise<Notification> => {
    try {
      const response = await api.post('api/notifications/create.php', {
        user_id: userId,
        title,
        message,
        type,
        category,
        link,
        evidence_url: evidenceUrl
      });

      if (response.success && response.data) {
        const data = response.data as any;
        return {
          id: data.id,
          userId,
          title,
          message,
          type,
          category,
          isRead: false,
          timestamp: Date.now(),
          link,
          evidenceUrl
        };
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    // Fallback: return a local notification if API fails
    return {
      id: crypto.randomUUID(),
      userId,
      title,
      message,
      type,
      category,
      isRead: false,
      timestamp: Date.now(),
      link,
      evidenceUrl
    };
  },

  // Marcar como lida
  markAsRead: async (notificationId: string): Promise<void> => {
    try {
      await api.post('api/notifications/mark_read.php', { notification_id: notificationId });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  },

  // Marcar todas como lidas
  markAllAsRead: async (userId: string): Promise<void> => {
    try {
      await api.post('api/notifications/mark_all_read.php', { user_id: userId });
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  },

  // Deletar notificação específica
  deleteNotification: async (notificationId: string): Promise<void> => {
    try {
      await api.post('api/notifications/delete.php', { notification_id: notificationId });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  },

  // Limpar notificações (opcional)
  clearAll: async (userId: string): Promise<void> => {
    try {
      await api.post('api/notifications/clear_all.php', { user_id: userId });
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
};
