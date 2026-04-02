import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { switchMap, takeWhile, timer } from 'rxjs';
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
  selector: 'app-bulk-sap-return-order-upload',
  imports: [AccordeonItem, LucideAngularModule],
  templateUrl: './bulk-sap-return-order-upload.html',
})
export class BulkSapReturnOrderUpload {
  private readonly batchService = inject(BatchService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  requestTypes = input.required<RequestType[]>();
  selectedRequestTypeId = input<number | null>(null);
  batchCreated = output<void>();

  private readonly allowedTypes = ['credits', 'debits', 'auditor-credits', 'auditor-debits'];

  isDragOver = signal(false);
  isCreatingBatch = signal(false);
  isPollingBatch = signal(false);
  uploadedFiles = signal<UploadedFileRow[]>([]);
  private files = signal<File[]>([]);

  isAllowed = computed(() => {
    const selectedType = this.selectedType();
    if (!selectedType) {
      return false;
    }

    return this.allowedTypes.includes(selectedType.name.toLowerCase());
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
    this.appendFiles(event.dataTransfer?.files ?? null);
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.appendFiles(input.files);
    input.value = '';
  }

  createBatch(): void {
    const selectedFiles = this.files();
    const requestTypeId = this.selectedRequestTypeId();

    if (selectedFiles.length === 0) {
      this.toastService.warning('Selecciona al menos un archivo para SAP Return Order.', 'SAP Return Order');
      return;
    }

    if (!requestTypeId) {
      this.toastService.warning('Selecciona el Request Type.', 'SAP Return Order');
      return;
    }

    if (!this.isAllowed()) {
      this.toastService.warning('El Request Type seleccionado no permite SAP Return Order.', 'SAP Return Order');
      return;
    }

    this.isCreatingBatch.set(true);

    const formData = new FormData();
    formData.append('batchType', 'sapScreen');
    formData.append('requestTypeId', String(requestTypeId));

    selectedFiles.forEach((file) => {
      formData.append('file[]', file);
    });

    this.batchService.createSapReturnOrderBatch(formData)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batch) => {
          this.isCreatingBatch.set(false);
          this.files.set([]);
          this.uploadedFiles.set([]);

          const batchId = batch?.id;
          this.toastService.success(
            `Batch SAP Return Order creado correctamente${batchId ? ` (ID: ${batchId})` : ''}.`,
            'SAP Return Order'
          );

          if (batchId !== undefined && batchId !== null && batchId !== '') {
            this.startBatchPolling(batchId);
          } else {
            this.batchCreated.emit();
          }
        },
        error: (error) => {
          this.isCreatingBatch.set(false);
          const message = error?.error?.message ?? 'No se pudo crear el batch SAP Return Order.';
          this.toastService.error(message, 'SAP Return Order');
        }
      });
  }

  removeUploadedFile(index: number): void {
    const currentFiles = [...this.files()];
    const currentUploadedFiles = [...this.uploadedFiles()];

    if (index < 0 || index >= currentFiles.length) {
      return;
    }

    currentFiles.splice(index, 1);
    currentUploadedFiles.splice(index, 1);

    this.files.set(currentFiles);
    this.uploadedFiles.set(currentUploadedFiles);
  }

  private appendFiles(fileList: FileList | null): void {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const currentFiles = [...this.files()];
    const currentUploadedFiles = [...this.uploadedFiles()];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];

      if (!this.isValidFile(file)) {
        this.toastService.warning(
          `Archivo "${file.name}" no permitido. Solo imágenes, Word y PDF son permitidos.`,
          'SAP Return Order'
        );
        continue;
      }

      currentFiles.push(file);
      currentUploadedFiles.push({
        name: file.name,
        sizeLabel: this.formatBytes(file.size),
        type: file.type || 'unknown',
        uploadedAt: new Date().toLocaleString('es-MX')
      });
    }

    this.files.set(currentFiles);
    this.uploadedFiles.set(currentUploadedFiles);
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
          this.toastService.success('Carga masiva de SAP Return Order completada.', 'SAP Return Order');
          this.batchCreated.emit();
        }

        if (status === 'failed') {
          this.isPollingBatch.set(false);
          this.toastService.error('La carga masiva de SAP Return Order fallo.', 'SAP Return Order');
          this.batchCreated.emit();
        }
      },
      error: () => {
        this.isPollingBatch.set(false);
        this.toastService.warning('No se pudo continuar el polling del batch SAP Return Order.', 'SAP Return Order');
        this.batchCreated.emit();
      },
      complete: () => {
        this.isPollingBatch.set(false);
      }
    });
  }

  private selectedType(): RequestType | undefined {
    const selectedId = this.selectedRequestTypeId();
    if (!selectedId) {
      return undefined;
    }

    return this.requestTypes().find((type) => type.id === selectedId);
  }

  private isValidFile(file: File): boolean {
    const validMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf'
    ];

    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.doc', '.docx', '.pdf'];

    const mimeValid = validMimes.includes(file.type);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const extValid = validExtensions.includes(ext);

    return mimeValid || extValid;
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
