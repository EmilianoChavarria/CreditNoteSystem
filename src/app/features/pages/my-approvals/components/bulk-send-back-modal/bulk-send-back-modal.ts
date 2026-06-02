import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../../shared/components/ui/modal/modal';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { RequestHistoryStep } from '../../../../../data/interfaces/RequestService';
import { RequestService } from '../../../../../core/services/request-service';
import { ToastService } from '../../../../../core/services/toast-service';

@Component({
  selector: 'app-bulk-send-back-modal',
  imports: [Modal, Spinner, TranslatePipe, ReactiveFormsModule],
  templateUrl: './bulk-send-back-modal.html',
})
export class BulkSendBackModal {
  private readonly _requestsService = inject(RequestService);
  private readonly _toastService = inject(ToastService);
  private readonly _translateService = inject(TranslateService);

  readonly open = input<boolean>(false);
  readonly requestIds = input<number[]>([]);
  /** ID de cualquier request seleccionado para cargar los pasos disponibles */
  readonly sampleRequestId = input<number | null>(null);
  readonly selectedCount = input<number>(0);

  readonly openChange = output<boolean>();
  readonly sent = output<void>();

  public availableSteps = signal<RequestHistoryStep[]>([]);
  public isLoadingSteps = signal<boolean>(false);
  public isSubmitting = signal<boolean>(false);

  public form = new FormGroup({
    targetWorkflowStepId: new FormControl<number | null>(null, Validators.required),
    comments: new FormControl<string>(''),
  });

  constructor() {
    effect(() => {
      if (this.open()) {
        this.loadSteps();
      } else {
        this.reset();
      }
    });
  }

  private loadSteps(): void {
    const requestId = this.sampleRequestId();
    if (!requestId) return;

    this.isLoadingSteps.set(true);
    this.availableSteps.set([]);

    this._requestsService.getRequestHistory(requestId).subscribe({
      next: (data) => {
        if (!data) {
          this.availableSteps.set([]);
          this.isLoadingSteps.set(false);
          return;
        }
        const currentOrder = data.currentStep?.workflow_step?.stepOrder ?? Infinity;
        const eligible = data.steps.filter(
          (s) => s.wasVisited && !s.isCurrent && !s.isInitialStep && s.stepOrder < currentOrder
        );
        this.availableSteps.set(eligible);
        this.isLoadingSteps.set(false);
      },
      error: () => {
        this.availableSteps.set([]);
        this.isLoadingSteps.set(false);
      },
    });
  }

  private reset(): void {
    this.form.reset();
    this.availableSteps.set([]);
    this.isLoadingSteps.set(false);
    this.isSubmitting.set(false);
  }

  confirm(): void {
    if (this.form.invalid || this.isSubmitting()) return;

    const ids = this.requestIds();
    const targetId = this.form.value.targetWorkflowStepId;
    if (!ids.length || !targetId) return;

    this.isSubmitting.set(true);

    this._requestsService
      .sendBackMassRequests(ids, targetId, this.form.value.comments ?? '')
      .subscribe({
        next: (response) => {
          if (response.totalSentBack > 0) {
            this._toastService.success(
              this._translateService.instant('MY_APPROVALS.TOAST.BULK_SEND_BACK_SUCCESS', {
                sentBack: response.totalSentBack,
                total: response.totalReceived,
              }),
              this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
            );
          }
          if (response.totalFailed > 0) {
            this._toastService.warning(
              this._translateService.instant('MY_APPROVALS.TOAST.BULK_SEND_BACK_PARTIAL', {
                failed: response.totalFailed,
              }),
              this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
            );
          }
          this.openChange.emit(false);
          this.sent.emit();
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this._toastService.error(
            error?.error?.message ??
              this._translateService.instant('MY_APPROVALS.TOAST.BULK_SEND_BACK_ERROR'),
            this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
          );
          console.error('Error sending back requests in bulk:', error);
        },
      });
  }
}
