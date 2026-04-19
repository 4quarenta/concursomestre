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

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  assertApiSuccess: (response: any) => {
    if (!response?.success) {
      throw new Error(response?.message || 'erro');
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
  readApiData: (response: any, fallback: any) => {
    if (response?.data !== undefined) {
      return response.data;
    }

    return response ?? fallback;
  },
  ENDPOINTS: {
    notifications: {
      list: 'notificationsList',
      markRead: 'notificationsMarkRead',
      markAllRead: 'notificationsMarkAllRead',
      delete: 'notificationsDelete',
      clearAll: 'notificationsClearAll',
      send: 'notificationsSend',
    },
  },
}));

import { notificationService } from '../index';

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes notification lists from the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [{ id: 'n1', title: 'Nova' }],
      },
    });

    const result = await notificationService.getNotifications();

    expect(mockGet).toHaveBeenCalledWith('notificationsList');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
  });

  it('marks a notification as read through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.markAsRead('n2');

    expect(mockPost).toHaveBeenCalledWith('notificationsMarkRead', {
      notification_id: 'n2',
    });
    expect(result.success).toBe(true);
  });

  it('marks all notifications as read through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.markAllAsRead();

    expect(mockPost).toHaveBeenCalledWith('notificationsMarkAllRead');
    expect(result.success).toBe(true);
  });

  it('clears all notifications through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.clearAll();

    expect(mockPost).toHaveBeenCalledWith('notificationsClearAll');
    expect(result.success).toBe(true);
  });

  it('sends system notifications through the admin endpoint', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.sendNotification(
      'user-1',
      'Título',
      'Mensagem',
      'info',
      'system',
      '/destino',
      'https://evidência.local',
    );

    expect(mockPost).toHaveBeenCalledWith('notificationsSend', {
      user_id: 'user-1',
      title: 'Título',
      message: 'Mensagem',
      type: 'info',
      category: 'system',
      action_url: '/destino',
      evidence_url: 'https://evidência.local',
    });
    expect(result.success).toBe(true);
  });
});
