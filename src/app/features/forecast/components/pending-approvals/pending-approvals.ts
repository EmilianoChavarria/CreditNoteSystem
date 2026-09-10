import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChangeRequest, DistributorChangeRequest, ForecastService } from '../../../../core/services/forecast.service';
import { AuthService } from '../../../../core/services/auth-service';
import { Modal } from '../../../../shared/components/ui/modal/modal';

/** Meses pendientes de un mismo cliente / distribuidor: se resuelven en bloque. */
export interface PendingGroup<T> {
  /** idClient o distributorId, según la tabla. */
  entityId: number;
  entityName: string;
  submittedByName: string;
  approverName: string;
  step: string;
  submittedAt: string;
  totalPrevious: number;
  totalProposed: number;
  rows: T[];
}

/** Acción pendiente de confirmar en el modal. */
interface ConfirmTarget {
  kind: 'client' | 'distributor';
  approved: boolean;
  entityId: number;
  entityName: string;
  monthCount: number;
}

@Component({
  selector: 'app-pending-approvals',
  imports: [TranslatePipe, DecimalPipe, DatePipe, Modal],
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
  /** idClient en proceso (la acción aplica a todo el grupo). */
  readonly processingClientId = signal<number | null>(null);

  readonly distributorRequests = signal<DistributorChangeRequest[]>([]);
  readonly distributorLoading = signal(false);
  readonly distributorProcessingId = signal<number | null>(null);

  /** Acción a confirmar antes de mandarla al backend. */
  readonly confirmTarget = signal<ConfirmTarget | null>(null);
  readonly confirmProcessing = signal(false);

  readonly MONTH_NAMES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

  /** Un bloque por cliente: la aprobación es todo o nada. */
  readonly groups = computed<PendingGroup<ChangeRequest>[]>(() =>
    this.buildGroups(
      this.requests(),
      r => r.idClient,
      r => r.clientName ?? '',
      r => r.previousAmount,
      r => r.proposedAmount
    )
  );

  readonly distributorGroups = computed<PendingGroup<DistributorChangeRequest>[]>(() =>
    this.buildGroups(
      this.distributorRequests(),
      r => r.distributorId,
      r => r.distributor?.businessName ?? r.distributorName ?? '',
      r => r.previousForecast,
      r => r.proposedForecast
    )
  );

  constructor() {
    this.loadRequests();
    this.loadDistributorRequests();
  }

  approveGroup(group: PendingGroup<ChangeRequest>): void {
    this.askConfirmation('client', group, true);
  }

  rejectGroup(group: PendingGroup<ChangeRequest>): void {
    this.askConfirmation('client', group, false);
  }

  approveDistributorGroup(group: PendingGroup<DistributorChangeRequest>): void {
    this.askConfirmation('distributor', group, true);
  }

  rejectDistributorGroup(group: PendingGroup<DistributorChangeRequest>): void {
    this.askConfirmation('distributor', group, false);
  }

  cancelConfirm(): void {
    if (this.confirmProcessing()) {
      return;
    }

    this.confirmTarget.set(null);
  }

  /** Confirmado: se resuelve el bloque completo (todo o nada). */
  confirmResolve(): void {
    const target = this.confirmTarget();

    if (!target) {
      return;
    }

    if (target.kind === 'client') {
      const group = this.groups().find(g => g.entityId === target.entityId);

      if (group) {
        this.resolveGroup(group, target.approved);
      }

      return;
    }

    const group = this.distributorGroups().find(g => g.entityId === target.entityId);

    if (group) {
      this.resolveDistributorGroup(group, target.approved);
    }
  }

  monthName(m: number): string {
    return this.MONTH_NAMES[m - 1] ?? String(m);
  }

  stepLabel(step: string): string {
    return step === 'sales_manager'
      ? this.translate.instant('FORECAST.PENDING_APPROVALS.STEP_SM')
      : this.translate.instant('FORECAST.PENDING_APPROVALS.STEP_GM');
  }

  private askConfirmation(kind: 'client' | 'distributor', group: PendingGroup<ChangeRequest | DistributorChangeRequest>, approved: boolean): void {
    this.confirmTarget.set({
      kind,
      approved,
      entityId: group.entityId,
      entityName: group.entityName,
      monthCount: group.rows.length,
    });
  }

  private resolveGroup(group: PendingGroup<ChangeRequest>, approved: boolean): void {
    this.processingClientId.set(group.entityId);
    this.confirmProcessing.set(true);

    const request$ = approved
      ? this.forecastService.approveClientRequests(group.entityId)
      : this.forecastService.rejectClientRequests(group.entityId);

    request$.subscribe({
      next: () => {
        this.processingClientId.set(null);
        this.closeConfirm();
        this.requests.update(reqs => reqs.filter(r => r.idClient !== group.entityId));
        this.resolved.emit();
        this.toastr.success(
          this.translate.instant(approved ? 'FORECAST.PENDING_APPROVALS.APPROVE_SUCCESS' : 'FORECAST.PENDING_APPROVALS.REJECT_SUCCESS'),
          this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_TITLE')
        );
      },
      error: (err) => {
        this.processingClientId.set(null);
        this.closeConfirm();
        this.toastr.error(
          err?.error?.message ?? this.translate.instant(approved ? 'FORECAST.PENDING_APPROVALS.APPROVE_ERROR' : 'FORECAST.PENDING_APPROVALS.REJECT_ERROR'),
          this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_ERROR')
        );
      },
    });
  }

  private resolveDistributorGroup(group: PendingGroup<DistributorChangeRequest>, approved: boolean): void {
    this.distributorProcessingId.set(group.entityId);
    this.confirmProcessing.set(true);

    const request$ = approved
      ? this.forecastService.approveDistributorRequests(group.entityId)
      : this.forecastService.rejectDistributorRequests(group.entityId);

    request$.subscribe({
      next: () => {
        this.distributorProcessingId.set(null);
        this.closeConfirm();
        this.distributorRequests.update(reqs => reqs.filter(r => r.distributorId !== group.entityId));
        this.resolved.emit();
        this.toastr.success(
          this.translate.instant(approved ? 'FORECAST.PENDING_APPROVALS.APPROVE_SUCCESS' : 'FORECAST.PENDING_APPROVALS.REJECT_SUCCESS'),
          this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_TITLE')
        );
      },
      error: (err) => {
        this.distributorProcessingId.set(null);
        this.closeConfirm();
        this.toastr.error(
          err?.error?.message ?? this.translate.instant(approved ? 'FORECAST.PENDING_APPROVALS.APPROVE_ERROR' : 'FORECAST.PENDING_APPROVALS.REJECT_ERROR'),
          this.translate.instant('FORECAST.PENDING_APPROVALS.TOAST_ERROR')
        );
      },
    });
  }

  private closeConfirm(): void {
    this.confirmProcessing.set(false);
    this.confirmTarget.set(null);
  }

  private buildGroups<T extends { year: number; month: number; currentStep: string; submittedAt: string; submittedBy: { fullName: string } | null; approver: { fullName: string } | null }>(
    rows: T[],
    idOf: (row: T) => number,
    nameOf: (row: T) => string,
    previousOf: (row: T) => number | string,
    proposedOf: (row: T) => number | string,
  ): PendingGroup<T>[] {
    const map = new Map<number, PendingGroup<T>>();

    for (const row of rows) {
      const id = idOf(row);
      let group = map.get(id);

      if (!group) {
        group = {
          entityId: id,
          entityName: nameOf(row),
          submittedByName: row.submittedBy?.fullName ?? '—',
          approverName: row.approver?.fullName ?? '—',
          step: row.currentStep,
          submittedAt: row.submittedAt,
          totalPrevious: 0,
          totalProposed: 0,
          rows: [],
        };
        map.set(id, group);
      }

      group.rows.push(row);
      group.totalPrevious += Number(previousOf(row)) || 0;
      group.totalProposed += Number(proposedOf(row)) || 0;

      // La fecha del bloque es la del envío más reciente.
      if (row.submittedAt > group.submittedAt) {
        group.submittedAt = row.submittedAt;
      }
    }

    for (const group of map.values()) {
      group.rows.sort((a, b) => (a.year - b.year) || (a.month - b.month));
    }

    return [...map.values()];
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
