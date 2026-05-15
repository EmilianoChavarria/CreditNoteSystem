import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { TranslatePipe } from '@ngx-translate/core';

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

@Component({
  selector: 'app-bulk-history-tab',
  imports: [LucideAngularModule, TranslatePipe],
  templateUrl: './bulk-history-tab.html',
})
export class BulkHistoryTab {
  isLoadingHistory = input.required<boolean>();
  bulkHistoryRows = input.required<BatchHistoryRow[]>();
  historyFrom = input.required<number>();
  historyTo = input.required<number>();
  historyTotal = input.required<number>();
  historyPageSize = input.required<number>();
  historyCurrentPage = input.required<number>();
  historyLastPage = input.required<number>();
  historyHasPrevPage = input.required<boolean>();
  historyHasNextPage = input.required<boolean>();

  openBatchDetail = output<BatchHistoryRow>();
  historyPageSizeChange = output<number>();
  historyFirstPage = output<void>();
  historyPrevPage = output<void>();
  historyNextPage = output<void>();
  historyLastPageClick = output<void>();

  onOpenBatchDetail(batch: BatchHistoryRow): void {
    this.openBatchDetail.emit(batch);
  }

  onHistoryPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.historyPageSizeChange.emit(value);
  }

  batchTypeLabel(batchType: string): string {
    const normalizedBatchType = (batchType ?? '').trim();

    switch (normalizedBatchType) {
      case 'sapScreen':
        return 'BULK.HISTORY.BATCH_TYPES.SAP_SCREEN';
      case 'creditsData':
        return 'BULK.HISTORY.BATCH_TYPES.CREDITS_DATA';
      case 'orderNumbers':
        return 'BULK.HISTORY.BATCH_TYPES.ORDER_NUMBERS';
      case 'newRequest':
        return 'BULK.HISTORY.BATCH_TYPES.NEW_REQUEST';
      case 'uploadSupport':
        return 'BULK.HISTORY.BATCH_TYPES.UPLOAD_SUPPORT';
      case 'users':
        return 'BULK.HISTORY.BATCH_TYPES.USERS';
      default:
        return this.toTitleCase(normalizedBatchType.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' '));
    }
  }

  private toTitleCase(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  onStatusClass(status: string): string {
    const normalizedStatus = (status ?? '').toLowerCase();

    if (normalizedStatus === 'success' || normalizedStatus === 'completed' || normalizedStatus === 'emitted' || normalizedStatus === 'processed') {
      return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    }

    if (normalizedStatus === 'processing' || normalizedStatus === 'pending') {
      return 'bg-amber-100 text-amber-700 border border-amber-200';
    }

    return 'bg-red-100 text-red-700 border border-red-200';
  }

  statusLabel(status?: string): string {
    const normalizedStatus = (status ?? '').trim().toLowerCase();

    switch (normalizedStatus) {
      case 'completed':
        return 'BULK.STATUS.COMPLETED';
      case 'failed':
        return 'BULK.STATUS.FAILED';
      case 'processing':
        return 'BULK.STATUS.PROCESSING';
      case 'pending':
        return 'BULK.STATUS.PENDING';
      case 'success':
        return 'BULK.STATUS.SUCCESS';
      case 'emitted':
        return 'BULK.STATUS.EMITTED';
      case 'processed':
        return 'BULK.STATUS.PROCESSED';
      case 'error':
        return 'BULK.STATUS.ERROR';
      default:
        return normalizedStatus ? status ?? normalizedStatus : 'BULK.STATUS.UNKNOWN';
    }
  }
}
