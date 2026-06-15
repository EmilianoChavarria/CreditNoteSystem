import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import {
  ChangeRequest,
  Distributor,
  ForecastService,
} from '../../../../core/services/forecast.service';
import { ForecastHistoryModal } from '../forecast-history-modal/forecast-history-modal';

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

@Component({
  selector: 'app-forecast-table',
  imports: [DecimalPipe, FormsModule, ForecastHistoryModal],
  templateUrl: './forecast-table.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastTable {
  private readonly forecastService = inject(ForecastService);
  private readonly toastr = inject(ToastrService);

  readonly distributors = input.required<Distributor[]>();
  readonly year = input.required<number>();
  readonly loading = input<boolean>(false);

  readonly refreshNeeded = output<void>();

  readonly MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  readonly editingCell = signal<EditingCell | null>(null);
  readonly editingValue = signal('');
  readonly submittingCell = signal<EditingCell | null>(null);
  readonly historyState = signal<HistoryState | null>(null);

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

  isEditing(clientId: number, monthIdx: number): boolean {
    const c = this.editingCell();
    return c?.clientId === clientId && c?.monthIdx === monthIdx;
  }

  isSubmitting(clientId: number, monthIdx: number): boolean {
    const c = this.submittingCell();
    return c?.clientId === clientId && c?.monthIdx === monthIdx;
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
    if (m.pendingRequest?.status !== 'pending' && !this.isSubmitting(dist.id, monthIdx)) {
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

  startEdit(clientId: number, monthIdx: number, current: number): void {
    this.editingCell.set({ clientId, monthIdx });
    this.editingValue.set(String(current));
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
        this.toastr.error(err?.error?.message ?? 'No se pudo enviar la solicitud.', 'Error');
      },
    });
  }

  handleKeydown(e: KeyboardEvent, clientId: number, monthIdx: number): void {
    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
    if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
  }

  stepTooltip(step: 'sales_manager' | 'general_manager'): string {
    return step === 'sales_manager' ? 'Esperando aprobación de Sales Manager' : 'Esperando aprobación de General Manager';
  }

  monthLabel(idx: number): string {
    return `${this.MONTHS[idx]} ${this.year()}`;
  }
}
