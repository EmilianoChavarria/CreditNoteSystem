import { Component, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../core/services/auth-service';
import { ForecastService, Distributor, mapApiToDistributors } from '../../../../core/services/forecast.service';
import { BatchService } from '../../../../core/services/batch-service';
import { ForecastTable } from '../../components/forecast-table/forecast-table';
import { MyRequests } from '../../components/my-requests/my-requests';
import { PendingApprovals } from '../../components/pending-approvals/pending-approvals';
import { LucideAngularModule } from "lucide-angular";

@Component({
  selector: 'app-sales-manage',
  imports: [DecimalPipe, ForecastTable, MyRequests, PendingApprovals, LucideAngularModule],
  templateUrl: './sales-manage.html',
  styleUrl: './sales-manage.css',
})
export class SalesManage {
  readonly years = [2024, 2025, 2026];

  readonly activeYear = signal(new Date().getFullYear());
  readonly distributors = signal<Distributor[]>([]);
  readonly loading = signal(false);
  readonly uploading = signal(false);
  readonly refreshTrigger = signal(0);

  readonly grandTotal = computed(() =>
    this.distributors().reduce(
      (s, d) => s + d.months.reduce((ms, m) => ms + m.forecast, 0),
      0
    )
  );

  constructor(
    private readonly forecastService: ForecastService,
    private readonly batchService: BatchService,
    private readonly authService: AuthService,
    private readonly toastr: ToastrService,
  ) {
    this.loadData(this.activeYear());
  }

  selectYear(year: number): void {
    this.activeYear.set(year);
    this.loadData(year);
  }

  onRefreshNeeded(): void {
    this.loadData(this.activeYear());
    this.refreshTrigger.update(v => v + 1);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.uploading.set(true);
    this.batchService.createForecastBatch(file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.toastr.success('Archivo importado. El batch está siendo procesado.', 'Forecast');
      },
      error: (err) => {
        this.uploading.set(false);
        this.toastr.error(err?.error?.message ?? 'Error al importar el archivo.', 'Error');
      },
    });
  }

  private loadData(year: number): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) return;

    this.loading.set(true);
    this.forecastService.getByEngineer(userId, year).subscribe({
      next: (clients) => {
        this.distributors.set(mapApiToDistributors(clients));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
