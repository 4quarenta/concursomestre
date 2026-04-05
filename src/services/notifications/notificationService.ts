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
import type { Notification } from 'types';

type NotificationListPayload = {
  items?: Notification[];
  notifications?: Notification[];
  data?: Notification[];
  count?: number;
};

/**
 * Extrai a lista de notificacoes preservando compatibilidade com os retornos
 * legados que alternam entre array cru, `{ data: [] }` e payload nomeado.
 * @since 1.0.0
 */
const readNotifications = (response: any): Notification[] => {
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
 * Fachada oficial do dominio de notificacoes.
 * Ela conecta o header do site, dropdowns e fluxos administrativos ao backend padronizado.
 * @since 1.0.0
 */
export const notificationService = {
  /**
   * Carrega as notificacoes do usuario autenticado.
   * @since 1.0.0
   */
  async getNotifications(): Promise<Notification[]> {
    try {
      const response = await apiClient.get(ENDPOINTS.notifications.list) as any;
      return readNotifications(response);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  },

  /**
   * Mantem a mesma API usada pelo app, mas a fonte de verdade continua sendo
   * o usuario autenticado no backend.
   * @since 1.0.0
   */
  async getUserNotifications(_userId: string): Promise<Notification[]> {
    try {
      const response = await apiClient.get(ENDPOINTS.notifications.list) as any;
      return readNotifications(response);
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      return [];
    }
  },

  /**
   * Marca uma notificacao como lida.
   * @since 1.0.0
   */
  async markAsRead(notificationId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.markRead,
      { notification_id: notificationId },
    ) as any;

    assertApiSuccess(response, 'Nao foi possivel marcar a notificacao como lida.');
    return { success: true };
  },

  /**
   * Marca todas as notificacoes como lidas.
   * @since 1.0.0
   */
  async markAllAsRead(): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.markAllRead,
    ) as any;

    assertApiSuccess(response, 'Nao foi possivel marcar todas as notificacoes como lidas.');
    return { success: true };
  },

  /**
   * Exclui uma notificacao individual.
   * @since 1.0.0
   */
  async deleteNotification(notificationId: string): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.delete,
      { notification_id: notificationId },
    ) as any;

    assertApiSuccess(response, 'Nao foi possivel excluir a notificacao.');
    return { success: true };
  },

  /**
   * Remove todas as notificacoes do usuario atual.
   * @since 1.0.0
   */
  async clearAll(): Promise<{ success: boolean }> {
    const response = await apiClient.post(
      ENDPOINTS.notifications.clearAll,
    ) as any;

    assertApiSuccess(response, 'Nao foi possivel limpar as notificacoes.');
    return { success: true };
  },

  /**
   * Dispara notificacao administrativa/sistemica para um usuario.
   * Essa ponte e usada por moderacao, financeiro e operacoes do painel admin.
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
  ): Promise<{ success: boolean }> {
    try {
      const response = await apiClient.post(
        ENDPOINTS.notifications.send,
        {
          user_id: userId,
          title,
          message,
          type,
          category,
          action_url: actionUrl,
          evidence_url: evidenceUrl,
        },
      ) as any;

      assertApiSuccess(response, 'Nao foi possivel enviar a notificacao.');
      return { success: true };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false };
    }
  },
};

export default notificationService;
