import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { AccordeonItem } from '../../../../../shared/components/ui/accordeon/accordeon-item';
import { BatchService } from '../../../../../core/services/batch-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { RequestType } from '../../../../../data/interfaces/Request';

interface UploadedFileRow {
  name: string;
  sizeLabel: string;
  type: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-bulk-credits-data-upload',
  imports: [AccordeonItem, LucideAngularModule],
  templateUrl: './bulk-credits-data-upload.html',
})
export class BulkCreditsDataUpload {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
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
      this.toastService.warning('Selecciona un archivo CSV o XLSX para Credits Data.', 'Bulk Upload');
      return;
    }

    if (!this.isAllowed()) {
      this.toastService.warning('Esta carga solo aplica para Request Type Credits o Debits.', 'Bulk Upload');
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
            `Batch Credits Data creado correctamente${batch?.id ? ` (ID: ${batch.id})` : ''}.`,
            'Bulk Upload'
          );

          this.batchCreated.emit();
        },
        error: (error) => {
          this.isCreatingBatch.set(false);
          const message = error?.error?.message ?? 'No se pudo crear el batch Credits Data.';
          this.toastService.error(message, 'Bulk Upload');
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
      this.toastService.warning('Solo se permite un archivo CSV o XLSX para Credits Data.', 'Bulk Upload');
      return;
    }

    this.selectedFile.set(primaryFile);

    if (fileList.length > 1) {
      this.toastService.warning('Solo se usara el primer archivo para Credits Data.', 'Bulk Upload');
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
