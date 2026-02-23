import { Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RequestService } from '../../core/services/request-service';
import { Request } from '../../data/interfaces/Request';
import { AccionPersonalizada, Column, Table } from "../../shared/components/ui/table/table";
import { Spinner } from '../../shared/components/ui/spinner/spinner';
import moment from 'moment';

import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

// 👇 Accede al default export real
const pdf: any = (pdfMake as any).default ?? pdfMake;

// 👇 Configura las fuentes
pdf.vfs = (pdfFonts as any).default?.vfs ?? (pdfFonts as any).vfs;
@Component({
    selector: 'app-pending',
    templateUrl: './pending.html',
    styleUrl: './pending.css',
    imports: [TranslatePipe, Table, Spinner]
})
export class Pending {

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
            render: (value) => value?.toUpperCase()
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
            render: (value) => value?.toUpperCase()
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
            accion: (request) => this.logAction(request)
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
            key: 'delete',
            icon: 'trash',
            label: 'Eliminar',
            accion: (request) => this.logAction(request)
        }
    ];

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

    logAction(request: Request) {
        console.log(request);
    }

    // =============================
    // GENERAR PDF
    // =============================

    generatePdf(request: Request) {

        const docDefinition: any = {
            content: [
                { text: 'TIMKEN', style: 'header' },
                {
                    table: {
                        widths: ['*', '*', '*', '*'],
                        body: [
                            [
                                { text: 'Solicitud de crédito auditor /\nAuditor Credit request', style: 'tableHeader' },
                                { text: 'Fecha de solicitud /\nRequest date', style: 'tableHeader' },
                                { text: 'Moneda emitida /\nCurrency', style: 'tableHeader' },
                                { text: 'Cargo misceláneo /\nMiscellaneous charge', style: 'tableHeader' }
                            ],
                            [
                                { text: request.requestNumber || 'N/A', style: 'tableData' }, // Usando datos reales
                                { text: moment(request.createdAt).format('DD/MM/YYYY'), style: 'tableData' },
                                { text: 'MXN', style: 'tableData' },
                                { text: 'SALES FORECAST - ZSEN', style: 'tableData' }
                            ]
                        ]
                    }
                },
                { text: ' ', margin: [0, 10] },
                {
                    table: {
                        widths: ['40%', '60%'],
                        body: [
                            ['Nombre del cliente / Customer name', request.area || 'N/A'], // Mapea tus campos aquí
                            ['Núm. Cliente / Customer No. (Sold to)', '182075'],
                            ['Área / Area', 'AFTERMARKET'],
                            ['Vendedor / Sales Engineer', 'FERNANDO CAYEROS']
                        ]
                    }
                }
            ],
            styles: {
                header: { fontSize: 22, bold: true, margin: [0, 0, 0, 10] },
                tableHeader: { fontSize: 8, fillColor: '#eeeeee', bold: true },
                tableData: { fontSize: 10, bold: true, margin: [0, 5, 0, 5] }
            }
        }

        pdf.createPdf(docDefinition).open();    
        // También puedes usar:
        // .download(`Request_${request.requestNumber}.pdf`);
        // .print();
    }
}