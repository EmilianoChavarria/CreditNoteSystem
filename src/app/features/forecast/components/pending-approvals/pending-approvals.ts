import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { ChangeRequest, ForecastService } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-pending-approvals',
  imports: [DecimalPipe, DatePipe],
  templateUrl: './pending-approvals.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingApprovals {
  private readonly forecastService = inject(ForecastService);
  private readonly toastr = inject(ToastrService);

  readonly requests = signal<ChangeRequest[]>([]);
  readonly loading = signal(false);
  readonly processingId = signal<number | null>(null);

  readonly MONTH_NAMES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  constructor() {
    this.loadRequests();
  }

  approve(id: number): void {
    this.processingId.set(id);
    this.forecastService.approveRequest(id).subscribe({
      next: () => {
        this.processingId.set(null);
        this.requests.update(reqs => reqs.filter(r => r.id !== id));
        this.toastr.success('Solicitud aprobada.', 'Forecast');
      },
      error: (err) => {
        this.processingId.set(null);
        this.toastr.error(err?.error?.message ?? 'No se pudo aprobar.', 'Error');
      },
    });
  }

  reject(id: number): void {
    this.processingId.set(id);
    this.forecastService.rejectRequest(id).subscribe({
      next: () => {
        this.processingId.set(null);
        this.requests.update(reqs => reqs.filter(r => r.id !== id));
        this.toastr.success('Solicitud rechazada.', 'Forecast');
      },
      error: (err) => {
        this.processingId.set(null);
        this.toastr.error(err?.error?.message ?? 'No se pudo rechazar.', 'Error');
      },
    });
  }

  monthName(m: number): string {
    return this.MONTH_NAMES[m - 1] ?? String(m);
  }

  stepLabel(step: string): string {
    return step === 'sales_manager' ? 'Sales Manager' : 'General Manager';
  }

  private loadRequests(): void {
    this.loading.set(true);
    this.forecastService.getPendingApprovals().subscribe({
      next: (reqs) => {
        this.requests.set(reqs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
