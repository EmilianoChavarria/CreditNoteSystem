import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import moment from 'moment';
import { ToastrService } from 'ngx-toastr';
import { finalize } from 'rxjs';
import { BatchService, WelcomeEmailMode } from '../../../../../../core/services/batch-service';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';

@Component({
    selector: 'app-bulk-users-upload-modal',
    templateUrl: './bulk-users-upload-modal.html',
    imports: [Modal, TranslatePipe, LucideAngularModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkUsersUploadModal {
    readonly open = input<boolean>(false);
    readonly openChange = output<boolean>();

    private readonly _batchService = inject(BatchService);
    private readonly _router = inject(Router);
    private readonly _toastr = inject(ToastrService);
    private readonly _translateService = inject(TranslateService);

    public isBulkUploading = signal<boolean>(false);
    public bulkUploadFile = signal<File | null>(null);
    public bulkUploadedAt = signal<string>('');
    public welcomeEmailMode = signal<WelcomeEmailMode>('none');
    public welcomeEmailRecipient = signal<string>('');
    public bulkUploadSubmitted = signal<boolean>(false);
    public isDragOver = signal<boolean>(false);

    onOpenChange(isOpen: boolean): void {
        if (this.isBulkUploading()) {
            return;
        }

        this.openChange.emit(isOpen);
        if (!isOpen) {
            this.reset();
        }
    }

    onBulkFileChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0] ?? null;
        this.setBulkFile(file);
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
        this.setBulkFile(event.dataTransfer?.files?.[0] ?? null);
    }

    removeBulkUploadFile(): void {
        this.bulkUploadFile.set(null);
        this.bulkUploadedAt.set('');
    }

    onWelcomeEmailModeChange(event: Event): void {
        const value = (event.target as HTMLInputElement).value as WelcomeEmailMode;
        this.welcomeEmailMode.set(value);

        if (value !== 'single') {
            this.welcomeEmailRecipient.set('');
        }
    }

    onWelcomeEmailRecipientChange(event: Event): void {
        this.welcomeEmailRecipient.set((event.target as HTMLInputElement).value);
    }

    isWelcomeEmailRecipientInvalid(): boolean {
        return this.welcomeEmailMode() === 'single'
            && this.bulkUploadSubmitted()
            && !this.isValidEmail(this.welcomeEmailRecipient().trim());
    }

    submitBulkUpload(): void {
        const file = this.bulkUploadFile();
        this.bulkUploadSubmitted.set(true);

        if (!file || this.isBulkUploading()) {
            return;
        }

        const mode = this.welcomeEmailMode();
        const recipient = this.welcomeEmailRecipient().trim();

        if (mode === 'single' && !this.isValidEmail(recipient)) {
            this._toastr.warning(
                this._translateService.instant('USERS_PAGE.BULK_WELCOME_EMAIL_RECIPIENT_INVALID'),
                this._translateService.instant('USERS_PAGE.ERROR')
            );
            return;
        }

        this.isBulkUploading.set(true);

        this._batchService.createUsersBatch(file, {
            welcomeEmailMode: mode,
            welcomeEmailRecipient: mode === 'single' ? recipient : undefined,
        }).pipe(
            finalize(() => this.isBulkUploading.set(false))
        ).subscribe({
            next: () => {
                this._toastr.success(
                    this._translateService.instant('USERS_PAGE.BULK_UPLOAD_SUCCESS'),
                    this._translateService.instant('USERS_PAGE.SUCCESS')
                );
                this.openChange.emit(false);
                this.reset();
                this._router.navigate(['/app/request/bulk-upload'], { queryParams: { tab: 'bulk-history' } });
            },
            error: (error) => {
                this._toastr.error(
                    error?.error?.message ?? this._translateService.instant('USERS_PAGE.BULK_UPLOAD_ERROR'),
                    this._translateService.instant('USERS_PAGE.ERROR')
                );
            }
        });
    }

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    private setBulkFile(file: File | null): void {
        this.bulkUploadFile.set(file);
        this.bulkUploadedAt.set(file ? moment().format('DD/MM/YYYY HH:mm:ss') : '');
    }

    private reset(): void {
        this.bulkUploadFile.set(null);
        this.bulkUploadedAt.set('');
        this.welcomeEmailMode.set('none');
        this.welcomeEmailRecipient.set('');
        this.bulkUploadSubmitted.set(false);
        this.isDragOver.set(false);
    }

    private isValidEmail(value: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }
}
