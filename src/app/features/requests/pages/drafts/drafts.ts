import { Component, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { RequestService } from '../../../../core/services/request-service';
import { ToastService } from '../../../../core/services/toast-service';
import { Request } from '../../../../data/interfaces/Request';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import moment from 'moment';
import { finalize } from 'rxjs';
import { Router } from '@angular/router';

@Component({
    selector: 'app-drafts',
    templateUrl: './drafts.html',
    styleUrl: './drafts.css',
    imports: [Table, Spinner, TranslatePipe, Modal],
})
export class Drafts {

    private _translate = inject(TranslateService);
    private _toast = inject(ToastService);

    public drafts = signal<Request[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public totalPages = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    public isLoading = signal<boolean>(false);

    public showDeleteModal = signal<boolean>(false);
    public isDeletingDraft = signal<boolean>(false);
    private draftToDelete = signal<Request | null>(null);

    public columns: Column<Request>[] = [];

    private readonly baseAcciones: AccionPersonalizada<Request>[] = [
        {
            key: 'edit',
            icon: 'pencil',
            label: 'DRAFTS.EDIT',
            accion: (request) => this.editRequest(request)
        },
        {
            key: 'delete',
            icon: 'trash-2',
            label: 'DRAFTS.DELETE',
            className: 'text-red-600 hover:bg-red-50',
            accion: (request) => this.openDeleteModal(request)
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
                render: (value, item) => item?.requestType?.name || '-'
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

    refreshDrafts(): void {
        this.currentPage.set(1);
        this.loadDrafts();
    }

    private loadDrafts(): void {
        this.isLoadingTable.set(true);

        this._requestsService.getDraftsPaginated(this.pageSize(), this.currentPage()).pipe(
            finalize(() => {
                this.isLoadingTable.set(false);
                this.isLoading.set(false);
            })
        ).subscribe({
            next: (response) => {
                this.drafts.set(response.data);
                this.currentPage.set(response.current_page ?? 1);
                this.totalPages.set(response.last_page ?? 1);
                this.hasNextPage.set(!!response.next_page_url);
                this.hasPrevPage.set(!!response.prev_page_url);
            },
            error: (error) => {
                console.error('❌ Error al cargar borradores:', error);
            }
        });
    }

    onNextPage(): void {
        if (!this.hasNextPage()) return;
        this.currentPage.update((v) => v + 1);
        this.loadDrafts();
    }

    onPrevPage(): void {
        if (!this.hasPrevPage()) return;
        this.currentPage.update((v) => Math.max(1, v - 1));
        this.loadDrafts();
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.currentPage.set(1);
        this.loadDrafts();
    }

    editRequest(request: Request): void {
        const requestTypeId = Number(request.requestTypeId);

        if (!requestTypeId || Number.isNaN(requestTypeId)) {
            return;
        }

        const navState = { editRequest: request };
        console.log('[drafts] editRequest navigate → queryParams:', { requestTypeId }, '| state:', navState);
        this.router.navigate(['/app/request/new-request'], {
            queryParams: { requestTypeId },
            state: navState
        });
    }

    openDeleteModal(request: Request): void {
        this.draftToDelete.set(request);
        this.showDeleteModal.set(true);
    }

    onDeleteModalChange(isOpen: boolean): void {
        this.showDeleteModal.set(isOpen);
        if (!isOpen) this.draftToDelete.set(null);
    }

    confirmDelete(): void {
        const draft = this.draftToDelete();
        if (!draft?.id) return;

        this.isDeletingDraft.set(true);
        this._requestsService.deleteDraft(Number(draft.id)).pipe(
            finalize(() => this.isDeletingDraft.set(false))
        ).subscribe({
            next: () => {
                this._toast.success(
                    this._translate.instant('DRAFTS.DELETE_SUCCESS'),
                    this._translate.instant('DRAFTS.SUCCESS')
                );
                this.onDeleteModalChange(false);
                this.currentPage.set(1);
                this.loadDrafts();
            },
            error: (error: any) => {
                this._toast.error(
                    error?.error?.message ?? this._translate.instant('DRAFTS.DELETE_ERROR'),
                    this._translate.instant('DRAFTS.ERROR')
                );
            }
        });
    }
}
