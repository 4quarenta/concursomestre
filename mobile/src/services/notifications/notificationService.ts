import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { MobileNotification } from '@/types/notifications';

type NotificationListPayload = {
  items?: unknown[];
  notifications?: unknown[];
  rows?: unknown[];
  data?: unknown[];
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'read', 'lida'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', 'unread', 'nao_lida', ''].includes(normalized)) return false;
  }
  return Boolean(value);
};

const readRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as NotificationListPayload;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.notifications)) return record.notifications;
  if (Array.isArray(record.rows)) return record.rows;
  if (Array.isArray(record.data)) return record.data;

  return [];
};

const normalizeNotification = (row: unknown, index: number): MobileNotification | null => {
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, any>;
  const id = String(record.id || record.notification_id || record.uuid || index).trim();

  if (!id) return null;

  return {
    id,
    userId: record.userId || record.user_id ? String(record.userId || record.user_id) : undefined,
    title: String(record.title || record.titulo || 'Notificacao').trim(),
    message: String(record.message || record.body || record.mensagem || '').trim(),
    type: String(record.type || record.notification_type || 'info'),
    category: String(record.category || record.categoria || 'system'),
    isRead: toBoolean(record.isRead ?? record.is_read ?? record.read ?? record.read_at),
    timestamp: record.timestamp || record.createdAt || record.created_at || record.created || record.date,
    link: record.link || record.actionUrl || record.action_url || record.url || undefined,
    evidenceUrl: record.evidenceUrl || record.evidence_url || undefined,
    deletedAt: record.deletedAt || record.deleted_at || null,
  };
};

const normalizeNotifications = (payload: unknown): MobileNotification[] => {
  return readRows(payload)
    .map((row, index) => normalizeNotification(row, index))
    .filter((row): row is MobileNotification => Boolean(row && !row.deletedAt));
};

/**
 * Fachada mobile de notificacoes.
 * @since v1.0.0
 */
export const notificationService = {
  async list(): Promise<MobileNotification[]> {
    const response: any = await apiClient.get<any>(ENDPOINTS.notifications.list);
    const payload = readApiData<any>(response, []);
    return normalizeNotifications(payload);
  },

  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.notifications.markRead,
      { notification_id: notificationId },
    );

    assertApiSuccess(response, 'Nao foi possivel marcar a notificacao como lida.');
    return { success: true };
  },

  async markAllAsRead(): Promise<{ success: boolean }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.notifications.markAllRead);
    assertApiSuccess(response, 'Nao foi possivel marcar todas as notificacoes como lidas.');
    return { success: true };
  },

  async deleteNotification(notificationId: string): Promise<{ success: boolean }> {
    const response: any = await apiClient.post<any>(
      ENDPOINTS.notifications.delete,
      { notification_id: notificationId },
    );

    assertApiSuccess(response, 'Nao foi possivel excluir a notificacao.');
    return { success: true };
  },

  async clearAll(): Promise<{ success: boolean }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.notifications.clearAll);
    assertApiSuccess(response, 'Nao foi possivel limpar as notificacoes.');
    return { success: true };
  },
};

export default notificationService;
