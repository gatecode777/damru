import { get, patch } from "@/lib/api";
import type { NotificationsPage, NotificationPreferences } from "@/types/notifications";

export const getNotifications = (page = 1, limit = 20) =>
  get<NotificationsPage>(`/api/notifications?page=${page}&limit=${limit}`);

export const getUnreadCount = () => get<{ count: number }>("/api/notifications/unread-count");

export const markNotificationRead = (id: string) => patch<{ success: boolean }>(`/api/notifications/${id}/read`);

export const markAllNotificationsRead = () => patch<{ success: boolean; count: number }>("/api/notifications/read-all");

export const getNotificationPreferences = () => get<{ preferences: NotificationPreferences }>("/api/user/notification-preferences");

export const updateNotificationPreferences = (patch_: Partial<NotificationPreferences>) =>
  patch<{ success: boolean; preferences: NotificationPreferences }>("/api/user/notification-preferences", patch_);
