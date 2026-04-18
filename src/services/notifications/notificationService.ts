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

import type { Notification } from '@/types';
import { assertApiSuccess, readApiData } from '@/lib/browserApi';
import { requestAuthenticatedApi } from '@/lib/authSession';

const NOTIFICATION_ENDPOINTS = {
  clearAll: 'notificationsClearAll',
  list: 'notificationsList',
  markAllRead: 'notificationsMarkAllRead',
  markRead: 'notificationsMarkRead',
} as const;

type NotificationListPayload = {
  count?: number;
  data?: Notification[];
  items?: Notification[];
  notifications?: Notification[];
};

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

export const notificationService = {
  async clearAll(): Promise<void> {
    const response = await requestAuthenticatedApi<any>(
      NOTIFICATION_ENDPOINTS.clearAll,
      {
        includeCsrfToken: true,
        method: 'POST',
      },
    );

    assertApiSuccess(response, 'Nao foi possivel limpar as notificacoes.');
  },

  async getNotifications(): Promise<Notification[]> {
    const response = await requestAuthenticatedApi<any>(NOTIFICATION_ENDPOINTS.list, {
      method: 'GET',
    });

    return readNotifications(response);
  },

  async markAllAsRead(): Promise<void> {
    const response = await requestAuthenticatedApi<any>(
      NOTIFICATION_ENDPOINTS.markAllRead,
      {
        includeCsrfToken: true,
        method: 'POST',
      },
    );

    assertApiSuccess(response, 'Nao foi possivel marcar todas como lidas.');
  },

  async markAsRead(notificationId: string): Promise<void> {
    const response = await requestAuthenticatedApi<any>(
      NOTIFICATION_ENDPOINTS.markRead,
      {
        body: { notification_id: notificationId },
        includeCsrfToken: true,
        method: 'POST',
      },
    );

    assertApiSuccess(response, 'Nao foi possivel marcar a notificacao como lida.');
  },
};

export default notificationService;
