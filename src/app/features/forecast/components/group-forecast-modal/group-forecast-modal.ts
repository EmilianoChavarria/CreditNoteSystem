import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ClientGroup, ClientGroupForecastSummary, ForecastService } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-group-forecast-modal',
  imports: [TranslatePipe, Modal, DecimalPipe],
  templateUrl: './group-forecast-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupForecastModal {
  private readonly forecastService = inject(ForecastService);

  readonly open = input<boolean>(false);
  readonly group = input<ClientGroup | null>(null);

  readonly closed = output<void>();

  readonly MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  readonly years = this.buildYearRange();

  readonly year = signal(new Date().getFullYear());
  readonly summary = signal<ClientGroupForecastSummary | null>(null);
  readonly loading = signal(false);
  readonly expandedMonth = signal<number | null>(null);

  private readonly loadEffect = effect(() => {
    const isOpen = this.open();
    const group = this.group();
    const year = this.year();

    if (!isOpen || !group) {
      return;
    }

    this.load(group.id, year);
  });

  private buildYearRange(): number[] {
    const current = new Date().getFullYear();
    return [current - 1, current, current + 1];
  }

  selectYear(year: number): void {
    if (this.year() === year) return;
    this.expandedMonth.set(null);
    this.year.set(year);
  }

  toggleMonth(monthIdx: number): void {
    this.expandedMonth.update(current => current === monthIdx ? null : monthIdx);
  }

  monthTotal(monthIdx: number): number {
    return this.summary()?.months?.[String(monthIdx + 1)]?.total ?? 0;
  }

  monthClients(monthIdx: number) {
    return this.summary()?.months?.[String(monthIdx + 1)]?.clients ?? [];
  }

  grandTotal(): number {
    const summary = this.summary();
    if (!summary) return 0;
    return Object.values(summary.months).reduce((sum, m) => sum + Number(m.total), 0);
  }

  private load(groupId: number, year: number): void {
    this.loading.set(true);
    this.forecastService.getGroupForecast(groupId, year).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.summary.set(null);
        this.loading.set(false);
      },
    });
  }
}
