import { Component, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RequestService } from '../../../../core/services/request-service';
import { Request } from '../../../../data/interfaces/Request';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import moment from 'moment';
import { finalize } from 'rxjs';
import { Router } from '@angular/router';

@Component({
    selector: 'app-drafts',
    templateUrl: './drafts.html',
    styleUrl: './drafts.css',
    imports: [Table, Spinner, TranslatePipe],
})
export class Drafts {

    private _translate = inject(TranslateService);

    public drafts = signal<Request[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    private nextCursor = signal<string | null>(null);
    private prevCursor = signal<string | null>(null);
    public isLoading = signal<boolean>(false);

    public columns: Column<Request>[] = [];

    private readonly baseAcciones: AccionPersonalizada<Request>[] = [
        {
            key: 'edit',
            icon: 'pencil',
            label: 'DRAFTS.EDIT',
            accion: (request) => this.editRequest(request)
        }
    ];

    public acciones = signal<AccionPersonalizada<Request>[]>(this.baseAcciones);

    constructor(
        private _requestsService: RequestService,
        private readonly router: Router,
    ) {
        this.columns = [
            {
                key: 'requestNumber',
                label: 'DRAFTS.REQUEST_NUMBER',
                sortable: true
            },
            {
                key: 'request_type.name',
                label: 'DRAFTS.REQUEST_TYPE',
                sortable: true,
                render: (value, item) => item?.request_type?.name || '-'
            },
            {
                key: 'status',
                label: 'DRAFTS.STATUS',
                sortable: true,
                render: () => this._translate.instant('DRAFTS.STATUS_DRAFT')
            },
            {
                key: 'createdAt',
                label: 'DRAFTS.CREATED_AT',
                sortable: true,
                render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
            },
            {
                key: 'updatedAt',
                label: 'DRAFTS.UPDATED_AT',
                sortable: true,
                render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
            },
        ];
        this.loadDrafts();
    }

    private loadDrafts(cursor?: string | null): void {
        this.isLoadingTable.set(true);

        this._requestsService.getDraftsPaginated(this.pageSize(), cursor).pipe(
            finalize(() => {
                this.isLoadingTable.set(false);
                this.isLoading.set(false);
            })
        ).subscribe({
            next: (response) => {
                this.drafts.set(response.data);
                this.nextCursor.set(response.next_cursor ?? null);
                this.prevCursor.set(response.prev_cursor ?? null);
                this.hasNextPage.set(!!response.next_cursor || !!response.next_page_url);
                this.hasPrevPage.set(!!response.prev_cursor || !!response.prev_page_url);
            },
            error: (error) => {
                console.error('❌ Error al cargar borradores:', error);
            }
        });
    }

    onNextPage(): void {
        const cursor = this.nextCursor();
        if (!cursor) {
            return;
        }

        this.currentPage.update((value) => value + 1);
        this.loadDrafts(cursor);
    }

    onPrevPage(): void {
        const cursor = this.prevCursor();
        if (!cursor) {
            return;
        }

        this.currentPage.update((value) => Math.max(1, value - 1));
        this.loadDrafts(cursor);
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.currentPage.set(1);
        this.nextCursor.set(null);
        this.prevCursor.set(null);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);
        this.loadDrafts();
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
}
