/**
 * Notification Service
 * Handles all notification-related operations with helper methods
 */

import { apiClient, ENDPOINTS } from '@core/api';
import type { ApiResponse } from '@core/api/types';
import type { Notification } from 'types';

export const notificationService = {
    /**
     * Get all notifications for current user
     */
    async getNotifications(): Promise<Notification[]> {
        try {
            const response = await apiClient.get(
                ENDPOINTS.notifications.list
            ) as any;
            // apiClient interceptor já unwrappa response.data, então response = {success, data, count}
            return response.data || [];
        } catch (error) {
            console.error('Error fetching notifications:', error);
            return [];
        }
    },

    /**
     * Get notifications for specific user (admin/system use)
     */
    async getUserNotifications(userId: string): Promise<Notification[]> {
        try {
            const response = await apiClient.get(
                ENDPOINTS.notifications.list,
                { params: { user_id: userId } }
            ) as any;
            // apiClient interceptor já unwrappa response.data, então response = {success, data, count}
            return response.data || [];
        } catch (error) {
            console.error('Error fetching user notifications:', error);
            return [];
        }
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string): Promise<{ success: boolean }> {
        const response = await apiClient.post<ApiResponse>(
            ENDPOINTS.notifications.markRead,
            { notification_id: notificationId }
        ) as any;
        return { success: response.success };
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(): Promise<{ success: boolean }> {
        const response = await apiClient.post<ApiResponse>(
            ENDPOINTS.notifications.markAllRead
        ) as any;
        return { success: response.success };
    },

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId: string): Promise<{ success: boolean }> {
        const response = await apiClient.post<ApiResponse>(
            ENDPOINTS.notifications.delete,
            { notification_id: notificationId }
        ) as any;
        return { success: response.success };
    },

    /**
     * Clear all notifications
     */
    async clearAll(): Promise<{ success: boolean }> {
        const response = await apiClient.post<ApiResponse>(
            ENDPOINTS.notifications.clearAll
        ) as any;
        return { success: response.success };
    },

    /**
     * Send notification (admin/system use)
     */
    async sendNotification(
        userId: string,
        title: string,
        message: string,
        type: 'success' | 'error' | 'info' | 'warning' = 'info',
        category: 'system' | 'social' | 'marketplace' | 'moderation' = 'system',
        actionUrl?: string,
        evidenceUrl?: string
    ): Promise<{ success: boolean }> {
        try {
            const response = await apiClient.post<ApiResponse>(
                ENDPOINTS.notifications.send, // Admin endpoint
                {
                    user_id: userId,
                    title,
                    message,
                    type,
                    category,
                    action_url: actionUrl,
                    evidence_url: evidenceUrl,
                }
            ) as any;
            return { success: response.success };
        } catch (error) {
            console.error('Error sending notification:', error);
            return { success: false };
        }
    },
};

export default notificationService;
