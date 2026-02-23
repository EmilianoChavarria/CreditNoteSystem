import { Component, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { RequestService } from '../../core/services/request-service';
import { Request } from '../../data/interfaces/Request';
import { AccionPersonalizada, Column, Table } from "../../shared/components/ui/table/table";
import moment from 'moment';
import { Badge } from "../../shared/components/ui/badge/badge";
import { Spinner } from '../../shared/components/ui/spinner/spinner';

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
            render: (value) => value.toUpperCase()
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
            render: (value) => value.toUpperCase()
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
            accion: (request) => this.function(request)
        },
        {
            key: 'decline',
            icon: 'x',
            label: 'Decline',
            accion: (request) => this.function(request)
        },
        {
            key: 'decline',
            icon: 'file-text',
            label: 'PDF',
            accion: (request) => this.function(request)
        },
        {
            key: 'edit',
            icon: 'pencil',
            label: 'Editar',
            accion: (request) => this.function(request)
        },
        {
            key: 'delete',
            icon: 'trash',
            label: 'Eliminar',
            accion: (request) => this.function(request)
        }
    ];
    constructor(
        private _requestsService: RequestService
    ) {

    }

    onRequestTypeChange(event: any) {
        this.isLoading.set(true);
        const value = event.target.value;
        console.log("🚀 ~ Pending ~ onRequestTypeChange ~ value:", value)
        if (value === 'DE') {
            this.isLoading.set(false);
            this.requests.set([]);
        } else {
            this._requestsService.getRequestsByType(value).subscribe({
                next: (response) => {
                    this.requests.set(response);
                    this.isLoading.set(false);
                    console.log('✅ Notas cargadas:', response);
                },
                error: (error) => {
                    console.error('❌ Error al cargar usuarios:', error);
                    this.isLoading.set(false);
                }
            })
        }

    }

    function(request: Request) {
        console.log(request);
    }

}
