import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { RequestAttachment, RequestService } from '../../../../core/services/request-service';

@Component({
  selector: 'app-pending-attachments-modal',
  imports: [Modal, Spinner, LucideAngularModule],
  templateUrl: './pending-attachments-modal.html',
  styleUrl: './pending-attachments-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PendingAttachmentsModal {
  readonly open = input(false);
  readonly requestId = input<number | null>(null);
  readonly canDelete = input(false);

  readonly openChange = output<boolean>();

  readonly isLoading = signal(false);
  readonly attachments = signal<RequestAttachment[]>([]);
  readonly deletingAttachmentIds = signal<number[]>([]);
  readonly openingAttachmentIds = signal<number[]>([]);
  readonly showDeleteConfirmModal = signal(false);
  readonly attachmentPendingDeletion = signal<RequestAttachment | null>(null);

  private readonly requestsService = inject(RequestService);

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const requestId = this.requestId();

      if (!isOpen) {
        this.attachments.set([]);
        this.deletingAttachmentIds.set([]);
        this.openingAttachmentIds.set([]);
        this.showDeleteConfirmModal.set(false);
        this.attachmentPendingDeletion.set(null);
        return;
      }

      if (!requestId) {
        this.attachments.set([]);
        return;
      }

      this.loadAttachments(requestId);
    });
  }

  onOpenChange(isOpen: boolean): void {
    this.openChange.emit(isOpen);
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

    if (!rawDate) {
      return '-';
    }

    const date = new Date(rawDate);

    if (Number.isNaN(date.getTime())) {
      return rawDate;
    }

    return date.toLocaleString('es-MX');
  }

  getPendingDeletionAttachmentName(): string {
    const attachment = this.attachmentPendingDeletion();

    if (!attachment) {
      return 'this file';
    }

    return this.getAttachmentName(attachment);
  }

  isOpening(attachmentId: number): boolean {
    return this.openingAttachmentIds().includes(attachmentId);
  }

  openAttachment(attachment: RequestAttachment): void {
    if (!attachment.id || this.isOpening(attachment.id)) {
      return;
    }

    this.openingAttachmentIds.update((ids) => [...ids, attachment.id]);

    this.requestsService.getRequestAttachmentFileUrl(attachment.id).pipe(
      finalize(() => {
        this.openingAttachmentIds.update((ids) => ids.filter((id) => id !== attachment.id));
      })
    ).subscribe({
      next: (fileUrl) => {
        if (!fileUrl) {
          return;
        }

        window.open(fileUrl, '_blank', 'noopener,noreferrer');
      },
      error: (error) => {
        console.error('Error opening attachment', error);
      }
    });
  }

  isDeleting(attachmentId: number): boolean {
    return this.deletingAttachmentIds().includes(attachmentId);
  }

  requestDeleteAttachment(attachment: RequestAttachment): void {
    const requestId = this.requestId();

    if (!requestId || !attachment.id || !this.canDelete()) {
      return;
    }

    this.attachmentPendingDeletion.set(attachment);
    this.showDeleteConfirmModal.set(true);
  }

  onDeleteConfirmModalChange(isOpen: boolean): void {
    this.showDeleteConfirmModal.set(isOpen);

    if (!isOpen) {
      this.attachmentPendingDeletion.set(null);
    }
  }

  confirmDeleteAttachment(): void {
    const requestId = this.requestId();
    const attachment = this.attachmentPendingDeletion();

    if (!requestId || !attachment?.id || !this.canDelete()) {
      return;
    }

    this.deletingAttachmentIds.update((ids) => [...ids, attachment.id]);
    this.showDeleteConfirmModal.set(false);
    this.attachmentPendingDeletion.set(null);

    this.requestsService.deleteRequestAttachment(requestId, attachment.id).pipe(
      finalize(() => {
        this.deletingAttachmentIds.update((ids) => ids.filter((id) => id !== attachment.id));
      })
    ).subscribe({
      next: () => {
        this.attachments.update((items) => items.filter((item) => item.id !== attachment.id));
      },
      error: (error) => {
        console.error('Error deleting attachment', error);
      }
    });
  }

  private loadAttachments(requestId: number): void {
    this.isLoading.set(true);

    this.requestsService.getRequestAttachments(requestId).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (attachments) => {
        this.attachments.set(attachments);
      },
      error: (error) => {
        console.error('Error loading request attachments', error);
        this.attachments.set([]);
      }
    });
  }
}
