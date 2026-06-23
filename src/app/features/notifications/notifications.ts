import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../core/services/notification-service';
import { ToastService } from '../../core/services/toast-service';
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
    private readonly toastService = inject(ToastService);
    private readonly translateService = inject(TranslateService);

    readonly notifications = this.notificationService.notifications;
    readonly unreadNotifications = this.notificationService.unreadNotifications;
    readonly unreadCount = this.notificationService.unreadCount;
    readonly lastError = this.notificationService.lastError;
    readonly isNavigatingToApprovals = signal(false);
    readonly isLoadingReadAll = signal(false);
    readonly isLoadingUnreadAll = signal(false);
    readonly loadingNotificationIds = signal<Set<string>>(new Set());

    ngOnInit(): void {
        this.refresh();
    }

    refresh(): void {
        this.notificationService.refreshAllNotifications().subscribe({
            error: (error) => console.error('[Notifications Component] Failed to refresh notifications:', error)
        });
    }

    markAllAsRead(): void {
        if (this.isLoadingReadAll()) return;
        this.isLoadingReadAll.set(true);
        this.notificationService.markAllAsRead().subscribe({
            next: (message) => {
                this.isLoadingReadAll.set(false);
                this.toastService.success(message ?? this.translateService.instant('NOTIFICATIONS.MARK_ALL_READ'));
            },
            error: (error) => {
                this.isLoadingReadAll.set(false);
                this.toastService.error(this.extractErrorMessage(error));
                console.error('[Notifications Component] Failed to mark all as read:', error);
            }
        });
    }

    markAllAsUnread(): void {
        if (this.isLoadingUnreadAll()) return;
        this.isLoadingUnreadAll.set(true);
        this.notificationService.markAllAsUnread().subscribe({
            next: (message) => {
                this.isLoadingUnreadAll.set(false);
                this.toastService.success(message ?? this.translateService.instant('NOTIFICATIONS.MARK_ALL_UNREAD'));
            },
            error: (error) => {
                this.isLoadingUnreadAll.set(false);
                this.toastService.error(this.extractErrorMessage(error));
                console.error('[Notifications Component] Failed to mark all as unread:', error);
            }
        });
    }

    private extractErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        const obj = error as Record<string, unknown>;
        return String(obj?.['message'] ?? obj?.['error'] ?? 'Error');
    }

    isMarkingAsRead(notification: AppNotification): boolean {
        return this.loadingNotificationIds().has(String(notification.id));
    }

    markAsRead(notification: AppNotification, event?: Event): void {
        event?.stopPropagation();

        if (this.notificationService.isRead(notification) || this.isMarkingAsRead(notification)) {
            return;
        }

        const id = String(notification.id);
        this.loadingNotificationIds.update((s) => new Set(s).add(id));

        this.notificationService.markAsRead(notification.id).subscribe({
            next: () => this.loadingNotificationIds.update((s) => { const n = new Set(s); n.delete(id); return n; }),
            error: (error) => {
                this.loadingNotificationIds.update((s) => { const n = new Set(s); n.delete(id); return n; });
                console.error('[Notifications Component] Failed to mark notification as read:', error);
            }
        });
    }

    openNotification(notification: AppNotification): void {
        const isAssignedRequestBulk = isAssignedRequestBulkNotification(notification);
        const isAssignedRequest = isAssignedRequestNotification(notification);
        const isBulkNotification = isBulkUploadNotification(notification);
        const requestNumber = extractRequestNumberFromNotification(notification);

        let routePath: string[];

        if (isAssignedRequest || isAssignedRequestBulk) {
            routePath = ['/app/my-approvals'];
        } else if (isBulkNotification) {
            routePath = ['/app/request/bulk-upload'];
        } else {
            routePath = ['/app/notifications'];
        }

        let queryParams: Record<string, string> | Record<string, string | number> | undefined;

        if (isAssignedRequest && requestNumber) {
            queryParams = { requestNumber };
        } else if (isBulkNotification && !isAssignedRequestBulk) {
            queryParams = this.buildBulkHistoryQuery(notification);
        } else {
            queryParams = undefined;
        }

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
