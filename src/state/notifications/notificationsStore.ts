'use client';

import { create } from 'zustand';
import type { Notification } from '@types';

interface NotificationsState {
  loadedUserId: string | null;
  notifications: Notification[];
  isNotificationsLoaded: boolean;
  replaceNotifications: (userId: string, notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  softDeleteNotification: (id: string, deletedAt?: number) => void;
  restoreNotification: (id: string) => void;
  permanentDeleteNotification: (id: string) => void;
  clearNotifications: (deletedAt?: number) => void;
  cleanupDeletedNotifications: (retentionPeriodMs: number, now?: number) => void;
  resetNotifications: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  loadedUserId: null,
  notifications: [],
  isNotificationsLoaded: false,
  replaceNotifications: (userId, notifications) => set({
    loadedUserId: userId,
    notifications,
    isNotificationsLoaded: true,
  }),
  addNotification: (notification) => set((state) => ({
    notifications: [notification, ...state.notifications],
  })),
  markNotificationAsRead: (id) => set((state) => ({
    notifications: state.notifications.map((notification) => (
      notification.id === id ? { ...notification, isRead: true } : notification
    )),
  })),
  markAllNotificationsAsRead: () => set((state) => ({
    notifications: state.notifications.map((notification) => ({ ...notification, isRead: true })),
  })),
  softDeleteNotification: (id, deletedAt = Date.now()) => set((state) => ({
    notifications: state.notifications.map((notification) => (
      notification.id === id ? { ...notification, deletedAt } : notification
    )),
  })),
  restoreNotification: (id) => set((state) => ({
    notifications: state.notifications.map((notification) => (
      notification.id === id ? { ...notification, deletedAt: undefined } : notification
    )),
  })),
  permanentDeleteNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((notification) => notification.id !== id),
  })),
  clearNotifications: (deletedAt = Date.now()) => set((state) => ({
    notifications: state.notifications.map((notification) => (
      notification.deletedAt ? notification : { ...notification, deletedAt }
    )),
  })),
  cleanupDeletedNotifications: (retentionPeriodMs, now = Date.now()) => set((state) => ({
    notifications: state.notifications.filter((notification) => (
      !notification.deletedAt || now - notification.deletedAt <= retentionPeriodMs
    )),
  })),
  resetNotifications: () => set({
    loadedUserId: null,
    notifications: [],
    isNotificationsLoaded: false,
  }),
}));

export default useNotificationsStore;
