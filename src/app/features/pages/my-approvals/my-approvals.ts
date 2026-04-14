import { Component, computed, inject, signal, ChangeDetectorRef } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AccionPersonalizada, Column, Table } from '../../../shared/components/ui/table/table';
import { Request, RequestType } from '../../../data/interfaces/Request';
import { WorkflowDetail, WorkflowHistoryDrawer } from '../../history/components/workflow-history-drawer/workflow-history-drawer';
import { RequestService } from '../../../core/services/request-service';
import { ToastService } from '../../../core/services/toast-service';
import moment from 'moment';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { Modal } from "../../../shared/components/ui/modal/modal";
import { Badge } from "../../../shared/components/ui/badge/badge";
import { UpperCasePipe } from '@angular/common';
import { Spinner } from "../../../shared/components/ui/spinner/spinner";
import { PermissionAction, RequestTypePermissionRecord, RoleService } from '../../../core/services/role-service';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { normalizeRequestNumber } from '../../../shared/utils/notification-navigation';
import { FullSpinnerComponent } from '../../../shared/components/ui/full-spinner/full-spinner';
import {
    buildRequestPdfDefinition,
    buildRequestWorkflowDetailFromHistory,
    buildRequestWorkflowDetailFromRequest,
    WorkflowDetailLabels,
} from '../../../shared/utils/request-workflow-utils';

const pdf: any = (pdfMake as any).default ?? pdfMake;

pdf.vfs = (pdfFonts as any).default?.vfs ?? (pdfFonts as any).vfs;
@Component({
  selector: 'app-my-approvals',
  imports: [TranslatePipe, WorkflowHistoryDrawer, Modal, Table, Badge, UpperCasePipe, Spinner, ReactiveFormsModule, FullSpinnerComponent],
  templateUrl: './my-approvals.html',
  styleUrl: './my-approvals.css',
})
export class MyApprovals {

  
    public selectedRequestType: string = '';
    public requests = signal<Request[]>([]);
    public availableRequestTypes = signal<RequestType[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public totalPages = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    public isLoading = signal<boolean>(false);
    public form = new FormGroup({
        comments: new FormControl<string>('', Validators.required)
    })
    public columns: Column<Request>[] = [
        {
            key: 'bulkSelect',
            label: 'MY_APPROVALS.SELECT',
            sortable: false,
            customTemplate: true
        },
        {
            key: 'requestNumber',
            label: 'MY_APPROVALS.REQUEST_NUMBER',
            sortable: true
        },
        {
            key: 'requestType.name',
            label: 'MY_APPROVALS.REQUEST_TYPE',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'area',
            label: 'MY_APPROVALS.AREA',
            sortable: false,
        },
        {
            key: 'classification.name',
            label: 'MY_APPROVALS.CLASSIFICATION',
            sortable: true,
        },
        {
            key: 'status',
            label: 'MY_APPROVALS.STATUS',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'createdAt',
            label: 'MY_APPROVALS.CREATED_AT',
            sortable: true,
            render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
        }
    ];

    acciones: AccionPersonalizada<Request>[] = [
        {
            key: 'approve',
            icon: 'check',
            label: 'MY_APPROVALS.APPROVE',
            accion: (request) => this.approveRequest(request)
        },
        {
            key: 'decline',
            icon: 'x',
            label: 'MY_APPROVALS.DECLINE',
            accion: (request) => this.onDeclineModalChange(true, request)
        },
        {
            key: 'pdf',
            icon: 'file-text',
            label: 'MY_APPROVALS.PDF',
            accion: (request) => this.generatePdf(request)
        },
        {
            key: 'edit',
            icon: 'pencil',
            label: 'MY_APPROVALS.EDIT',
            accion: (request) => this.editRequest(request)
        },
        {
            key: 'history',
            icon: 'history',
            label: 'MY_APPROVALS.SEE_HISTORY',
            accion: (request) => this.logAction(request)
        },
        {
            key: 'delete',
            icon: 'trash',
            label: 'MY_APPROVALS.DELETE',
            accion: (request) => this.logAction(request)
        }
    ];


    public showHistoryDrawer = signal<boolean>(false);
    public workflowDetail: WorkflowDetail | null = null;

    closeHistoryDrawer(): void {
        this.showHistoryDrawer.set(false);
    }
    public selectedRequest = signal<Request | null>(null);
    public selectedRequestIds = signal<Set<number>>(new Set<number>());
    public selectedCount = computed(() => this.selectedRequestIds().size);
    public currentPageRequestIds = computed(() => this.requests()
        .map((request) => Number(request.id))
        .filter((id) => Number.isFinite(id) && id > 0));
    public allVisibleSelected = computed(() => {
        const pageIds = this.currentPageRequestIds();
        if (!pageIds.length) {
            return false;
        }

        const selectedIds = this.selectedRequestIds();
        return pageIds.every((id) => selectedIds.has(id));
    });

    public submitted = signal(false);
    public showDeclineModal = signal<boolean>(false);
    public showBulkApproveModal = signal<boolean>(false);
    public showBulkDeclineModal = signal<boolean>(false);
    public isBulkProcessing = signal<boolean>(false);
    public searchTerm = signal<string>('');
    public isInitializingDeepLink = signal<boolean>(false);
    private searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
    private pendingShortcutRequestNumber: string | null = null;
    private appliedShortcutRequestNumber: string | null = null;
    private readonly requestTypeActionPermissions = signal<Record<number, Record<string, boolean>>>({});
    private readonly roleService = inject(RoleService);
    private readonly translateService = inject(TranslateService);
    private readonly route = inject(ActivatedRoute);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly workflowLabels: WorkflowDetailLabels = {
        noClient: this.translateService.instant('MY_APPROVALS.NO_CLIENT'),
        noClassification: this.translateService.instant('MY_APPROVALS.NO_CLASSIFICATION'),
        flowLabel: 'Flujo',
        stepLabel: 'Paso',
        progressText: (current, total) => this.translateService.instant('MY_APPROVALS.STEP_OF', { current, total }),
        noComments: this.translateService.instant('MY_APPROVALS.NO_COMMENTS'),
        noStatus: this.translateService.instant('MY_APPROVALS.NO_STATUS'),
        statusCreated: this.translateService.instant('MY_APPROVALS.STATUS_CREATED'),
        statusProcessed: this.translateService.instant('MY_APPROVALS.STATUS_PROCESSED'),
        statusRejected: this.translateService.instant('MY_APPROVALS.STATUS_REJECTED'),
        statusReturned: this.translateService.instant('MY_APPROVALS.STATUS_RETURNED'),
        statusApproved: this.translateService.instant('MY_APPROVALS.STATUS_APPROVED'),
    };

    constructor(
        private _requestsService: RequestService,
        private _toastService: ToastService
    ) { }

    private readonly router = inject(Router);

    ngOnInit(): void {
        this.listenForNotificationShortcut();
        this.loadAllowedRequestTypes();
    }

    private loadAllowedRequestTypes(): void {
        this.loadRequestTypesByContext();
    }

    private loadRequestTypesByContext(): void {
        forkJoin({
            actions: this.roleService.getActions(),
            requestTypes: this._requestsService.getRequestTypes(),
            permissions: this.roleService.getRequestTypePermissionsForCurrentContext(),
        }).subscribe({
            next: ({ actions, requestTypes, permissions }) => {
                const permissionMatrix = this.buildRequestTypeActionPermissions(actions, permissions);
                this.requestTypeActionPermissions.set(permissionMatrix);

                const filteredTypes = requestTypes.filter((requestType) => {
                    const permissionsBySlug = permissionMatrix[requestType.id] ?? {};
                    return Boolean(permissionsBySlug['approve']);
                });

                this.availableRequestTypes.set(filteredTypes);
                this.tryApplyNotificationShortcut();
            },
            error: () => {
                this.availableRequestTypes.set([]);
            }
        });
    }

    private buildRequestTypeActionPermissions(
        actions: PermissionAction[],
        permissions: RequestTypePermissionRecord[]
    ): Record<number, Record<string, boolean>> {
        const actionSlugById = actions.reduce<Record<number, string>>((acc, action) => {
            acc[action.id] = action.slug?.trim().toLowerCase() ?? '';
            return acc;
        }, {});

        const permissionMatrix: Record<number, Record<string, boolean>> = {};

        for (const permission of permissions) {
            const slug = actionSlugById[permission.action_id];
            if (!slug) {
                continue;
            }

            if (!permissionMatrix[permission.request_type_id]) {
                permissionMatrix[permission.request_type_id] = {};
            }

            permissionMatrix[permission.request_type_id][slug] = Boolean(permission.is_allowed);
        }

        return permissionMatrix;
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

        if (!requestNumber || this.appliedShortcutRequestNumber === requestNumber) {
            return;
        }

        const requestTypes = this.availableRequestTypes();
        if (!requestTypes.length) {
            return;
        }

        this.isInitializingDeepLink.set(true);

        this.resolveRequestTypeForShortcut(requestNumber, requestTypes).subscribe((resolvedRequestTypeId) => {
            if (!resolvedRequestTypeId) {
                this.isInitializingDeepLink.set(false);
                return;
            }

            this.appliedShortcutRequestNumber = requestNumber;
            this.selectedRequestType = String(resolvedRequestTypeId);
            this.searchTerm.set(requestNumber);
            this.currentPage.set(1);
            this.totalPages.set(1);
            this.hasNextPage.set(false);
            this.hasPrevPage.set(false);
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

                if (directMatch) {
                    return of(directMatch.requestTypeId);
                }

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
        const normalized = normalizeRequestNumber(requestNumber);
        const match = normalized.match(/^[A-Z]+/);
        return match?.[0] ?? '';
    }

    private normalizeRequestNumberForCompare(requestNumber: string): string {
        return normalizeRequestNumber(requestNumber).replace(/[^A-Z0-9]/g, '');
    }

    onRequestTypeChange(event: any) {
        this.isLoading.set(true);
        const value = event.target.value as string;
        this.selectedRequestType = value;
        this.appliedShortcutRequestNumber = null;
        this.searchTerm.set('');

        this.currentPage.set(1);
        this.totalPages.set(1);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);
        this.clearSelectedRequests();

        if (value === 'DE') {
            this.requests.set([]);
            this.isLoadingTable.set(false);
            this.isLoading.set(false);
            return;
        }

        this.loadMyPendingRequests();
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

    onNextPage(): void {
        if (!this.hasNextPage()) {
            return;
        }

        this.currentPage.update((value) => value + 1);
        this.loadMyPendingRequests();
    }

    onPrevPage(): void {
        if (!this.hasPrevPage()) {
            return;
        }

        this.currentPage.update((value) => Math.max(1, value - 1));
        this.loadMyPendingRequests();
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.currentPage.set(1);
        this.totalPages.set(1);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);

        if (this.selectedRequestType !== 'DE') {
            this.loadMyPendingRequests();
        }
    }

    onFirstPage(): void {
        if (this.currentPage() === 1) {
            return;
        }

        this.currentPage.set(1);
        this.loadMyPendingRequests();
    }

    onLastPage(): void {
        const lastPage = this.totalPages();

        if (this.currentPage() === lastPage) {
            return;
        }

        this.currentPage.set(lastPage);
        this.loadMyPendingRequests();
    }

    onSearch(term: string): void {
        if (this.selectedRequestType === 'DE' || !this.selectedRequestType) {
            return;
        }

        if (this.searchDebounceTimeout) {
            clearTimeout(this.searchDebounceTimeout);
        }

        this.searchDebounceTimeout = setTimeout(() => {
            const normalizedTerm = term.trim();

            if (normalizedTerm === this.searchTerm()) {
                return;
            }

            this.searchTerm.set(normalizedTerm);
            this.currentPage.set(1);
            this.totalPages.set(1);
            this.hasNextPage.set(false);
            this.hasPrevPage.set(false);
            this.clearSelectedRequests();
            this.loadMyPendingRequests();
        }, 350);
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

        if (isOpen) {
            this.form.reset();
            this.submitted.set(false);
            return;
        }

        this.form.reset();
        this.submitted.set(false);
    }

    isRequestSelected(request: Request): boolean {
        const requestId = Number(request.id);

        if (!Number.isFinite(requestId) || requestId <= 0) {
            return false;
        }

        return this.selectedRequestIds().has(requestId);
    }

    toggleRequestSelection(request: Request, checked: boolean): void {
        const requestId = Number(request.id);

        if (!Number.isFinite(requestId) || requestId <= 0) {
            return;
        }

        this.selectedRequestIds.update((currentSelection) => {
            const nextSelection = new Set(currentSelection);

            if (checked) {
                nextSelection.add(requestId);
            } else {
                nextSelection.delete(requestId);
            }

            return nextSelection;
        });
    }

    toggleSelectCurrentPage(checked: boolean): void {
        const pageIds = this.currentPageRequestIds();
        if (!pageIds.length) {
            return;
        }

        this.selectedRequestIds.update((currentSelection) => {
            const nextSelection = new Set(currentSelection);

            for (const requestId of pageIds) {
                if (checked) {
                    nextSelection.add(requestId);
                } else {
                    nextSelection.delete(requestId);
                }
            }

            return nextSelection;
        });
    }

    clearSelectedRequests(): void {
        this.selectedRequestIds.set(new Set<number>());
    }

    private getErrorMessageFromResponse(error: any, fallbackTranslationKey: string): string {
        return error?.error?.message
            ? error.error.message
            : this.translateService.instant(fallbackTranslationKey);
    }

    openBulkApproveModal(): void {
        if (!this.selectedCount()) {
            return;
        }

        this.onBulkApproveModalChange(true);
    }

    openBulkDeclineModal(): void {
        if (!this.selectedCount()) {
            return;
        }

        this.onBulkDeclineModalChange(true);
    }

    approveSelectedRequests(): void {
        const requestIds = Array.from(this.selectedRequestIds());

        if (!requestIds.length) {
            return;
        }

        this.isBulkProcessing.set(true);
        const defaultComment = this.translateService.instant('MY_APPROVALS.BULK_APPROVE_DEFAULT_COMMENT');

        this._requestsService.approveMassRequests(requestIds, defaultComment).subscribe({
            next: (response) => {
                if (response.totalApproved > 0) {
                    this._toastService.success(
                        this.translateService.instant('MY_APPROVALS.TOAST.BULK_APPROVE_SUCCESS', {
                            approved: response.totalApproved,
                            total: response.totalReceived,
                        }),
                        this.translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                    );
                }

                if (response.totalFailed > 0) {
                    this._toastService.warning(
                        this.translateService.instant('MY_APPROVALS.TOAST.BULK_APPROVE_PARTIAL', {
                            failed: response.totalFailed,
                        }),
                        this.translateService.instant('MY_APPROVALS.TOAST.ERROR')
                    );
                }

                this.onBulkApproveModalChange(false);
                this.clearSelectedRequests();
                this.loadMyPendingRequests();
                this.isBulkProcessing.set(false);
            },
            error: (error) => {
                this.isBulkProcessing.set(false);
                const errorMessage = this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.BULK_APPROVE_ERROR');
                this._toastService.error(
                    errorMessage,
                    this.translateService.instant('MY_APPROVALS.TOAST.ERROR')
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

        if (!requestIds.length) {
            return;
        }

        const comments = this.form.get('comments')?.value ?? '';
        this.isBulkProcessing.set(true);

        this._requestsService.rejectMassRequests(requestIds, comments).subscribe({
            next: (response) => {
                if (response.totalRejected > 0) {
                    this._toastService.success(
                        this.translateService.instant('MY_APPROVALS.TOAST.BULK_REJECT_SUCCESS', {
                            rejected: response.totalRejected,
                            total: response.totalReceived,
                        }),
                        this.translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                    );
                }

                if (response.totalFailed > 0) {
                    this._toastService.warning(
                        this.translateService.instant('MY_APPROVALS.TOAST.BULK_REJECT_PARTIAL', {
                            failed: response.totalFailed,
                        }),
                        this.translateService.instant('MY_APPROVALS.TOAST.ERROR')
                    );
                }

                this.onBulkDeclineModalChange(false);
                this.clearSelectedRequests();
                this.loadMyPendingRequests();
                this.isBulkProcessing.set(false);
            },
            error: (error) => {
                this.isBulkProcessing.set(false);
                const errorMessage = this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.BULK_REJECT_ERROR');
                this._toastService.error(
                    errorMessage,
                    this.translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
                console.error('Error rejecting requests in bulk:', error);
            }
        });
    }

    campoVacio(controlName: string): boolean {
        const control = this.form.get(controlName);
        if (!control) return false;
        return control.invalid && (control.touched || this.submitted());
    }

    getErrorMessage(controlName: string): string {
        const control = this.form.get(controlName);
        if (!control || !control.errors) return '';

        if (control.errors['required']) {
            return this.translateService.instant('MY_APPROVALS.REQUIRED_FIELD');
        }

        return this.translateService.instant('MY_APPROVALS.INVALID_VALUE');
    }

    declineRequest(request: Request) {
        if (!request.id || !this.form.valid) {
            return;
        }

        const comments = this.form.get('comments')?.value || '';
        
        this._requestsService.rejectRequest(request.id, comments).subscribe({
            next: () => {
                this._toastService.success(
                    this.translateService.instant('MY_APPROVALS.TOAST.REQUEST_REJECTED_SUCCESS'),
                    this.translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                );
                this.onDeclineModalChange(false);
                this.loadMyPendingRequests();
            },
            error: (error) => {
                const errorMessage = this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.REQUEST_REJECTED_ERROR');
                this._toastService.error(
                    errorMessage,
                    this.translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
                console.error('Error rejecting request:', error);
            }
        });
    }

    approveRequest(request: Request) {
        if (!request.id) {
            return;
        }

        this._requestsService.approveRequest(request.id).subscribe({
            next: () => {
                this._toastService.success(
                    this.translateService.instant('MY_APPROVALS.TOAST.REQUEST_APPROVED_SUCCESS'),
                    this.translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                );
                this.loadMyPendingRequests();
            },
            error: (error) => {
                const errorMessage = this.getErrorMessageFromResponse(error, 'MY_APPROVALS.TOAST.REQUEST_APPROVED_ERROR');
                this._toastService.error(
                    errorMessage,
                    this.translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
                console.error('Error approving request:', error);
            }
        });
    }

    logAction(request: Request) {
        this.openHistoryDrawer(request);
    }

    editRequest(request: Request): void {
        const requestTypeId = Number(request.requestTypeId ?? request.requestType?.id);

        if (!requestTypeId || Number.isNaN(requestTypeId)) {
            return;
        }

        this.router.navigate(['/app/request/new-request'], {
            queryParams: { requestTypeId },
            state: { editRequest: request }
        });
    }

    // =============================
    // GENERAR PDF
    // =============================

    generatePdf(request: Request): void {
        const docDefinition = buildRequestPdfDefinition(request);
        (pdf as { createPdf: (definition: Record<string, unknown>) => { open: () => void } }).createPdf(docDefinition).open();
    }

    openHistoryDrawer(request: Request): void {
        this.selectedRequest.set(request);
        this.showHistoryDrawer.set(false);
        this.workflowDetail = null;

        if (!request.id) {
            this.workflowDetail = buildRequestWorkflowDetailFromRequest(request, this.workflowLabels);
            setTimeout(() => {
                this.showHistoryDrawer.set(true);
            });
            return;
        }

        this._requestsService.getRequestHistory(request.id).subscribe({
            next: (response) => {
                if (!response) {
                    this.workflowDetail = buildRequestWorkflowDetailFromRequest(request, this.workflowLabels);
                } else {
                    this.workflowDetail = buildRequestWorkflowDetailFromHistory(response, this.workflowLabels);
                }

                setTimeout(() => {
                    this.showHistoryDrawer.set(true);
                });
            },
            error: () => {
                this.workflowDetail = buildRequestWorkflowDetailFromRequest(request, this.workflowLabels);
                setTimeout(() => {
                    this.showHistoryDrawer.set(true);
                });
            }
        });
    }

    private hasRequestTypePermission(requestTypeId: number, slugCandidates: string[]): boolean {
        if (!requestTypeId || Number.isNaN(requestTypeId)) {
            return false;
        }

        const permissionsBySlug = this.requestTypeActionPermissions()[requestTypeId] ?? {};

        return slugCandidates.some((slug) => Boolean(permissionsBySlug[slug]));
    }
}
