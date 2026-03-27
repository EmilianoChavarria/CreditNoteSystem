import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RequestService } from '../../core/services/request-service';
import { Request } from '../../data/interfaces/Request';
import { AccionPersonalizada, Column, Table } from "../../shared/components/ui/table/table";
import { Spinner } from '../../shared/components/ui/spinner/spinner';
import moment from 'moment';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { Badge } from "../../shared/components/ui/badge/badge";
import { UpperCasePipe } from '@angular/common';
import { Modal } from "../../shared/components/ui/modal/modal";
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { WorkflowDetail, WorkflowHistoryDrawer } from '../history/components/workflow-history-drawer/workflow-history-drawer';
import { finalize, forkJoin } from 'rxjs';
import { RequestHistoryData, RequestHistoryLog } from '../../core/services/request-service';
import { AuthService } from '../../core/services/auth-service';
import { PermissionAction, RequestTypePermissionRecord, RoleService } from '../../core/services/role-service';
import { RequestType } from '../../data/interfaces/Request';
import { getPermissionSlugsForCustomAction } from '../../core/constants/action-permission-map';
import { Router } from '@angular/router';

// 👇 Accede al default export real
const pdf: any = (pdfMake as any).default ?? pdfMake;

// 👇 Configura las fuentes
pdf.vfs = (pdfFonts as any).default?.vfs ?? (pdfFonts as any).vfs;
@Component({
    selector: 'app-pending',
    templateUrl: './pending.html',
    styleUrl: './pending.css',
    imports: [TranslatePipe, Table, Spinner, Badge, UpperCasePipe, Modal, WorkflowHistoryDrawer]
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
    public form = new FormGroup({
        reason: new FormControl<string>('', Validators.required)
    })
    public columns: Column<Request>[] = [
        {
            key: 'requestNumber',
            label: 'Request Number',
            sortable: true
        },
        {
            key: 'request_type.name',
            label: 'Request Type',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'area',
            label: 'Area',
            sortable: false,
        },
        {
            key: 'classification.name',
            label: 'Classification',
            sortable: true,
        },
        {
            key: 'status',
            label: 'Status',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'createdAt',
            label: 'Fecha de Creación',
            sortable: true,
            render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
        }
    ];

    private readonly baseAcciones: AccionPersonalizada<Request>[] = [
        {
            key: 'approve',
            icon: 'check',
            label: 'Approve',
            accion: (request) => this.logAction(request)
        },
        {
            key: 'decline',
            icon: 'x',
            label: 'Decline',
            accion: (request) => this.onDeclineModalChange(true, request)
        },
        {
            key: 'pdf',
            icon: 'file-text',
            label: 'PDF',
            accion: (request) => this.generatePdf(request)
        },
        {
            key: 'edit',
            icon: 'pencil',
            label: 'Editar',
            accion: (request) => this.editRequest(request)
        },
        {
            key: 'see_history',
            icon: 'history',
            label: 'See history',
            accion: (request) => this.logAction(request)
        },
        {
            key: 'delete',
            icon: 'trash',
            label: 'Eliminar',
            accion: (request) => this.logAction(request)
        }
    ];
    public acciones = signal<AccionPersonalizada<Request>[]>([]);


    public showHistoryDrawer = signal<boolean>(false);
    public workflowDetail: WorkflowDetail | null = null;

    closeHistoryDrawer(): void {
        this.showHistoryDrawer.set(false);
    }
    public selectedRequest = signal<Request | null>(null);

    public submitted = signal(false);
    public showDeclineModal = signal<boolean>(false);

    private readonly requestTypeActionPermissions = signal<Record<number, Record<string, boolean>>>({});

    private readonly _roleService = inject(RoleService);
    private readonly _authService = inject(AuthService);

    constructor(
        private _requestsService: RequestService,
        private readonly router: Router,
    ) {
        this.initializePermissions();
    }

    private initializePermissions(): void {
        this.isLoading.set(true);
        const roleId = this._authService.getCurrentUser()?.roleId;

        if (roleId) {
            this.loadPermissionContext(roleId);
            return;
        }

        this._authService.checkSession().subscribe({
            next: (isValid) => {
                const resolvedRoleId = this._authService.getCurrentUser()?.roleId;
                if (isValid && resolvedRoleId) {
                    this.loadPermissionContext(resolvedRoleId);
                    return;
                }

                this._requestsService.getRequestTypes().subscribe({
                    next: (requestTypes) => {
                        this.requestTypes.set(requestTypes);
                        this.availableRequestTypes.set([]);
                        this.acciones.set([]);
                        this.isLoading.set(false);
                    },
                    error: () => {
                        this.availableRequestTypes.set([]);
                        this.acciones.set([]);
                        this.isLoading.set(false);
                    }
                });
            },
            error: () => {
                this.availableRequestTypes.set([]);
                this.acciones.set([]);
                this.isLoading.set(false);
            }
        });
    }

    private loadPermissionContext(roleId: number): void {
        forkJoin({
            actions: this._roleService.getActions(),
            requestTypes: this._requestsService.getRequestTypes(),
            permissions: this._roleService.getRequestTypePermissionsByRole(roleId),
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

        this._requestsService.getRequestsByTypeWithPagePagination(requestTypeId, this.pageSize(), this.currentPage()).pipe(
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

    onDeclineModalChange(isOpen: boolean = true, request?: Request): void {
        this.showDeclineModal.set(isOpen);
        // if (!isOpen) {
        //     this.selectedUserToDelete.set(null);
        // }
        console.log(request);

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
            return 'Este campo es obligatorio';
        }

        return 'Valor no válido';
    }

    declineRequest(request: Request) {

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

    // =============================
    // GENERAR PDF
    // =============================

    generatePdf(request: Request) {
        console.log(request);
        const docDefinition: any = {
            content: [
                { text: 'TIMKEN', style: 'header' },

                // Primera Tabla: Encabezado
                {
                    table: {
                        widths: ['*', '*', '*', '*'],
                        body: [
                            [
                                { text: 'Solicitud de crédito auditor /\nAuditor Credit request' },
                                { text: 'Fecha de solicitud /\nRequest date' },
                                { text: 'Moneda emitida /\nCurrency' },
                                { text: 'Cargo misceláneo /\nMiscellaneous charge' }
                            ],
                            [
                                { text: request.requestNumber || '' },
                                { text: request.requestDate ? moment(request.requestDate).format('DD/MM/YYYY') : '' },
                                { text: request.currency || '' },
                                { text: request.classification ? `${request.classification.name} - ${request.classification.code}` : '' }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5
                    }
                },
                { text: ' ', margin: [0, 5] },

                // Segunda Tabla: Datos del Cliente
                {
                    table: {
                        widths: ['30%', '70%'],
                        body: [
                            ['Nombre del cliente / Customer name', { text: request.customer?.customerName || '' }],
                            ['Núm. Cliente / Customer No. (Sold to)', { text: request.customer?.customerNumber?.toString() || '' }],
                            ['Núm. Cliente / Customer No. (Ship to)', ''],
                            ['Área / Area', { text: request.area || '' }],
                            ['Vendedor / Sales Engineer', { text: request.user?.fullName.toUpperCase() || '' }],
                            ['Núm. de Factura / Invoice Number', { text: request.invoiceNumber?.toUpperCase() || '' }],
                            ['Fecha de factura / Invoice Date', { text: request.invoiceDate ? moment(request.invoiceDate).format('DD/MM/YYYY') : '' }],
                            ['Número de remisión / Delivery Note', { text: request.deliveryNote || '' }],
                            ['Solicitado por / Requested by', { text: request.user?.fullName.toUpperCase() || '' }],
                            ['Motivo por el que se solicita / Reason why you are applying', { text: request.reason?.name || '' }],
                            ['Auditado por / Audited by', ''],
                            ['Gerentes que autorizan / Manager Approval', '']
                        ]
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5
                    }
                },
                { text: ' ', margin: [0, 5] },

                // Sección de Comentarios
                {
                    table: {
                        widths: ['100%'],
                        body: [
                            [
                                {
                                    stack: [
                                        { text: 'Comentarios / Comments', fontSize: 9, margin: [0, 0, 0, 5] },
                                        { text: request.comments || 'No hay comentarios', fontSize: 9, bold: false }
                                    ],
                                    minHeight: 50,
                                    margin: [5, 5, 5, 5]
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5
                    }
                },
                { text: ' ', margin: [0, 5] },

                // Tabla de Notas e Información de Flete
                {
                    table: {
                        widths: ['60%', '40%'],
                        body: [
                            [
                                {
                                    text: [
                                        { text: 'Nota importante: ' },
                                        {
                                            text: '1. No se aceptará material oxidado o que tenga las cajas rayadas con pluma o plumón. 2. Etiquetar la caja(s) con el número de RGA. 3. El material se recibirá dentro de los 30 días a partir de la fecha de la solicitud, después de esta fecha será cancelada.',
                                            italics: true
                                        }
                                    ],
                                    fontSize: 8.5,
                                    margin: [5, 5, 5, 5]
                                },
                                {
                                    text: 'El costo del flete deberá ser pagado por el cliente',
                                    bold: true,
                                    fontSize: 9,
                                    alignment: 'center',
                                    margin: [5, 20, 5, 5] // Ajuste para centrar verticalmente con la nota
                                }
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: () => 0.5,
                        vLineWidth: () => 0.5
                    }
                },
                { text: ' ', margin: [0, 5] },

                // Tablas Inferiores (SAP y Refacturación)
                {
                    columns: [
                        {
                            width: '50%',
                            table: {
                                widths: ['60%', '40%'],
                                body: [
                                    ['Número de Orden SAP / SAP Order', { text: request.orderNumber || '' }],
                                    ['Importe / Amount', { text: request.amount || '' }],
                                    ['I.V.A. 16% / Input Tax', { text: (request.totalAmount - request.amount).toFixed(2) || '' }],
                                    ['Total ' + (request.currency || ''), { text: request.totalAmount || '' }],
                                    ['Tipo de cambio / Exchange rate', { text: request.exchangeRate || '' }]
                                ]
                            },
                            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 }
                        },
                        {
                            width: '50%',
                            table: {
                                widths: ['60%', '40%'],
                                body: [
                                    ['Orden SAP Refacturación / SAP Order Re-invoice', { text: request.orderNumber || '' }],
                                    ['Número de remisión / Delivery note', { text: request.deliveryNote || '' }],
                                    ['Crédito - Débito / Credit - Debit', { text: request.creditNumber || '' }],
                                    ['Factura nueva / New invoice', { text: request.newInvoice || '' }],
                                    ['Aprobado por Finanzas / Finance Approval', '']
                                ]
                            },
                            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 }
                        }
                    ],
                    columnGap: 10
                }
            ],
            styles: {
                header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
                tableHeader: { fontSize: 8, fillColor: '#eeeeee', bold: true, alignment: 'center' },
                tableData: { fontSize: 9, bold: true, alignment: 'center', margin: [0, 3, 0, 3] }
            },
            defaultStyle: { fontSize: 9 }
        };

        pdf.createPdf(docDefinition).open();
    }

    openHistoryDrawer(request: Request): void {
        this.selectedRequest.set(request);
        this.showHistoryDrawer.set(false);
        this.workflowDetail = null;

        if (!request.id) {
            this.workflowDetail = this.buildWorkflowDetailFromRequest(request);
            setTimeout(() => {
                this.showHistoryDrawer.set(true);
            });
            return;
        }

        this._requestsService.getRequestHistory(request.id).subscribe({
            next: (response) => {
                if (!response) {
                    this.workflowDetail = this.buildWorkflowDetailFromRequest(request);
                } else {
                    this.workflowDetail = this.buildWorkflowDetailFromHistory(response);
                }

                setTimeout(() => {
                    this.showHistoryDrawer.set(true);
                });
            },
            error: () => {
                this.workflowDetail = this.buildWorkflowDetailFromRequest(request);
                setTimeout(() => {
                    this.showHistoryDrawer.set(true);
                });
            }
        });
    }

    private buildWorkflowDetailFromRequest(request: Request): WorkflowDetail {
        const amount = this.formatAmount(request.currency, request.totalAmount ?? request.amount);

        return {
            code: `${request.requestNumber ?? '-'}`,
            company: request.customer?.customerName ?? 'Sin cliente',
            amount,
            classification: request.classification?.name ?? 'Sin clasificación',
            flow: `Flujo: ${request.request_type?.name?.toUpperCase() ?? 'N/A'} (${request.area ?? 'N/A'})`,
            createdDate: request.createdAt ? moment(request.createdAt).format('DD MMM YYYY') : '-',
            progressText: 'Paso 9 de 11',
            statusLabel: this.toTitleCase(request.status),
            steps: [],
            commentsHistory: []
        };
    }

    private buildWorkflowDetailFromHistory(data: RequestHistoryData): WorkflowDetail {
        const request = data.request;
        const amount = this.formatAmount(request.currency, request.totalAmount ?? request.amount);
        const roleNameByStepId = new Map<number, string>();
        data.steps.forEach((step) => {
            roleNameByStepId.set(step.id, step.role?.roleName ?? step.stepName ?? '-');
        });

        const timelineSteps = (data.timeline ?? [])
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((item) => {
                const eventMoment = moment(item.timestamp);

                return {
                    number: item.step.order,
                    title: `Paso ${item.step.order}`,
                    status: this.mapHistoryStatus(item.actionType),
                    role: roleNameByStepId.get(item.step.id) ?? item.step.name,
                    user: item.actionUser?.fullName ?? '-',
                    date: eventMoment.format('DD MMM YYYY'),
                    time: eventMoment.format('hh:mm a'),
                    note: item.comments ?? item.message ?? ''
                };
            });

        const latestHistoryByStep = new Map<number, RequestHistoryLog>();

        data.history.forEach((historyItem) => {
            const existing = latestHistoryByStep.get(historyItem.workflowStepId);

            if (!existing || new Date(historyItem.createdAt).getTime() > new Date(existing.createdAt).getTime()) {
                latestHistoryByStep.set(historyItem.workflowStepId, historyItem);
            }
        });

        const fallbackSteps = Array.from(latestHistoryByStep.values())
            .sort((a, b) => a.workflow_step.stepOrder - b.workflow_step.stepOrder)
            .map((historyItem) => {
                const eventDate = historyItem.request_step?.completedAt ?? historyItem.request_step?.startedAt ?? historyItem.createdAt;
                const eventMoment = eventDate ? moment(eventDate) : null;

                return {
                    number: historyItem.workflow_step.stepOrder,
                    title: `Paso ${historyItem.workflow_step.stepOrder}`,
                    status: this.mapHistoryStatus(historyItem.request_step?.status ?? historyItem.actionType),
                    role: historyItem.workflow_step?.stepName ?? '-',
                    user: historyItem.action_user?.fullName ?? '-',
                    date: eventMoment ? eventMoment.format('DD MMM YYYY') : '-',
                    time: eventMoment ? eventMoment.format('hh:mm a') : '-',
                    note: historyItem.comments ?? ''
                };
            });

        return {
            code: `${request.requestNumber ?? '-'}`,
            company: request.customer?.customerName ?? 'Sin cliente',
            amount,
            classification: request.classification?.name ?? 'Sin clasificación',
            flow: `Flujo: ${request.request_type?.name?.toUpperCase() ?? 'N/A'} (${request.area ?? 'N/A'})`,
            createdDate: request.createdAt ? moment(request.createdAt).format('DD MMM YYYY') : '-',
            progressText: `Paso ${data.progress.currentStepOrder} de ${data.progress.totalSteps}`,
            statusLabel: this.toTitleCase(request.status),
            steps: timelineSteps.length > 0 ? timelineSteps : fallbackSteps,
            commentsHistory: data.history.map((historyItem) => {
                const createdAt = moment(historyItem.createdAt);

                return {
                    id: historyItem.id,
                    author: historyItem.action_user?.fullName ?? '-',
                    role: historyItem.workflow_step?.stepName ?? '-',
                    comment: historyItem.comments ?? 'Sin comentarios',
                    status: this.mapHistoryStatus(historyItem.actionType),
                    date: createdAt.format('DD MMM YYYY'),
                    time: createdAt.format('hh:mm a')
                };
            })
        };
    }

    private mapHistoryStatus(status: string | null | undefined): string {
        const normalized = (status ?? '').toLowerCase();

        if (normalized === 'created') {
            return 'Creado';
        }

        if (normalized === 'processed') {
            return 'Procesado';
        }

        if (normalized === 'rejected') {
            return 'Rechazado';
        }

        if (normalized === 'returned') {
            return 'Devuelto';
        }

        if (normalized === 'routed') {
            return 'Procesado';
        }

        if (normalized === 'routed_back' || normalized === 'returned') {
            return 'Devuelto';
        }

        if (normalized === 'pending') {
            return 'Procesado';
        }

        return 'Aprobado';
    }

    private formatAmount(currency: string | undefined, amountValue: number | string | undefined): string {
        const numericAmount = Number(amountValue ?? 0);
        const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;
        const safeCurrency = currency ?? 'USD';

        return `${safeCurrency} ${safeAmount.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    private toTitleCase(value: string | undefined): string {
        if (!value) {
            return 'Sin estado';
        }

        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    }
}