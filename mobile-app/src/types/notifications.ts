export type NotificationCategory =
  | "REWARDS" | "ORDERS" | "PAYMENTS" | "REFUNDS" | "COUPONS"
  | "ACCOUNT" | "SECURITY" | "PROMOTIONS" | "CAMPAIGNS" | "SYSTEM" | "DELIVERY";

export type AppNotification = {
  _id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  message: string;
  imageUrl?: string;
  action?: { label: string; route: string };
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
};

export type NotificationsPage = {
  notifications: AppNotification[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type NotificationPreferences = {
  orderUpdates: boolean;
  rewardUpdates: boolean;
  promotionalPush: boolean;
  promotionalEmail: boolean;
  promotionalInApp: boolean;
};
