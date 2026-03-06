import { Component, signal } from '@angular/core';
import { AccionPersonalizada, Column, Table } from '../../../../shared/components/ui/table/table';
import { RequestService } from '../../../../core/services/request-service';
import { Request } from '../../../../data/interfaces/Request';
import moment from 'moment';
import { TranslatePipe } from '@ngx-translate/core';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { UpperCasePipe } from '@angular/common';
import { Badge } from '../../../../shared/components/ui/badge/badge';

@Component({
    selector: 'app-bulk-upload',
    templateUrl: './bulk-upload.html',
    styleUrl: './bulk-upload.css',
    imports: [TranslatePipe, Table, Spinner, Badge, UpperCasePipe]
})
export class BulkUpload {


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
            key: 'continueEditing',
            icon: 'arrow-right',
            label: 'Continue editing',
            accion: (request) => this.continueEditing(request)
        },
        {
            key: 'delete',
            icon: 'trash',
            label: 'Delete draft',
            accion: (request) => this.continueEditing(request)
        }
    ];
    public submitted = signal(false);
    public showDeclineModal = signal<boolean>(false);
    public showHistoryDrawer = signal<boolean>(false);
    public selectedRequest = signal<Request | null>(null);



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



    continueEditing(request: Request) {
        console.log(request);
    }


}
