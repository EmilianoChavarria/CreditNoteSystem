import { Component, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

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
  imports: [LucideAngularModule],
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
}
