import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import moment from 'moment';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { BatchService } from '../../../../core/services/batch-service';
import { BulkTemplateService } from '../../../../core/services/bulk-template-service';
import { Modal } from '../../../../shared/components/ui/modal/modal';

@Component({
  selector: 'app-bulk-distributor-upload-modal',
  templateUrl: './bulk-distributor-upload-modal.html',
  imports: [Modal, TranslatePipe, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkDistributorUploadModal {
  readonly open = input<boolean>(false);
  readonly openChange = output<boolean>();
  readonly uploaded = output<void>();

  private readonly batchService = inject(BatchService);
  private readonly bulkTemplateService = inject(BulkTemplateService);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);

  readonly isUploading = signal(false);
  readonly file = signal<File | null>(null);
  readonly uploadedAt = signal('');
  readonly isDragOver = signal(false);

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
    this.bulkTemplateService.download('distributors');
  }

  removeFile(): void {
    this.file.set(null);
    this.uploadedAt.set('');
  }

  submitUpload(): void {
    const file = this.file();
    if (!file || this.isUploading()) return;

    this.isUploading.set(true);
    this.batchService.createDistributorsBatch(file).pipe(
      finalize(() => this.isUploading.set(false))
    ).subscribe({
      next: () => {
        this.toastr.success(
          this.translate.instant('FORECAST.DISTRIBUTORS.BULK_UPLOAD_SUCCESS'),
          this.translate.instant('FORECAST.DISTRIBUTORS.BULK_UPLOAD_TOAST_TITLE')
        );
        this.openChange.emit(false);
        this.uploaded.emit();
        this.reset();
      },
      error: (err) => {
        this.toastr.error(
          err?.error?.message ?? this.translate.instant('FORECAST.DISTRIBUTORS.BULK_UPLOAD_ERROR'),
          this.translate.instant('FORECAST.DISTRIBUTORS.BULK_UPLOAD_TOAST_TITLE')
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
    this.uploadedAt.set(file ? moment().format('DD/MM/YYYY HH:mm:ss') : '');
  }

  private reset(): void {
    this.file.set(null);
    this.uploadedAt.set('');
    this.isDragOver.set(false);
  }
}
