import { Component, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth-service';
import { ForecastService, Distributor, mapApiToDistributors } from '../../../../core/services/forecast.service';
import { BatchService } from '../../../../core/services/batch-service';
import { SalesEngineerAssignmentService } from '../../../../core/services/sales-engineer-assignment.service';
import { AssignmentUser } from '../../../../core/services/user-assignment-service';
import { ForecastTable } from '../../components/forecast-table/forecast-table';
import { MyRequestsModal } from '../../components/my-requests-modal/my-requests-modal';
import { PendingApprovalsModal } from '../../components/pending-approvals-modal/pending-approvals-modal';
import { LucideAngularModule } from "lucide-angular";

@Component({
  selector: 'app-sales-manage',
  imports: [TranslatePipe, DecimalPipe, ForecastTable, MyRequestsModal, PendingApprovalsModal, LucideAngularModule],
  templateUrl: './sales-manage.html',
  styleUrl: './sales-manage.css',
})
export class SalesManage {
  readonly years = [2024, 2025, 2026];

  readonly activeYear = signal(new Date().getFullYear());
  readonly distributors = signal<Distributor[]>([]);
  readonly loading = signal(false);
  readonly foreignDistributors = signal<Distributor[]>([]);
  readonly foreignLoading = signal(false);
  readonly uploading = signal(false);
  readonly refreshTrigger = signal(0);

  readonly isSalesManager = signal(false);
  readonly isForecastAdmin = signal(false);
  readonly engineers = signal<AssignmentUser[]>([]);
  readonly selectedEngineer = signal<AssignmentUser | null>(null);
  readonly loadingEngineers = signal(false);

  readonly showMyRequestsModal = signal(false);
  readonly showPendingApprovalsModal = signal(false);
  readonly pendingClientCount = signal(0);
  readonly pendingForeignCount = signal(0);
  readonly pendingCount = computed(() => this.pendingClientCount() + this.pendingForeignCount());

  readonly grandTotal = computed(() =>
    this.distributors().reduce(
      (s, d) => s + d.months.reduce((ms, m) => ms + m.forecast, 0),
      0
    )
  );

  readonly activeClientsCount = computed(() =>
    this.distributors().reduce((s, d) => s + (d.isGroup ? d.members?.length ?? 0 : 1), 0)
  );

  constructor(
    private readonly forecastService: ForecastService,
    private readonly batchService: BatchService,
    private readonly authService: AuthService,
    private readonly seAssignmentService: SalesEngineerAssignmentService,
    private readonly toastr: ToastrService,
    private readonly translate: TranslateService,
  ) {
    const roleName = this.authService.getCurrentUser()?.roleName?.trim().toUpperCase();
    const isMgr = roleName === 'SALES ENGINEER / MANAGER';
    const isAdmin = roleName === 'FORECAST ADMIN';
    this.isSalesManager.set(isMgr);
    this.isForecastAdmin.set(isAdmin);

    if (isMgr) {
      this.loadEngineers('my');
    } else if (isAdmin) {
      this.loadEngineers('all');
    } else {
      this.loadData(this.activeYear());
    }

    this.loadPendingCount();
  }

  selectYear(year: number): void {
    this.activeYear.set(year);
    const engineerId = (this.isSalesManager() || this.isForecastAdmin())
      ? this.selectedEngineer()?.id
      : this.authService.getCurrentUser()?.id;
    if (engineerId) {
      this.loadForecast(engineerId, year);
    }
  }

  selectEngineerById(engineer: AssignmentUser): void {
    this.selectedEngineer.set(engineer);
    this.loadForecast(engineer.id, this.activeYear());
  }

  onEngineerSelected(event: Event): void {
    const id = parseInt((event.target as HTMLSelectElement).value, 10);
    if (isNaN(id)) {
      this.selectedEngineer.set(null);
      this.distributors.set([]);
      return;
    }
    const engineer = this.engineers().find(e => e.id === id) ?? null;
    this.selectedEngineer.set(engineer);
    if (engineer) {
      this.loadForecast(engineer.id, this.activeYear());
    }
  }

  onRefreshNeeded(): void {
    const engineerId = (this.isSalesManager() || this.isForecastAdmin())
      ? this.selectedEngineer()?.id
      : this.authService.getCurrentUser()?.id;
    if (engineerId) {
      this.loadForecast(engineerId, this.activeYear());
    }
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
        this.toastr.success(this.translate.instant('FORECAST.SALES_MANAGE.UPLOAD_SUCCESS'), this.translate.instant('FORECAST.SALES_MANAGE.TOAST_TITLE'));
      },
      error: (err) => {
        this.uploading.set(false);
        this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.SALES_MANAGE.UPLOAD_ERROR'), this.translate.instant('FORECAST.SALES_MANAGE.TOAST_ERROR'));
      },
    });
  }

  onPendingResolved(): void {
    this.loadPendingCount();
  }

  private loadPendingCount(): void {
    this.forecastService.getPendingApprovals().subscribe({
      next: (reqs) => this.pendingClientCount.set(reqs.length),
      error: () => {},
    });
    this.forecastService.getDistributorPendingApprovals().subscribe({
      next: (reqs) => this.pendingForeignCount.set(reqs.length),
      error: () => {},
    });
  }

  private loadEngineers(scope: 'my' | 'all'): void {
    this.loadingEngineers.set(true);
    const request$ = scope === 'all'
      ? this.seAssignmentService.getAllEngineers()
      : this.seAssignmentService.getMyEngineers();
    request$.subscribe({
      next: (engineers) => {
        this.engineers.set(engineers);
        this.loadingEngineers.set(false);
      },
      error: () => {
        this.toastr.error(this.translate.instant('FORECAST.SALES_MANAGE.LOAD_ENGINEERS_ERROR'), this.translate.instant('FORECAST.SALES_MANAGE.TOAST_ERROR'));
        this.loadingEngineers.set(false);
      },
    });
  }

  private loadData(year: number): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) return;
    this.loadForecast(userId, year);
  }

  private loadForecast(engineerId: number, year: number): void {
    this.loading.set(true);
    this.forecastService.getByEngineer(engineerId, year).subscribe({
      next: (clients) => {
        this.distributors.set(mapApiToDistributors(clients));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.foreignLoading.set(true);
    this.forecastService.getDistributorsByEngineer(engineerId, year).subscribe({
      next: (rows) => {
        this.foreignDistributors.set(mapApiToDistributors(rows));
        this.foreignLoading.set(false);
      },
      error: () => this.foreignLoading.set(false),
    });
  }
}
