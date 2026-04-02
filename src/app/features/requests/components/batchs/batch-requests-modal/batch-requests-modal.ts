import { Component, input, output } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Modal } from '../../../../../shared/components/ui/modal/modal';
import { Popover } from '../../../../../shared/components/ui/popover/popover';

interface BatchSummaryView {
  id?: number | string;
  status?: string;
  progressPercent?: number;
}

interface BatchErrorLogView {
  message?: string;
  detail?: string;
  [key: string]: unknown;
}

interface RequestHistoryRow {
  requestNumber: string;
  status: string;
  errorMessage?: string;
}

@Component({
  selector: 'app-batch-requests-modal',
  imports: [Modal, Popover, LucideAngularModule, JsonPipe],
  templateUrl: './batch-requests-modal.html',
})
export class BatchRequestsModal {
  open = input.required<boolean>();
  selectedBatchSummary = input<BatchSummaryView | null>(null);
  selectedBatchErrors = input.required<BatchErrorLogView[]>();
  isLoadingBatchRequests = input.required<boolean>();
  batchRequestRows = input.required<RequestHistoryRow[]>();
  batchRequestsFrom = input.required<number>();
  batchRequestsTo = input.required<number>();
  batchRequestsTotal = input.required<number>();
  batchRequestsPageSize = input.required<number>();
  batchRequestsCurrentPage = input.required<number>();
  batchRequestsLastPage = input.required<number>();
  batchRequestsHasPrevPage = input.required<boolean>();
  batchRequestsHasNextPage = input.required<boolean>();

  openChange = output<boolean>();
  openRequestError = output<RequestHistoryRow>();
  batchRequestsPageSizeChange = output<number>();
  batchRequestsFirstPage = output<void>();
  batchRequestsPrevPage = output<void>();
  batchRequestsNextPage = output<void>();
  batchRequestsLastPageClick = output<void>();

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

  onBatchRequestsPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.batchRequestsPageSizeChange.emit(value);
  }

  onOpenRequestError(request: RequestHistoryRow): void {
    this.openRequestError.emit(request);
  }
}
