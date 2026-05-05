export type NotificationEntityId = number | string | null;

export interface AppNotification {
  id: number | string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  type?: string | null;
  isRead?: boolean;
  readAt?: string | null;
  createdAt?: string | null;
  userId?: NotificationEntityId;
  user_id?: NotificationEntityId;
  recipientId?: NotificationEntityId;
  recipient_id?: NotificationEntityId;
  notifiableId?: NotificationEntityId;
  notifiable_id?: NotificationEntityId;
  targetUserId?: NotificationEntityId;
  target_user_id?: NotificationEntityId;
  user?: { id?: NotificationEntityId } | null;
  recipient?: { id?: NotificationEntityId } | null;
  notifiable?: { id?: NotificationEntityId } | null;
  [key: string]: unknown;
}