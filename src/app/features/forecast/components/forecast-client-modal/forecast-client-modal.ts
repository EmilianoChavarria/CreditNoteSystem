import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ForecastMonthApi, ForecastService, PendingRequest } from '../../../../core/services/forecast.service';
import { Modal } from '../../../../shared/components/ui/modal/modal';

const MONTHS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

@Component({
  selector: 'app-forecast-client-modal',
  imports: [Modal, DecimalPipe],
  templateUrl: './forecast-client-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastClientModal {
  private readonly forecastService = inject(ForecastService);

  readonly open = input<boolean>(false);
  readonly clientId = input<number>(0);
  readonly clientName = input<string>('');
  readonly year = input<number>(new Date().getFullYear());

  readonly closed = output<void>();

  readonly MONTHS = MONTHS;
  readonly MONTH_INDICES = Array.from({ length: 12 }, (_, i) => i);

  readonly loading = signal(false);
  readonly months = signal<ForecastMonthApi[]>([]);

  constructor() {
    effect(() => {
      if (this.open() && this.clientId()) {
        this.load();
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.months.set([]);
    this.forecastService.getClientForecast(this.clientId(), this.year()).subscribe({
      next: (data) => { this.months.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  forecastAt(idx: number): number {
    const m = this.months().find(m => m.month === idx + 1);
    return parseFloat(m?.amount ?? '0') || 0;
  }

  salesAt(idx: number): number {
    const m = this.months().find(m => m.month === idx + 1);
    return parseFloat(String(m?.sales ?? '0')) || 0;
  }

  modAt(idx: number): PendingRequest | null {
    return this.months().find(m => m.month === idx + 1)?.modification ?? null;
  }

  readonly forecastTotal = computed(() =>
    this.MONTH_INDICES.reduce((s, i) => s + this.forecastAt(i), 0)
  );

  readonly salesTotal = computed(() =>
    this.MONTH_INDICES.reduce((s, i) => s + this.salesAt(i), 0)
  );

  readonly fulfillmentPct = computed(() => {
    const ft = this.forecastTotal();
    return ft > 0 ? (this.salesTotal() / ft) * 100 : 0;
  });

  readonly bestMonth = computed((): { label: string; value: number } | null => {
    const entries = this.MONTH_INDICES.map(i => ({ label: MONTHS[i], value: this.salesAt(i) }))
      .filter(e => e.value > 0);
    if (!entries.length) return null;
    return entries.reduce((best, e) => e.value > best.value ? e : best);
  });

  stepTooltip(step: 'sales_manager' | 'general_manager'): string {
    return step === 'sales_manager'
      ? 'Esperando aprobación de Sales Manager'
      : 'Esperando aprobación de General Manager';
  }
}
