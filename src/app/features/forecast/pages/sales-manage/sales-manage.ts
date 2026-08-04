import { Component, computed, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../../core/services/auth-service';
import { ForecastService, Distributor, mapApiToDistributors } from '../../../../core/services/forecast.service';
import { SalesEngineerAssignmentService } from '../../../../core/services/sales-engineer-assignment.service';
import { AssignmentUser } from '../../../../core/services/user-assignment-service';
import { ExportService } from '../../../../core/services/export-service';
import { ForecastTable } from '../../components/forecast-table/forecast-table';
import { MyRequestsModal } from '../../components/my-requests-modal/my-requests-modal';
import { PendingApprovalsModal } from '../../components/pending-approvals-modal/pending-approvals-modal';
import { Popover } from '../../../../shared/components/ui/popover/popover';
import { BulkForecastHistoryModal } from './components/bulk-forecast-history-modal/bulk-forecast-history-modal';
import { BulkForecastUploadModal } from '../../components/bulk-forecast-upload-modal/bulk-forecast-upload-modal';
import { LucideAngularModule } from "lucide-angular";

@Component({
  selector: 'app-sales-manage',
  imports: [TranslatePipe, DecimalPipe, ForecastTable, MyRequestsModal, PendingApprovalsModal, Popover, BulkForecastHistoryModal, BulkForecastUploadModal, LucideAngularModule],
  templateUrl: './sales-manage.html',
  styleUrl: './sales-manage.css',
})
export class SalesManage {
  private readonly bulkHistoryModal = viewChild(BulkForecastHistoryModal);

  readonly years = [2024, 2025, 2026];

  readonly activeYear = signal(new Date().getFullYear());
  readonly distributors = signal<Distributor[]>([]);
  readonly loading = signal(false);
  readonly foreignDistributors = signal<Distributor[]>([]);
  readonly foreignLoading = signal(false);
  readonly downloadingTemplate = signal(false);
  readonly refreshTrigger = signal(0);

  readonly isSalesManager = signal(false);
  readonly isForecastAdmin = signal(false);
  readonly engineers = signal<AssignmentUser[]>([]);
  readonly selectedEngineer = signal<AssignmentUser | null>(null);
  readonly loadingEngineers = signal(false);

  readonly showMyRequestsModal = signal(false);
  readonly showPendingApprovalsModal = signal(false);
  readonly showBulkHistoryModal = signal(false);
  readonly showBulkUploadModal = signal(false);
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

  readonly currentEngineerId = computed(() =>
    (this.isSalesManager() || this.isForecastAdmin())
      ? this.selectedEngineer()?.id ?? null
      : this.authService.getCurrentUser()?.id ?? null
  );

  constructor(
    private readonly forecastService: ForecastService,
    private readonly authService: AuthService,
    private readonly seAssignmentService: SalesEngineerAssignmentService,
    private readonly exportService: ExportService,
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

  openBulkUploadModal(): void {
    this.showBulkUploadModal.set(true);
  }

  onForecastBulkUploaded(): void {
    this.bulkHistoryModal()?.refresh();
  }

  openBulkHistoryModal(): void {
    this.showBulkHistoryModal.set(true);
  }

  downloadTemplate(scope: 'engineer' | 'all'): void {
    const engineerId = scope === 'engineer' ? this.currentEngineerId() ?? undefined : undefined;

    this.downloadingTemplate.set(true);
    this.forecastService.exportTemplate(engineerId).subscribe({
      next: (blob) => {
        this.downloadingTemplate.set(false);
        this.exportService.downloadBlob(blob, 'Layout Forecast.csv');
      },
      error: (err) => {
        this.downloadingTemplate.set(false);
        this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.SALES_MANAGE.DOWNLOAD_TEMPLATE_ERROR'), this.translate.instant('FORECAST.SALES_MANAGE.TOAST_ERROR'));
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
