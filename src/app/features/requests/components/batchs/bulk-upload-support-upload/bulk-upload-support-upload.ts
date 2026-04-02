import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { AccordeonItem } from '../../../../../shared/components/ui/accordeon/accordeon-item';
import { BatchService } from '../../../../../core/services/batch-service';
import { ToastService } from '../../../../../core/services/toast-service';

interface UploadedFileRow {
  name: string;
  sizeLabel: string;
  type: string;
  uploadedAt: string;
}

@Component({
  selector: 'app-bulk-upload-support-upload',
  imports: [AccordeonItem, LucideAngularModule],
  templateUrl: './bulk-upload-support-upload.html',
})
export class BulkUploadSupportUpload {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  selectedRequestTypeId = input<number | null>(null);
  batchCreated = output<void>();

  isDragOver = signal(false);
  isCreatingBatch = signal(false);
  uploadedFiles = signal<UploadedFileRow[]>([]);
  minRange = signal('');
  maxRange = signal('');
  private files = signal<File[]>([]);

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
    this.appendFiles(event.dataTransfer?.files ?? null);
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.appendFiles(input.files);
    input.value = '';
  }

  onMinRangeChange(event: Event): void {
    this.minRange.set((event.target as HTMLInputElement).value);
  }

  onMaxRangeChange(event: Event): void {
    this.maxRange.set((event.target as HTMLInputElement).value);
  }

  createBatch(): void {
    const requestTypeId = this.selectedRequestTypeId();
    const minRange = Number(this.minRange().trim());
    const maxRange = Number(this.maxRange().trim());
    const files = this.files();

    if (!requestTypeId) {
      this.toastService.warning('Selecciona el Request Type.', 'Bulk Upload');
      return;
    }

    if (!Number.isInteger(minRange) || !Number.isInteger(maxRange) || minRange <= 0 || maxRange <= 0) {
      this.toastService.warning('Captura un rango valido (minRange y maxRange numericos).', 'Bulk Upload');
      return;
    }

    if (minRange > maxRange) {
      this.toastService.warning('El rango minimo no puede ser mayor al maximo.', 'Bulk Upload');
      return;
    }

    if (files.length === 0) {
      this.toastService.warning('Debes adjuntar al menos un archivo para Upload Support.', 'Bulk Upload');
      return;
    }

    if (files.length > 10) {
      this.toastService.warning('Solo se permiten hasta 10 archivos para Upload Support.', 'Bulk Upload');
      return;
    }

    this.isCreatingBatch.set(true);

    this.batchService
      .createUploadSupportBatch(files, requestTypeId, minRange, maxRange)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batch) => {
          this.isCreatingBatch.set(false);
          this.toastService.success(
            `Batch Upload Support creado correctamente${batch?.id ? ` (ID: ${batch.id})` : ''}.`,
            'Bulk Upload'
          );

          this.files.set([]);
          this.uploadedFiles.set([]);
          this.minRange.set('');
          this.maxRange.set('');
          this.batchCreated.emit();
        },
        error: (error) => {
          this.isCreatingBatch.set(false);
          const message = error?.error?.message ?? 'No se pudo crear el batch Upload Support.';
          this.toastService.error(message, 'Bulk Upload');
        }
      });
  }

  removeUploadedFile(index: number): void {
    const currentFiles = [...this.files()];
    if (index < 0 || index >= currentFiles.length) {
      return;
    }

    currentFiles.splice(index, 1);
    this.files.set(currentFiles);

    const rows = currentFiles.map((file) => ({
      name: file.name,
      sizeLabel: this.formatBytes(file.size),
      type: file.type || 'N/A',
      uploadedAt: new Date().toLocaleString('es-MX')
    }));

    this.uploadedFiles.set(rows);
  }

  private appendFiles(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const currentFiles = [...this.files()];
    const incomingFiles = Array.from(fileList);
    const availableSlots = Math.max(0, 10 - currentFiles.length);

    if (availableSlots === 0) {
      this.toastService.warning('Solo se permiten hasta 10 archivos por batch de Upload Support.', 'Bulk Upload');
      return;
    }

    const acceptedFiles = incomingFiles.slice(0, availableSlots);
    const nextFiles = [...currentFiles, ...acceptedFiles];
    this.files.set(nextFiles);

    const nowLabel = new Date().toLocaleString('es-MX');
    const nextRows = nextFiles.map((file) => ({
      name: file.name,
      sizeLabel: this.formatBytes(file.size),
      type: file.type || 'N/A',
      uploadedAt: nowLabel,
    }));

    this.uploadedFiles.set(nextRows);

    if (incomingFiles.length > acceptedFiles.length) {
      this.toastService.warning('Se agregaron solo 10 archivos maximo para Upload Support.', 'Bulk Upload');
    }
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
