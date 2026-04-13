import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../core/services/notification-service';
import { AppNotification } from '../../data/interfaces/Notification';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
    extractRequestNumberFromNotification,
    isAssignedRequestBulkNotification,
    isAssignedRequestNotification,
    isBulkUploadNotification,
} from '../../shared/utils/notification-navigation';
import { FullSpinnerComponent } from '../../shared/components/ui/full-spinner/full-spinner';

@Component({
    selector: 'app-notifications',
    templateUrl: './notifications.html',
    styleUrl: './notifications.css',
    imports: [TranslatePipe, LucideAngularModule, FullSpinnerComponent],
})
export class Notifications implements OnInit {
    private readonly router = inject(Router);
    private readonly notificationService = inject(NotificationService);
    private readonly translateService = inject(TranslateService);

    readonly notifications = this.notificationService.notifications;
    readonly unreadNotifications = this.notificationService.unreadNotifications;
    readonly unreadCount = this.notificationService.unreadCount;
    readonly lastError = this.notificationService.lastError;
    readonly isNavigatingToApprovals = signal(false);

    ngOnInit(): void {
        this.refresh();
    }

    refresh(): void {
        this.notificationService.refreshAllNotifications().subscribe({
            error: (error) => console.error('[Notifications Component] Failed to refresh notifications:', error)
        });
    }

    markAsRead(notification: AppNotification, event?: Event): void {
        event?.stopPropagation();

        if (this.notificationService.isRead(notification)) {
            return;
        }

        this.notificationService.markAsRead(notification.id).subscribe({
            error: (error) => console.error('[Notifications Component] Failed to mark notification as read:', error)
        });
    }

    openNotification(notification: AppNotification): void {
        const isAssignedRequestBulk = isAssignedRequestBulkNotification(notification);
        const isAssignedRequest = isAssignedRequestNotification(notification);
        const isBulkNotification = isBulkUploadNotification(notification);
        const requestNumber = extractRequestNumberFromNotification(notification);

        const routePath = isAssignedRequest || isAssignedRequestBulk
            ? ['/app/my-approvals']
            : isBulkNotification
                ? ['/app/request/bulk-upload']
                : ['/app/notifications'];

        const queryParams = isAssignedRequest && requestNumber
            ? { requestNumber }
            : isBulkNotification && !isAssignedRequestBulk
                ? this.buildBulkHistoryQuery(notification)
                : undefined;

        // Show spinner when navigating to approvals
        if (isAssignedRequest || isAssignedRequestBulk) {
            this.isNavigatingToApprovals.set(true);
        }

        this.router.navigate(routePath, { queryParams }).then(() => {
            // Hide spinner after navigation completes
            this.isNavigatingToApprovals.set(false);
        }).catch((error) => {
            console.error('[Notifications Component] Notification navigation failed:', error);
            this.isNavigatingToApprovals.set(false);
        });
    }

    onCardKeydown(event: KeyboardEvent, notification: AppNotification): void {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }

        event.preventDefault();
        this.openNotification(notification);
    }

    trackByNotificationId(_: number, notification: AppNotification): string {
        return String(notification.id);
    }

    formatNotificationDate(value?: string | null): string {
        if (!value) {
            return this.translateService.instant('NOTIFICATIONS.RECENT');
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        const locale = this.translateService.currentLang?.toLowerCase().startsWith('en') ? 'en' : 'es';

        return new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(date);
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
