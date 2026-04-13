import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { AccordeonItem } from '../../../../../shared/components/ui/accordeon/accordeon-item';
import { BatchService } from '../../../../../core/services/batch-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { RequestType } from '../../../../../data/interfaces/Request';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BulkUploadedFilesTable } from '../shared/bulk-uploaded-files-table/bulk-uploaded-files-table';
import { BulkFileDropzone } from '../shared/bulk-file-dropzone/bulk-file-dropzone';

interface UploadedFileRow {
  name: string;
  sizeLabel: string;
  type: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-bulk-credits-data-upload',
  imports: [AccordeonItem, LucideAngularModule, TranslatePipe, BulkUploadedFilesTable, BulkFileDropzone],
  templateUrl: './bulk-credits-data-upload.html',
})
export class BulkCreditsDataUpload {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  requestTypes = input.required<RequestType[]>();
  selectedRequestTypeId = input<number | null>(null);
  batchCreated = output<void>();

  private readonly allowedTypes = ['credits', 'debits'];

  isDragOver = signal(false);
  isCreatingBatch = signal(false);
  uploadedFiles = signal<UploadedFileRow[]>([]);
  private selectedFile = signal<File | null>(null);

  isAllowed = computed(() => {
    const selectedType = this.selectedType();
    if (!selectedType) {
      return false;
    }

    return this.allowedTypes.includes(selectedType.name.toLowerCase());
  });

  isDebitsSelected = computed(() => {
    const selectedType = this.selectedType();
    return selectedType?.name.toLowerCase() === 'debits';
  });

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
    const file = this.selectedFile();

    if (!file) {
      this.toastService.warning(this.translateService.instant('BULK.TOAST.CREDITS_SELECT_FILE'), this.translateService.instant('BULK.TABS.UPLOAD'));
      return;
    }

    if (!this.isAllowed()) {
      this.toastService.warning(this.translateService.instant('BULK.TOAST.CREDITS_ALLOWED_ONLY'), this.translateService.instant('BULK.TABS.UPLOAD'));
      return;
    }

    this.isCreatingBatch.set(true);

    this.batchService.createCreditsDataBatch(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batch) => {
          this.isCreatingBatch.set(false);
          this.uploadedFiles.set([]);
          this.selectedFile.set(null);

          this.toastService.success(
            this.translateService.instant('BULK.TOAST.CREDITS_CREATED', { id: batch?.id ?? '' }),
            this.translateService.instant('BULK.TABS.UPLOAD')
          );

          this.batchCreated.emit();
        },
        error: (error) => {
          this.isCreatingBatch.set(false);
          const message = error?.error?.message ?? this.translateService.instant('BULK.TOAST.CREDITS_CREATE_ERROR');
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

    if (!this.isValidFile(primaryFile)) {
      this.toastService.warning(this.translateService.instant('BULK.TOAST.CREDITS_ONLY_CSV_XLSX'), this.translateService.instant('BULK.TABS.UPLOAD'));
      return;
    }

    this.selectedFile.set(primaryFile);

    if (fileList.length > 1) {
      this.toastService.warning(this.translateService.instant('BULK.TOAST.CREDITS_ONLY_FIRST_FILE'), this.translateService.instant('BULK.TABS.UPLOAD'));
    }

    this.uploadedFiles.set([{
      name: primaryFile.name,
      sizeLabel: this.formatBytes(primaryFile.size),
      type: primaryFile.type || 'N/A',
      uploadedAt: new Date().toLocaleString('es-MX')
    }]);
  }

  private selectedType(): RequestType | undefined {
    const selectedId = this.selectedRequestTypeId();
    if (!selectedId) {
      return undefined;
    }

    return this.requestTypes().find((type) => type.id === selectedId);
  }

  private isValidFile(file: File): boolean {
    const fileName = file.name.toLowerCase();
    return fileName.endsWith('.csv') || fileName.endsWith('.xlsx');
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
