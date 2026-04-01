export interface AppNotification {
  id: number | string;
  title?: string | null;
  message?: string | null;
  body?: string | null;
  type?: string | null;
  isRead?: boolean;
  readAt?: string | null;
  createdAt?: string | null;
  userId?: number | string | null;
  user_id?: number | string | null;
  recipientId?: number | string | null;
  recipient_id?: number | string | null;
  notifiableId?: number | string | null;
  notifiable_id?: number | string | null;
  targetUserId?: number | string | null;
  target_user_id?: number | string | null;
  user?: { id?: number | string | null } | null;
  recipient?: { id?: number | string | null } | null;
  notifiable?: { id?: number | string | null } | null;
  [key: string]: unknown;
}