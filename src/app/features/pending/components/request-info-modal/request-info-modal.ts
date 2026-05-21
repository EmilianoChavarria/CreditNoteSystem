import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { Request } from '../../../../data/interfaces/Request';
import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { RequestService } from '../../../../core/services/request-service';
import { RequestHistoryData, RequestHistoryLog } from '../../../../data/interfaces/RequestService';

interface SequenceStep {
  stepOrder: number;
  totalSteps: number;
  userName: string;
  roleName: string;
  assignedAt: string | null;
  actionAt: string | null;
  statusKey: string | null;
  isCurrent: boolean;
}

@Component({
  selector: 'app-request-info-modal',
  imports: [Modal, TranslatePipe, DatePipe, UpperCasePipe, CurrencyPipe],
  templateUrl: './request-info-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestInfoModal {
  private readonly requestService = inject(RequestService);

  readonly open = input(false);
  readonly request = input<Request | null>(null);

  readonly openChange = output<boolean>();
  readonly viewHistory = output<void>();

  readonly sequenceSteps = signal<SequenceStep[]>([]);
  readonly isLoadingSequence = signal(false);

  constructor() {
    effect(() => {
      const req = this.request();
      const isOpen = this.open();
      if (!isOpen || !req?.id) {
        this.sequenceSteps.set([]);
        return;
      }
      this.loadSequence(req);
    });
  }

  private loadSequence(req: Request): void {
    this.isLoadingSequence.set(true);
    this.requestService.getRequestHistory(req.id!).subscribe({
      next: (data) => {
        this.sequenceSteps.set(data ? this.buildSequenceSteps(data, req) : []);
        this.isLoadingSequence.set(false);
      },
      error: () => {
        this.sequenceSteps.set([]);
        this.isLoadingSequence.set(false);
      }
    });
  }

  private buildSequenceSteps(data: RequestHistoryData, req: Request): SequenceStep[] {
    const total = data.steps.length;
    const latestLogByStepId = new Map<number, RequestHistoryLog>();
    for (const log of data.history) {
      const existing = latestLogByStepId.get(log.workflowStepId);
      if (!existing || new Date(log.createdAt) > new Date(existing.createdAt)) {
        latestLogByStepId.set(log.workflowStepId, log);
      }
    }

    return data.steps
      .slice()
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => {
        const log = latestLogByStepId.get(step.id);
        let userName = log?.action_user?.fullName ?? '---';
        if (step.isCurrent && req.workflowCurrentStep?.assigned_user?.fullName) {
          userName = req.workflowCurrentStep.assigned_user.fullName;
        }

        return {
          stepOrder: step.stepOrder,
          totalSteps: total,
          userName,
          roleName: step.role?.roleName ?? '---',
          assignedAt: step.latestStartedAt,
          actionAt: step.latestCompletedAt,
          statusKey: this.resolveStatusKey(step.latestStatus, step.isCurrent),
          isCurrent: step.isCurrent,
        };
      });
  }

  private resolveStatusKey(status: string | null, isCurrent: boolean): string | null {
    if (status) {
      const s = status.toLowerCase();
      if (s === 'pending' || s === 'current') return 'pending';
      if (s === 'approved') return 'approved';
      if (s === 'rejected') return 'rejected';
      if (s === 'returned' || s === 'routed_back') return 'returned';
      if (s === 'cancelled') return 'cancelled';
      return s;
    }
    if (isCurrent) return 'pending';
    return null;
  }

  getStatusClasses(statusKey: string): string {
    switch (statusKey) {
      case 'approved':  return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300';
      case 'rejected':
      case 'cancelled': return 'bg-red-100 text-red-700 ring-1 ring-red-300';
      case 'returned':  return 'bg-amber-100 text-amber-700 ring-1 ring-amber-300';
      case 'pending':   return 'bg-blue-100 text-blue-700 ring-1 ring-blue-300';
      default:          return 'bg-slate-100 text-slate-600 ring-1 ring-slate-300';
    }
  }

  onOpenChange(isOpen: boolean): void {
    this.openChange.emit(isOpen);
  }
}
