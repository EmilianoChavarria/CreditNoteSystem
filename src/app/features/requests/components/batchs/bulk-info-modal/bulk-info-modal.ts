import { Component, OnDestroy, effect, inject, input, output, signal } from '@angular/core';
import { forkJoin, Subscription } from 'rxjs';
import { Classification, Reason } from '../../../../../data/interfaces/Request';
import { RequestService } from '../../../../../core/services/request-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../../shared/components/ui/modal/modal';

@Component({
    selector: 'app-bulk-info-modal',
    imports: [Modal, TranslatePipe],
    templateUrl: './bulk-info-modal.html',
})
export class BulkInfoModal implements OnDestroy {
    open = input.required<boolean>();
    selectedRequestTypeId = input<number | null>(null);

    openChange = output<boolean>();

    private readonly requestService = inject(RequestService);
    private readonly toastService = inject(ToastService);
    private readonly translateService = inject(TranslateService);
    private readonly subscriptions: Subscription[] = [];

    isLoading = signal(false);
    reasons = signal<Reason[]>([]);
    classifications = signal<Classification[]>([]);
    areas = signal<{ id: number, name: string }[]>([{ id: 1, name: 'ORIGINAL EQUIPMENT' }, { id: 2, name: 'AFTERMARKET' }]);
    copiedText = signal<string | null>(null);

    constructor() {
        effect(() => {
            if (this.open()) {
                this.loadData();
            } else {
                this.reasons.set([]);
                this.classifications.set([]);
            }
        });
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach(s => s.unsubscribe());
    }

    private loadData(): void {
        const requestTypeId = this.selectedRequestTypeId();
        if (!requestTypeId) return;

        this.reasons.set([]);
        this.classifications.set([]);
        this.isLoading.set(true);

        const sub = forkJoin({
            reasons: this.requestService.getReasons(requestTypeId),
            classifications: this.requestService.getClassificationsByType(requestTypeId),
        }).subscribe({
            next: ({ reasons, classifications }) => {
                this.reasons.set(reasons);
                this.classifications.set(classifications);
                this.isLoading.set(false);
            },
            error: () => {
                this.isLoading.set(false);
                this.toastService.error(
                    this.translateService.instant('BULK.TOAST.LOAD_REQUEST_TYPES_ERROR'),
                    this.translateService.instant('BULK.TABS.UPLOAD')
                );
            }
        });

        this.subscriptions.push(sub);
    }

    copyText(text: string): void {
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.copiedText.set(text);
                setTimeout(() => this.copiedText.set(null), 1500);
            }).catch(() => this.fallbackCopy(text));
        } else {
            this.fallbackCopy(text);
        }
    }

    private fallbackCopy(text: string): void {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
            this.copiedText.set(text);
            setTimeout(() => this.copiedText.set(null), 1500);
        } catch { }
        document.body.removeChild(textarea);
    }
}
