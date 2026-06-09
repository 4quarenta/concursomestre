/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import { getAccessToken, isAccessTokenExpired } from '@services/auth/session';
import { clientLog } from '@services/monitoring/clientLog';
import { normalizeNotificationSettings } from '@/constants/gamificationNotificationSettings';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import type { Notification } from 'types';

type NotificationListPayload = {
  items?: Notification[];
  notifications?: Notification[];
  data?: Notification[];
  count?: number;
};

/**
 * Extrai a lista de notificações preservando compatibilidade com os retornos
 * legados que alternam entre array cru, `{ data: [] }` e payload nomeado.
 * @since 1.0.0
 */
type NotificationListResponse = {
  success?: boolean;
  data?: Notification[] | NotificationListPayload;
  items?: Notification[];
  notifications?: Notification[];
};

const readNotifications = (response: NotificationListResponse): Notification[] => {
  const payload = readApiData<Notification[] | NotificationListPayload>(response, []);

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.notifications)) {
    return payload.notifications;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
};

/**
 * Normaliza o destinatario mantendo aliases oficiais do backend (`admin`, `all`).
 * O backend resolve esses aliases para IDs reais; converter no frontend pode
 * gerar destinatarios inexistentes e violacao de FK em producao.
 *
 * @since 1.0.0
 */
const normalizeNotificationRecipient = (userId: string): string => String(userId || '').trim();

const canSendConfiguredNotification = (eventKey?: string | null): boolean => {
  const systemSettings = useAppConfigStore.getState().systemSettings;
  if (systemSettings.features?.notificationsEnabled === false) {
    return false;
  }

  const notificationSettings = normalizeNotificationSettings(systemSettings.notificationSettings);
  if (!notificationSettings.enabled) {
    return false;
  }

  const normalizedEventKey = String(eventKey || '').trim();
  if (!normalizedEventKey) {
    return true;
  }

  const rule = notificationSettings.rules.find((item) => item.key === normalizedEventKey);
  return rule ? rule.enabled : true;
};

/**
 * Fachada oficial do dominio de notificações.
 * Ela conecta o header do site, dropdowns e fluxos administrativos ao backend padronizado.
 * @since 1.0.0
 */
export const notificationService = {
  /**
   * Carrega as notificações do usuário autenticado.
   * @since 1.0.0
   */
  async getNotifications(): Promise<Notification[]> {
    try {
      const response = await apiClient.get<Notification[] | NotificationListPayload>(ENDPOINTS.notifications.list);
      return readNotifications(response);
    } catch (error) {
      clientLog.warn('Error fetching notifications:', error);
      return [];
    }
  },

  /**
   * Mantem a mesma API usada pelo app, mas a fonte de verdade continua sendo
   * o usuário autenticado no backend.
   * @since 1.0.0
   */
  async getUserNotifications(_userId: string): Promise<Notification[]> {
    void _userId;
    return this.getNotifications();
  },

  /**
   * Marca uma notificação como lida.
   * @since 1.0.0
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.markRead,
      { notification_id: notificationId },
    );

    assertApiSuccess(response, 'Não foi possível marcar a notificação como lida.');
    return { success: true };
  },

  /**
   * Marca todas as notificações como lidas.
   * @since 1.0.0
   */
  async markAllAsRead(): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.markAllRead,
    );

    assertApiSuccess(response, 'Não foi possível marcar todas as notificações como lidas.');
    return { success: true };
  },

  /**
   * Exclui uma notificação individual.
   * @since 1.0.0
   */
  async deleteNotification(notificationId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.delete,
      { notification_id: notificationId },
    );

    assertApiSuccess(response, 'Não foi possível excluir a notificação.');
    return { success: true };
  },

  /**
   * Restaura uma notificacao que estava na lixeira.
   * @since 1.0.0
   */
  async restoreNotification(notificationId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.restore,
      { notification_id: notificationId },
    );

    assertApiSuccess(response, 'Nao foi possivel restaurar a notificacao.');
    return { success: true };
  },

  /**
   * Exclui uma notificacao definitivamente.
   * @since 1.0.0
   */
  async permanentDeleteNotification(notificationId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.permanentDelete,
      { notification_id: notificationId },
    );

    assertApiSuccess(response, 'Nao foi possivel excluir definitivamente a notificacao.');
    return { success: true };
  },

  /**
   * Remove todas as notificacoes do usuario atual.
   * @since 1.0.0
   */
  async clearAll(): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.clearAll,
    );

    assertApiSuccess(response, 'Não foi possível limpar as notificações.');
    return { success: true };
  },

  /**
   * Dispara notificação administrativa/sistemica para um usuário.
   * Essa ponte e usada por moderação, financeiro e operações do painel admin.
   * @since 1.0.0
   */
  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    category: 'system' | 'social' | 'marketplace' | 'moderation' = 'system',
    actionUrl?: string,
    evidenceUrl?: string,
    eventKey?: string,
  ): Promise<{ success: boolean }> {
    try {
      if (!canSendConfiguredNotification(eventKey)) {
        return { success: false };
      }

      const recipientId = normalizeNotificationRecipient(userId);
      if (!recipientId) {
        return { success: false };
      }

      const accessToken = getAccessToken();
      if (!accessToken || isAccessTokenExpired(accessToken, 5)) {
        return { success: false };
      }

      const notificationPayload = {
        user_id: recipientId,
        title,
        message,
        type,
        category,
        action_url: actionUrl,
        evidence_url: evidenceUrl,
        ...(eventKey ? { event_key: eventKey } : {}),
      };

      const response = await apiClient.post(
        ENDPOINTS.notifications.send,
        notificationPayload,
      );

      assertApiSuccess(response, 'Não foi possível enviar a notificação.');
      return { success: true };
    } catch (error) {
      clientLog.warn('Error sending notification:', error);
      return { success: false };
    }
  },
};

export default notificationService;
