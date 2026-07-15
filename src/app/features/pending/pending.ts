import { Component, computed, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AccionPersonalizada, Column, Table } from '../../shared/components/ui/table/table';
import { Spinner } from '../../shared/components/ui/spinner/spinner';
import moment from 'moment';
import { Badge } from '../../shared/components/ui/badge/badge';
import { CurrencyPipe, SlicePipe, UpperCasePipe } from '@angular/common';
import { Modal } from '../../shared/components/ui/modal/modal';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { WorkflowHistoryDrawer } from '../history/components/workflow-history-drawer/workflow-history-drawer';
import { WorkflowHistoryModal } from '../history/components/workflow-history-modal/workflow-history-modal';
import { finalize, forkJoin } from 'rxjs';
import { RoleService } from '../../core/services/role-service';
import { AuthService } from '../../core/services/auth-service';
import { Request, RequestType } from '../../data/interfaces/Request';
import { getPermissionSlugsForCustomAction } from '../../core/constants/action-permission-map';
import { PendingAttachmentsModal } from './components/pending-attachments-modal/pending-attachments-modal';
import { RequestInfoModal } from './components/request-info-modal/request-info-modal';
import { DraftsAdminModal } from './components/drafts-admin-modal/drafts-admin-modal';
import { RequestListBase } from '../../shared/base/request-list.base';

@Component({
    selector: 'app-pending',
    templateUrl: './pending.html',
    styleUrl: './pending.css',
    imports: [TranslatePipe, Table, Spinner, Badge, UpperCasePipe, CurrencyPipe, Modal, WorkflowHistoryDrawer, WorkflowHistoryModal, PendingAttachmentsModal, RequestInfoModal, DraftsAdminModal, ReactiveFormsModule, SlicePipe]
})
export class Pending extends RequestListBase {
    private readonly _roleService = inject(RoleService);
    private readonly _authService = inject(AuthService);

    public requestTypes = signal<RequestType[]>([]);
    public showAttachmentsModal = signal<boolean>(false);
    public selectedRequestForAttachments = signal<Request | null>(null);
    public canDeleteSelectedAttachments = signal<boolean>(false);
    public showDraftsAdminModal = signal<boolean>(false);
    private readonly authUser = toSignal(this._authService.user$, { initialValue: null });
    public isAdmin = computed(() => (this.authUser()?.roleName ?? '').trim().toUpperCase().includes('ADMIN'));

    private readonly baseColumns: Column<Request>[] = [
        { key: 'requestNumber', label: 'PENDING_PAGE.REQUEST_NUMBER', sortable: true },
        {
            key: 'razonSocial', label: 'PENDING_PAGE.SOCIAL_REASON', sortable: true, customTemplate: true
        },
        // { key: 'requestType.name', label: 'PENDING_PAGE.REQUEST_TYPE', sortable: true, customTemplate: true },
        { key: 'classification.name', label: 'PENDING_PAGE.CLASSIFICATION', sortable: true },
        { key: 'username', label: 'Assigned User', sortable: true, customTemplate: true },
        { key: 'status', label: 'PENDING_PAGE.STATUS', sortable: true, customTemplate: true },
        {
            key: 'createdAt', label: 'PENDING_PAGE.CREATED_AT', sortable: true,
            render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
        },
        { key: 'totalAmount', label: 'PENDING_PAGE.AMOUNT', sortable: false, customTemplate: true },
        { key: 'user.fullName', label: 'CREATED BY', sortable: true}
    ];

    private readonly deletedColumn: Column<Request> = {
        key: 'deletedAt', label: 'PENDING_PAGE.DELETED', sortable: false, customTemplate: true
    };

    /**
     * Solo admin/superadmin recibe borradores en este listado (ver
     * RequestController::getAllByRequestType), así que la columna "Eliminado"
     * solo aporta info para ellos.
     */
    public columns = computed<Column<Request>[]>(() =>
        this.isAdmin() ? [...this.baseColumns, this.deletedColumn] : this.baseColumns
    );

    private readonly baseAcciones: AccionPersonalizada<Request>[] = [
        { key: 'pdf', icon: 'file-text', label: 'PENDING_PAGE.PDF', accion: (request) => this.generatePdf(request) },
        { key: 'see_info', icon: 'info', label: 'PENDING_PAGE.SEE_INFO', accion: (request) => this.openInfoModal(request) },
        { key: 'delete', icon: 'trash', label: 'PENDING_PAGE.DELETE', accion: (request) => this.logAction(request) }
    ];
    public acciones = signal<AccionPersonalizada<Request>[]>([]);

    constructor() {
        super();
        this.form = new FormGroup({
            reason: new FormControl<string>('', Validators.required)
        });
        this.initializePermissions();
        this.subscribeToLanguageChanges();
    }

    protected getI18nPrefix(): string {
        return 'PENDING_PAGE';
    }
    

    protected loadRequests(): void {
        this.loadRequestsPaginated();
    }

    private initializePermissions(): void {
        this.isLoading.set(true);
        forkJoin({
            actions: this._roleService.getActions(),
            roles: this._roleService.getRoles(),
            requestTypes: this._requestsService.getRequestTypes(),
            permissions: this._roleService.getRequestTypePermissionsForCurrentContext(),
        }).subscribe({
            next: ({ actions, roles, requestTypes, permissions }) => {
                this.setRoleFilterOptions(roles);
                this.requestTypes.set(requestTypes);
                this.requestTypeActionPermissions.set(this.buildRequestTypeActionPermissions(actions, permissions));
                const allowedTypes = requestTypes.filter(rt => this.canViewRequestType(rt.id));
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

    private canViewRequestType(requestTypeId: number): boolean {
        return Boolean(this.requestTypeActionPermissions()[requestTypeId]?.['view']);
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

    onRequestTypeChange(event: any): void {
        this.isLoading.set(true);
        const value = event.target.value as string;
        this.selectedRequestType = value;
        this.updateVisibleActions();
        this.resetPagination();
        this.selectedRequesterId.set('all');
        this.requesterOptions.set([]);
        this.selectedDateFrom.set('');
        this.selectedDateTo.set('');

        if (value === 'DE') {
            this.requests.set([]);
            this.isLoadingTable.set(false);
            this.isLoading.set(false);
            return;
        }

        this.loadRequesterOptions(Number(value));
        this.loadRequests();
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

        const { dateFrom, dateTo } = this.getDateRangeParams();
        this._requestsService.getRequestsByTypeWithPagePagination(
            requestTypeId,
            this.pageSize(),
            this.currentPage(),
            this.searchTerm(),
            this.selectedRoleName(),
            this.selectedRequesterId(),
            dateFrom,
            dateTo
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

    onDeclineModalChange(isOpen: boolean = true): void {
        this.showDeclineModal.set(isOpen);
    }

    onAttachmentsModalChange(isOpen: boolean): void {
        this.showAttachmentsModal.set(isOpen);
        if (!isOpen) {
            this.selectedRequestForAttachments.set(null);
            this.canDeleteSelectedAttachments.set(false);
        }
    }

    openAttachmentsModal(request: Request): void {
        if (!request.id) return;
        const requestTypeId = Number(request.requestTypeId);
        const canDelete = this.hasRequestTypePermission(requestTypeId, [
            'delete_attachments', 'delete_attachment', 'delete_atachments', 'delete_atachment'
        ]);
        this.selectedRequestForAttachments.set(request);
        this.canDeleteSelectedAttachments.set(canDelete);
        this.showAttachmentsModal.set(true);
    }

    public refreshData(): void { this.loadRequests(); }

    public openDraftsAdminModal(): void {
        this.showDraftsAdminModal.set(true);
    }

    public onDraftsAdminModalChange(isOpen: boolean): void {
        this.showDraftsAdminModal.set(isOpen);
    }
}
