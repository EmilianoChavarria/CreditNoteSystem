import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { finalize, map, Observable } from 'rxjs';
import {
  ChangeRequest,
  ChangeRequestBatchResult,
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

/** Cambio capturado en la tabla que todavía no se ha enviado al backend. */
interface DraftChange {
  clientId: number;
  clientName: string;
  monthIdx: number;
  previous: number;
  proposed: number;
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
  /** Solo FORECAST ADMIN / SALES MANAGER pueden fijar el objetivo anual. */
  readonly canEditAnnualTarget = input<boolean>(false);

  readonly refreshNeeded = output<void>();

  readonly MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  readonly editingCell = signal<EditingCell | null>(null);
  readonly editingValue = signal('');
  private originalValue = 0;
  readonly submittingCell = signal<EditingCell | null>(null);

  /** Cambios capturados aún no enviados, indexados por `clientId:monthIdx`. */
  readonly drafts = signal<Map<string, DraftChange>>(new Map());
  readonly savingDrafts = signal(false);

  readonly historyState = signal<HistoryState | null>(null);
  readonly invoicesState = signal<InvoicesState | null>(null);
  readonly exportingInvoices = signal(false);
  readonly invoiceProductsState = signal<InvoiceProductsState | null>(null);
  readonly clientModalState = signal<ClientModalState | null>(null);
  readonly editingTargetId = signal<number | null>(null);
  readonly editingTargetValue = signal('');
  readonly savingTargetId = signal<number | null>(null);
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

  // -------------------------------------------------------------------------
  // Objetivo anual (techo): la suma de los 12 meses no puede rebasarlo
  // -------------------------------------------------------------------------

  /** Total del año contando los cambios en borrador aún sin enviar. */
  projectedTotal(dist: Distributor): number {
    return dist.months.reduce(
      (s, m, i) => s + (this.draftValue(dist.id, i) ?? m.forecast),
      0
    );
  }

  /** true si el total proyectado rebasa el objetivo anual del distribuidor. */
  exceedsTarget(dist: Distributor): boolean {
    const target = dist.annualTarget;
    if (target === null || target === undefined) return false;
    return this.projectedTotal(dist) > target + 0.01;
  }

  /** Cuánto sobra (positivo) respecto al objetivo anual. */
  overTargetBy(dist: Distributor): number {
    const target = dist.annualTarget ?? 0;
    return Math.max(0, this.projectedTotal(dist) - target);
  }

  /** Lo que aún cabe en el año sin rebasar el objetivo. */
  remainingTarget(dist: Distributor): number {
    const target = dist.annualTarget;
    if (target === null || target === undefined) return 0;
    return target - this.projectedTotal(dist);
  }

  /** Filas con cambios en borrador que rebasarían el objetivo anual: no se pueden enviar. */
  readonly blockedRows = computed(() => {
    const draftedIds = new Set(this.draftList().map(d => d.clientId));
    return this.distributors().filter(d => draftedIds.has(d.id) && this.exceedsTarget(d));
  });

  readonly hasBlockedRows = computed(() => this.blockedRows().length > 0);

  readonly blockedRowNames = computed(() => this.blockedRows().map(d => d.name).join(', '));

  /** Fila con cambios capturados que no se pueden enviar por rebasar el objetivo anual. */
  isBlocked(dist: Distributor): boolean {
    return this.exceedsTarget(dist) && this.hasDraftsFor(dist.id);
  }

  hasDraftsFor(clientId: number): boolean {
    return [...this.drafts().values()].some(d => d.clientId === clientId);
  }

  private annualTargetType(): 'cliente' | 'clienteExtranjero' {
    return this.mode() === 'distributor' ? 'clienteExtranjero' : 'cliente';
  }

  isEditingTarget(clientId: number): boolean {
    return this.editingTargetId() === clientId;
  }

  startEditTarget(dist: Distributor): void {
    if (!this.canEditAnnualTarget() || this.savingTargetId() !== null) return;
    this.editingTargetId.set(dist.id);
    this.editingTargetValue.set(dist.annualTarget !== null ? String(dist.annualTarget) : '');
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input.fc-target-input')?.select();
    });
  }

  cancelEditTarget(): void {
    this.editingTargetId.set(null);
  }

  /** Guarda el objetivo anual. Vacío = se elimina el techo del distribuidor. */
  commitTargetEdit(dist: Distributor): void {
    const raw = this.editingTargetValue().replace(/[^0-9.]/g, '');
    this.editingTargetId.set(null);

    const amount = raw === '' ? null : parseFloat(raw);
    if (amount !== null && (isNaN(amount) || amount < 0)) return;
    if (amount === dist.annualTarget) return;

    this.savingTargetId.set(dist.id);
    this.forecastService.setAnnualTarget(this.annualTargetType(), dist.id, this.year(), amount).pipe(
      finalize(() => this.savingTargetId.set(null))
    ).subscribe({
      next: () => {
        this.toastr.success(this.translate.instant('FORECAST.TABLE.ANNUAL_TARGET_SAVED'));
        this.refreshNeeded.emit();
      },
      error: (err: unknown) => {
        const message = (err as { error?: { message?: string } })?.error?.message;
        this.toastr.error(message ?? this.translate.instant('FORECAST.TABLE.ANNUAL_TARGET_ERROR'));
      },
    });
  }

  handleTargetKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLElement).blur(); }
    if (e.key === 'Escape') { e.preventDefault(); this.cancelEditTarget(); }
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
      // El input arranca con el valor en borrador si ya se editó esta celda,
      // pero el original sigue siendo el forecast vigente.
      this.startEdit(dist.id, monthIdx, this.draftValue(dist.id, monthIdx) ?? m.forecast, m.forecast);
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
    this.forecastService.getInvoices(dist.id, this.year(), monthIdx + 1, 'USD').subscribe({
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
    this.forecastService.getInvoiceProducts(event.clientId, year, month, 'USD').subscribe({
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
    this.forecastService.exportInvoicesExcel(state.clientId, year, month, 'USD').pipe(
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

  startEdit(clientId: number, monthIdx: number, current: number, original: number = current): void {
    this.editingCell.set({ clientId, monthIdx });
    this.editingValue.set(String(current));
    this.originalValue = original;
    setTimeout(() => {
      document.querySelector<HTMLInputElement>('input.fc-edit-input')?.select();
    });
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  // -------------------------------------------------------------------------
  // Cambios en borrador (se envían todos juntos con "Guardar cambios")
  // -------------------------------------------------------------------------

  private draftKey(clientId: number, monthIdx: number): string {
    return `${clientId}:${monthIdx}`;
  }

  readonly draftList = computed(() =>
    [...this.drafts().values()].sort((a, b) =>
      a.clientName.localeCompare(b.clientName) || a.monthIdx - b.monthIdx
    )
  );

  readonly draftCount = computed(() => this.drafts().size);

  readonly draftClientCount = computed(() => new Set(this.draftList().map(d => d.clientId)).size);

  hasDrafts(): boolean {
    return this.drafts().size > 0;
  }

  isDraft(clientId: number, monthIdx: number): boolean {
    return this.drafts().has(this.draftKey(clientId, monthIdx));
  }

  draftValue(clientId: number, monthIdx: number): number | null {
    return this.drafts().get(this.draftKey(clientId, monthIdx))?.proposed ?? null;
  }

  /** Guarda el valor capturado en el borrador. No envía nada al backend. */
  commitEdit(dist: Distributor, monthIdx: number): void {
    const raw = parseFloat(this.editingValue().replace(/[^0-9.]/g, ''));
    this.editingCell.set(null);
    if (isNaN(raw) || raw < 0) return;

    const proposed = Math.round(raw);
    const key = this.draftKey(dist.id, monthIdx);

    this.drafts.update(current => {
      const next = new Map(current);
      // Volver al valor original equivale a descartar el cambio.
      if (proposed === this.originalValue) {
        next.delete(key);
      } else {
        next.set(key, {
          clientId: dist.id,
          clientName: dist.name,
          monthIdx,
          previous: this.originalValue,
          proposed,
        });
      }
      return next;
    });

    // Aviso inmediato: la fila queda marcada y no se podrá enviar así.
    if (this.exceedsTarget(dist)) {
      this.toastr.warning(
        this.translate.instant('FORECAST.TABLE.ANNUAL_TARGET_EXCEEDED_TOAST', {
          client: dist.name,
          over: Math.round(this.overTargetBy(dist)).toLocaleString(),
        })
      );
    }
  }

  discardDraft(clientId: number, monthIdx: number): void {
    this.drafts.update(current => {
      const next = new Map(current);
      next.delete(this.draftKey(clientId, monthIdx));
      return next;
    });
  }

  discardAllDrafts(): void {
    this.drafts.set(new Map());
    this.editingCell.set(null);
  }

  /** Envía todos los cambios capturados en una sola petición. */
  saveDrafts(): void {
    const drafts = this.draftList();
    if (drafts.length === 0 || this.savingDrafts()) return;

    // Bloqueo duro: mientras una fila rebase su objetivo anual no se envía nada.
    if (this.hasBlockedRows()) {
      this.toastr.error(
        this.translate.instant('FORECAST.TABLE.ANNUAL_TARGET_BLOCKED_TOAST', { clients: this.blockedRowNames() })
      );
      return;
    }

    this.savingDrafts.set(true);
    const year = this.year();

    const request$: Observable<ChangeRequestBatchResult<unknown>> = this.mode() === 'distributor'
      ? this.forecastService.submitDistributorChangeRequestBatch(
          drafts.map(d => ({ distributorId: d.clientId, year, month: d.monthIdx + 1, forecast: d.proposed }))
        )
      : this.forecastService.submitChangeRequestBatch(
          drafts.map(d => ({ idClient: d.clientId, year, month: d.monthIdx + 1, amount: d.proposed }))
        );

    request$.pipe(finalize(() => this.savingDrafts.set(false))).subscribe({
      next: (result) => {
        this.drafts.set(new Map());
        this.toastr.success(
          this.translate.instant('FORECAST.TABLE.BATCH_SAVED', { count: result.created.length })
        );
        for (const err of result.errors ?? []) {
          this.toastr.warning(`${err.clientName ?? ''} · ${this.MONTHS[err.month - 1]}: ${err.message}`);
        }
        this.refreshNeeded.emit();
      },
      error: (err: unknown) => {
        const message = (err as { error?: { message?: string } })?.error?.message;
        this.toastr.error(
          message ?? this.translate.instant('FORECAST.TABLE.SUBMIT_ERROR'),
          this.translate.instant('FORECAST.SALES_MANAGE.TOAST_ERROR')
        );
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
