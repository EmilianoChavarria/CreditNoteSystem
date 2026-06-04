import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { AccordeonItem } from '../../../../../shared/components/ui/accordeon/accordeon-item';
import { BatchService } from '../../../../../core/services/batch-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BulkFileDropzone } from '../shared/bulk-file-dropzone/bulk-file-dropzone';
import { BulkUploadedFilesTable } from '../shared/bulk-uploaded-files-table/bulk-uploaded-files-table';

interface UploadedFileRow {
  name: string;
  sizeLabel: string;
  type: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-bulk-material-return-upload',
  imports: [AccordeonItem, LucideAngularModule, TranslatePipe, BulkFileDropzone, BulkUploadedFilesTable],
  templateUrl: './bulk-material-return-upload.html',
})
export class BulkMaterialReturnUpload {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  selectedRequestTypeId = input<number | null>(null);
  batchCreated = output<void>();
  openInfo = output<void>();

  isDragOver = signal(false);
  isCreatingBatch = signal(false);
  uploadedFiles = signal<UploadedFileRow[]>([]);
  private selectedFile = signal<File | null>(null);

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

  createBatch(): void {
    const selectedFile = this.selectedFile();
    const requestTypeId = this.selectedRequestTypeId();

    if (!selectedFile) {
      this.toastService.warning(this.translateService.instant('BULK.TOAST.SELECT_FILE_NEW_REQUEST'), this.translateService.instant('BULK.TABS.UPLOAD'));
      return;
    }

    if (!requestTypeId) {
      this.toastService.warning(this.translateService.instant('BULK.TOAST.SELECT_REQUEST_TYPE'), this.translateService.instant('BULK.TABS.UPLOAD'));
      return;
    }

    this.isCreatingBatch.set(true);

    // TODO: update batch type string when defined
    this.batchService.createBatch(selectedFile, 'newRequest', requestTypeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batch) => {
          this.isCreatingBatch.set(false);
          this.toastService.success(
            this.translateService.instant('BULK.TOAST.BATCH_CREATED_NEW_REQUEST', { id: batch?.id ?? '' }),
            this.translateService.instant('BULK.TABS.UPLOAD')
          );
          this.uploadedFiles.set([]);
          this.selectedFile.set(null);
          this.batchCreated.emit();
        },
        error: (error) => {
          this.isCreatingBatch.set(false);
          const message = error?.error?.message ?? this.translateService.instant('BULK.TOAST.BATCH_CREATE_NEW_REQUEST_ERROR');
          this.toastService.error(message, this.translateService.instant('BULK.TABS.UPLOAD'));
        }
      });
  }

  removeUploadedFile(index: number): void {
    const currentFiles = [...this.uploadedFiles()];
    if (index < 0 || index >= currentFiles.length) {
      return;
    }

    currentFiles.splice(index, 1);
    this.uploadedFiles.set(currentFiles);

    if (currentFiles.length === 0) {
      this.selectedFile.set(null);
    }
  }

  private appendFile(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const primaryFile = fileList[0];
    this.selectedFile.set(primaryFile);

    if (fileList.length > 1) {
      this.toastService.warning(this.translateService.instant('BULK.TOAST.ONLY_FIRST_FILE_NEW_REQUEST'), this.translateService.instant('BULK.TABS.UPLOAD'));
    }

    const now = new Date();
    this.uploadedFiles.set([{
      name: primaryFile.name,
      sizeLabel: this.formatBytes(primaryFile.size),
      type: primaryFile.type || 'N/A',
      uploadedAt: now.toLocaleString('es-MX')
    }]);
  }

  private formatBytes(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  }
}
