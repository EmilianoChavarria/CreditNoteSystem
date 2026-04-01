import { Component, OnInit, inject } from '@angular/core';
import { NotificationService } from '../../core/services/notification-service';
import { AppNotification } from '../../data/interfaces/Notification';

@Component({
    selector: 'app-notifications',
    templateUrl: './notifications.html',
    styleUrl: './notifications.css',
})
export class Notifications implements OnInit {
    private readonly notificationService = inject(NotificationService);

    readonly notifications = this.notificationService.notifications;
    readonly unreadNotifications = this.notificationService.unreadNotifications;
    readonly unreadCount = this.notificationService.unreadCount;
    readonly lastError = this.notificationService.lastError;

    ngOnInit(): void {
        this.refresh();
    }

    refresh(): void {
        this.notificationService.refreshAllNotifications().subscribe({
            error: (error) => console.error('[Notifications Component] Failed to refresh notifications:', error)
        });
    }

    markAsRead(notification: AppNotification): void {
        if (this.notificationService.isRead(notification)) {
            return;
        }

        this.notificationService.markAsRead(notification.id).subscribe({
            error: (error) => console.error('[Notifications Component] Failed to mark notification as read:', error)
        });
    }

    trackByNotificationId(_: number, notification: AppNotification): string {
        return String(notification.id);
    }

    formatNotificationDate(value?: string | null): string {
        if (!value) {
            return 'Reciente';
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return new Intl.DateTimeFormat('es', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
    }

}
