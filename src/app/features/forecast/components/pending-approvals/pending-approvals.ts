import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChangeRequest, DistributorChangeRequest, ForecastService } from '../../../../core/services/forecast.service';
import { AuthService } from '../../../../core/services/auth-service';

@Component({
  selector: 'app-pending-approvals',
  imports: [TranslatePipe, DecimalPipe, DatePipe],
  templateUrl: './pending-approvals.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingApprovals {
  readonly resolved = output<void>();
  private readonly forecastService = inject(ForecastService);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);
  private readonly authService = inject(AuthService);

  /** El admin ve todas las pendientes, no solo las asignadas a él. */
  readonly isForecastAdmin = signal(
    this.authService.getCurrentUser()?.roleName?.trim().toUpperCase() === 'FORECAST ADMIN'
  );

  readonly requests = signal<ChangeRequest[]>([]);
  readonly loading = signal(false);
  readonly processingId = signal<number | null>(null);

  readonly distributorRequests = signal<DistributorChangeRequest[]>([]);
  readonly distributorLoading = signal(false);
  readonly distributorProcessingId = signal<number | null>(null);

  readonly MONTH_NAMES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  constructor() {
    this.loadRequests();
    this.loadDistributorRequests();
  }

  approve(id: number): void {
    this.processingId.set(id);
    this.forecastService.approveRequest(id).subscribe({
      next: () => {
        this.processingId.set(null);
        this.requests.update(reqs => reqs.filter(r => r.id !== id));
        this.resolved.emit();
        this.toastr.success(this.translate.instant('FORECAST.PENDING_APPROVALS.APPROVE_SUCCESS'), this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_TITLE'));
      },
      error: (err) => {
        this.processingId.set(null);
        this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.PENDING_APPROVALS.APPROVE_ERROR'), this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_ERROR'));
      },
    });
  }

  reject(id: number): void {
    this.processingId.set(id);
    this.forecastService.rejectRequest(id).subscribe({
      next: () => {
        this.processingId.set(null);
        this.requests.update(reqs => reqs.filter(r => r.id !== id));
        this.resolved.emit();
        this.toastr.success(this.translate.instant('FORECAST.PENDING_APPROVALS.REJECT_SUCCESS'), this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_TITLE'));
      },
      error: (err) => {
        this.processingId.set(null);
        this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.PENDING_APPROVALS.REJECT_ERROR'), this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_ERROR'));
      },
    });
  }

  approveDistributor(id: number): void {
    this.distributorProcessingId.set(id);
    this.forecastService.approveDistributorRequest(id).subscribe({
      next: () => {
        this.distributorProcessingId.set(null);
        this.distributorRequests.update(reqs => reqs.filter(r => r.id !== id));
        this.resolved.emit();
        this.toastr.success(this.translate.instant('FORECAST.PENDING_APPROVALS.APPROVE_SUCCESS'), this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_TITLE'));
      },
      error: (err) => {
        this.distributorProcessingId.set(null);
        this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.PENDING_APPROVALS.APPROVE_ERROR'), this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_ERROR'));
      },
    });
  }

  rejectDistributor(id: number): void {
    this.distributorProcessingId.set(id);
    this.forecastService.rejectDistributorRequest(id).subscribe({
      next: () => {
        this.distributorProcessingId.set(null);
        this.distributorRequests.update(reqs => reqs.filter(r => r.id !== id));
        this.resolved.emit();
        this.toastr.success(this.translate.instant('FORECAST.PENDING_APPROVALS.REJECT_SUCCESS'), this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_TITLE'));
      },
      error: (err) => {
        this.distributorProcessingId.set(null);
        this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.PENDING_APPROVALS.REJECT_ERROR'), this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_ERROR'));
      },
    });
  }

  monthName(m: number): string {
    return this.MONTH_NAMES[m - 1] ?? String(m);
  }

  stepLabel(step: string): string {
    return step === 'sales_manager'
      ? this.translate.instant('FORECAST.PENDING_APPROVALS.STEP_SM')
      : this.translate.instant('FORECAST.PENDING_APPROVALS.STEP_GM');
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

  private loadDistributorRequests(): void {
    this.distributorLoading.set(true);
    this.forecastService.getDistributorPendingApprovals().subscribe({
      next: (reqs) => {
        this.distributorRequests.set(reqs);
        this.distributorLoading.set(false);
      },
      error: () => this.distributorLoading.set(false),
    });
  }
}
