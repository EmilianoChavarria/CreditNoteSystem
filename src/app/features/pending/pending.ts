import { Component, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AccionPersonalizada, Column, Table } from "../../shared/components/ui/table/table";
import { Spinner } from '../../shared/components/ui/spinner/spinner';
import moment from 'moment';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { Badge } from "../../shared/components/ui/badge/badge";
import { UpperCasePipe } from '@angular/common';
import { Modal } from "../../shared/components/ui/modal/modal";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WorkflowDetail, WorkflowHistoryDrawer } from '../history/components/workflow-history-drawer/workflow-history-drawer';
import { finalize, forkJoin } from 'rxjs';
import { RequestService } from '../../core/services/request-service';
import { PermissionAction, RequestTypePermissionRecord, RoleService } from '../../core/services/role-service';
import { RequestType, Request } from '../../data/interfaces/Request';
import { getPermissionSlugsForCustomAction } from '../../core/constants/action-permission-map';
import { Router } from '@angular/router';
import { PendingAttachmentsModal } from './components/pending-attachments-modal/pending-attachments-modal';
import {
    buildRequestPdfDefinition,
    buildRequestWorkflowDetailFromHistory,
    buildRequestWorkflowDetailFromRequest,
    WorkflowDetailLabels,
} from '../../shared/utils/request-workflow-utils';

// 👇 Accede al default export real
const pdf: any = (pdfMake as any).default ?? pdfMake;

// 👇 Configura las fuentes
pdf.vfs = (pdfFonts as any).default?.vfs ?? (pdfFonts as any).vfs;
@Component({
    selector: 'app-pending',
    templateUrl: './pending.html',
    styleUrl: './pending.css',
    imports: [TranslatePipe, Table, Spinner, Badge, UpperCasePipe, Modal, WorkflowHistoryDrawer, PendingAttachmentsModal, ReactiveFormsModule]
})
export class Pending {

    public selectedRequestType: string = '';
    public requestTypes = signal<RequestType[]>([]);
    public availableRequestTypes = signal<RequestType[]>([]);
    public requests = signal<Request[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public totalPages = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    public isLoading = signal<boolean>(false);
    public searchTerm = signal<string>('');
    private searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
    public form = new FormGroup({
        reason: new FormControl<string>('', Validators.required)
    })
    public columns: Column<Request>[] = [
        {
            key: 'requestNumber',
            label: 'PENDING_PAGE.REQUEST_NUMBER',
            sortable: true
        },
        {
            key: 'request_type.name',
            label: 'PENDING_PAGE.REQUEST_TYPE',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'area',
            label: 'PENDING_PAGE.AREA',
            sortable: false,
        },
        {
            key: 'classification.name',
            label: 'PENDING_PAGE.CLASSIFICATION',
            sortable: true,
        },
        {
            key: 'status',
            label: 'PENDING_PAGE.STATUS',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'createdAt',
            label: 'PENDING_PAGE.CREATED_AT',
            sortable: true,
            render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
        }
    ];

    private readonly baseAcciones: AccionPersonalizada<Request>[] = [
        {
            key: 'pdf',
            icon: 'file-text',
            label: 'PENDING_PAGE.PDF',
            accion: (request) => this.generatePdf(request)
        },
        {
            key: 'see_history',
            icon: 'history',
            label: 'PENDING_PAGE.SEE_HISTORY',
            accion: (request) => this.logAction(request)
        },
        {
            key: 'see_attachments',
            icon: 'eye',
            label: 'PENDING_PAGE.SEE_ATTACHMENTS',
            accion: (request) => this.openAttachmentsModal(request)
        },
        {
            key: 'delete',
            icon: 'trash',
            label: 'PENDING_PAGE.DELETE',
            accion: (request) => this.logAction(request)
        }
    ];
    public acciones = signal<AccionPersonalizada<Request>[]>([]);


    public showHistoryDrawer = signal<boolean>(false);
    public workflowDetail: WorkflowDetail | null = null;
    public showAttachmentsModal = signal<boolean>(false);
    public selectedRequestForAttachments = signal<Request | null>(null);
    public canDeleteSelectedAttachments = signal<boolean>(false);

    closeHistoryDrawer(): void {
        this.showHistoryDrawer.set(false);
    }
    public selectedRequest = signal<Request | null>(null);

    public submitted = signal(false);
    public showDeclineModal = signal<boolean>(false);

    private readonly requestTypeActionPermissions = signal<Record<number, Record<string, boolean>>>({});

    private readonly _roleService = inject(RoleService);
    private readonly _translateService = inject(TranslateService);
    private readonly workflowLabels: WorkflowDetailLabels = {
        noClient: this._translateService.instant('PENDING_PAGE.NO_CLIENT'),
        noClassification: this._translateService.instant('PENDING_PAGE.NO_CLASSIFICATION'),
        flowLabel: this._translateService.instant('PENDING_PAGE.FLOW_LABEL'),
        stepLabel: this._translateService.instant('PENDING_PAGE.STEP'),
        progressText: (current, total) => this._translateService.instant('PENDING_PAGE.STEP_OF', { current, total }),
        noComments: this._translateService.instant('PENDING_PAGE.NO_COMMENTS'),
        noStatus: this._translateService.instant('PENDING_PAGE.NO_STATUS'),
        statusCreated: this._translateService.instant('PENDING_PAGE.STATUS_CREATED'),
        statusProcessed: this._translateService.instant('PENDING_PAGE.STATUS_PROCESSED'),
        statusRejected: this._translateService.instant('PENDING_PAGE.STATUS_REJECTED'),
        statusReturned: this._translateService.instant('PENDING_PAGE.STATUS_RETURNED'),
        statusApproved: this._translateService.instant('PENDING_PAGE.STATUS_APPROVED'),
    };

    constructor(
        private _requestsService: RequestService,
        private readonly router: Router,
    ) {
        this.initializePermissions();
    }

    private initializePermissions(): void {
        this.isLoading.set(true);
        this.loadPermissionContext();
    }

    private loadPermissionContext(): void {
        forkJoin({
            actions: this._roleService.getActions(),
            requestTypes: this._requestsService.getRequestTypes(),
            permissions: this._roleService.getRequestTypePermissionsForCurrentContext(),
        }).subscribe({
            next: ({ actions, requestTypes, permissions }) => {
                this.requestTypes.set(requestTypes);
                this.requestTypeActionPermissions.set(this.buildRequestTypeActionPermissions(actions, permissions));

                const allowedTypes = requestTypes.filter(requestType => this.canViewRequestType(requestType.id));
                this.availableRequestTypes.set(allowedTypes);

                this.selectedRequestType = 'DE';
                this.requests.set([]);
                this.updateVisibleActions();
                this.isLoading.set(false);
            },
            error: () => {
                this.availableRequestTypes.set([]);
                this.acciones.set([]);
                this.isLoading.set(false);
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

    private canViewRequestType(requestTypeId: number): boolean {
        const permissionsBySlug = this.requestTypeActionPermissions()[requestTypeId] ?? {};

        // Pending select must be filtered strictly by the "view" permission.
        return Boolean(permissionsBySlug['view']);
    }

    private updateVisibleActions(): void {
        const requestTypeId = Number(this.selectedRequestType);

        if (!requestTypeId || Number.isNaN(requestTypeId)) {
            this.acciones.set([]);
            return;
        }

        const permissionsBySlug = this.requestTypeActionPermissions()[requestTypeId] ?? {};
        const visibleActions = this.baseAcciones.filter(action => {
            const slugCandidates = getPermissionSlugsForCustomAction(action.key);
            return slugCandidates.some(slug => permissionsBySlug[slug]);
        });

        this.acciones.set(visibleActions);
    }

    onRequestTypeChange(event: any) {
        this.isLoading.set(true);
        const value = event.target.value as string;
        this.selectedRequestType = value;
        this.updateVisibleActions();

        this.currentPage.set(1);
        this.totalPages.set(1);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);

        if (value === 'DE') {
            this.requests.set([]);
            this.isLoadingTable.set(false);
            this.isLoading.set(false);
            return;
        }

        this.loadRequestsPaginated();
    }

    private loadRequestsPaginated(): void {
        const requestTypeId = Number(this.selectedRequestType);

        if (!requestTypeId || Number.isNaN(requestTypeId)) {
            this.requests.set([]);
            this.isLoadingTable.set(false);
            this.isLoading.set(false);
            return;
        }

        this.isLoadingTable.set(true);


        this._requestsService.getRequestsByTypeWithPagePagination(
            requestTypeId,
            this.pageSize(),
            this.currentPage(),
            this.searchTerm()
        ).pipe(
            finalize(() => {
                this.isLoadingTable.set(false);
                this.isLoading.set(false);
            })
        ).subscribe({
            next: (response) => {
                this.requests.set(response.data);
                this.currentPage.set(response.current_page ?? 1);
                this.totalPages.set(response.last_page ?? 1);
                this.hasNextPage.set(!!response.next_page_url);
                this.hasPrevPage.set(!!response.prev_page_url);
            },
            error: (error) => {
                console.error('❌ Error al cargar requests:', error);
            }
        });
    }

    onNextPage(): void {
        const page = this.currentPage();
        const lastPage = this.totalPages();

        if (page >= lastPage) {
            return;
        }

        this.currentPage.update((value) => value + 1);
        this.loadRequestsPaginated();
    }

    onPrevPage(): void {
        const page = this.currentPage();

        if (page <= 1) {
            return;
        }

        this.currentPage.update((value) => Math.max(1, value - 1));
        this.loadRequestsPaginated();
    }

    onFirstPage(): void {
        if (this.currentPage() === 1) {
            return;
        }

        this.currentPage.set(1);
        this.loadRequestsPaginated();
    }

    onLastPage(): void {
        const lastPage = this.totalPages();

        if (this.currentPage() === lastPage) {
            return;
        }

        this.currentPage.set(lastPage);
        this.loadRequestsPaginated();
    }

    onPageSizeChange(size: number): void {
        if (this.selectedRequestType === 'DE' || !this.selectedRequestType) {
            this.pageSize.set(size);
            return;
        }

        this.pageSize.set(size);
        this.currentPage.set(1);
        this.totalPages.set(1);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);
        this.loadRequestsPaginated();
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
            this.loadRequestsPaginated();
        }, 350);
    }

    onDeclineModalChange(isOpen: boolean = true, request?: Request): void {
        this.showDeclineModal.set(isOpen);
        console.log(request);

    }

    onAttachmentsModalChange(isOpen: boolean): void {
        this.showAttachmentsModal.set(isOpen);

        if (!isOpen) {
            this.selectedRequestForAttachments.set(null);
            this.canDeleteSelectedAttachments.set(false);
        }
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
            return this._translateService.instant('PENDING_PAGE.REQUIRED_FIELD');
        }

        return this._translateService.instant('PENDING_PAGE.INVALID_VALUE');
    }

    editRequest(request: Request): void {
        const requestTypeId = Number(request.requestTypeId);

        if (!requestTypeId || Number.isNaN(requestTypeId)) {
            return;
        }

        this.router.navigate(['/app/request/new-request'], {
            queryParams: { requestTypeId },
            state: { editRequest: request }
        });
    }

    logAction(request: Request) {
        console.log(request);
        this.openHistoryDrawer(request);
    }

    openAttachmentsModal(request: Request): void {
        if (!request.id) {
            return;
        }

        const requestTypeId = Number(request.requestTypeId);
        const canDeleteAttachments = this.hasRequestTypePermission(requestTypeId, [
            'delete_attachments',
            'delete_attachment',
            'delete_atachments',
            'delete_atachment'
        ]);

        this.selectedRequestForAttachments.set(request);
        this.canDeleteSelectedAttachments.set(canDeleteAttachments);
        this.showAttachmentsModal.set(true);
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