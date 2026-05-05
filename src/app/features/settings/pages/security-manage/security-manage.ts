import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Tab } from '../../../../shared/components/ui/tab/tab';
import { TabsContainer } from '../../../../shared/components/ui/tab/tab-container/tab-container';
import { Column, Table } from '../../../../shared/components/ui/table/table';
import { SecurityService } from '../../../../core/services/security-service';
import { finalize } from 'rxjs';
import { Modal as UiModal } from '../../../../shared/components/ui/modal/modal';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe as I18nTranslatePipe, TranslateService } from '@ngx-translate/core';

interface BlockedUserRow {
    id: number;
    user: string;
    email: string;
    blockedAt: string;
    reason: string;
    attempts: number;
    actionLabel: string;
}

interface BlockedIpRow {
    ipAddress: string;
    blockedAt: string;
    reason: string;
    attempts: number;
    actionLabel: string;
}

@Component({
    selector: 'app-security-manage',
    templateUrl: './security-manage.html',
    imports: [LucideAngularModule, TabsContainer, Tab, Table, UiModal, I18nTranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecurityManage implements OnInit {
    private readonly _securityService = inject(SecurityService);
    private readonly _toastr = inject(ToastrService);
    private readonly _translateService = inject(TranslateService);

    readonly blockedUsers = signal<BlockedUserRow[]>([]);
    readonly blockedIps = signal<BlockedIpRow[]>([]);
    readonly isLoadingBlockedUsers = signal<boolean>(false);
    readonly isLoadingBlockedIps = signal<boolean>(false);
    readonly isUnlockingUser = signal<boolean>(false);
    readonly isUnlockingIp = signal<boolean>(false);

    readonly showUnlockUserModal = signal<boolean>(false);
    readonly showUnlockIpModal = signal<boolean>(false);
    readonly selectedBlockedUser = signal<BlockedUserRow | null>(null);
    readonly selectedBlockedIp = signal<BlockedIpRow | null>(null);

    readonly userColumns: Column<BlockedUserRow>[] = [
        { key: 'user', label: 'SECURITY_MANAGE.TABLE.USER', sortable: false },
        { key: 'email', label: 'SECURITY_MANAGE.TABLE.EMAIL', sortable: false },
        { key: 'blockedAt', label: 'SECURITY_MANAGE.TABLE.BLOCKED_AT', sortable: false },
        { key: 'reason', label: 'SECURITY_MANAGE.TABLE.REASON', sortable: false, customTemplate: true },
        { key: 'attempts', label: 'SECURITY_MANAGE.TABLE.ATTEMPTS', sortable: false },
        { key: 'actionLabel', label: 'SECURITY_MANAGE.TABLE.ACTIONS', sortable: false, customTemplate: true }
    ];

    readonly ipColumns: Column<BlockedIpRow>[] = [
        { key: 'ipAddress', label: 'SECURITY_MANAGE.TABLE.IP_ADDRESS', sortable: false },
        { key: 'blockedAt', label: 'SECURITY_MANAGE.TABLE.BLOCKED_AT', sortable: false },
        { key: 'reason', label: 'SECURITY_MANAGE.TABLE.REASON', sortable: false, customTemplate: true },
        { key: 'attempts', label: 'SECURITY_MANAGE.TABLE.ATTEMPTS', sortable: false },
        { key: 'actionLabel', label: 'SECURITY_MANAGE.TABLE.ACTIONS', sortable: false, customTemplate: true }
    ];

    ngOnInit(): void {
        this.loadBlockedUsers();
        this.loadBlockedIps();
    }

    loadBlockedUsers(): void {
        this.isLoadingBlockedUsers.set(true);

        this._securityService.getBlockedUsers().pipe(
            finalize(() => this.isLoadingBlockedUsers.set(false))
        ).subscribe({
            next: (response) => {
                const mappedRows: BlockedUserRow[] = (response?.data ?? []).map((item) => ({
                    id: item.id,
                    user: item.fullName,
                    email: item.email,
                    blockedAt: this.formatDate(item.blockedAt ?? item.security?.lastFailedAt),
                    reason: item.reason ?? this._translateService.instant('SECURITY_MANAGE.FALLBACK.USER_REASON'),
                    attempts: item.security?.failedAttempts ?? 0,
                    actionLabel: 'SECURITY_MANAGE.ACTIONS.UNBLOCK'
                }));

                this.blockedUsers.set(mappedRows);
            },
            error: (error) => {
                console.error('Error loading blocked users', error);
                this.blockedUsers.set([]);
            }
        });
    }

    loadBlockedIps(): void {
        this.isLoadingBlockedIps.set(true);

        this._securityService.getBlockedIps().pipe(
            finalize(() => this.isLoadingBlockedIps.set(false))
        ).subscribe({
            next: (response) => {
                const mappedRows: BlockedIpRow[] = (response?.data ?? []).map((item) => ({
                    ipAddress: item.ipAddress,
                    blockedAt: this.formatDate(item.blockedHistoryAt ?? item.blockedAt),
                    reason: item.reason ?? (item.isBlockedPermanently
                        ? this._translateService.instant('SECURITY_MANAGE.FALLBACK.PERMANENT_BLOCK')
                        : this._translateService.instant('SECURITY_MANAGE.FALLBACK.TEMPORARY_BLOCK')),
                    attempts: item.failedAttempts,
                    actionLabel: 'SECURITY_MANAGE.ACTIONS.UNBLOCK'
                }));

                this.blockedIps.set(mappedRows);
            },
            error: (error) => {
                console.error('Error loading blocked IPs', error);
                this.blockedIps.set([]);
            }
        });
    }

    private formatDate(value: string | null | undefined): string {
        if (!value) {
            return '-';
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return '-';
        }

        const date = parsed.toLocaleDateString('es-CO', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

        const time = parsed.toLocaleTimeString('es-CO', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        return `${date} ${time}`;
    }

    unblockUser(row: BlockedUserRow): void {
        this.selectedBlockedUser.set(row);
        this.showUnlockUserModal.set(true);
    }

    unblockIp(row: BlockedIpRow): void {
        this.selectedBlockedIp.set(row);
        this.showUnlockIpModal.set(true);
    }

    onUnlockUserModalChange(isOpen: boolean): void {
        this.showUnlockUserModal.set(isOpen);
        if (!isOpen) {
            this.selectedBlockedUser.set(null);
        }
    }

    onUnlockIpModalChange(isOpen: boolean): void {
        this.showUnlockIpModal.set(isOpen);
        if (!isOpen) {
            this.selectedBlockedIp.set(null);
        }
    }

    confirmUnlockUser(): void {
        const user = this.selectedBlockedUser();
        if (!user || this.isUnlockingUser()) {
            return;
        }

        this.isUnlockingUser.set(true);
        this._securityService.unlockBlockedUser(user.id).pipe(
            finalize(() => this.isUnlockingUser.set(false))
        ).subscribe({
            next: (response) => {
                this._toastr.success(
                    response.message ?? this._translateService.instant('SECURITY_MANAGE.TOAST.USER_UNLOCK_SUCCESS'),
                    this._translateService.instant('SECURITY_MANAGE.TOAST.SUCCESS')
                );
                this.onUnlockUserModalChange(false);
                this.loadBlockedUsers();
            },
            error: (error) => {
                this._toastr.error(
                    error?.error?.message ?? this._translateService.instant('SECURITY_MANAGE.TOAST.USER_UNLOCK_ERROR'),
                    this._translateService.instant('SECURITY_MANAGE.TOAST.ERROR')
                );
            }
        });
    }

    confirmUnlockIp(): void {
        const ip = this.selectedBlockedIp();
        if (!ip || this.isUnlockingIp()) {
            return;
        }

        this.isUnlockingIp.set(true);
        this._securityService.unlockBlockedIp(ip.ipAddress).pipe(
            finalize(() => this.isUnlockingIp.set(false))
        ).subscribe({
            next: (response) => {
                this._toastr.success(
                    response.message ?? this._translateService.instant('SECURITY_MANAGE.TOAST.IP_UNLOCK_SUCCESS'),
                    this._translateService.instant('SECURITY_MANAGE.TOAST.SUCCESS')
                );
                this.onUnlockIpModalChange(false);
                this.loadBlockedIps();
            },
            error: (error) => {
                this._toastr.error(
                    error?.error?.message ?? this._translateService.instant('SECURITY_MANAGE.TOAST.IP_UNLOCK_ERROR'),
                    this._translateService.instant('SECURITY_MANAGE.TOAST.ERROR')
                );
            }
        });
    }

}
