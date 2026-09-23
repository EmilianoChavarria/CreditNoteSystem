import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { BulkReturnsEmailsResult, CustomerService } from '../../../../../../core/services/customer-service';
import { BulkTemplateService } from '../../../../../../core/services/bulk-template-service';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';

@Component({
  selector: 'app-bulk-returns-emails-modal',
  standalone: true,
  imports: [Modal, TranslatePipe, LucideAngularModule],
  templateUrl: './bulk-returns-emails-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkReturnsEmailsModal {
  private readonly customerService = inject(CustomerService);
  private readonly bulkTemplateService = inject(BulkTemplateService);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);

  readonly open = input<boolean>(false);
  readonly openChange = output<boolean>();
  readonly uploaded = output<void>();

  readonly isUploading = signal(false);
  readonly file = signal<File | null>(null);
  readonly isDragOver = signal(false);
  readonly result = signal<BulkReturnsEmailsResult | null>(null);

  onOpenChange(isOpen: boolean): void {
    if (this.isUploading()) return;
    this.openChange.emit(isOpen);
    if (!isOpen) this.reset();
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    this.setFile(event.dataTransfer?.files?.[0] ?? null);
  }

  downloadTemplate(): void {
    this.bulkTemplateService.download('customerReturnsEmails');
  }

  removeFile(): void {
    this.file.set(null);
    this.result.set(null);
  }

  submitUpload(): void {
    const file = this.file();
    if (!file || this.isUploading()) return;

    this.isUploading.set(true);
    this.customerService.bulkUpdateReturnsEmails(file).pipe(
      finalize(() => this.isUploading.set(false))
    ).subscribe({
      next: (result) => {
        this.result.set(result);
        const title = this.translate.instant('CUSTOMERS_PAGE.BULK_RETURNS_EMAILS');
        if (result.updated > 0) {
          this.uploaded.emit();
        }
        if (result.failed === 0) {
          this.toastr.success(
            this.translate.instant('CUSTOMERS_PAGE.BULK_RESULT_OK', { count: result.updated }),
            title
          );
          this.openChange.emit(false);
          this.reset();
        } else {
          this.toastr.warning(
            this.translate.instant('CUSTOMERS_PAGE.BULK_RESULT_PARTIAL', { updated: result.updated, failed: result.failed }),
            title
          );
        }
      },
      error: (err) => {
        this.toastr.error(
          err?.error?.message ?? this.translate.instant('CUSTOMERS_PAGE.BULK_ERROR'),
          this.translate.instant('CUSTOMERS_PAGE.BULK_RETURNS_EMAILS')
        );
      },
    });
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private setFile(file: File | null): void {
    this.file.set(file);
    this.result.set(null);
  }

  private reset(): void {
    this.file.set(null);
    this.result.set(null);
    this.isDragOver.set(false);
  }
}
