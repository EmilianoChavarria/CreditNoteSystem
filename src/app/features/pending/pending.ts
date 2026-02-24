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
                                { text: 'Solicitud de crédito auditor /\nAuditor Credit request'},
                                { text: 'Fecha de solicitud /\nRequest date'},
                                { text: 'Moneda emitida /\nCurrency'},
                                { text: 'Cargo misceláneo /\nMiscellaneous charge'}
                            ],
                            [
                                { text: request.requestNumber || ''},
                                { text: request.requestDate ? moment(request.requestDate).format('DD/MM/YYYY') : ''},
                                { text: request.currency || ''},
                                { text: request.classification ? `${request.classification.name} - ${request.classification.code}` : ''}
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
                            ['Nombre del cliente / Customer name', { text: request.customer?.customerName || ''}],
                            ['Núm. Cliente / Customer No. (Sold to)', { text: request.customer?.customerNumber?.toString() || ''}],
                            ['Núm. Cliente / Customer No. (Ship to)', ''],
                            ['Área / Area', { text: request.area || ''}],
                            ['Vendedor / Sales Engineer', { text: request.user?.fullName.toUpperCase() || ''}],
                            ['Núm. de Factura / Invoice Number', { text: request.invoiceNumber?.toUpperCase() || ''}],
                            ['Fecha de factura / Invoice Date', { text: request.invoiceDate ? moment(request.invoiceDate).format('DD/MM/YYYY') : ''}],
                            ['Número de remisión / Delivery Note', { text: request.deliveryNote || ''}],
                            ['Solicitado por / Requested by', { text: request.user?.fullName.toUpperCase() || ''}],
                            ['Motivo por el que se solicita / Reason why you are applying', { text: request.reason?.name || ''}],
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
                                        { text: 'Nota importante: '},
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
                                    ['Número de Orden SAP / SAP Order', { text: request.orderNumber || ''}],
                                    ['Importe / Amount', { text: request.amount || ''}],
                                    ['I.V.A. 16% / Input Tax', { text: (request.totalAmount - request.amount).toFixed(2) || ''}],
                                    ['Total ' + (request.currency || ''), { text: request.totalAmount || ''}],
                                    ['Tipo de cambio / Exchange rate', { text: request.exchangeRate || ''}]
                                ]
                            },
                            layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5 }
                        },
                        {
                            width: '50%',
                            table: {
                                widths: ['60%', '40%'],
                                body: [
                                    ['Orden SAP Refacturación / SAP Order Re-invoice', { text: request.orderNumber || ''}],
                                    ['Número de remisión / Delivery note', { text: request.deliveryNote || ''}],
                                    ['Crédito - Débito / Credit - Debit', { text: request.creditNumber || ''}],
                                    ['Factura nueva / New invoice', { text: request.newInvoice || ''}],
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
}