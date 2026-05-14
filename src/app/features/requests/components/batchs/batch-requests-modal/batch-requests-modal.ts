import { Component, computed, effect, input, OnDestroy, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Modal } from '../../../../../shared/components/ui/modal/modal';
import { Popover } from '../../../../../shared/components/ui/popover/popover';
import { TranslatePipe } from '@ngx-translate/core';

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
  displayName?: string;
}

@Component({
  selector: 'app-batch-requests-modal',
  imports: [Modal, Popover, LucideAngularModule, TranslatePipe, FormsModule],
  templateUrl: './batch-requests-modal.html',
})
export class BatchRequestsModal implements OnDestroy {
  open = input<boolean>(false);
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

  statusFilter = signal<'all' | 'success' | 'error'>('all');
  refreshIntervalSeconds = signal<number>(30);
  secondsUntilRefresh = signal<number>(30);
  isRefreshPaused = signal<boolean>(false);
  private refreshTimerId: ReturnType<typeof setInterval> | null = null;

  shouldShowRefreshControls = computed(() => Number(this.selectedBatchSummary()?.progressPercent ?? 0) < 100);

  filteredRows = computed(() => {
    const filter = this.statusFilter();
    const rows = this.batchRequestRows();
    if (filter === 'all') return rows;
    if (filter === 'error') return rows.filter(r => r.status === 'error');
    return rows.filter(r => r.status !== 'error');
  });

  openChange = output<boolean>();
  openRequestError = output<RequestHistoryRow>();
  batchRequestsPageSizeChange = output<number>();
  batchRequestsFirstPage = output<void>();
  batchRequestsPrevPage = output<void>();
  batchRequestsNextPage = output<void>();
  batchRequestsLastPageClick = output<void>();
  refreshRequested = output<void>();

  constructor() {
    effect(() => {
      if (this.open() && this.shouldShowRefreshControls()) {
        this.startRefreshTimer();
        return;
      }

      this.stopRefreshTimer();
      this.resetRefreshCountdown();
    });
  }

  ngOnDestroy(): void {
    this.stopRefreshTimer();
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

  onBatchRequestsPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    this.batchRequestsPageSizeChange.emit(value);
  }

  onStatusFilterChange(value: 'all' | 'success' | 'error'): void {
    this.statusFilter.set(value);
  }

  onRefreshIntervalChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (![30, 60, 120].includes(value)) {
      return;
    }

    this.refreshIntervalSeconds.set(value);
    this.secondsUntilRefresh.set(value);
  }

  onRefreshNow(): void {
    if (!this.shouldShowRefreshControls()) {
      return;
    }

    this.refreshRequested.emit();
    this.resetRefreshCountdown();
  }

  toggleRefreshPause(): void {
    this.isRefreshPaused.update((value) => !value);
  }

  onOpenRequestError(request: RequestHistoryRow): void {
    this.openRequestError.emit(request);
  }

  private startRefreshTimer(): void {
    if (this.refreshTimerId) {
      return;
    }

    this.resetRefreshCountdown();
    this.refreshTimerId = setInterval(() => {
      if (this.isRefreshPaused()) {
        return;
      }

      if (!this.shouldShowRefreshControls()) {
        this.stopRefreshTimer();
        this.resetRefreshCountdown();
        return;
      }

      const nextSeconds = this.secondsUntilRefresh() - 1;
      if (nextSeconds <= 0) {
        this.refreshRequested.emit();
        this.resetRefreshCountdown();
        return;
      }

      this.secondsUntilRefresh.set(nextSeconds);
    }, 1000);
  }

  private stopRefreshTimer(): void {
    if (!this.refreshTimerId) {
      return;
    }

    clearInterval(this.refreshTimerId);
    this.refreshTimerId = null;
  }

  private resetRefreshCountdown(): void {
    this.secondsUntilRefresh.set(this.refreshIntervalSeconds());
  }
}
