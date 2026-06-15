import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeRequest, ForecastService } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-my-requests',
  imports: [DecimalPipe, DatePipe],
  templateUrl: './my-requests.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyRequests {
  private readonly forecastService = inject(ForecastService);

  readonly refreshTrigger = input<number>(0);

  readonly requests = signal<ChangeRequest[]>([]);
  readonly loading = signal(false);

  readonly MONTH_NAMES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  constructor() {
    effect(() => {
      this.refreshTrigger();
      untracked(() => this.loadRequests());
    });
  }

  monthName(m: number): string {
    return this.MONTH_NAMES[m - 1] ?? String(m);
  }

  statusLabel(status: string): string {
    if (status === 'approved') return 'Aprobado';
    if (status === 'rejected') return 'Rechazado';
    return 'Pendiente';
  }

  statusClass(status: string): string {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-amber-100 text-amber-700';
  }

  stepLabel(step: string): string {
    return step === 'sales_manager' ? 'Sales Manager' : 'General Manager';
  }

  private loadRequests(): void {
    this.loading.set(true);
    this.forecastService.getMyRequests().subscribe({
      next: (reqs) => {
        this.requests.set(reqs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
