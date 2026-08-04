import { Component, computed, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { LucideAngularModule } from "lucide-angular";
import { Observable, finalize, map, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import {
  ForecastCreditNote,
  ForecastEntityType,
  ForecastService,
  ForecastSummaryMonth,
  InvoiceProductsEntry,
  InvoiceSection,
} from '../../../../core/services/forecast.service';
import { ExportService } from '../../../../core/services/export-service';
import { AutocompleteOption } from '../../../../shared/components/ui/autocomplete/autocomplete';
import { GroupedAutocomplete, AutocompleteOptionGroup } from '../../../../shared/components/ui/grouped-autocomplete/grouped-autocomplete';
import { ForecastInvoicesModal } from '../../components/forecast-invoices-modal/forecast-invoices-modal';
import { ForecastInvoiceProductsModal } from '../../components/forecast-invoice-products-modal/forecast-invoice-products-modal';
import { Modal } from '../../../../shared/components/ui/modal/modal';

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
    LucideAngularModule,
    GroupedAutocomplete,
    CurrencyPipe,
    DecimalPipe,
    DatePipe,
    ForecastInvoicesModal,
    ForecastInvoiceProductsModal,
    Modal,
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

  readonly invoicesState = signal<InvoicesState | null>(null);
  readonly exportingInvoices = signal(false);
  readonly invoiceProductsState = signal<InvoiceProductsState | null>(null);

  readonly creditNotesHistory = signal<ForecastCreditNote[]>([]);
  readonly loadingHistory = signal(false);

  readonly generateTarget = signal<SummaryRow | null>(null);
  readonly generateModalOpen = signal(false);
  readonly generatingNC = signal(false);
  readonly generateError = signal<string | null>(null);

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
  ) {}

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
          groupLabel: 'Agrupaciones',
          options: results.grupos.map((g) => ({
            id: `group:${g.id}`,
            label: g.nombre,
            data: g,
          })),
        },
        {
          groupLabel: 'Clientes',
          options: results.clientes.map((c) => ({
            id: `client:${c.id}`,
            label: `${c.numeroCliente} — ${c.nombre}`,
            data: c,
          })),
        },
        {
          groupLabel: 'Clientes extranjeros',
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
  }

  onStatusChange(event: Event): void {
    this.status.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  private loadSummary(entity: SelectedEntity): void {
    this.loadingSummary.set(true);
    this.forecastService.getForecastSummary(entity.tipo, entity.id, this.year()).subscribe({
      next: (summary) => {
        this.summaryMonths.set(summary?.meses ?? []);
        this.loadingSummary.set(false);
      },
      error: () => {
        this.summaryMonths.set([]);
        this.loadingSummary.set(false);
      },
    });
    this.loadHistory(entity);
  }

  private loadHistory(entity: SelectedEntity): void {
    if (entity.tipo === 'clienteExtranjero') {
      this.creditNotesHistory.set([]);
      return;
    }

    this.loadingHistory.set(true);
    this.forecastService.getForecastCreditNoteHistory(entity.tipo, entity.id).subscribe({
      next: (history) => {
        this.creditNotesHistory.set(history);
        this.loadingHistory.set(false);
      },
      error: () => {
        this.creditNotesHistory.set([]);
        this.loadingHistory.set(false);
      },
    });
  }

  /** NC ya generada para ese mes del año seleccionado, si existe. */
  generatedNoteFor(mes: number): ForecastCreditNote | null {
    return this.creditNotesHistory().find(h => h.month === mes && h.year === this.year()) ?? null;
  }

  canGenerateNC(row: SummaryRow): boolean {
    const entity = this.selectedEntity();
    return !!entity && entity.tipo !== 'clienteExtranjero' && !!row.cumplido && !this.generatedNoteFor(row.mes);
  }

  openGenerateNC(row: SummaryRow): void {
    if (!this.canGenerateNC(row)) return;
    this.generateTarget.set(row);
    this.generateError.set(null);
    this.generateModalOpen.set(true);
  }

  cancelGenerateNC(): void {
    if (this.generatingNC()) return;
    this.generateModalOpen.set(false);
    this.generateTarget.set(null);
  }

  confirmGenerateNC(): void {
    const entity = this.selectedEntity();
    const row = this.generateTarget();
    if (!entity || !row || this.generatingNC() || entity.tipo === 'clienteExtranjero') return;

    this.generatingNC.set(true);
    this.generateError.set(null);
    this.forecastService.generateForecastCreditNote(entity.tipo, entity.id, this.year(), row.mes)
      .pipe(finalize(() => this.generatingNC.set(false)))
      .subscribe({
        next: () => {
          this.generateModalOpen.set(false);
          this.generateTarget.set(null);
          this.toastr.success('Nota de crédito generada correctamente.');
          this.loadHistory(entity);
        },
        error: (err) => {
          const message = err?.error?.message ?? err?.error?.errors ?? 'No se pudo generar la nota de crédito.';
          this.generateError.set(typeof message === 'string' ? message : Object.values(message).flat().join(' '));
        },
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
      error: () => this.toastr.error('No se pudo exportar el archivo.'),
    });
  }
}
