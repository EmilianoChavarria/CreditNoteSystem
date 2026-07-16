import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { BulkFileDropzone } from '../../../../../../features/requests/components/batchs/shared/bulk-file-dropzone/bulk-file-dropzone';
import { BulkUploadedFilesTable } from '../../../../../../features/requests/components/batchs/shared/bulk-uploaded-files-table/bulk-uploaded-files-table';
import { BatchService } from '../../../../../../core/services/batch-service';
import { ToastService } from '../../../../../../core/services/toast-service';

interface UploadedFileRow {
  name: string;
  sizeLabel: string;
  type: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-bulk-classify-products-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal, BulkFileDropzone, BulkUploadedFilesTable],
  templateUrl: './bulk-classify-products-modal.html',
})
export class BulkClassifyProductsModal {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly acceptedExtensions = ['.csv', '.xlsx', '.xls', '.txt', '.xml'];

  readonly open = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly batchCreated = output<void>();

  readonly isDragOver = signal(false);
  readonly isCreatingBatch = signal(false);
  readonly uploadedFiles = signal<UploadedFileRow[]>([]);
  private readonly selectedFile = signal<File | null>(null);

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
    this.appendFile(event.dataTransfer?.files ?? null);
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.appendFile(input.files);
    input.value = '';
  }

  removeUploadedFile(index: number): void {
    const currentFiles = [...this.uploadedFiles()];
    if (index < 0 || index >= currentFiles.length) return;

    currentFiles.splice(index, 1);
    this.uploadedFiles.set(currentFiles);

    if (currentFiles.length === 0) {
      this.selectedFile.set(null);
    }
  }

  onSave(): void {
    const file = this.selectedFile();

    if (!file) {
      this.toastService.warning(this.translateService.instant('FORECAST.BULK_CLASSIFY.SELECT_FILE'));
      return;
    }

    this.isCreatingBatch.set(true);

    this.batchService.createProductClassificationBatch(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batch) => {
          this.isCreatingBatch.set(false);
          this.uploadedFiles.set([]);
          this.selectedFile.set(null);

          this.toastService.success(
            this.translateService.instant('FORECAST.BULK_CLASSIFY.CREATED', { id: batch?.id ?? '' })
          );

          this.batchCreated.emit();
          this.openChange.emit(false);
        },
        error: (error) => {
          this.isCreatingBatch.set(false);
          const message = error?.error?.errors?.message
            ?? error?.error?.message
            ?? this.translateService.instant('FORECAST.BULK_CLASSIFY.CREATE_ERROR');
          this.toastService.error(message);
        }
      });
  }

  private appendFile(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) return;

    const primaryFile = fileList[0];

    if (!this.isValidFile(primaryFile)) {
      this.toastService.warning(this.translateService.instant('FORECAST.BULK_CLASSIFY.INVALID_FILE'));
      return;
    }

    this.selectedFile.set(primaryFile);

    if (fileList.length > 1) {
      this.toastService.warning(this.translateService.instant('FORECAST.BULK_CLASSIFY.ONLY_FIRST_FILE'));
    }

    this.uploadedFiles.set([{
      name: primaryFile.name,
      sizeLabel: this.formatBytes(primaryFile.size),
      type: primaryFile.type || 'N/A',
      uploadedAt: new Date().toLocaleString('es-MX')
    }]);
  }

  private isValidFile(file: File): boolean {
    const fileName = file.name.toLowerCase();
    return this.acceptedExtensions.some((ext) => fileName.endsWith(ext));
  }

  private formatBytes(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
}
