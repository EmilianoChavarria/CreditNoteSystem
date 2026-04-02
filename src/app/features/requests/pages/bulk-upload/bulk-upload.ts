import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { TabsContainer } from "../../../../shared/components/ui/tab/tab-container/tab-container";
import { Tab } from "../../../../shared/components/ui/tab/tab";
import { AccordeonContainer } from "../../../../shared/components/ui/accordeon/accordeon-container";
import { AccordeonItem } from "../../../../shared/components/ui/accordeon/accordeon-item";
import { LucideAngularModule } from "lucide-angular";
import { Modal } from "../../../../shared/components/ui/modal/modal";
import { Popover } from "../../../../shared/components/ui/popover/popover";
import { Subscription } from 'rxjs';
import { BatchErrorLog, BatchRequestItem, BatchService, BatchSummary } from '../../../../core/services/batch-service';
import { AuthService } from '../../../../core/services/auth-service';
import { BatchFinishedMessage, ReverbSocketService } from '../../../../core/services/reverb-socket-service';
import { ToastService } from '../../../../core/services/toast-service';
import { RequestService } from '../../../../core/services/request-service';
import { RequestType } from '../../../../data/interfaces/Request';
import { ActivatedRoute } from '@angular/router';

interface UploadedFileRow {
    name: string;
    sizeLabel: string;
    type: string;
    uploadedAt: string;
}

interface BatchHistoryRow {
    idBatch: string;
    date: string;
    batchType:string;
    status: string;
    requests: number;
    emitted: number;
    pending: number;
    error: number;
    rawId: number | string;
}

type RequestStatus = string;

interface RequestHistoryRow {
    requestNumber: string;
    status: RequestStatus;
    errorMessage?: string;
    rawItem?: BatchRequestItem;
}

@Component({
    selector: 'app-bulk-upload',
    templateUrl: './bulk-upload.html',
    styleUrl: './bulk-upload.css',
    imports: [TabsContainer, Tab, AccordeonContainer, AccordeonItem, LucideAngularModule, Modal, Popover, JsonPipe]
})
export class BulkUpload implements OnInit, AfterViewInit, OnDestroy {

    @ViewChild(TabsContainer) private tabsContainer?: TabsContainer;

    private readonly batchService = inject(BatchService);
    private readonly socketService = inject(ReverbSocketService);
    private readonly authService = inject(AuthService);
    private readonly route = inject(ActivatedRoute);
    private readonly toastService = inject(ToastService);
    private readonly requestService = inject(RequestService);
    private readonly subscriptions: Subscription[] = [];
    private pendingTabIndex: number | null = null;

    private readonly detailErrorsPerPage = 25;


    public isDragOver = signal(false);
    public isSupportDragOver = signal(false);
    public initialTabIndex = signal(0);
    public isCreatingBatch = signal(false);
    public isCreatingSupportBatch = signal(false);
    public uploadedFiles = signal<UploadedFileRow[]>([]);
    public supportUploadedFiles = signal<UploadedFileRow[]>([]);
    public availableRequestTypes = signal<RequestType[]>([]);
    public selectedRequestTypeId = signal<number | null>(null);
    public selectedBatchFile = signal<File | null>(null);
    public supportFiles = signal<File[]>([]);
    public supportMinRange = signal('');
    public supportMaxRange = signal('');
    public isBatchDetailModalOpen = signal(false);
    public isLoadingHistory = signal(false);
    public isLoadingBatchDetail = signal(false);
    public isLoadingBatchRequests = signal(false);
    public isRequestErrorModalOpen = signal(false);
    public selectedBatch = signal<BatchHistoryRow | null>(null);
    public selectedRequestError = signal<RequestHistoryRow | null>(null);
    public selectedBatchSummary = signal<BatchSummary | null>(null);
    public selectedBatchErrors = signal<BatchErrorLog[]>([]);
    public historyCurrentPage = signal(1);
    public historyPageSize = signal(10);
    public historyLastPage = signal(1);
    public historyTotal = signal(0);
    public historyHasNextPage = signal(false);
    public historyHasPrevPage = signal(false);
    public batchRequestsCurrentPage = signal(1);
    public batchRequestsPageSize = signal(10);
    public batchRequestsLastPage = signal(1);
    public batchRequestsTotal = signal(0);
    public batchRequestsHasNextPage = signal(false);
    public batchRequestsHasPrevPage = signal(false);

    public bulkHistoryRows = signal<BatchHistoryRow[]>([]);

    public batchRequestRows = signal<RequestHistoryRow[]>([]);

    ngOnInit(): void {
        this.loadRequestTypes();
        this.loadBatches();
        this.socketService.connectToGlobalNotifications();

        const routeSub = this.route.queryParamMap.subscribe((params) => {
            const requestedTab = params.get('tab');
            const nextTabIndex = requestedTab === 'bulk-history' ? 1 : 0;
            this.applyTabIndex(nextTabIndex);
        });

        this.subscriptions.push(routeSub);

        const socketSub = this.socketService.batchFinished$.subscribe((message) => {
            this.handleBatchFinishedEvent(message);
        });

        this.subscriptions.push(socketSub);
    }

    ngAfterViewInit(): void {
        if (this.pendingTabIndex !== null) {
            this.tabsContainer?.selectTabByIndex(this.pendingTabIndex);
            this.pendingTabIndex = null;
        }
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    }

    onDragOver(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(true);
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(false);
    }

    onDrop(event: DragEvent): void {
        event.preventDefault();
        this.isDragOver.set(false);
        this.appendFiles(event.dataTransfer?.files ?? null);
    }

    onSupportDragOver(event: DragEvent): void {
        event.preventDefault();
        this.isSupportDragOver.set(true);
    }

    onSupportDragLeave(event: DragEvent): void {
        event.preventDefault();
        this.isSupportDragOver.set(false);
    }

    onSupportDrop(event: DragEvent): void {
        event.preventDefault();
        this.isSupportDragOver.set(false);
        this.appendSupportFiles(event.dataTransfer?.files ?? null);
    }

    onFileInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.appendFiles(input.files);
        input.value = '';
    }

    onSupportFileInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.appendSupportFiles(input.files);
        input.value = '';
    }

    private appendFiles(fileList: FileList | null): void {
        if (!fileList || fileList.length === 0) {
            return;
        }

        const primaryFile = fileList[0];
        this.selectedBatchFile.set(primaryFile);

        if (fileList.length > 1) {
            this.toastService.warning('Solo se usara el primer archivo seleccionado para crear el batch.', 'Bulk Upload');
        }

        const now = new Date();
        const nextRows: UploadedFileRow[] = [{
            name: primaryFile.name,
            sizeLabel: this.formatBytes(primaryFile.size),
            type: primaryFile.type || 'N/A',
            uploadedAt: now.toLocaleString('es-MX')
        }];

        this.uploadedFiles.set(nextRows);
    }

    private appendSupportFiles(fileList: FileList | null): void {
        if (!fileList || fileList.length === 0) {
            return;
        }

        const currentFiles = [...this.supportFiles()];
        const incomingFiles = Array.from(fileList);
        const availableSlots = Math.max(0, 10 - currentFiles.length);

        if (availableSlots === 0) {
            this.toastService.warning('Solo se permiten hasta 10 archivos por batch de Upload Support.', 'Bulk Upload');
            return;
        }

        const acceptedFiles = incomingFiles.slice(0, availableSlots);
        const nextFiles = [...currentFiles, ...acceptedFiles];
        this.supportFiles.set(nextFiles);

        const nowLabel = new Date().toLocaleString('es-MX');
        const nextRows = nextFiles.map((file) => ({
            name: file.name,
            sizeLabel: this.formatBytes(file.size),
            type: file.type || 'N/A',
            uploadedAt: nowLabel,
        }));

        this.supportUploadedFiles.set(nextRows);

        if (incomingFiles.length > acceptedFiles.length) {
            this.toastService.warning('Se agregaron solo 10 archivos maximo para Upload Support.', 'Bulk Upload');
        }
    }

    onRequestTypeChange(event: Event): void {
        const value = (event.target as HTMLSelectElement).value;
        const parsedId = Number(value);

        if (!value || Number.isNaN(parsedId) || parsedId <= 0) {
            this.selectedRequestTypeId.set(null);
            return;
        }

        this.selectedRequestTypeId.set(parsedId);
    }

    onSupportMinRangeChange(event: Event): void {
        this.supportMinRange.set((event.target as HTMLInputElement).value);
    }

    onSupportMaxRangeChange(event: Event): void {
        this.supportMaxRange.set((event.target as HTMLInputElement).value);
    }

    createBatchFromUpload(): void {
        const selectedFile = this.selectedBatchFile();
        const requestTypeId = this.selectedRequestTypeId();

        if (!selectedFile) {
            this.toastService.warning('Selecciona un archivo para crear el batch.', 'Bulk Upload');
            return;
        }

        if (!requestTypeId) {
            this.toastService.warning('Selecciona el Request Type.', 'Bulk Upload');
            return;
        }

        this.isCreatingBatch.set(true);

        const subscription = this.batchService.createBatch(selectedFile, 'newRequest', requestTypeId).subscribe({
            next: (batch) => {
                this.isCreatingBatch.set(false);
                this.toastService.success(
                    `Batch creado correctamente${batch?.id ? ` (ID: ${batch.id})` : ''}.`,
                    'Bulk Upload'
                );
                this.uploadedFiles.set([]);
                this.selectedBatchFile.set(null);
                this.loadBatches();
            },
            error: (error) => {
                this.isCreatingBatch.set(false);
                const message = error?.error?.message ?? 'No se pudo crear el batch.';
                this.toastService.error(message, 'Bulk Upload');
            }
        });

        this.subscriptions.push(subscription);
    }

    createSupportBatchFromUpload(): void {
        const requestTypeId = this.selectedRequestTypeId();
        const minRange = Number(this.supportMinRange().trim());
        const maxRange = Number(this.supportMaxRange().trim());
        const files = this.supportFiles();

        if (!requestTypeId) {
            this.toastService.warning('Selecciona el Request Type.', 'Bulk Upload');
            return;
        }

        if (!Number.isInteger(minRange) || !Number.isInteger(maxRange) || minRange <= 0 || maxRange <= 0) {
            this.toastService.warning('Captura un rango valido (minRange y maxRange numericos).', 'Bulk Upload');
            return;
        }

        if (minRange > maxRange) {
            this.toastService.warning('El rango minimo no puede ser mayor al maximo.', 'Bulk Upload');
            return;
        }

        if (files.length === 0) {
            this.toastService.warning('Debes adjuntar al menos un archivo para Upload Support.', 'Bulk Upload');
            return;
        }

        if (files.length > 10) {
            this.toastService.warning('Solo se permiten hasta 10 archivos para Upload Support.', 'Bulk Upload');
            return;
        }

        this.isCreatingSupportBatch.set(true);

        const subscription = this.batchService
            .createUploadSupportBatch(files, requestTypeId, minRange, maxRange)
            .subscribe({
                next: (batch) => {
                    this.isCreatingSupportBatch.set(false);
                    this.toastService.success(
                        `Batch Upload Support creado correctamente${batch?.id ? ` (ID: ${batch.id})` : ''}.`,
                        'Bulk Upload'
                    );

                    this.supportFiles.set([]);
                    this.supportUploadedFiles.set([]);
                    this.supportMinRange.set('');
                    this.supportMaxRange.set('');
                    this.loadBatches();
                },
                error: (error) => {
                    this.isCreatingSupportBatch.set(false);
                    const message = error?.error?.message ?? 'No se pudo crear el batch Upload Support.';
                    this.toastService.error(message, 'Bulk Upload');
                }
            });

        this.subscriptions.push(subscription);
    }

    removeUploadedFile(index: number): void {
        const currentFiles = [...this.uploadedFiles()];
        if (index < 0 || index >= currentFiles.length) {
            return;
        }

        currentFiles.splice(index, 1);
        this.uploadedFiles.set(currentFiles);

        if (currentFiles.length === 0) {
            this.selectedBatchFile.set(null);
        }
    }

    removeSupportUploadedFile(index: number): void {
        const currentFiles = [...this.supportFiles()];
        if (index < 0 || index >= currentFiles.length) {
            return;
        }

        currentFiles.splice(index, 1);
        this.supportFiles.set(currentFiles);

        const rows = currentFiles.map((file) => ({
            name: file.name,
            sizeLabel: this.formatBytes(file.size),
            type: file.type || 'N/A',
            uploadedAt: new Date().toLocaleString('es-MX')
        }));

        this.supportUploadedFiles.set(rows);
    }

    private formatBytes(size: number): string {
        if (size < 1024) {
            return `${size} B`;
        }

        if (size < 1024 * 1024) {
            return `${(size / 1024).toFixed(1)} KB`;
        }

        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }

    private applyTabIndex(index: number): void {
        this.initialTabIndex.set(index);

        if (this.tabsContainer) {
            this.tabsContainer.selectTabByIndex(index);
            this.pendingTabIndex = null;
            return;
        }

        this.pendingTabIndex = index;
    }

    public openBatchDetail(batch: BatchHistoryRow): void {
        this.selectedBatch.set(batch);
        this.batchRequestsCurrentPage.set(1);
        this.loadBatchDetail(batch.rawId);
        this.loadBatchRequests(batch.rawId, 1);
        this.isBatchDetailModalOpen.set(true);
    }

    public closeBatchDetailModal(isOpen: boolean): void {
        this.isBatchDetailModalOpen.set(isOpen);
        if (!isOpen) {
            this.selectedBatchSummary.set(null);
            this.selectedBatchErrors.set([]);
            this.batchRequestRows.set([]);
            this.batchRequestsCurrentPage.set(1);
            this.batchRequestsLastPage.set(1);
            this.batchRequestsTotal.set(0);
            this.batchRequestsHasNextPage.set(false);
            this.batchRequestsHasPrevPage.set(false);
        }
    }

    public openRequestErrorModal(request: RequestHistoryRow): void {
        this.selectedRequestError.set(request);
        this.isRequestErrorModalOpen.set(true);
    }

    public closeRequestErrorModal(isOpen: boolean): void {
        this.isRequestErrorModalOpen.set(isOpen);
    }

    public getStatusClass(status: RequestStatus): string {
        const normalizedStatus = (status ?? '').toLowerCase();

        if (normalizedStatus === 'success' || normalizedStatus === 'completed' || normalizedStatus === 'emitted' || normalizedStatus === 'processed') {
            return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
        }

        if (normalizedStatus === 'processing' || normalizedStatus === 'pending') {
            return 'bg-amber-100 text-amber-700 border border-amber-200';
        }

        return 'bg-red-100 text-red-700 border border-red-200';
    }

    private loadBatches(): void {
        this.loadBatchesByPage(this.historyCurrentPage());
    }

    private loadBatchesByPage(page: number): void {
        const safePage = Math.max(1, page);
        this.isLoadingHistory.set(true);

        const subscription = this.batchService.getBatches(this.historyPageSize(), safePage).subscribe({
            next: (response) => {
                this.bulkHistoryRows.set(response.data.map((batch) => this.mapBatchToHistoryRow(batch)));
                this.historyCurrentPage.set(response.current_page || safePage);
                this.historyLastPage.set(response.last_page || 1);
                this.historyTotal.set(response.total ?? response.data.length);
                this.historyHasNextPage.set(Boolean(response.next_page_url));
                this.historyHasPrevPage.set(Boolean(response.prev_page_url));
                this.isLoadingHistory.set(false);
            },
            error: (error) => {
                this.isLoadingHistory.set(false);
                console.error('Error loading batches:', error);
                this.toastService.error('No se pudieron cargar los batches.', 'Bulk History');
            }
        });

        this.subscriptions.push(subscription);
    }

    private loadRequestTypes(): void {
        const subscription = this.requestService.getRequestTypes().subscribe({
            next: (requestTypes) => {
                this.availableRequestTypes.set(requestTypes);

                if (requestTypes.length > 0 && !this.selectedRequestTypeId()) {
                    this.selectedRequestTypeId.set(requestTypes[0].id);
                }
            },
            error: (error) => {
                console.error('Error loading request types:', error);
                this.toastService.error('No se pudieron cargar los request types.', 'Bulk Upload');
            }
        });

        this.subscriptions.push(subscription);
    }

    private loadBatchDetail(batchId: number | string): void {
        this.isLoadingBatchDetail.set(true);

        const subscription = this.batchService.getBatchDetail(batchId, this.detailErrorsPerPage).subscribe({
            next: (response) => {
                this.selectedBatchSummary.set(response.batch);
                this.selectedBatchErrors.set(response.errors.data ?? []);
                this.isLoadingBatchDetail.set(false);
            },
            error: (error) => {
                this.isLoadingBatchDetail.set(false);
                console.error(`Error loading batch detail ${String(batchId)}:`, error);
                this.toastService.error('No se pudo cargar el detalle del batch.', 'Bulk History');
            }
        });

        this.subscriptions.push(subscription);
    }

    private loadBatchRequests(batchId: number | string, page?: number): void {
        const safePage = Math.max(1, page ?? this.batchRequestsCurrentPage());
        this.isLoadingBatchRequests.set(true);

        const subscription = this.batchService.getBatchRequests(batchId, this.batchRequestsPageSize(), safePage).subscribe({
            next: (response) => {
                this.batchRequestRows.set(response.items.data.map((item) => this.mapRequestItemToHistoryRow(item)));
                this.batchRequestsCurrentPage.set(response.items.current_page || safePage);
                this.batchRequestsLastPage.set(response.items.last_page || 1);
                this.batchRequestsTotal.set(response.items.total ?? response.items.data.length);
                this.batchRequestsHasNextPage.set(Boolean(response.items.next_page_url));
                this.batchRequestsHasPrevPage.set(Boolean(response.items.prev_page_url));
                this.isLoadingBatchRequests.set(false);
            },
            error: (error) => {
                this.isLoadingBatchRequests.set(false);
                console.error(`Error loading batch requests ${String(batchId)}:`, error);
                this.toastService.error('No se pudieron cargar las solicitudes del batch.', 'Bulk History');
            }
        });

        this.subscriptions.push(subscription);
    }

    private mapBatchToHistoryRow(batch: BatchSummary): BatchHistoryRow {
        return {
            idBatch: `BATCH-${String(batch.id).padStart(4, '0')}`,
            batchType: batch.batchType,
            date: this.formatDate(batch.createdAt),
            status: batch.status,
            requests: batch.totalRecords,
            emitted: batch.processedRecords,
            pending: batch.processingRecords,
            error: batch.errorRecords,
            rawId: batch.id,
        };
    }

    private mapRequestItemToHistoryRow(item: BatchRequestItem): RequestHistoryRow {
        const request = (item.request ?? {}) as Record<string, unknown>;
        const requestNumber = String(request['requestNumber'] ?? item.requestId ?? item.id ?? '-');

        return {
            requestNumber,
            status: String(item.status ?? 'unknown'),
            errorMessage: this.resolveErrorMessage(item.errorLog),
            rawItem: item,
        };
    }

    private resolveErrorMessage(errorLog: unknown): string {
        if (!errorLog) {
            return 'Sin detalle de error.';
        }

        if (typeof errorLog === 'string') {
            return errorLog;
        }

        if (typeof errorLog === 'object') {
            try {
                return JSON.stringify(errorLog, null, 2);
            } catch {
                return 'No fue posible leer el detalle del error.';
            }
        }

        return String(errorLog);
    }

    private handleBatchFinishedEvent(message: BatchFinishedMessage): void {
        const eventName = this.resolveEventName(message);
        if (eventName !== 'batch.finished') {
            return;
        }

        const currentUserId = this.authService.getCurrentUser()?.id;
        if (!this.isTargetedToCurrentUser(message, currentUserId)) {
            return;
        }

        this.toastService.info('Se recibio actualizacion de batch finalizado. Refrescando historial...', 'Bulk History');
        this.loadBatches();

        const selected = this.selectedBatch();
        const selectedId = selected?.rawId;
        const incomingId = message.batch?.id;

        if (selectedId !== undefined && incomingId !== undefined && String(selectedId) === String(incomingId)) {
            this.loadBatchDetail(selectedId);
            this.loadBatchRequests(selectedId);
        }
    }

    public onHistoryNextPage(): void {
        if (!this.historyHasNextPage()) {
            return;
        }

        this.loadBatchesByPage(this.historyCurrentPage() + 1);
    }

    public onHistoryPrevPage(): void {
        if (!this.historyHasPrevPage()) {
            return;
        }

        this.loadBatchesByPage(this.historyCurrentPage() - 1);
    }

    public onHistoryFirstPage(): void {
        if (this.historyCurrentPage() === 1) {
            return;
        }

        this.loadBatchesByPage(1);
    }

    public onHistoryLastPage(): void {
        const lastPage = this.historyLastPage();
        if (this.historyCurrentPage() === lastPage) {
            return;
        }

        this.loadBatchesByPage(lastPage);
    }

    public onBatchRequestsNextPage(): void {
        const selected = this.selectedBatch();
        if (!selected || !this.batchRequestsHasNextPage()) {
            return;
        }

        this.loadBatchRequests(selected.rawId, this.batchRequestsCurrentPage() + 1);
    }

    public onBatchRequestsPrevPage(): void {
        const selected = this.selectedBatch();
        if (!selected || !this.batchRequestsHasPrevPage()) {
            return;
        }

        this.loadBatchRequests(selected.rawId, this.batchRequestsCurrentPage() - 1);
    }

    public onBatchRequestsFirstPage(): void {
        const selected = this.selectedBatch();
        if (!selected || this.batchRequestsCurrentPage() === 1) {
            return;
        }

        this.loadBatchRequests(selected.rawId, 1);
    }

    public onBatchRequestsLastPage(): void {
        const selected = this.selectedBatch();
        const lastPage = this.batchRequestsLastPage();
        if (!selected || this.batchRequestsCurrentPage() === lastPage) {
            return;
        }

        this.loadBatchRequests(selected.rawId, lastPage);
    }

    public onHistoryPageSizeChange(event: Event): void {
        const value = Number((event.target as HTMLSelectElement).value);
        if (![5, 10, 20].includes(value)) {
            return;
        }

        this.historyPageSize.set(value);
        this.historyCurrentPage.set(1);
        this.loadBatchesByPage(1);
    }

    public onBatchRequestsPageSizeChange(event: Event): void {
        const selected = this.selectedBatch();
        if (!selected) {
            return;
        }

        const value = Number((event.target as HTMLSelectElement).value);
        if (![5, 10, 20].includes(value)) {
            return;
        }

        this.batchRequestsPageSize.set(value);
        this.batchRequestsCurrentPage.set(1);
        this.loadBatchRequests(selected.rawId, 1);
    }

    public historyFrom(): number {
        const total = this.historyTotal();
        if (total === 0) {
            return 0;
        }

        return (this.historyCurrentPage() - 1) * this.historyPageSize() + 1;
    }

    public historyTo(): number {
        return Math.min(this.historyCurrentPage() * this.historyPageSize(), this.historyTotal());
    }

    public batchRequestsFrom(): number {
        const total = this.batchRequestsTotal();
        if (total === 0) {
            return 0;
        }

        return (this.batchRequestsCurrentPage() - 1) * this.batchRequestsPageSize() + 1;
    }

    public batchRequestsTo(): number {
        return Math.min(this.batchRequestsCurrentPage() * this.batchRequestsPageSize(), this.batchRequestsTotal());
    }

    private isTargetedToCurrentUser(message: BatchFinishedMessage, currentUserId?: number): boolean {
        const payloadTarget = this.extractTargetUserId(message);

        if (payloadTarget === undefined || payloadTarget === null || payloadTarget === '') {
            // If backend emits global batch updates without target user, refresh anyway.
            return true;
        }

        if (typeof currentUserId !== 'number') {
            // Fail-open to avoid losing realtime updates when user state has not hydrated yet.
            return true;
        }

        return String(payloadTarget) === String(currentUserId);
    }

    private extractTargetUserId(message: BatchFinishedMessage): unknown {
        const recordMessage = message as Record<string, unknown>;
        const data = (recordMessage['data'] ?? null) as Record<string, unknown> | null;
        const batch = (recordMessage['batch'] ?? null) as Record<string, unknown> | null;

        return message.targetUserId
            ?? message.target_user_id
            ?? data?.['targetUserId']
            ?? data?.['target_user_id']
            ?? batch?.['targetUserId']
            ?? batch?.['target_user_id'];
    }

    private resolveEventName(message: BatchFinishedMessage): string {
        const rootEvent = String(message.event ?? '');
        if (rootEvent.length > 0) {
            return rootEvent;
        }

        const recordMessage = message as Record<string, unknown>;
        const data = (recordMessage['data'] ?? null) as Record<string, unknown> | null;
        return String(data?.['event'] ?? '');
    }

    private formatDate(value: string): string {
        if (!value) {
            return '-';
        }

        const parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
            return value;
        }

        return parsedDate.toLocaleString('es-MX');
    }



}
