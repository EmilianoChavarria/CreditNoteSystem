import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { Request } from '../../../../data/interfaces/Request';
import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';
import { RequestService } from '../../../../core/services/request-service';
import { RequestHistoryData, RequestHistoryLog, RequestAttachment } from '../../../../data/interfaces/RequestService';
import { ApiResponse } from '../../../../data/interfaces/ApiResponse-interface';
import { ToastService } from '../../../../core/services/toast-service';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { ReturnOrderRequestService, ReturnOrderRequestByRequestData } from '../../../../core/services/return-order-request-service';
import { ReturnOrderItemsModal } from './return-order-items-modal';

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
  imports: [Modal, TranslatePipe ,DatePipe, UpperCasePipe, CurrencyPipe, Spinner, LucideAngularModule, ReturnOrderItemsModal],
  templateUrl: './request-info-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestInfoModal {
  private readonly requestService = inject(RequestService);
  private readonly returnOrderRequestService = inject(ReturnOrderRequestService);
  private readonly translateService = inject(TranslateService);
  private readonly toastService = inject(ToastService);

  readonly open = input(false);
  readonly request = input<Request | null>(null);
  readonly canDelete = input(false);

  readonly openChange = output<boolean>();
  readonly viewHistory = output<void>();

  readonly sequenceSteps = signal<SequenceStep[]>([]);
  readonly isLoadingSequence = signal(false);

  readonly isLoadingReturnOrder = signal(false);
  readonly returnOrderData = signal<ReturnOrderRequestByRequestData | null>(null);
  readonly showReturnOrderItemsModal = signal(false);

  readonly effectiveCurrency = computed(() =>
    this.returnOrderData()?.returnOrder?.currency ?? this.request()?.currency ?? 'MXN'
  );

  readonly isLoadingAttachments = signal(false);
  readonly attachments = signal<RequestAttachment[]>([]);
  readonly deletingAttachmentIds = signal<number[]>([]);
  readonly openingAttachmentIds = signal<number[]>([]);
  readonly showDeleteConfirmModal = signal(false);
  readonly attachmentPendingDeletion = signal<RequestAttachment | null>(null);

  constructor() {
    effect(() => {
      const req = this.request();
      const isOpen = this.open();
      if (!isOpen || !req?.id) {
        this.sequenceSteps.set([]);
        this.attachments.set([]);
        this.returnOrderData.set(null);
        this.deletingAttachmentIds.set([]);
        this.openingAttachmentIds.set([]);
        this.showDeleteConfirmModal.set(false);
        this.attachmentPendingDeletion.set(null);
        return;
      }
      this.loadSequence(req);
      this.loadAttachments(req.id);
      this.loadReturnOrderData(req.id);
    });
  }

  private loadReturnOrderData(requestId: number): void {
    this.isLoadingReturnOrder.set(true);
    this.returnOrderRequestService.getByRequestId(requestId).pipe(
      finalize(() => this.isLoadingReturnOrder.set(false))
    ).subscribe({
      next: (data) => this.returnOrderData.set(data),
      error: () => this.returnOrderData.set(null)
    });
  }

  private loadAttachments(requestId: number): void {
    this.isLoadingAttachments.set(true);
    this.requestService.getRequestAttachments(requestId).pipe(
      finalize(() => this.isLoadingAttachments.set(false))
    ).subscribe({
      next: (items) => this.attachments.set(items),
      error: () => this.attachments.set([])
    });
  }

  getAttachmentName(attachment: RequestAttachment): string {
    return attachment.originalName
      ?? attachment.original_name
      ?? attachment.fileName
      ?? attachment.file_name
      ?? attachment.name
      ?? `Attachment #${attachment.id}`;
  }

  getAttachmentDate(attachment: RequestAttachment): string {
    const rawDate = attachment.createdAt ?? attachment.created_at;
    if (!rawDate) return '-';
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return rawDate;
    const locale = this.translateService.currentLang?.toLowerCase().startsWith('en') ? 'en-US' : 'es-MX';
    return date.toLocaleString(locale);
  }

  isOpening(attachmentId: number): boolean {
    return this.openingAttachmentIds().includes(attachmentId);
  }

  isDeleting(attachmentId: number): boolean {
    return this.deletingAttachmentIds().includes(attachmentId);
  }

  openAttachment(attachment: RequestAttachment): void {
    if (!attachment.id || this.isOpening(attachment.id)) return;
    this.openingAttachmentIds.update((ids) => [...ids, attachment.id]);
    this.requestService.getRequestAttachmentFileUrl(attachment.id).pipe(
      finalize(() => this.openingAttachmentIds.update((ids) => ids.filter((id) => id !== attachment.id)))
    ).subscribe({
      next: (fileUrl) => {
        if (fileUrl) window.open(fileUrl, '_blank', 'noopener,noreferrer');
      },
      error: () => {}
    });
  }

  requestDeleteAttachment(attachment: RequestAttachment): void {
    if (!attachment.id || !this.canDelete()) return;
    this.attachmentPendingDeletion.set(attachment);
    this.showDeleteConfirmModal.set(true);
  }

  onDeleteConfirmModalChange(isOpen: boolean): void {
    this.showDeleteConfirmModal.set(isOpen);
    if (!isOpen) this.attachmentPendingDeletion.set(null);
  }

  getPendingDeletionAttachmentName(): string {
    const a = this.attachmentPendingDeletion();
    return a ? this.getAttachmentName(a) : this.translateService.instant('PENDING_ATTACHMENTS.THIS_FILE');
  }

  confirmDeleteAttachment(): void {
    const requestId = this.request()?.id;
    const attachment = this.attachmentPendingDeletion();
    if (!requestId || !attachment?.id || !this.canDelete()) return;

    this.deletingAttachmentIds.update((ids) => [...ids, attachment.id]);
    this.showDeleteConfirmModal.set(false);
    this.attachmentPendingDeletion.set(null);

    this.requestService.deleteRequestAttachment(requestId, attachment.id).pipe(
      finalize(() => this.deletingAttachmentIds.update((ids) => ids.filter((id) => id !== attachment.id)))
    ).subscribe({
      next: (response: ApiResponse<boolean>) => {
        this.attachments.update((items) => items.filter((item) => item.id !== attachment.id));
        this.toastService.success(
          response.message ?? this.translateService.instant('PENDING_ATTACHMENTS.DELETE_SUCCESS'),
          this.translateService.instant('PENDING_ATTACHMENTS.SUCCESS')
        );
      },
      error: () => {}
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
        let userName =
          log?.request_step?.assigned_user?.fullName
          ?? (step.isCurrent ? req.workflowCurrentStep?.assigned_user?.fullName : null)
          ?? '---';

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
