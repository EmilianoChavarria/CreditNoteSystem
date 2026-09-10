import { Component, computed, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { LucideAngularModule } from "lucide-angular";
import { Observable, finalize, map, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CustomerCurrency,
  ForecastCreditNote,
  ForecastEntityType,
  ForecastGroupMemberBreakdown,
  ForecastGroupMonthBreakdown,
  ForecastService,
  ForecastSummaryMonth,
  InvoiceProductsEntry,
  InvoiceSection,
} from '../../../../core/services/forecast.service';
import { ExportService } from '../../../../core/services/export-service';
import { RequestService } from '../../../../core/services/request-service';
import { AuthService } from '../../../../core/services/auth-service';
import { SalesEngineerAssignmentService } from '../../../../core/services/sales-engineer-assignment.service';
import { AssignmentUser } from '../../../../core/services/user-assignment-service';
import { AutocompleteOption } from '../../../../shared/components/ui/autocomplete/autocomplete';
import { GroupedAutocomplete, AutocompleteOptionGroup } from '../../../../shared/components/ui/grouped-autocomplete/grouped-autocomplete';
import { ForecastInvoicesModal } from '../../components/forecast-invoices-modal/forecast-invoices-modal';
import { ForecastInvoiceProductsModal } from '../../components/forecast-invoice-products-modal/forecast-invoice-products-modal';
import { GenerateCreditNoteModal } from '../../components/generate-credit-note-modal/generate-credit-note-modal';

type StatusFilter = 'all' | 'met' | 'missed' | 'pending-note' | 'with-note';

interface SelectedEntity {
  tipo: ForecastEntityType;
  id: number;
  nombre: string;
}

interface SummaryRow extends ForecastSummaryMonth {
  monthLabel: string;
  cumplido: boolean | null;
}

const CUMPLIMIENTO_THRESHOLD = 97;

interface InvoicesState {
  clientId: number;
  clientName: string;
  monthLabel: string;
  year: number;
  month: number;
  sections: InvoiceSection[];
  loading: boolean;
}

interface InvoiceProductsState {
  clientName: string;
  folio: string;
  entry: InvoiceProductsEntry | null;
  loading: boolean;
}

@Component({
  selector: 'app-credit-notes',
  imports: [
    TranslatePipe,
    LucideAngularModule,
    GroupedAutocomplete,
    CurrencyPipe,
    DecimalPipe,
    DatePipe,
    ForecastInvoicesModal,
    ForecastInvoiceProductsModal,
    GenerateCreditNoteModal,
  ],
  templateUrl: './credit-notes.html',
  styleUrl: './credit-notes.css',
})
export class CreditNotes {
  readonly years = [2024, 2025, 2026];

  readonly monthsLong = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  readonly monthsShort = [
    'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC',
  ];

  readonly entityControl = new FormControl<AutocompleteOption | null>(null);

  readonly year = signal(new Date().getFullYear());
  readonly entity = signal('all');
  readonly month = signal('all');
  readonly status = signal<StatusFilter>('all');
  readonly tab = signal<'active' | 'history'>('active');

  readonly selectedEntity = signal<SelectedEntity | null>(null);
  readonly loadingSummary = signal(false);
  readonly summaryMonths = signal<ForecastSummaryMonth[]>([]);
  /** Moneda del cliente/grupo seleccionado: en ella se muestran ventas, retorno y NC. */
  readonly currency = signal<CustomerCurrency>('USD');

  readonly invoicesState = signal<InvoicesState | null>(null);
  readonly exportingInvoices = signal(false);
  readonly invoiceProductsState = signal<InvoiceProductsState | null>(null);

  readonly creditNotesHistory = signal<ForecastCreditNote[]>([]);
  readonly loadingHistory = signal(false);

  /** Solo el FORECAST ADMIN calcula cumplimiento y genera notas. */
  readonly isForecastAdmin = signal(false);
  readonly isSalesManager = signal(false);
  /** Solo el admin acota por ingeniero; SE y SM comparten año, mes y cliente. */
  readonly canFilterByEngineer = computed(() => this.isForecastAdmin());
  readonly engineers = signal<AssignmentUser[]>([]);
  readonly historyEngineerId = signal<number | null>(null);

  readonly expandedMes = signal<number | null>(null);
  readonly loadingBreakdown = signal<number | null>(null);
  private readonly breakdownCache = signal<Map<number, ForecastGroupMonthBreakdown>>(new Map());

  readonly generateTarget = signal<SummaryRow | null>(null);
  readonly generateModalOpen = signal(false);
  readonly generatingNC = signal(false);
  readonly generateError = signal<string | null>(null);
  readonly loadingGenerateMembers = signal(false);

  readonly stats = computed(() => ({ pending: 0 }));

  readonly summaryRows = computed<SummaryRow[]>(() =>
    this.summaryMonths().map((m) => ({
      ...m,
      monthLabel: `${this.monthsShort[m.mes - 1]} ${this.year()}`,
      cumplido: m.porcentajeCumplimiento == null ? null : m.porcentajeCumplimiento >= CUMPLIMIENTO_THRESHOLD,
    }))
  );

  constructor(
    private readonly forecastService: ForecastService,
    private readonly exportService: ExportService,
    private readonly toastr: ToastrService,
    private readonly requestService: RequestService,
    private readonly authService: AuthService,
    private readonly seAssignmentService: SalesEngineerAssignmentService,
    private readonly translate: TranslateService,
  ) {
    const roleName = this.authService.getCurrentUser()?.roleName?.trim().toUpperCase();
    const isAdmin = roleName === 'FORECAST ADMIN';
    const isManager = roleName === 'SALES ENGINEER / MANAGER';

    this.isForecastAdmin.set(isAdmin);
    this.isSalesManager.set(isManager);

    // Sales engineer y manager entran directo al historial: no ven cumplimiento.
    if (!isAdmin) {
      this.tab.set('history');
    }

    if (isAdmin || isManager) {
      this.loadEngineers(isAdmin ? 'all' : 'my');
    }

    this.loadScopedHistory();
  }

  /** Historial global acotado por el backend según el rol. */
  loadScopedHistory(): void {
    const entity = this.selectedEntity();

    const month = this.month() === 'all' ? undefined : Number(this.month()) + 1;

    this.loadingHistory.set(true);
    this.forecastService.getForecastCreditNotesHistory({
      year: this.year(),
      month,
      salesEngineerId: this.historyEngineerId() ?? undefined,
      tipo: entity && entity.tipo !== 'clienteExtranjero' ? entity.tipo : undefined,
      id: entity && entity.tipo !== 'clienteExtranjero' ? entity.id : undefined,
    }).pipe(finalize(() => this.loadingHistory.set(false)))
      .subscribe({
        next: (history) => this.creditNotesHistory.set(history),
        error: (err) => {
          this.creditNotesHistory.set([]);
          this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.CREDIT_NOTES.HISTORY_ERROR'));
        },
      });
  }

  onHistoryEngineerChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;

    this.historyEngineerId.set(value ? Number(value) : null);
    this.loadScopedHistory();
  }

  onHistoryYearChange(event: Event): void {
    this.year.set(Number((event.target as HTMLSelectElement).value));

    const entity = this.selectedEntity();
    if (entity) {
      this.loadSummary(entity);
    } else {
      this.loadScopedHistory();
    }
  }

  private loadEngineers(scope: 'my' | 'all'): void {
    const request$ = scope === 'all'
      ? this.seAssignmentService.getAllEngineers()
      : this.seAssignmentService.getMyEngineers();

    request$.subscribe({
      next: (engineers) => this.engineers.set(engineers),
      error: () => this.engineers.set([]),
    });
  }

  viewNotePdf(requestId: number): void {
    this.requestService.getRequestPdf(requestId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      },
      error: () => this.toastr.error(this.translate.instant('FORECAST.CREDIT_NOTES.PDF_ERROR')),
    });
  }

  setYear(year: number): void {
    this.year.set(year);
    const entity = this.selectedEntity();
    if (entity) {
      this.loadSummary(entity);
    }
  }

  searchEntities(term: string): Observable<AutocompleteOptionGroup[]> {
    if (!term || term.trim().length === 0) {
      return of([]);
    }

    return this.forecastService.searchForecastEntities(term.trim()).pipe(
      map((results) => [
        {
          groupLabel: this.translate.instant('FORECAST.CREDIT_NOTES.GROUP_SECTION_GROUPS'),
          options: results.grupos.map((g) => ({
            id: `group:${g.id}`,
            label: g.nombre,
            data: g,
          })),
        },
        {
          groupLabel: this.translate.instant('FORECAST.CREDIT_NOTES.GROUP_SECTION_CLIENTS'),
          options: results.clientes.map((c) => ({
            id: `client:${c.id}`,
            label: `${c.numeroCliente} — ${c.nombre}`,
            data: c,
          })),
        },
        {
          groupLabel: this.translate.instant('FORECAST.CREDIT_NOTES.GROUP_SECTION_FOREIGN'),
          options: results.clientesExtranjeros.map((c) => ({
            id: `clientExt:${c.id}`,
            label: `${c.numeroCliente} — ${c.nombre}`,
            data: c,
          })),
        },
      ])
    );
  }

  onEntitySelected(option: AutocompleteOption): void {
    if (!option) {
      this.entity.set('all');
      this.selectedEntity.set(null);
      this.summaryMonths.set([]);
      this.currency.set('USD');
      this.loadScopedHistory();
      return;
    }

    this.entity.set(String(option.id));

    const entity: SelectedEntity = {
      tipo: option['data'].tipo,
      id: option['data'].id,
      nombre: option['data'].nombre,
    };
    this.selectedEntity.set(entity);
    this.loadSummary(entity);
  }

  onMonthChange(event: Event): void {
    this.month.set((event.target as HTMLSelectElement).value);
    this.loadScopedHistory();
  }

  onStatusChange(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  private loadSummary(entity: SelectedEntity): void {
    this.loadingSummary.set(true);
    this.forecastService.getForecastSummary(entity.tipo, entity.id, this.year()).subscribe({
      next: (summary) => {
        this.summaryMonths.set(summary?.meses ?? []);
        this.currency.set(summary?.moneda ?? 'USD');
        this.loadingSummary.set(false);
      },
      error: () => {
        this.summaryMonths.set([]);
        this.currency.set('USD');
        this.loadingSummary.set(false);
      },
    });
    this.loadHistory(entity);
  }

  /** El historial siempre sale del endpoint global: respeta la cartera del rol. */
  private loadHistory(_entity: SelectedEntity): void {
    this.loadScopedHistory();
  }

  /** NC ya generadas para ese mes del año seleccionado (puede ser >1 si la entidad es un grupo). */
  generatedNotesFor(mes: number): ForecastCreditNote[] {
    return this.creditNotesHistory().filter(h => h.month === mes && h.year === this.year());
  }

  canGenerateNC(row: SummaryRow): boolean {
    const entity = this.selectedEntity();
    return !!entity && entity.tipo !== 'clienteExtranjero' && !!row.cumplido && this.generatedNotesFor(row.mes).length === 0;
  }

  openGenerateNC(row: SummaryRow): void {
    if (!this.canGenerateNC(row)) return;
    const entity = this.selectedEntity();

    this.generateTarget.set(row);
    this.generateError.set(null);
    this.generateModalOpen.set(true);

    if (entity?.tipo === 'grupo') {
      this.ensureBreakdownLoaded(entity, row.mes, this.loadingGenerateMembers);
    }
  }

  cancelGenerateNC(): void {
    if (this.generatingNC()) return;
    this.generateModalOpen.set(false);
    this.generateTarget.set(null);
  }

  /** Miembros del grupo que recibirán NC este mes: aportaron venta considerada y aún no tienen nota. */
  contributingMembersFor(row: SummaryRow): ForecastGroupMemberBreakdown[] {
    return (this.breakdownFor(row.mes)?.members ?? []).filter(m => m.folioCount > 0 && !m.note);
  }

  confirmGenerateNC(attachments: File[]): void {
    const entity = this.selectedEntity();
    const row = this.generateTarget();
    if (!entity || !row || this.generatingNC() || entity.tipo === 'clienteExtranjero') return;

    this.generatingNC.set(true);
    this.generateError.set(null);
    this.forecastService.generateForecastCreditNote(entity.tipo, entity.id, this.year(), row.mes, attachments)
      .pipe(finalize(() => this.generatingNC.set(false)))
      .subscribe({
        next: (result) => {
          this.generateModalOpen.set(false);
          this.generateTarget.set(null);

          const count = result.created.length;
          this.toastr.success(
            count === 1
              ? this.translate.instant('FORECAST.CREDIT_NOTES.GENERATE_SUCCESS')
              : this.translate.instant('FORECAST.CREDIT_NOTES.GENERATE_SUCCESS_MANY', { count })
          );
          if (result.skipped.length > 0) {
            this.toastr.info(this.translate.instant('FORECAST.CREDIT_NOTES.GENERATE_SKIPPED', { count: result.skipped.length }));
          }

          const map = new Map(this.breakdownCache());
          map.delete(row.mes);
          this.breakdownCache.set(map);
          if (this.expandedMes() === row.mes) {
            this.expandedMes.set(null);
            this.toggleBreakdown(row);
          }

          this.loadHistory(entity);
        },
        error: (err) => {
          const message = err?.error?.message ?? err?.error?.errors ?? this.translate.instant('FORECAST.CREDIT_NOTES.GENERATE_ERROR');
          this.generateError.set(typeof message === 'string' ? message : Object.values(message).flat().join(' '));
        },
      });
  }

  noteLabels(notes: ForecastCreditNote[]): string {
    return notes.map(n => n.requestNumber ?? ('#' + n.requestId)).join(', ');
  }

  breakdownFor(mes: number): ForecastGroupMonthBreakdown | undefined {
    return this.breakdownCache().get(mes);
  }

  toggleBreakdown(row: SummaryRow): void {
    const entity = this.selectedEntity();
    if (!entity || entity.tipo !== 'grupo') return;

    if (this.expandedMes() === row.mes) {
      this.expandedMes.set(null);
      return;
    }

    this.expandedMes.set(row.mes);
    this.ensureBreakdownLoaded(entity, row.mes, (loading) => this.loadingBreakdown.set(loading ? row.mes : null));
  }

  /** Carga (y cachea por mes) la aportación por cliente del grupo, si no está ya cacheada. */
  private ensureBreakdownLoaded(entity: SelectedEntity, mes: number, setLoading: (loading: boolean) => void): void {
    if (this.breakdownCache().has(mes)) return;

    setLoading(true);
    this.forecastService.getGroupMonthBreakdown(entity.id, this.year(), mes)
      .pipe(finalize(() => setLoading(false)))
      .subscribe({
        next: (breakdown) => {
          if (!breakdown) return;
          const map = new Map(this.breakdownCache());
          map.set(mes, breakdown);
          this.breakdownCache.set(map);
        },
        error: () => {},
      });
  }

  openInvoices(row: SummaryRow): void {
    const entity = this.selectedEntity();
    if (!entity) return;

    const year = this.year();
    const month = row.mes;
    this.invoicesState.set({
      clientId: entity.id,
      clientName: entity.nombre,
      monthLabel: row.monthLabel,
      year,
      month,
      sections: [],
      loading: true,
    });
    this.forecastService.getInvoices(entity.id, year, month).subscribe({
      next: (sections) => this.invoicesState.update(s => s ? { ...s, sections, loading: false } : null),
      error: () => this.invoicesState.update(s => s ? { ...s, loading: false } : null),
    });
  }

  closeInvoices(): void {
    this.invoicesState.set(null);
  }

  viewInvoiceProducts(event: { clientId: number; clientName: string; folio: string }): void {
    const state = this.invoicesState();
    if (!state) return;

    this.invoiceProductsState.set({ clientName: event.clientName, folio: event.folio, entry: null, loading: true });
    this.forecastService.getInvoiceProducts(event.clientId, state.year, state.month).subscribe({
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
    if (!state || this.exportingInvoices()) return;

    this.exportingInvoices.set(true);
    this.forecastService.exportInvoicesExcel(state.clientId, state.year, state.month).pipe(
      finalize(() => this.exportingInvoices.set(false))
    ).subscribe({
      next: (blob) => {
        const fileName = `facturas_${state.clientName.trim().replace(/\s+/g, '_')}_${state.year}_${state.month}.xlsx`;
        this.exportService.downloadBlob(blob, fileName);
      },
      error: () => this.toastr.error(this.translate.instant('FORECAST.CREDIT_NOTES.EXPORT_ERROR')),
    });
  }
}
