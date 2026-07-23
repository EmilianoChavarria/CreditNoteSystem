import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { LucideAngularModule } from 'lucide-angular';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { AuthService } from '../../../../core/services/auth-service';
import {
  DistributorForecastMonth,
  DistributorRecord,
  ForecastService,
  UpdateDistributorForecastMonthPayload,
} from '../../../../core/services/forecast.service';

interface MonthFormRow {
  month: number;
  forecast: string;
  sales: string;
}

type ForecastField = 'forecast' | 'sales';

interface EditingCell {
  month: number;
  field: ForecastField;
}

function emptyRows(): MonthFormRow[] {
  return Array.from({ length: 12 }, (_, i) => ({ month: i + 1, forecast: '', sales: '' }));
}

@Component({
  selector: 'app-distributor-forecast-modal',
  imports: [TranslatePipe, Modal, FormsModule, LucideAngularModule, DecimalPipe],
  templateUrl: './distributor-forecast-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DistributorForecastModal {
  private readonly forecastService = inject(ForecastService);
  private readonly authService = inject(AuthService);
  private readonly toastr = inject(ToastrService);

  readonly open = input<boolean>(false);
  readonly distributor = input<DistributorRecord | null>(null);

  readonly openChange = output<boolean>();

  readonly MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  readonly years = this.buildYearRange();

  readonly isForecastAdmin = signal(false);

  readonly year = signal(new Date().getFullYear());
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly savingRow = signal<number | null>(null);
  readonly rows = signal<MonthFormRow[]>(emptyRows());
  readonly editingCell = signal<EditingCell | null>(null);
  private editOriginal = '';

  constructor() {
    const roleName = this.authService.getCurrentUser()?.roleName?.trim().toUpperCase();
    this.isForecastAdmin.set(roleName === 'FORECAST ADMIN');

    effect(() => {
      const isOpen = this.open();
      const distributor = this.distributor();
      const year = this.year();

      if (!isOpen || !distributor) return;

      this.load(distributor.id, year);
    });
  }

  private buildYearRange(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }

  selectYear(year: number): void {
    if (this.year() === year) return;
    this.year.set(year);
  }

  patchRow(month: number, field: ForecastField, value: string): void {
    this.rows.update(rows => rows.map(r => r.month === month ? { ...r, [field]: value } : r));
  }

  isEditingCell(month: number, field: ForecastField): boolean {
    const cell = this.editingCell();
    return cell !== null && cell.month === month && cell.field === field;
  }

  startEdit(row: MonthFormRow, field: ForecastField): void {
    if (!this.isForecastAdmin() || this.savingRow() !== null) return;
    this.editOriginal = row[field];
    this.editingCell.set({ month: row.month, field });
  }

  onCellKeydown(event: KeyboardEvent, row: MonthFormRow, field: ForecastField): void {
    if (event.key === 'Enter') {
      (event.target as HTMLInputElement).blur();
    } else if (event.key === 'Escape') {
      this.patchRow(row.month, field, this.editOriginal);
      (event.target as HTMLInputElement).blur();
    }
  }

  onCellBlur(row: MonthFormRow, field: ForecastField): void {
    if (!this.isEditingCell(row.month, field)) return;
    this.editingCell.set(null);

    const current = row[field].trim();
    if (current === this.editOriginal.trim()) return;

    this.saveCell(row.month, field, current);
  }

  private saveCell(month: number, field: ForecastField, rawValue: string): void {
    const distributor = this.distributor();
    if (!distributor) return;

    const numeric = rawValue === '' ? 0 : Number(rawValue);
    if (!Number.isFinite(numeric)) {
      this.toastr.error('Valor inválido.');
      this.patchRow(month, field, this.editOriginal);
      return;
    }

    const payload: UpdateDistributorForecastMonthPayload = { [field]: numeric };

    this.savingRow.set(month);
    this.forecastService.updateDistributorForecastMonth(distributor.id, this.year(), month, payload).subscribe({
      next: (updated) => {
        this.rows.update(rows => rows.map(r => r.month === updated.month
          ? { month: updated.month, forecast: String(updated.forecast), sales: String(updated.sales) }
          : r));
        this.savingRow.set(null);
        this.toastr.success('Mes actualizado.');
      },
      error: (err) => {
        this.savingRow.set(null);
        this.patchRow(month, field, this.editOriginal);
        this.toastr.error(err?.error?.message ?? 'No se pudo actualizar el mes.');
      },
    });
  }

  forecastAt(month: number): number {
    return Number(this.rows().find(r => r.month === month)?.forecast) || 0;
  }

  salesAt(month: number): number {
    return Number(this.rows().find(r => r.month === month)?.sales) || 0;
  }

  readonly forecastTotal = computed(() =>
    this.rows().reduce((s, r) => s + (Number(r.forecast) || 0), 0)
  );

  readonly salesTotal = computed(() =>
    this.rows().reduce((s, r) => s + (Number(r.sales) || 0), 0)
  );

  readonly fulfillmentPct = computed(() => {
    const ft = this.forecastTotal();
    return ft > 0 ? (this.salesTotal() / ft) * 100 : 0;
  });

  readonly bestMonth = computed((): { label: string; value: number } | null => {
    const entries = this.rows()
      .map(r => ({ label: this.MONTHS[r.month - 1], value: Number(r.sales) || 0 }))
      .filter(e => e.value > 0);
    if (!entries.length) return null;
    return entries.reduce((best, e) => e.value > best.value ? e : best);
  });

  private applyMonths(months: DistributorForecastMonth[]): void {
    const byMonth = new Map(months.map(m => [m.month, m]));
    this.rows.set(emptyRows().map(row => {
      const m = byMonth.get(row.month);
      return m ? { month: row.month, forecast: String(m.forecast), sales: String(m.sales) } : row;
    }));
  }

  private load(distributorId: number, year: number): void {
    this.loading.set(true);
    this.forecastService.getDistributorForecast(distributorId, year).subscribe({
      next: (months) => {
        this.applyMonths(months);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set(emptyRows());
        this.loading.set(false);
      },
    });
  }

  canSaveAll(): boolean {
    return this.rows().some(r => r.forecast.trim() !== '' && r.sales.trim() !== '');
  }

  saveAll(): void {
    const distributor = this.distributor();
    if (!distributor || this.saving() || !this.canSaveAll()) return;

    const months = this.rows()
      .filter(r => r.forecast.trim() !== '' && r.sales.trim() !== '')
      .map(r => ({ month: r.month, forecast: Number(r.forecast), sales: Number(r.sales) }));

    this.saving.set(true);
    this.forecastService.storeDistributorForecast(distributor.id, { year: this.year(), months }).subscribe({
      next: (updated) => {
        this.applyMonths(updated);
        this.saving.set(false);
        this.toastr.success('Forecast guardado.');
      },
      error: (err) => {
        this.saving.set(false);
        this.toastr.error(err?.error?.message ?? 'No se pudo guardar el forecast.');
      },
    });
  }

  close(): void {
    this.openChange.emit(false);
  }

  exportTemplate(): void {
    const distributor = this.distributor();
    if (!distributor) return;

    import('xlsx').then(XLSX => {
      const HEADER = ['Mes', 'Nombre Mes', 'Forecast', 'Venta real'];
      const data = this.rows().map(r => ({
        'Mes': r.month,
        'Nombre Mes': this.MONTHS[r.month - 1],
        'Forecast': r.forecast,
        'Venta real': r.sales,
      }));

      const ws = XLSX.utils.json_to_sheet(data, { header: HEADER });
      ws['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Forecast');
      const label = distributor.clientNumber || distributor.id;
      XLSX.writeFile(wb, `forecast_${label}_${this.year()}.xlsx`);
    });
  }

  onImportTemplate(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      import('xlsx').then(XLSX => {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        this.rows.update(rows => rows.map(row => {
          const match = parsed.find(p => Number(p['Mes']) === row.month);
          if (!match) return row;

          const forecast = match['Forecast'];
          const sales = match['Venta real'];
          return {
            month: row.month,
            forecast: forecast === '' || forecast === undefined ? row.forecast : String(forecast).trim(),
            sales: sales === '' || sales === undefined ? row.sales : String(sales).trim(),
          };
        }));

        this.toastr.success('Plantilla cargada. Revisa los valores y guarda.');
      });
    };
    reader.readAsArrayBuffer(file);
  }
}
