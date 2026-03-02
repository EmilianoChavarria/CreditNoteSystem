import { Component, signal } from '@angular/core';
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
import { finalize } from 'rxjs';

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
    public requests = signal<Request[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    private nextCursor = signal<string | null>(null);
    private prevCursor = signal<string | null>(null);
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

    acciones: AccionPersonalizada<Request>[] = [
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
            accion: (request) => this.logAction(request)
        },
        {
            key: 'history',
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


    // TODO: QUITAR DESPUES DE LA REUNIÓN-------------------------------------------
    public showHistoryDrawer = signal<boolean>(false);
    public workflowDetail: WorkflowDetail = {
        code: 'NC-001',
        company: 'Grupo Bimbo S.A.',
        amount: 'USD 45,000.00',
        classification: 'Sales',
        flow: 'Flujo: Flujo 1 — Con aprobación de CS Leader (Sales)',
        createdDate: '01 feb 2026',
        progressText: 'Paso 9 de 11',
        statusLabel: 'Liberada',
        steps: [
            {
                number: 1,
                title: 'Paso 1',
                status: 'Creado',
                role: 'Requester',
                user: 'María López',
                date: '01 feb 2026',
                time: '03:00 a.m.',
                note: ''
            },
            {
                number: 2,
                title: 'Paso 2',
                status: 'Procesado',
                role: 'Processor',
                user: 'Andrés Morales',
                date: '01 feb 2026',
                time: '07:00 a.m.',
                note: 'Datos validados correctamente'
            },
            {
                number: 3,
                title: 'Paso 3',
                status: 'Aprobado',
                role: 'Finance',
                user: 'Luis Hernández',
                date: '02 feb 2026',
                time: '03:00 a.m.',
                note: ''
            },
            {
                number: 4,
                title: 'Paso 4',
                status: 'Aprobado',
                role: 'Manager',
                user: 'Roberto Mendez',
                date: '02 feb 2026',
                time: '08:00 a.m.',
                note: ''
            },
            {
                number: 5,
                title: 'Paso 5',
                status: 'Aprobado',
                role: 'General Manager',
                user: 'Patricia Vega',
                date: '03 feb 2026',
                time: '03:30 a.m.',
                note: ''
            },
            {
                number: 6,
                title: 'Paso 6',
                status: 'Rechazado',
                role: 'Business Controllers',
                user: 'Fernando Díaz',
                date: '03 feb 2026',
                time: '10:00 a.m.',
                note: 'Discrepancia en el monto facturado'
            },
            {
                number: 7,
                title: 'Paso 5',
                status: 'Devuelto',
                role: 'General Manager',
                user: 'Fernando Díaz',
                date: '03 feb 2026',
                time: '10:01 a.m.',
                note: ''
            },
            {
                number: 8,
                title: 'Paso 5',
                status: 'Aprobado',
                role: 'General Manager',
                user: 'Patricia Vega',
                date: '04 feb 2026',
                time: '04:00 a.m.',
                note: 'Monto corregido'
            }
        ]
    };

    closeHistoryDrawer(): void {
        this.showHistoryDrawer.set(false);
    }
    public selectedRequest = signal<Request | null>(null);
    // -----------------------------------------------------------------------------

    public submitted = signal(false);
    public showDeclineModal = signal<boolean>(false);

    private readonly mockSteps: WorkflowDetail['steps'] = [
        {
            number: 1,
            title: 'Paso 1',
            status: 'Creado',
            role: 'Requester',
            user: 'María López',
            date: '01 feb 2026',
            time: '03:00 a.m.',
            note: ''
        },
        {
            number: 2,
            title: 'Paso 2',
            status: 'Procesado',
            role: 'Processor',
            user: 'Andrés Morales',
            date: '01 feb 2026',
            time: '07:00 a.m.',
            note: 'Datos validados correctamente'
        },
        {
            number: 3,
            title: 'Paso 3',
            status: 'Aprobado',
            role: 'Finance',
            user: 'Luis Hernández',
            date: '02 feb 2026',
            time: '03:00 a.m.',
            note: ''
        },
        {
            number: 4,
            title: 'Paso 4',
            status: 'Aprobado',
            role: 'Manager',
            user: 'Roberto Mendez',
            date: '02 feb 2026',
            time: '08:00 a.m.',
            note: ''
        },
        {
            number: 5,
            title: 'Paso 5',
            status: 'Aprobado',
            role: 'General Manager',
            user: 'Patricia Vega',
            date: '03 feb 2026',
            time: '03:30 a.m.',
            note: ''
        },
        {
            number: 6,
            title: 'Paso 6',
            status: 'Rechazado',
            role: 'Business Controllers',
            user: 'Fernando Díaz',
            date: '03 feb 2026',
            time: '10:00 a.m.',
            note: 'Discrepancia en el monto facturado'
        },
        {
            number: 7,
            title: 'Paso 5',
            status: 'Devuelto',
            role: 'General Manager',
            user: 'Fernando Díaz',
            date: '03 feb 2026',
            time: '10:01 a.m.',
            note: ''
        },
        {
            number: 8,
            title: 'Paso 5',
            status: 'Aprobado',
            role: 'General Manager',
            user: 'Patricia Vega',
            date: '04 feb 2026',
            time: '04:00 a.m.',
            note: 'Monto corregido'
        }
    ];

    private readonly mockCommentsHistory: NonNullable<WorkflowDetail['commentsHistory']> = [
        {
            id: 1,
            author: 'Andrés Morales',
            role: 'Processor',
            comment: 'Se valida documentación inicial y se envía al flujo de aprobación.',
            status: 'Procesado',
            date: '01 feb 2026',
            time: '07:05 a.m.'
        },
        {
            id: 2,
            author: 'Fernando Díaz',
            role: 'Business Controllers',
            comment: 'Discrepancia en el monto facturado. Se solicita corrección al paso anterior.',
            status: 'Rechazado',
            date: '03 feb 2026',
            time: '10:00 a.m.'
        },
        {
            id: 3,
            author: 'Patricia Vega',
            role: 'General Manager',
            comment: 'Se corrige el monto y se aprueba nuevamente para cierre del flujo.',
            status: 'Aprobado',
            date: '04 feb 2026',
            time: '04:00 a.m.'
        }
    ];

    constructor(
        private _requestsService: RequestService
    ) { }

    onRequestTypeChange(event: any) {
        this.isLoading.set(true);
        const value = event.target.value as string;
        this.selectedRequestType = value;

        this.currentPage.set(1);
        this.nextCursor.set(null);
        this.prevCursor.set(null);
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

    private loadRequestsPaginated(cursor?: string | null): void {
        const requestTypeId = Number(this.selectedRequestType);

        if (!requestTypeId || Number.isNaN(requestTypeId)) {
            this.requests.set([]);
            this.isLoadingTable.set(false);
            this.isLoading.set(false);
            return;
        }

        this.isLoadingTable.set(true);

        this._requestsService.getRequestByTypePaginated(requestTypeId, this.pageSize(), cursor).pipe(
            finalize(() => {
                this.isLoadingTable.set(false);
                this.isLoading.set(false);
            })
        ).subscribe({
            next: (response) => {
                this.requests.set(response.data);
                this.nextCursor.set(response.next_cursor ?? null);
                this.prevCursor.set(response.prev_cursor ?? null);
                this.hasNextPage.set(!!response.next_cursor || !!response.next_page_url);
                this.hasPrevPage.set(!!response.prev_cursor || !!response.prev_page_url);
            },
            error: (error) => {
                console.error('❌ Error al cargar requests:', error);
            }
        });
    }

    onNextPage(): void {
        const cursor = this.nextCursor();
        if (!cursor) {
            return;
        }

        this.currentPage.update((value) => value + 1);
        this.loadRequestsPaginated(cursor);
    }

    onPrevPage(): void {
        const cursor = this.prevCursor();
        if (!cursor) {
            return;
        }

        this.currentPage.update((value) => Math.max(1, value - 1));
        this.loadRequestsPaginated(cursor);
    }

    onPageSizeChange(size: number): void {
        if (this.selectedRequestType === 'DE' || !this.selectedRequestType) {
            this.pageSize.set(size);
            return;
        }

        this.pageSize.set(size);
        this.currentPage.set(1);
        this.nextCursor.set(null);
        this.prevCursor.set(null);
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

    logAction(request: Request) {
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
        this.workflowDetail = this.buildWorkflowDetailFromRequest(request);
        this.showHistoryDrawer.set(true);
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
            steps: this.mockSteps,
            commentsHistory: this.mockCommentsHistory
        };
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