import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';
import {
  ChangeRequest,
  Distributor,
  ForecastService,
  Invoice,
} from '../../../../core/services/forecast.service';
import { ExportService } from '../../../../core/services/export-service';
import { ForecastHistoryModal } from '../forecast-history-modal/forecast-history-modal';
import { ForecastInvoicesModal } from '../forecast-invoices-modal/forecast-invoices-modal';
import { ForecastClientModal } from '../forecast-client-modal/forecast-client-modal';

interface EditingCell {
  clientId: number;
  monthIdx: number;
}

interface HistoryState {
  clientName: string;
  monthIdx: number;
  requests: ChangeRequest[];
  loading: boolean;
}

interface InvoicesState {
  clientId: number;
  clientName: string;
  monthIdx: number;
  invoices: Invoice[];
  loading: boolean;
}

interface ClientModalState {
  clientId: number;
  clientName: string;
}

@Component({
  selector: 'app-forecast-table',
  imports: [TranslatePipe, DecimalPipe, FormsModule, ForecastHistoryModal, ForecastInvoicesModal, ForecastClientModal],
  templateUrl: './forecast-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastTable {
  private readonly forecastService = inject(ForecastService);
  private readonly exportService = inject(ExportService);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);

  readonly distributors = input.required<Distributor[]>();
  readonly year = input.required<number>();
  readonly loading = input<boolean>(false);

  readonly refreshNeeded = output<void>();

  readonly MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  readonly editingCell = signal<EditingCell | null>(null);
  readonly editingValue = signal('');
  private originalValue = 0;
  readonly submittingCell = signal<EditingCell | null>(null);
  readonly historyState = signal<HistoryState | null>(null);
  readonly invoicesState = signal<InvoicesState | null>(null);
  readonly exportingInvoices = signal(false);
  readonly clientModalState = signal<ClientModalState | null>(null);

  private clickTimer: ReturnType<typeof setTimeout> | null = null;

  readonly colTotals = computed(() =>
    Array.from({ length: 12 }, (_, i) =>
      this.distributors().reduce((s, d) => s + d.months[i].forecast, 0)
    )
  );

  readonly grandTotal = computed(() =>
    this.distributors().reduce(
      (s, d) => s + d.months.reduce((ms, m) => ms + m.forecast, 0),
      0
    )
  );

  hasAnyPending(dist: Distributor): boolean {
    return dist.months.some(m => m.pendingRequest?.status === 'pending');
  }

  rowTotal(dist: Distributor): number {
    return dist.months.reduce((s, m) => s + m.forecast, 0);
  }

  rowSalesTotal(dist: Distributor): number {
    return dist.months.reduce((s, m) => s + m.sales, 0);
  }

  isEditing(clientId: number, monthIdx: number): boolean {
    const c = this.editingCell();
    return c?.clientId === clientId && c?.monthIdx === monthIdx;
  }

  isSubmitting(clientId: number, monthIdx: number): boolean {
    const c = this.submittingCell();
    return c?.clientId === clientId && c?.monthIdx === monthIdx;
  }

  isEditableMonth(monthIdx: number): boolean {
    const now = new Date();
    if (this.year() < now.getFullYear()) return true;
    if (this.year() > now.getFullYear()) return false;
    return monthIdx <= now.getMonth();
  }

  onCellClick(dist: Distributor, monthIdx: number): void {
    this.clickTimer = setTimeout(() => {
      this.clickTimer = null;
      this.openHistory(dist, monthIdx);
    }, 220);
  }

  onCellDblClick(dist: Distributor, monthIdx: number): void {
    if (this.clickTimer) {
      clearTimeout(this.clickTimer);
      this.clickTimer = null;
    }
    const m = dist.months[monthIdx];
    if (this.isEditableMonth(monthIdx) && m.pendingRequest?.status !== 'pending' && !this.isSubmitting(dist.id, monthIdx)) {
      this.startEdit(dist.id, monthIdx, m.forecast);
    }
  }

  openHistory(dist: Distributor, monthIdx: number): void {
    this.historyState.set({ clientName: dist.name, monthIdx, requests: [], loading: true });
    this.forecastService.getHistory(dist.id, this.year(), monthIdx + 1).subscribe({
      next: (reqs) => this.historyState.update(s => s ? { ...s, requests: reqs, loading: false } : null),
      error: () => this.historyState.update(s => s ? { ...s, loading: false } : null),
    });
  }

  closeHistory(): void {
    this.historyState.set(null);
  }

  openInvoices(dist: Distributor, monthIdx: number): void {
    this.invoicesState.set({ clientId: dist.id, clientName: dist.name, monthIdx, invoices: [], loading: true });
    this.forecastService.getInvoices(dist.id, this.year(), monthIdx + 1).subscribe({
      next: (invoices) => this.invoicesState.update(s => s ? { ...s, invoices, loading: false } : null),
      error: () => this.invoicesState.update(s => s ? { ...s, loading: false } : null),
    });
  }

  closeInvoices(): void {
    this.invoicesState.set(null);
  }

  exportInvoices(): void {
    const state = this.invoicesState();
    if (!state || this.exportingInvoices()) {
      return;
    }

    const year = this.year();
    const month = state.monthIdx + 1;
    this.exportingInvoices.set(true);
    this.forecastService.exportInvoicesExcel(state.clientId, year, month).pipe(
      finalize(() => this.exportingInvoices.set(false))
    ).subscribe({
      next: (blob) => {
        const fileName = `facturas_${state.clientName.trim().replace(/\s+/g, '_')}_${year}_${month}.xlsx`;
        this.exportService.downloadBlob(blob, fileName);
      },
      error: () => this.toastr.error(this.translate.instant('FORECAST.TABLE.EXPORT_ERROR')),
    });
  }

  openClientModal(dist: Distributor): void {
    this.clientModalState.set({ clientId: dist.id, clientName: dist.name });
  }

  closeClientModal(): void {
    this.clientModalState.set(null);
  }

  startEdit(clientId: number, monthIdx: number, current: number): void {
    this.editingCell.set({ clientId, monthIdx });
    this.editingValue.set(String(current));
    this.originalValue = current;
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input.fc-edit-input')?.select();
    });
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  submitChangeRequest(clientId: number, monthIdx: number): void {
    const raw = parseFloat(this.editingValue().replace(/[^0-9.]/g, ''));
    this.editingCell.set(null);
    if (isNaN(raw) || raw < 0) return;
    if (Math.round(raw) === this.originalValue) return;

    this.submittingCell.set({ clientId, monthIdx });
    this.forecastService.submitChangeRequest({
      idClient: clientId,
      year: this.year(),
      month: monthIdx + 1,
      amount: Math.round(raw),
    }).subscribe({
      next: () => {
        this.submittingCell.set(null);
        this.refreshNeeded.emit();
      },
      error: (err) => {
        this.submittingCell.set(null);
        this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.TABLE.SUBMIT_ERROR'), this.translate.instant('FORECAST.SALES_MANAGE.TOAST_ERROR'));
      },
    });
  }

  handleKeydown(e: KeyboardEvent, clientId: number, monthIdx: number): void {
    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
    if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
  }

  stepTooltip(step: 'sales_manager' | 'general_manager'): string {
    return step === 'sales_manager'
      ? this.translate.instant('FORECAST.TABLE.AWAIT_SALES_MANAGER')
      : this.translate.instant('FORECAST.TABLE.AWAIT_GENERAL_MANAGER');
  }

  monthLabel(idx: number): string {
    return `${this.MONTHS[idx]} ${this.year()}`;
  }
}
