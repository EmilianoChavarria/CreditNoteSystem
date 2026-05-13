import { Component, computed, inject, signal, ChangeDetectorRef } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { getPermissionSlugsForCustomAction } from '../../../core/constants/action-permission-map';
import { TranslatePipe } from '@ngx-translate/core';
import { AccionPersonalizada, Column, Table } from '../../../shared/components/ui/table/table';
import { Request, RequestType } from '../../../data/interfaces/Request';
import { WorkflowHistoryDrawer } from '../../history/components/workflow-history-drawer/workflow-history-drawer';
import { ToastService } from '../../../core/services/toast-service';
import moment from 'moment';
import { Modal } from '../../../shared/components/ui/modal/modal';
import { Badge } from '../../../shared/components/ui/badge/badge';
import { UpperCasePipe } from '@angular/common';
import { Spinner } from '../../../shared/components/ui/spinner/spinner';
import { RoleService } from '../../../core/services/role-service';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { normalizeRequestNumber } from '../../../shared/utils/notification-navigation';
import { FullSpinnerComponent } from '../../../shared/components/ui/full-spinner/full-spinner';
import { RequestListBase } from '../../../shared/base/request-list.base';
import { RequestInfoModal } from '../../pending/components/request-info-modal/request-info-modal';
import { ApproveConfirmModal } from './components/approve-confirm-modal/approve-confirm-modal';
import { SendBackModal } from './components/send-back-modal/send-back-modal';

@Component({
    selector: 'app-my-approvals',
    imports: [TranslatePipe, WorkflowHistoryDrawer, Modal, Table, Badge, UpperCasePipe, Spinner, ReactiveFormsModule, FullSpinnerComponent, RequestInfoModal, ApproveConfirmModal, SendBackModal],
    templateUrl: './my-approvals.html',
    styleUrl: './my-approvals.css',
})
export class MyApprovals extends RequestListBase {
    private readonly roleService = inject(RoleService);
    private readonly _toastService = inject(ToastService);
    private readonly route = inject(ActivatedRoute);
    private readonly cdr = inject(ChangeDetectorRef);

    public selectedRequestIds = signal<Set<number>>(new Set<number>());
    public selectedCount = computed(() => this.selectedRequestIds().size);
    public currentPageRequestIds = computed(() =>
        this.requests().map((r) => Number(r.id)).filter((id) => Number.isFinite(id) && id > 0)
    );
    public allVisibleSelected = computed(() => {
        const pageIds = this.currentPageRequestIds();
        if (!pageIds.length) return false;
        const selectedIds = this.selectedRequestIds();
        return pageIds.every((id) => selectedIds.has(id));
    });

    public showApproveModal = signal<boolean>(false);
    public requestToApprove = signal<Request | null>(null);
    public showBulkApproveModal = signal<boolean>(false);
    public showBulkDeclineModal = signal<boolean>(false);
    public isBulkProcessing = signal<boolean>(false);
    public isInitializingDeepLink = signal<boolean>(false);
    public showCancelModal = signal<boolean>(false);
    public cancelComments = new FormControl<string>('');
    public showSendBackModal = signal<boolean>(false);

    private pendingShortcutRequestNumber: string | null = null;
    private appliedShortcutRequestNumber: string | null = null;

    public columns: Column<Request>[] = [
        { key: 'bulkSelect', label: 'MY_APPROVALS.SELECT', sortable: false, customTemplate: true },
        { key: 'requestNumber', label: 'MY_APPROVALS.REQUEST_NUMBER', sortable: true },
        { key: 'requestType.name', label: 'MY_APPROVALS.REQUEST_TYPE', sortable: true, customTemplate: true },
        { key: 'classification.name', label: 'MY_APPROVALS.CLASSIFICATION', sortable: true },
        { key: 'username', label: 'Assigned User', sortable: true, customTemplate: true },
        { key: 'status', label: 'MY_APPROVALS.STATUS', sortable: true, customTemplate: true },
        {
            key: 'createdAt', label: 'MY_APPROVALS.CREATED_AT', sortable: true,
            render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
        }
    ];

    private readonly baseAcciones: AccionPersonalizada<Request>[] = [
        { key: 'approve', icon: 'check', label: 'MY_APPROVALS.APPROVE', accion: (request) => this.openApproveModal(request) },
        { key: 'decline', icon: 'x', label: 'MY_APPROVALS.DECLINE', accion: (request) => this.onDeclineModalChange(true, request) },
        { key: 'cancel', icon: 'ban', label: 'MY_APPROVALS.CANCEL_REQUEST', accion: (request) => this.openCancelModal(request) },
        { key: 'return_order', icon: 'corner-up-left', label: 'MY_APPROVALS.RETURN_ORDER', accion: (request) => this.openSendBackModal(request) },
        { key: 'pdf', icon: 'file-text', label: 'MY_APPROVALS.PDF', accion: (request) => this.generatePdf(request) },
        { key: 'see_info', icon: 'info', label: 'PENDING_PAGE.SEE_INFO', accion: (request) => this.openInfoModal(request) },
        { key: 'edit', icon: 'pencil', label: 'MY_APPROVALS.EDIT', accion: (request) => this.editRequest(request) },
        { key: 'history', icon: 'history', label: 'MY_APPROVALS.SEE_HISTORY', accion: (request) => this.logAction(request) },
    ];
    public acciones = signal<AccionPersonalizada<Request>[]>([]);

    constructor() {
        super();
        this.form = new FormGroup({
            comments: new FormControl<string>('', Validators.required)
        });
        this.subscribeToLanguageChanges();
    }

    protected getI18nPrefix(): string {
        return 'MY_APPROVALS';
    }

    protected loadRequests(): void {
        this.loadMyPendingRequests();
    }

    ngOnInit(): void {
        this.listenForNotificationShortcut();
        this.loadAllowedRequestTypes();
    }

    private loadAllowedRequestTypes(): void {
        forkJoin({
            actions: this.roleService.getActions(),
            requestTypes: this._requestsService.getRequestTypes(),
            permissions: this.roleService.getRequestTypePermissionsForCurrentContext(),
        }).subscribe({
            next: ({ actions, requestTypes, permissions }) => {
                const permissionMatrix = this.buildRequestTypeActionPermissions(actions, permissions);
                this.requestTypeActionPermissions.set(permissionMatrix);
                const filteredTypes = requestTypes.filter((rt) => Boolean(permissionMatrix[rt.id]?.['approve']));
                this.availableRequestTypes.set(filteredTypes);
                this.updateVisibleActions();
                this.tryApplyNotificationShortcut();
            },
            error: () => {
                this.availableRequestTypes.set([]);
            }
        });
    }

    private listenForNotificationShortcut(): void {
        this.route.queryParamMap.subscribe((params) => {
            const requestNumber = normalizeRequestNumber(params.get('requestNumber') ?? '');
            if (!requestNumber) {
                this.pendingShortcutRequestNumber = null;
                return;
            }
            this.pendingShortcutRequestNumber = requestNumber;
            this.tryApplyNotificationShortcut();
        });
    }

    private tryApplyNotificationShortcut(): void {
        const requestNumber = this.pendingShortcutRequestNumber;
        if (!requestNumber || this.appliedShortcutRequestNumber === requestNumber) return;

        const requestTypes = this.availableRequestTypes();
        if (!requestTypes.length) return;

        this.isInitializingDeepLink.set(true);

        this.resolveRequestTypeForShortcut(requestNumber, requestTypes).subscribe((resolvedRequestTypeId) => {
            if (!resolvedRequestTypeId) {
                this.isInitializingDeepLink.set(false);
                return;
            }
            this.appliedShortcutRequestNumber = requestNumber;
            this.selectedRequestType = String(resolvedRequestTypeId);
            this.searchTerm.set(requestNumber);
            this.resetPagination();
            this.clearSelectedRequests();
            this.loadMyPendingRequests();
        });
    }

    private resolveRequestTypeForShortcut(requestNumber: string, requestTypes: RequestType[]) {
        const targetSeries = this.extractSeries(requestNumber);

        return forkJoin(
            requestTypes.map((requestType) =>
                this._requestsService.getNextRequestNumber(requestType.id).pipe(
                    map((nextNumber) => ({
                        requestTypeId: requestType.id,
                        series: this.extractSeries(nextNumber.prefix ?? ''),
                    })),
                    catchError(() => of({ requestTypeId: requestType.id, series: '' }))
                )
            )
        ).pipe(
            switchMap((prefixMatches) => {
                const directMatch = prefixMatches
                    .filter((item) => !!item.series)
                    .sort((a, b) => b.series.length - a.series.length)
                    .find((item) => targetSeries.startsWith(item.series));

                if (directMatch) return of(directMatch.requestTypeId);
                return this.findRequestTypeByRequestLookup(requestNumber, requestTypes);
            })
        );
    }

    private findRequestTypeByRequestLookup(requestNumber: string, requestTypes: RequestType[]) {
        const normalizedTarget = this.normalizeRequestNumberForCompare(requestNumber);

        return forkJoin(
            requestTypes.map((requestType) =>
                this._requestsService.getMyPendingRequests(requestType.id, this.pageSize(), 1, requestNumber).pipe(
                    map((response) => {
                        const found = (response.data ?? []).some((request) =>
                            this.normalizeRequestNumberForCompare(request.requestNumber) === normalizedTarget
                        );
                        return found ? requestType.id : null;
                    }),
                    catchError(() => of(null))
                )
            )
        ).pipe(
            map((matches) => matches.find((item) => item !== null) ?? null)
        );
    }

    private extractSeries(requestNumber: string): string {
        const match = normalizeRequestNumber(requestNumber).match(/^[A-Z]+/);
        return match?.[0] ?? '';
    }

    private normalizeRequestNumberForCompare(requestNumber: string): string {
        return normalizeRequestNumber(requestNumber).replace(/[^A-Z0-9]/g, '');
    }

    onRequestTypeChange(event: any): void {
        this.isLoading.set(true);
        const value = event.target.value as string;
        this.selectedRequestType = value;
        this.appliedShortcutRequestNumber = null;
        this.searchTerm.set('');
        this.resetPagination();
        this.clearSelectedRequests();
        this.updateVisibleActions();

        if (value === 'DE') {
            this.requests.set([]);
            this.isLoadingTable.set(false);
            this.isLoading.set(false);
            return;
        }

        this.loadRequests();
    }

    private updateVisibleActions(): void {
        const requestTypeId = Number(this.selectedRequestType);
        if (!requestTypeId || Number.isNaN(requestTypeId)) {
            this.acciones.set([]);
            return;
        }
        const permissionsBySlug = this.requestTypeActionPermissions()[requestTypeId] ?? {};
        const visibleActions = this.baseAcciones.filter(action =>
            getPermissionSlugsForCustomAction(action.key).some(slug => permissionsBySlug[slug])
        );
        this.acciones.set(visibleActions);
    }

    override onSearch(term: string): void {
        if (this.selectedRequestType === 'DE' || !this.selectedRequestType) return;
        if (this.searchDebounceTimeout) clearTimeout(this.searchDebounceTimeout);
        this.searchDebounceTimeout = setTimeout(() => {
            const normalizedTerm = term.trim();
            if (normalizedTerm === this.searchTerm()) return;
            this.searchTerm.set(normalizedTerm);
            this.resetPagination();
            this.clearSelectedRequests();
            this.loadRequests();
        }, 350);
    }

    private loadMyPendingRequests(): void {
        const requestTypeId = Number(this.selectedRequestType);
        if (!Number.isFinite(requestTypeId) || requestTypeId <= 0) {
            this.requests.set([]);
            this.isLoadingTable.set(false);
            this.isLoading.set(false);
            this.isInitializingDeepLink.set(false);
            return;
        }

        this.isLoadingTable.set(true);

        this._requestsService.getMyPendingRequests(requestTypeId, this.pageSize(), this.currentPage(), this.searchTerm()).subscribe({
            next: (response) => {
                this.requests.set(response.data ?? []);
                this.currentPage.set(response.current_page ?? 1);
                this.totalPages.set(response.last_page ?? 1);
                this.hasNextPage.set(Boolean(response.next_page_url));
                this.hasPrevPage.set(Boolean(response.prev_page_url));
                this.isLoadingTable.set(false);
                this.isLoading.set(false);
                this.isInitializingDeepLink.set(false);
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('❌ Error al cargar requests:', error);
                this.isLoadingTable.set(false);
                this.isLoading.set(false);
                this.isInitializingDeepLink.set(false);
                this.cdr.markForCheck();
            }
        });
    }

    openApproveModal(request: Request): void {
        this.requestToApprove.set(request);
        this.showApproveModal.set(true);
    }

    onApproveConfirmed(comments: string): void {
        const request = this.requestToApprove();
        if (!request) return;
        this.showApproveModal.set(false);
        this.approveRequest(request, comments);
    }

    onDeclineModalChange(isOpen: boolean = true, request?: Request): void {
        this.showDeclineModal.set(isOpen);
        if (isOpen && request) {
            this.selectedRequest.set(request);
            this.form.reset();
            this.submitted.set(false);
        }
        if (!isOpen) {
            this.selectedRequest.set(null);
            this.form.reset();
            this.submitted.set(false);
        }
    }

    onBulkApproveModalChange(isOpen: boolean = true): void {
        this.showBulkApproveModal.set(isOpen);
    }

    onBulkDeclineModalChange(isOpen: boolean = true): void {
        this.showBulkDeclineModal.set(isOpen);
        this.form.reset();
        this.submitted.set(false);
    }

    isRequestSelected(request: Request): boolean {
        const requestId = Number(request.id);
        if (!Number.isFinite(requestId) || requestId <= 0) return false;
        return this.selectedRequestIds().has(requestId);
    }

    toggleRequestSelection(request: Request, checked: boolean): void {
        const requestId = Number(request.id);
        if (!Number.isFinite(requestId) || requestId <= 0) return;
        this.selectedRequestIds.update((current) => {
            const next = new Set(current);
            checked ? next.add(requestId) : next.delete(requestId);
            return next;
        });
    }

    toggleSelectCurrentPage(checked: boolean): void {
        const pageIds = this.currentPageRequestIds();
        if (!pageIds.length) return;
        this.selectedRequestIds.update((current) => {
            const next = new Set(current);
            for (const id of pageIds) {
                checked ? next.add(id) : next.delete(id);
            }
            return next;
        });
    }

    clearSelectedRequests(): void {
        this.selectedRequestIds.set(new Set<number>());
    }

    openBulkApproveModal(): void {
        if (!this.selectedCount()) return;
        this.onBulkApproveModalChange(true);
    }

    openBulkDeclineModal(): void {
        if (!this.selectedCount()) return;
        this.onBulkDeclineModalChange(true);
    }

    approveSelectedRequests(): void {
        const requestIds = Array.from(this.selectedRequestIds());
        if (!requestIds.length) return;

        this.isBulkProcessing.set(true);
        const defaultComment = this._translateService.instant('MY_APPROVALS.BULK_APPROVE_DEFAULT_COMMENT');

        this._requestsService.approveMassRequests(requestIds, defaultComment).subscribe({
            next: (response) => {
                if (response.totalApproved > 0) {
                    this._toastService.success(
                        this._translateService.instant('MY_APPROVALS.TOAST.BULK_APPROVE_SUCCESS', { approved: response.totalApproved, total: response.totalReceived }),
                        this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                    );
                }
                if (response.totalFailed > 0) {
                    this._toastService.warning(
                        this._translateService.instant('MY_APPROVALS.TOAST.BULK_APPROVE_PARTIAL', { failed: response.totalFailed }),
                        this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                    );
                }
                this.onBulkApproveModalChange(false);
                this.clearSelectedRequests();
                this.loadMyPendingRequests();
                this.isBulkProcessing.set(false);
            },
            error: (error) => {
                this.isBulkProcessing.set(false);
                this._toastService.error(
                    this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.BULK_APPROVE_ERROR'),
                    this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
                console.error('Error approving requests in bulk:', error);
            }
        });
    }

    declineSelectedRequests(): void {
        this.submitted.set(true);
        if (!this.form.valid) {
            this.form.markAllAsTouched();
            return;
        }

        const requestIds = Array.from(this.selectedRequestIds());
        if (!requestIds.length) return;

        const comments = this.form.get('comments')?.value ?? '';
        this.isBulkProcessing.set(true);

        this._requestsService.rejectMassRequests(requestIds, comments).subscribe({
            next: (response) => {
                if (response.totalRejected > 0) {
                    this._toastService.success(
                        this._translateService.instant('MY_APPROVALS.TOAST.BULK_REJECT_SUCCESS', { rejected: response.totalRejected, total: response.totalReceived }),
                        this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                    );
                }
                if (response.totalFailed > 0) {
                    this._toastService.warning(
                        this._translateService.instant('MY_APPROVALS.TOAST.BULK_REJECT_PARTIAL', { failed: response.totalFailed }),
                        this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                    );
                }
                this.onBulkDeclineModalChange(false);
                this.clearSelectedRequests();
                this.loadMyPendingRequests();
                this.isBulkProcessing.set(false);
            },
            error: (error) => {
                this.isBulkProcessing.set(false);
                this._toastService.error(
                    this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.BULK_REJECT_ERROR'),
                    this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
                console.error('Error rejecting requests in bulk:', error);
            }
        });
    }

    declineRequest(request: Request): void {
        if (!request.id || !this.form.valid) return;
        const comments = this.form.get('comments')?.value || '';

        this._requestsService.rejectRequest(request.id, comments).subscribe({
            next: () => {
                this._toastService.success(
                    this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_REJECTED_SUCCESS'),
                    this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                );
                this.onDeclineModalChange(false);
                this.loadMyPendingRequests();
            },
            error: (error) => {
                this._toastService.error(
                    this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.REQUEST_REJECTED_ERROR'),
                    this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
                console.error('Error rejecting request:', error);
            }
        });
    }

    approveRequest(request: Request, comments?: string): void {
        if (!request.id) return;

        this._requestsService.approveRequest(request.id, comments).subscribe({
            next: () => {
                this._toastService.success(
                    this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_APPROVED_SUCCESS'),
                    this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                );
                this.loadMyPendingRequests();
            },
            error: (error) => {
                this._toastService.error(
                    this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.REQUEST_APPROVED_ERROR'),
                    this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
                console.error('Error approving request:', error);
            }
        });
    }

    openSendBackModal(request: Request): void {
        this.selectedRequest.set(request);
        this.showSendBackModal.set(true);
    }

    onSendBackModalChange(isOpen: boolean): void {
        this.showSendBackModal.set(isOpen);
        if (!isOpen) this.selectedRequest.set(null);
    }

    onSendBackSent(): void {
        this.loadMyPendingRequests();
    }

    openCancelModal(request: Request): void {
        this.selectedRequest.set(request);
        this.cancelComments.reset();
        this.showCancelModal.set(true);
    }

    onCancelModalChange(isOpen: boolean): void {
        this.showCancelModal.set(isOpen);
        if (!isOpen) {
            this.selectedRequest.set(null);
            this.cancelComments.reset();
        }
    }

    cancelRequest(): void {
        const request = this.selectedRequest();
        if (!request?.id) return;

        this._requestsService.cancelRequest(request.id, this.cancelComments.value ?? '').subscribe({
            next: () => {
                this._toastService.success(
                    this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_CANCELLED_SUCCESS'),
                    this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                );
                this.onCancelModalChange(false);
                this.loadMyPendingRequests();
            },
            error: (error) => {
                this._toastService.error(
                    this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.REQUEST_CANCELLED_ERROR'),
                    this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
                console.error('Error cancelling request:', error);
            }
        });
    }

    private getErrorMessageFromResponse(error: any, fallbackKey: string): string {
        return error?.error?.message ?? this._translateService.instant(fallbackKey);
    }
}
