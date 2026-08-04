import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { BulkHistoryTab } from '../../../../../requests/components/batchs/bulk-history-tab/bulk-history-tab';
import { BatchRequestsModal } from '../../../../../requests/components/batchs/batch-requests-modal/batch-requests-modal';
import { RequestErrorModal } from '../../../../../requests/components/batchs/request-error-modal/request-error-modal';
import { BatchErrorLog, BatchRequestItem, BatchService, BatchSummary } from '../../../../../../core/services/batch-service';
import { ToastService } from '../../../../../../core/services/toast-service';

interface BatchHistoryRow {
  idBatch: string;
  date: string;
  batchType: string;
  requestTypeId?: number | null;
  requestTypeName?: string | null;
  status: string;
  requests: number;
  emitted: number;
  pending: number;
  error: number;
  rawId: number | string;
}

interface RequestHistoryRow {
  requestNumber: string;
  status: string;
  errorMessage?: string;
  displayName?: string;
  rawItem?: BatchRequestItem;
}

@Component({
  selector: 'app-bulk-distributor-history-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal, BulkHistoryTab, BatchRequestsModal, RequestErrorModal],
  templateUrl: './bulk-distributor-history-modal.html',
})
export class BulkDistributorHistoryModal {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly detailErrorsPerPage = 25;

  readonly open = input<boolean>(false);
  readonly openChange = output<boolean>();

  readonly isLoadingHistory = signal(false);
  readonly bulkHistoryRows = signal<BatchHistoryRow[]>([]);
  readonly historyCurrentPage = signal(1);
  readonly historyPageSize = signal(15);
  readonly historyLastPage = signal(1);
  readonly historyTotal = signal(0);
  readonly historyHasNextPage = signal(false);
  readonly historyHasPrevPage = signal(false);

  readonly isBatchDetailModalOpen = signal(false);
  readonly isLoadingBatchDetail = signal(false);
  readonly isLoadingBatchRequests = signal(false);
  readonly selectedBatch = signal<BatchHistoryRow | null>(null);
  readonly selectedBatchSummary = signal<BatchSummary | null>(null);
  readonly selectedBatchErrors = signal<BatchErrorLog[]>([]);
  readonly batchRequestRows = signal<RequestHistoryRow[]>([]);
  readonly batchRequestsCurrentPage = signal(1);
  readonly batchRequestsPageSize = signal(10);
  readonly batchRequestsLastPage = signal(1);
  readonly batchRequestsTotal = signal(0);
  readonly batchRequestsHasNextPage = signal(false);
  readonly batchRequestsHasPrevPage = signal(false);

  readonly isRequestErrorModalOpen = signal(false);
  readonly selectedRequestError = signal<RequestHistoryRow | null>(null);

  private wasOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (isOpen && !this.wasOpen) {
        this.loadBatchesByPage(1);
      }
      this.wasOpen = isOpen;
    });
  }

  refresh(): void {
    this.loadBatchesByPage(this.historyCurrentPage());
  }

  onOpenChange(isOpen: boolean): void {
    this.openChange.emit(isOpen);
  }

  openBatchDetail(batch: BatchHistoryRow): void {
    this.selectedBatch.set(batch);
    this.batchRequestsCurrentPage.set(1);
    this.loadBatchDetail(batch.rawId);
    this.loadBatchRequests(batch.rawId, 1);
    this.isBatchDetailModalOpen.set(true);
  }

  closeBatchDetailModal(isOpen: boolean): void {
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

  openRequestErrorModal(request: RequestHistoryRow): void {
    this.selectedRequestError.set(request);
    this.isRequestErrorModalOpen.set(true);
  }

  closeRequestErrorModal(isOpen: boolean): void {
    this.isRequestErrorModalOpen.set(isOpen);
  }

  onBatchDetailRefreshRequested(): void {
    const selected = this.selectedBatch();
    if (!selected) return;

    this.loadBatchDetail(selected.rawId);
    this.loadBatchRequests(selected.rawId, this.batchRequestsCurrentPage());
  }

  onHistoryNextPage(): void {
    if (!this.historyHasNextPage()) return;
    this.loadBatchesByPage(this.historyCurrentPage() + 1);
  }

  onHistoryPrevPage(): void {
    if (!this.historyHasPrevPage()) return;
    this.loadBatchesByPage(this.historyCurrentPage() - 1);
  }

  onHistoryFirstPage(): void {
    if (this.historyCurrentPage() === 1) return;
    this.loadBatchesByPage(1);
  }

  onHistoryLastPage(): void {
    const lastPage = this.historyLastPage();
    if (this.historyCurrentPage() === lastPage) return;
    this.loadBatchesByPage(lastPage);
  }

  onHistoryPageSizeChange(value: number): void {
    if (![5, 10, 20].includes(value)) return;
    this.historyPageSize.set(value);
    this.historyCurrentPage.set(1);
    this.loadBatchesByPage(1);
  }

  onBatchRequestsNextPage(): void {
    const selected = this.selectedBatch();
    if (!selected || !this.batchRequestsHasNextPage()) return;
    this.loadBatchRequests(selected.rawId, this.batchRequestsCurrentPage() + 1);
  }

  onBatchRequestsPrevPage(): void {
    const selected = this.selectedBatch();
    if (!selected || !this.batchRequestsHasPrevPage()) return;
    this.loadBatchRequests(selected.rawId, this.batchRequestsCurrentPage() - 1);
  }

  onBatchRequestsFirstPage(): void {
    const selected = this.selectedBatch();
    if (!selected || this.batchRequestsCurrentPage() === 1) return;
    this.loadBatchRequests(selected.rawId, 1);
  }

  onBatchRequestsLastPage(): void {
    const selected = this.selectedBatch();
    const lastPage = this.batchRequestsLastPage();
    if (!selected || this.batchRequestsCurrentPage() === lastPage) return;
    this.loadBatchRequests(selected.rawId, lastPage);
  }

  onBatchRequestsPageSizeChange(value: number): void {
    const selected = this.selectedBatch();
    if (!selected || ![5, 10, 20].includes(value)) return;
    this.batchRequestsPageSize.set(value);
    this.batchRequestsCurrentPage.set(1);
    this.loadBatchRequests(selected.rawId, 1);
  }

  historyFrom(): number {
    const total = this.historyTotal();
    if (total === 0) return 0;
    return (this.historyCurrentPage() - 1) * this.historyPageSize() + 1;
  }

  historyTo(): number {
    return Math.min(this.historyCurrentPage() * this.historyPageSize(), this.historyTotal());
  }

  batchRequestsFrom(): number {
    const total = this.batchRequestsTotal();
    if (total === 0) return 0;
    return (this.batchRequestsCurrentPage() - 1) * this.batchRequestsPageSize() + 1;
  }

  batchRequestsTo(): number {
    return Math.min(this.batchRequestsCurrentPage() * this.batchRequestsPageSize(), this.batchRequestsTotal());
  }

  private loadBatchesByPage(page: number): void {
    const safePage = Math.max(1, page);
    this.isLoadingHistory.set(true);

    this.batchService.getDistributorsBatches(this.historyPageSize(), safePage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
          console.error('Error loading distributors batches:', error);
          this.toastService.error(this.translateService.instant('FORECAST.DISTRIBUTORS.BULK_HISTORY_LOAD_ERROR'));
        }
      });
  }

  private loadBatchDetail(batchId: number | string): void {
    this.isLoadingBatchDetail.set(true);

    this.batchService.getBatchDetail(batchId, this.detailErrorsPerPage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.selectedBatchSummary.set(response.batch);
          this.selectedBatchErrors.set(response.errors.data ?? []);
          this.isLoadingBatchDetail.set(false);
        },
        error: (error) => {
          this.isLoadingBatchDetail.set(false);
          console.error(`Error loading batch detail ${String(batchId)}:`, error);
          this.toastService.error(this.translateService.instant('FORECAST.DISTRIBUTORS.BULK_HISTORY_LOAD_DETAIL_ERROR'));
        }
      });
  }

  private loadBatchRequests(batchId: number | string, page?: number): void {
    const safePage = Math.max(1, page ?? this.batchRequestsCurrentPage());
    this.isLoadingBatchRequests.set(true);

    this.batchService.getBatchRequests(batchId, this.batchRequestsPageSize(), safePage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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
          this.toastService.error(this.translateService.instant('FORECAST.DISTRIBUTORS.BULK_HISTORY_LOAD_REQUESTS_ERROR'));
        }
      });
  }

  private mapBatchToHistoryRow(batch: BatchSummary): BatchHistoryRow {
    return {
      idBatch: `BATCH-${String(batch.id).padStart(4, '0')}`,
      batchType: batch.batchType,
      requestTypeId: batch.requestTypeId ?? null,
      requestTypeName: batch.requestTypeName ?? null,
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
    const rawData = (item.rawData ?? {}) as Record<string, unknown>;
    const clientNumber = rawData['clientNumber'] ?? rawData['client_number'];
    const requestNumber = String(request['requestNumber'] ?? clientNumber ?? item.requestId ?? item.id ?? '-');
    const displayName = (rawData['businessName'] || rawData['business_name'])
      ? String(rawData['businessName'] ?? rawData['business_name'])
      : undefined;

    return {
      requestNumber,
      displayName,
      status: String(item.status ?? 'unknown'),
      errorMessage: this.resolveErrorMessage(item.errorLog),
      rawItem: item,
    };
  }

  private resolveErrorMessage(errorLog: unknown): string {
    if (!errorLog) {
      return this.translateService.instant('BULK.REQUEST_ERROR.NO_DETAIL');
    }

    if (typeof errorLog === 'string') {
      return errorLog;
    }

    if (typeof errorLog === 'object') {
      try {
        return JSON.stringify(errorLog, null, 2);
      } catch {
        return this.translateService.instant('BULK.REQUEST_ERROR.PARSE_ERROR');
      }
    }

    return String(errorLog);
  }

  private formatDate(value: string): string {
    if (!value) return '-';

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return value;

    return parsedDate.toLocaleString('es-MX', { timeZone: 'UTC' });
  }
}
