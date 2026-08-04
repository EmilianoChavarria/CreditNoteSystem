import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize, map } from 'rxjs';
import {
  ChangeRequest,
  Distributor,
  ForecastService,
  GroupMemberSales,
  InvoiceProductsEntry,
  InvoiceSection,
  mapDistributorChangeRequestToChangeRequest,
  PendingRequest,
} from '../../../../core/services/forecast.service';
import { ExportService } from '../../../../core/services/export-service';
import { ForecastHistoryModal } from '../forecast-history-modal/forecast-history-modal';
import { ForecastInvoicesModal } from '../forecast-invoices-modal/forecast-invoices-modal';
import { ForecastInvoiceProductsModal } from '../forecast-invoice-products-modal/forecast-invoice-products-modal';
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
  sections: InvoiceSection[];
  loading: boolean;
}

interface ClientModalState {
  clientId: number;
  clientName: string;
}

interface InvoiceProductsState {
  clientName: string;
  folio: string;
  entry: InvoiceProductsEntry | null;
  loading: boolean;
}

@Component({
  selector: 'app-forecast-table',
  imports: [TranslatePipe, DecimalPipe, FormsModule, NgTemplateOutlet, LucideAngularModule, ForecastHistoryModal, ForecastInvoicesModal, ForecastInvoiceProductsModal, ForecastClientModal],
  templateUrl: './forecast-table.html',
  styleUrl: './forecast-table.css',
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
  readonly mode = input<'client' | 'distributor'>('client');

  readonly refreshNeeded = output<void>();

  readonly MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  readonly editingCell = signal<EditingCell | null>(null);
  readonly editingValue = signal('');
  private originalValue = 0;
  readonly submittingCell = signal<EditingCell | null>(null);
  readonly historyState = signal<HistoryState | null>(null);
  readonly invoicesState = signal<InvoicesState | null>(null);
  readonly exportingInvoices = signal(false);
  readonly invoiceProductsState = signal<InvoiceProductsState | null>(null);
  readonly clientModalState = signal<ClientModalState | null>(null);
  readonly expandedGroups = signal<Set<number>>(new Set());
  readonly closingGroups = signal<Set<number>>(new Set());

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

  toggleGroup(id: number): void {
    if (this.expandedGroups().has(id)) {
      this.closingGroups.update(current => new Set(current).add(id));
      setTimeout(() => {
        this.expandedGroups.update(current => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        this.closingGroups.update(current => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }, 180);
    } else {
      this.expandedGroups.update(current => new Set(current).add(id));
    }
  }

  isGroupExpanded(id: number): boolean {
    return this.expandedGroups().has(id);
  }

  isGroupClosing(id: number): boolean {
    return this.closingGroups().has(id);
  }

  groupRail(inGroup: boolean | undefined, isLast?: boolean): string | null {
    if (!inGroup) return null;
    const rail = 'inset 4px 0 0 0 #fb923c';
    return isLast ? `${rail}, inset 0 -3px 0 0 #fb923c` : rail;
  }

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
    const year = this.year();
    const month = monthIdx + 1;
    const request$ = this.mode() === 'distributor'
      ? this.forecastService.getDistributorHistory(dist.id, year, month).pipe(map(mapDistributorChangeRequestToChangeRequest))
      : this.forecastService.getHistory(dist.id, year, month);
    request$.subscribe({
      next: (reqs) => this.historyState.update(s => s ? { ...s, requests: reqs, loading: false } : null),
      error: () => this.historyState.update(s => s ? { ...s, loading: false } : null),
    });
  }

  closeHistory(): void {
    this.historyState.set(null);
  }

  openInvoices(dist: { id: number; name: string }, monthIdx: number): void {
    if (this.mode() === 'distributor') return;
    this.invoicesState.set({ clientId: dist.id, clientName: dist.name, monthIdx, sections: [], loading: true });
    this.forecastService.getInvoices(dist.id, this.year(), monthIdx + 1).subscribe({
      next: (sections) => this.invoicesState.update(s => s ? { ...s, sections, loading: false } : null),
      error: () => this.invoicesState.update(s => s ? { ...s, loading: false } : null),
    });
  }

  memberSalesTotal(member: GroupMemberSales): number {
    return member.monthlySales.reduce((s, v) => s + v, 0);
  }

  closeInvoices(): void {
    this.invoicesState.set(null);
  }

  viewInvoiceProducts(event: { clientId: number; clientName: string; folio: string }): void {
    const state = this.invoicesState();
    if (!state) return;

    this.invoiceProductsState.set({ clientName: event.clientName, folio: event.folio, entry: null, loading: true });
    const year = this.year();
    const month = state.monthIdx + 1;
    this.forecastService.getInvoiceProducts(event.clientId, year, month).subscribe({
      next: (entries) => {
        const entry = entries.find(e => e.folio === event.folio) ?? null;
        this.invoiceProductsState.update(s => s ? { ...s, entry, loading: false } : null);
      },
      error: () => this.invoiceProductsState.update(s => s ? { ...s, loading: false } : null),
    });
  }

  closeInvoiceProducts(): void {
    this.invoiceProductsState.set(null);
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
    if (this.mode() === 'distributor') return;
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
    const year = this.year();
    const month = monthIdx + 1;
    const amount = Math.round(raw);
    const request$ = this.mode() === 'distributor'
      ? this.forecastService.submitDistributorChangeRequest({ distributorId: clientId, year, month, forecast: amount }).pipe(map(() => void 0))
      : this.forecastService.submitChangeRequest({ idClient: clientId, year, month, amount }).pipe(map(() => void 0));
    request$.subscribe({
      next: () => {
        this.submittingCell.set(null);
        this.refreshNeeded.emit();
      },
      error: (err: unknown) => {
        this.submittingCell.set(null);
        const message = (err as { error?: { message?: string } })?.error?.message;
        this.toastr.error(message ?? this.translate.instant('FORECAST.TABLE.SUBMIT_ERROR'), this.translate.instant('FORECAST.SALES_MANAGE.TOAST_ERROR'));
      },
    });
  }

  handleKeydown(e: KeyboardEvent, clientId: number, monthIdx: number): void {
    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
    if (e.key === 'Escape') { e.preventDefault(); this.cancelEdit(); }
  }

  proposedValue(req: PendingRequest): number {
    return parseFloat(String(req.proposedAmount ?? req.proposedForecast ?? '0')) || 0;
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
