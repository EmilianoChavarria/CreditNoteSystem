import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { switchMap, takeWhile, timer } from 'rxjs';
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
  selector: 'app-bulk-order-numbers-upload',
  imports: [AccordeonItem, LucideAngularModule],
  templateUrl: './bulk-order-numbers-upload.html',
})
export class BulkOrderNumbersUpload {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  selectedRequestTypeId = input<number | null>(null);
  batchCreated = output<void>();

  isDragOver = signal(false);
  isCreatingBatch = signal(false);
  isPollingBatch = signal(false);
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
      this.toastService.warning('Selecciona un archivo CSV para Order Numbers.', 'Bulk Upload');
      return;
    }

    if (!requestTypeId) {
      this.toastService.warning('Selecciona el Request Type.', 'Bulk Upload');
      return;
    }

    this.isCreatingBatch.set(true);

    this.batchService.createBatch(selectedFile, 'orderNumbers', requestTypeId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batch) => {
          this.isCreatingBatch.set(false);
          this.uploadedFiles.set([]);
          this.selectedFile.set(null);

          const batchId = batch?.id;
          this.toastService.success(
            `Batch Order Numbers creado correctamente${batchId ? ` (ID: ${batchId})` : ''}.`,
            'Bulk Upload'
          );

          if (batchId !== undefined && batchId !== null && batchId !== '') {
            this.startBatchPolling(batchId);
          } else {
            this.batchCreated.emit();
          }
        },
        error: (error) => {
          this.isCreatingBatch.set(false);
          const message = error?.error?.message ?? 'No se pudo crear el batch Order Numbers.';
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
    this.selectedFile.set(primaryFile);

    if (fileList.length > 1) {
      this.toastService.warning('Solo se usara el primer archivo CSV para Order Numbers.', 'Bulk Upload');
    }

    this.uploadedFiles.set([{
      name: primaryFile.name,
      sizeLabel: this.formatBytes(primaryFile.size),
      type: primaryFile.type || 'N/A',
      uploadedAt: new Date().toLocaleString('es-MX')
    }]);
  }

  private startBatchPolling(batchId: number | string): void {
    this.isPollingBatch.set(true);

    timer(0, 3000).pipe(
      switchMap(() => this.batchService.getBatchDetail(batchId, 1, 1)),
      takeWhile((response) => {
        const status = String(response.batch?.status ?? '').toLowerCase();
        return status !== 'completed' && status !== 'failed';
      }, true),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        const status = String(response.batch?.status ?? '').toLowerCase();

        if (status === 'completed') {
          this.isPollingBatch.set(false);
          this.toastService.success('Carga masiva de Order Numbers completada.', 'Bulk Upload');
          this.batchCreated.emit();
        }

        if (status === 'failed') {
          this.isPollingBatch.set(false);
          this.toastService.error('La carga masiva de Order Numbers fallo.', 'Bulk Upload');
          this.batchCreated.emit();
        }
      },
      error: () => {
        this.isPollingBatch.set(false);
        this.toastService.warning('No se pudo continuar el polling del batch Order Numbers.', 'Bulk Upload');
        this.batchCreated.emit();
      },
      complete: () => {
        this.isPollingBatch.set(false);
      }
    });
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
