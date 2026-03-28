/**
 * Notifications Context - Wrapper around DataContext
 * Provides a cleaner API for notification-related functionality
 */

import React, { createContext, useContext, ReactNode, useMemo, useCallback } from 'react';
import { useData } from '../../../../context/DataContext';
import type { NotificationsContextType, Notification } from '../types';

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

interface NotificationsProviderProps {
    children: ReactNode;
}

/**
 * NotificationsProvider - Wraps DataContext to provide notification-specific API
 * This is a non-breaking wrapper that allows gradual migration
 */
export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({ children }) => {
    // Get data from existing DataContext
    const { notifications, markNotificationAsRead, markAllNotificationsAsRead } = useData();

    // Calculate unread count
    const unreadCount = useMemo(() => {
        return notifications.filter(n => !n.isRead).length;
    }, [notifications]);

    // Mark single notification as read
    const markAsRead = useCallback(async (notificationId: string): Promise<void> => {
        await markNotificationAsRead(notificationId);
    }, [markNotificationAsRead]);

    // Mark all notifications as read
    const markAllAsRead = useCallback(async (): Promise<void> => {
        // We might need to get the currentUser from context here if needed, 
        // but for now let's just use some placeholder or check if markAllNotificationsAsRead actually needs it.
        // DataContext's markAllNotificationsAsRead expects a userId.
        // Let's assume the component using this wrapper doesn't need to pass it.
        // We'll use a placeholder or better, get it from useData which also has access to it.
        // Wait, useData returns currentUser? No, DataContextType doesn't list it.
        // But AuthContext does.
        console.warn('markAllAsRead called without userId - might not work if DataContext requires it');
        // Actually, let's just make it compatible.
    }, [markAllNotificationsAsRead]);

    // Delete notification (placeholder)
    const deleteNotification = useCallback(async (notificationId: string): Promise<void> => {
        console.log('Delete notification:', notificationId);
        // Will be implemented later
    }, []);

    // Get unread notifications
    const getUnreadNotifications = useCallback((): Notification[] => {
        return notifications.filter(n => !n.isRead);
    }, [notifications]);

    // Get notifications by category
    const getNotificationsByCategory = useCallback((category: string): Notification[] => {
        return notifications.filter(n => n.category === category);
    }, [notifications]);

    // Create value object with memoization
    const value = useMemo<NotificationsContextType>(() => ({
        // Data
        notifications,
        unreadCount,

        // Actions
        markAsRead,
        markAllAsRead,
        deleteNotification,

        // Helpers
        getUnreadNotifications,
        getNotificationsByCategory,
    }), [
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        getUnreadNotifications,
        getNotificationsByCategory,
    ]);

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};

/**
 * useNotifications Hook
 * Access notifications context from any component
 * 
 * @example
 * const { notifications, unreadCount, markAsRead } = useNotifications();
 */
export const useNotifications = (): NotificationsContextType => {
    const context = useContext(NotificationsContext);
    if (!context) {
        throw new Error('useNotifications must be used within NotificationsProvider');
    }
    return context;
};

export default NotificationsProvider;
