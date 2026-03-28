/**
 * useNotificationActions Hook
 * Provides notification-related actions with loading states
 */

import { useState, useCallback } from 'react';
import { useNotifications } from '../context/NotificationsContext';

export const useNotificationActions = () => {
    const { markAsRead, markAllAsRead, deleteNotification } = useNotifications();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Mark single notification as read
    const handleMarkAsRead = useCallback(async (notificationId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await markAsRead(notificationId);
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to mark as read';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [markAsRead]);

    // Mark all notifications as read
    const handleMarkAllAsRead = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            await markAllAsRead();
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to mark all as read';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [markAllAsRead]);

    // Delete notification
    const handleDeleteNotification = useCallback(async (notificationId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            await deleteNotification(notificationId);
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete notification';
            setError(errorMessage);
            return { success: false, error: errorMessage };
        } finally {
            setIsLoading(false);
        }
    }, [deleteNotification]);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    return {
        handleMarkAsRead,
        handleMarkAllAsRead,
        handleDeleteNotification,
        isLoading,
        error,
        clearError,
    };
};

export default useNotificationActions;
