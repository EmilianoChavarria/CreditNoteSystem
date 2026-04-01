import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../core/services/notification-service';
import { AppNotification } from '../../data/interfaces/Notification';

@Component({
    selector: 'app-notifications',
    templateUrl: './notifications.html',
    styleUrl: './notifications.css',
})
export class Notifications implements OnInit {
    private readonly router = inject(Router);
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

    openNotification(notification: AppNotification): void {
        const isBulkNotification = this.isBulkUploadNotification(notification);
        const routePath = isBulkNotification ? ['/app/request/bulk-upload'] : ['/app/notifications'];
        const queryParams = isBulkNotification ? this.buildBulkHistoryQuery(notification) : undefined;

        this.router.navigate(routePath, { queryParams }).catch((error) => {
            console.error('[Notifications Component] Notification navigation failed:', error);
        });

        if (!this.notificationService.isRead(notification)) {
            this.markAsRead(notification);
        }
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

    private isBulkUploadNotification(notification: AppNotification): boolean {
        const raw = notification as Record<string, unknown>;
        const composedText = [
            String(notification.type ?? ''),
            String(notification.title ?? ''),
            String(notification.message ?? ''),
            String(raw['event'] ?? ''),
            String(raw['category'] ?? ''),
        ].join(' ').toLowerCase();

        return composedText.includes('batch') || composedText.includes('bulk');
    }

    private buildBulkHistoryQuery(notification: AppNotification): Record<string, string | number> {
        const raw = notification as Record<string, unknown>;
        const data = (raw['data'] ?? null) as Record<string, unknown> | null;
        const batch = (raw['batch'] ?? null) as Record<string, unknown> | null;
        const batchId = raw['batchId']
            ?? raw['batch_id']
            ?? data?.['batchId']
            ?? data?.['batch_id']
            ?? batch?.['id'];

        if (batchId === undefined || batchId === null || String(batchId).length === 0) {
            return { tab: 'bulk-history' };
        }

        return {
            tab: 'bulk-history',
            batchId: String(batchId),
        };
    }

}
