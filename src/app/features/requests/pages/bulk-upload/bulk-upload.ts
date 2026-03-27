import { Component, signal } from '@angular/core';
import { AccionPersonalizada, Column, Table } from '../../../../shared/components/ui/table/table';
import { RequestService } from '../../../../core/services/request-service';
import { Request } from '../../../../data/interfaces/Request';
import moment from 'moment';
import { TranslatePipe } from '@ngx-translate/core';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { UpperCasePipe } from '@angular/common';
import { Badge } from '../../../../shared/components/ui/badge/badge';
import { TabsContainer } from "../../../../shared/components/ui/tab/tab-container/tab-container";
import { Tab } from "../../../../shared/components/ui/tab/tab";
import { AccordeonContainer } from "../../../../shared/components/ui/accordeon/accordeon-container";
import { AccordeonItem } from "../../../../shared/components/ui/accordeon/accordeon-item";
import { LucideAngularModule } from "lucide-angular";
import { Modal } from "../../../../shared/components/ui/modal/modal";
import { Popover } from "../../../../shared/components/ui/popover/popover";

interface UploadedFileRow {
    name: string;
    sizeLabel: string;
    type: string;
    uploadedAt: string;
}

interface BatchHistoryRow {
    idBatch: string;
    date: string;
    requests: number;
    emitted: number;
    pending: number;
    error: number;
}

type RequestStatus = 'emitted' | 'error';

interface RequestHistoryRow {
    requestNumber: string;
    status: RequestStatus;
    errorMessage?: string;
}

@Component({
    selector: 'app-bulk-upload',
    templateUrl: './bulk-upload.html',
    styleUrl: './bulk-upload.css',
    imports: [TabsContainer, Tab, AccordeonContainer, AccordeonItem, LucideAngularModule, Modal, Popover]
})
export class BulkUpload {


    public isDragOver = signal(false);
    public uploadedFiles = signal<UploadedFileRow[]>([]);
    public isBatchDetailModalOpen = signal(false);
    public isRequestErrorModalOpen = signal(false);
    public selectedBatch = signal<BatchHistoryRow | null>(null);
    public selectedRequestError = signal<RequestHistoryRow | null>(null);

    public bulkHistoryRows = signal<BatchHistoryRow[]>([
        { idBatch: 'BATCH-0001', date: '2026-02-20 09:12', requests: 10, emitted: 8, pending: 1, error: 1 },
        { idBatch: 'BATCH-0002', date: '2026-02-21 14:37', requests: 7, emitted: 5, pending: 0, error: 2 },
        { idBatch: 'BATCH-0003', date: '2026-02-22 11:05', requests: 12, emitted: 12, pending: 0, error: 0 }
    ]);

    public batchRequestRows = signal<RequestHistoryRow[]>([]);

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

    private appendFiles(fileList: FileList | null): void {
        if (!fileList || fileList.length === 0) {
            return;
        }

        const now = new Date();
        const nextRows: UploadedFileRow[] = Array.from(fileList).map(file => ({
            name: file.name,
            sizeLabel: this.formatBytes(file.size),
            type: file.type || 'N/A',
            uploadedAt: now.toLocaleString('es-MX')
        }));

        this.uploadedFiles.update(current => [...current, ...nextRows]);
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

    public openBatchDetail(batch: BatchHistoryRow): void {
        this.selectedBatch.set(batch);
        this.batchRequestRows.set(this.buildRequestsForBatch(batch));
        this.isBatchDetailModalOpen.set(true);
    }

    public closeBatchDetailModal(isOpen: boolean): void {
        this.isBatchDetailModalOpen.set(isOpen);
    }

    public openRequestErrorModal(request: RequestHistoryRow): void {
        this.selectedRequestError.set(request);
        this.isRequestErrorModalOpen.set(true);
    }

    public closeRequestErrorModal(isOpen: boolean): void {
        this.isRequestErrorModalOpen.set(isOpen);
    }

    public getStatusClass(status: RequestStatus): string {
        return status === 'emitted'
            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
            : 'bg-red-100 text-red-700 border border-red-200';
    }


    private buildRequestsForBatch(batch: BatchHistoryRow): RequestHistoryRow[] {
        const rows: RequestHistoryRow[] = [];
        const total = batch.requests;
        const emittedCount = batch.emitted;

        for (let index = 1; index <= total; index++) {
            const requestNumber = `AC-${String(index).padStart(5, '0')}`;

            if (index <= emittedCount) {
                rows.push({ requestNumber, status: 'emitted' });
            } else {
                rows.push({
                    requestNumber,
                    status: 'error',
                    errorMessage: `Error en validación de datos para ${requestNumber}.`
                });
            }
        }

        return rows;
    }



}
