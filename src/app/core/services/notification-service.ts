import { computed, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { AppNotification } from '../../data/interfaces/Notification';
import { AuthService } from './auth-service';
import { HttpService } from './http-service';
import { IncomingSocketMessage, ReverbSocketService } from './reverb-socket-service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly allNotificationsEndpoint = '/notifications';
  private readonly unreadNotificationsEndpoint = '/notifications/unread';
  private currentUserId: number | null = null;

  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadNotifications = computed(() => {
    return this.notifications().filter((notification) => !this.isRead(notification));
  });
  readonly unreadCount = computed(() => this.unreadNotifications().length);
  readonly lastError = signal<string | null>(null);

  constructor(
    private readonly httpService: HttpService,
    private readonly socketService: ReverbSocketService,
    private readonly authService: AuthService,
  ) {
    this.authService.user$.subscribe((user) => {
      if (!user) {
        this.resetState();
        return;
      }

      if (this.currentUserId === user.id) {
        return;
      }

      this.currentUserId = user.id;
      this.socketService.connectToGlobalNotifications();
      this.refreshUnreadNotifications().subscribe({
        error: (error) => {
          console.error('[NotificationService] Failed to load unread notifications:', error);
        }
      });
    });

    this.socketService.notificationCreated$.subscribe((payload) => {
      this.handleIncomingSocketNotification(payload);
    });

    this.socketService.messages$.subscribe((payload) => {
      // Some backends broadcast everything via socket.message.sent with an inner event field.
      if (String(payload['event'] ?? '') !== 'notification.created') {
        return;
      }

      this.handleIncomingSocketNotification(payload);
    });
  }

  refreshUnreadNotifications(): Observable<AppNotification[]> {
    return this.loadNotifications(this.unreadNotificationsEndpoint);
  }

  refreshAllNotifications(): Observable<AppNotification[]> {
    return this.loadNotifications(this.allNotificationsEndpoint);
  }

  markAsRead(notificationId: number | string): Observable<AppNotification | null> {
    return this.httpService.patch<AppNotification | null>(`/notifications/${notificationId}/read`, {}).pipe(
      tap((response) => {
        const updatedNotification = response.data ? this.normalizeNotification(response.data) : null;

        if (updatedNotification) {
          this.upsertNotifications([updatedNotification]);
        } else {
          this.markAsReadLocally(notificationId);
        }

        this.lastError.set(null);
      }),
      map((response) => response.data ?? null),
      catchError((error) => {
        this.lastError.set(this.toErrorMessage(error));
        return throwError(() => error);
      })
    );
  }

  isRead(notification: AppNotification): boolean {
    if (typeof notification.isRead === 'boolean') {
      return notification.isRead;
    }

    const readAt = this.pickString(notification.readAt, notification['read_at']);
    return Boolean(readAt);
  }

  private loadNotifications(endpoint: string): Observable<AppNotification[]> {
    return this.httpService.get<AppNotification[]>(endpoint, { timeoutMs: 30000 }).pipe(
      tap(() => {
        this.lastError.set(null);
      }),
      map((response: ApiResponse<AppNotification[]>) => this.extractNotifications(response)),
      tap((notifications) => {
        this.upsertNotifications(notifications);
      }),
      catchError((error) => {
        this.lastError.set(this.toErrorMessage(error));
        return throwError(() => error);
      })
    );
  }

  private extractNotifications(response: ApiResponse<AppNotification[]>): AppNotification[] {
    if (!Array.isArray(response.data)) {
      return [];
    }

    return response.data
      .map((notification) => this.normalizeNotification(notification))
      .filter((notification): notification is AppNotification => notification !== null);
  }

  private normalizeNotification(notification: Partial<AppNotification> & Record<string, unknown>): AppNotification | null {
    const id = this.pickValue(
      notification.id,
      notification['notificationId'],
      notification['notification_id'],
      notification['uuid'],
      notification['id']
    );

    if (id === null || id === undefined || id === '') {
      return null;
    }

    const title = this.pickString(
      notification.title,
      notification['subject'],
      notification.type,
      notification['title'],
      notification['subject']
    ) ?? 'Notificación';

    const message = this.pickString(
      notification.message,
      notification.body,
      notification['content'],
      notification['description'],
      notification['message'],
      notification['body']
    ) ?? '';

    const createdAt = this.pickString(
      notification.createdAt,
      notification['created_at'],
      notification['createdAt'],
      notification['created_at']
    );

    const readAt = this.pickString(notification.readAt, notification['read_at'], notification['readAt'], notification['read_at']);

    return {
      ...notification,
      id,
      title,
      message,
      createdAt,
      readAt,
      isRead: typeof notification.isRead === 'boolean' ? notification.isRead : Boolean(readAt),
    };
  }

  private handleIncomingSocketNotification(payload: IncomingSocketMessage): void {
    const recordPayload = payload as Record<string, unknown>;
    const nestedNotification = this.pickSocketNotificationRecord(recordPayload);
    const notification = this.normalizeNotification(nestedNotification ?? recordPayload);

    if (!notification || !this.shouldAcceptNotification(notification)) {
      return;
    }

    this.upsertNotifications([notification]);
  }

  private pickSocketNotificationRecord(payload: Record<string, unknown>): Record<string, unknown> | null {
    const notificationValue = payload['notification'];
    if (notificationValue && typeof notificationValue === 'object') {
      return notificationValue as Record<string, unknown>;
    }

    const dataValue = payload['data'];
    if (dataValue && typeof dataValue === 'object') {
      const asRecord = dataValue as Record<string, unknown>;
      const nested = asRecord['notification'];

      if (nested && typeof nested === 'object') {
        return nested as Record<string, unknown>;
      }

      return asRecord;
    }

    return null;
  }

  private upsertNotifications(incomingNotifications: AppNotification[]): void {
    if (incomingNotifications.length === 0) {
      return;
    }

    const merged = new Map<string, AppNotification>();

    [...this.notifications(), ...incomingNotifications].forEach((notification) => {
      merged.set(String(notification.id), notification);
    });

    const nextNotifications = Array.from(merged.values()).sort((left, right) => {
      const leftDate = this.toTimestamp(left.createdAt);
      const rightDate = this.toTimestamp(right.createdAt);

      if (leftDate !== rightDate) {
        return rightDate - leftDate;
      }

      return String(right.id).localeCompare(String(left.id));
    });

    this.notifications.set(nextNotifications);
  }

  private markAsReadLocally(notificationId: number | string): void {
    this.notifications.update((currentNotifications) => {
      return currentNotifications.map((notification) => {
        if (String(notification.id) !== String(notificationId)) {
          return notification;
        }

        const now = new Date().toISOString();
        return {
          ...notification,
          isRead: true,
          readAt: notification.readAt ?? now,
        };
      });
    });
  }

  private shouldAcceptNotification(notification: AppNotification): boolean {
    if (this.currentUserId === null) {
      return false;
    }

    const candidateUserIds = [
      notification.userId,
      notification.user_id,
      notification.recipientId,
      notification.recipient_id,
      notification.notifiableId,
      notification.notifiable_id,
      notification.targetUserId,
      notification.target_user_id,
      this.extractNestedId(notification.user),
      this.extractNestedId(notification.recipient),
      this.extractNestedId(notification.notifiable),
    ]
      .map((value) => this.toNumber(value))
      .filter((value): value is number => value !== null);

    if (candidateUserIds.length === 0) {
      return true;
    }

    return candidateUserIds.includes(this.currentUserId);
  }

  private extractNestedId(value: { id?: number | string | null } | null | undefined): number | string | null {
    return value?.id ?? null;
  }

  private resetState(): void {
    this.currentUserId = null;
    this.notifications.set([]);
    this.lastError.set(null);
    this.socketService.disconnect();
  }

  private pickString(...values: unknown[]): string | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }

    return null;
  }

  private pickValue(...values: unknown[]): string | number | null {
    for (const value of values) {
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }

      if (typeof value === 'number' && !Number.isNaN(value)) {
        return value;
      }
    }

    return null;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsedValue = Number(value);
      return Number.isNaN(parsedValue) ? null : parsedValue;
    }

    return null;
  }

  private toTimestamp(value: string | null | undefined): number {
    if (!value) {
      return 0;
    }

    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    return 'No se pudieron cargar las notificaciones';
  }
}