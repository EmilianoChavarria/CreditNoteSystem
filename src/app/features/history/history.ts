import { Component, signal } from '@angular/core';
import { AccionPersonalizada, Column, Table } from '../../shared/components/ui/table/table';
import moment from 'moment';
import { RequestService } from '../../core/services/request-service';
import { Request } from '../../data/interfaces/Request';
import { TranslatePipe } from '@ngx-translate/core';
import { Spinner } from '../../shared/components/ui/spinner/spinner';
import { Badge } from '../../shared/components/ui/badge/badge';
import { UpperCasePipe } from '@angular/common';
import { WorkflowDetail, WorkflowHistoryDrawer } from './components/workflow-history-drawer/workflow-history-drawer';

@Component({
    selector: 'app-history',
    templateUrl: './history.html',
    styleUrl: './history.css',
    imports: [TranslatePipe, Table, Spinner, Badge, UpperCasePipe]
})
export class History {

    public selectedRequestType: string = '';
    public requests = signal<Request[]>([]);
    public isLoading = signal<boolean>(false);
    
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
            key: 'history',
            icon: 'history',
            label: 'See history',
            accion: (request) => this.logAction(request)
        }
    ];
    public submitted = signal(false);
    public showDeclineModal = signal<boolean>(false);
    public showHistoryDrawer = signal<boolean>(false);
    public selectedRequest = signal<Request | null>(null);

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

    public workflowDetail: WorkflowDetail = {
        code: 'NC-001',
        company: 'Grupo Bimbo S.A.',
        amount: 'USD 45,000.00',
        classification: 'Sales',
        flow: 'Flujo: Flujo 1 — Con aprobación de CS Leader (Sales)',
        createdDate: '01 feb 2026',
        progressText: 'Paso 9 de 11',
        statusLabel: 'Liberada',
        steps: this.mockSteps
    };

    constructor(
        private _requestsService: RequestService
    ) { }

    onRequestTypeChange(event: any) {
        this.isLoading.set(true);
        const value = event.target.value;

        if (value === 'DE') {
            this.requests.set([]);
            this.isLoading.set(false);
            return;
        }

        this._requestsService.getRequestsByType(value).subscribe({
            next: (response) => {
                this.requests.set(response);
                this.isLoading.set(false);
            },
            error: (error) => {
                console.error('❌ Error al cargar requests:', error);
                this.isLoading.set(false);
            }
        });
    }

    onDeclineModalChange(isOpen: boolean = true, request?: Request): void {
        this.showDeclineModal.set(isOpen);
        // if (!isOpen) {
        //     this.selectedUserToDelete.set(null);
        // }
        console.log(request);

    }

    

    declineRequest(request: Request) {

    }

    openHistoryDrawer(request: Request): void {
        this.selectedRequest.set(request);
        this.workflowDetail = this.buildWorkflowDetailFromRequest(request);
        this.showHistoryDrawer.set(true);
    }

    closeHistoryDrawer(): void {
        this.showHistoryDrawer.set(false);
    }

    private buildWorkflowDetailFromRequest(request: Request): WorkflowDetail {
        const amount = this.formatAmount(request.currency, request.totalAmount ?? request.amount);

        return {
            code: `NC-${request.requestNumber ?? '-'}`,
            company: request.customer?.customerName ?? 'Sin cliente',
            amount,
            classification: request.classification?.name ?? 'Sin clasificación',
            flow: `Flujo: ${request.request_type?.name?.toUpperCase() ?? 'N/A'} (${request.area ?? 'N/A'})`,
            createdDate: request.createdAt ? moment(request.createdAt).format('DD MMM YYYY') : '-',
            progressText: 'Paso 9 de 11',
            statusLabel: this.toTitleCase(request.status),
            steps: this.mockSteps
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

    logAction(request: Request) {
        this.openHistoryDrawer(request);
    }

    // =============================
    // GENERAR PDF
    // =============================

    
}
