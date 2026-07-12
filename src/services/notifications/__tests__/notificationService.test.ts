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

type MockApiResponse = {
  data?: unknown;
  success?: boolean;
  message?: string;
} | null | undefined;

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  assertApiSuccess: (response: MockApiResponse) => {
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
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) {
      return response.data;
    }

    return response ?? fallback;
  },
  ENDPOINTS: {
    notifications: {
      list: 'notifications/list.php',
      markRead: 'notifications/mark_read.php',
      markAllRead: 'notifications/mark_all_read.php',
      delete: 'notifications/delete.php',
      clearAll: 'notifications/clear_all.php',
      restore: 'notifications/restore.php',
      permanentDelete: 'notifications/permanent-delete.php',
      send: 'notifications/send.php',
    },
  },
}));

vi.mock('@services/auth/session', () => ({
  getAccessToken: () => 'valid-token',
  isAccessTokenExpired: () => false,
}));

import { notificationService } from '../index';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppConfigStore.getState().resetAppConfig();
  });

  it('normalizes notification lists from the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [{ id: 'n1', title: 'Nova' }],
      },
    });

    const result = await notificationService.getNotifications();

    expect(mockGet).toHaveBeenCalledWith('notifications/list.php', {
      params: { limit: 10 },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('n1');
  });

  it('marks a notification as read through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.markAsRead('n2');

    expect(mockPost).toHaveBeenCalledWith('notifications/mark_read.php', {
      notification_id: 'n2',
    });
    expect(result.success).toBe(true);
  });

  it('marks all notifications as read through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.markAllAsRead();

    expect(mockPost).toHaveBeenCalledWith('notifications/mark_all_read.php');
    expect(result.success).toBe(true);
  });

  it('clears all notifications through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.clearAll();

    expect(mockPost).toHaveBeenCalledWith('notifications/clear_all.php');
    expect(result.success).toBe(true);
  });

  it('moves a notification to trash through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.deleteNotification('n3');

    expect(mockPost).toHaveBeenCalledWith('notifications/delete.php', {
      notification_id: 'n3',
    });
    expect(result.success).toBe(true);
  });

  it('restores a trashed notification through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.restoreNotification('n4');

    expect(mockPost).toHaveBeenCalledWith('notifications/restore.php', {
      notification_id: 'n4',
    });
    expect(result.success).toBe(true);
  });

  it('permanently deletes a notification through the official mutation', async () => {
    mockPost.mockResolvedValueOnce({ success: true });

    const result = await notificationService.permanentDeleteNotification('n5');

    expect(mockPost).toHaveBeenCalledWith('notifications/permanent-delete.php', {
      notification_id: 'n5',
    });
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

    expect(mockPost).toHaveBeenCalledWith('notifications/send.php', {
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

  it('does not send notifications disabled by admin settings', async () => {
    useAppConfigStore.getState().mergeSystemSettings({
      notificationSettings: {
        enabled: true,
        rules: [
          {
            key: 'xp_bonus',
            category: 'Gamificacao',
            label: 'Bonus de XP',
            trigger: 'Quando um marco de XP e desbloqueado.',
            title: 'Bonus de XP desbloqueado',
            message: 'Mensagem dinamica com o marco e a quantidade de XP.',
            type: 'success',
            enabled: false,
          },
        ],
      },
    });

    const result = await notificationService.sendNotification(
      'user-1',
      'XP',
      'Mensagem',
      'success',
      'system',
      '/levels',
      undefined,
      'xp_bonus',
    );

    expect(result.success).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });
});
