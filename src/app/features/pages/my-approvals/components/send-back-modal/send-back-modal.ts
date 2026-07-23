import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../../shared/components/ui/modal/modal';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { Request } from '../../../../../data/interfaces/Request';
import { RequestHistoryStep } from '../../../../../data/interfaces/RequestService';
import { RequestService } from '../../../../../core/services/request-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-send-back-modal',
  imports: [Modal, Spinner, TranslatePipe, ReactiveFormsModule],
  templateUrl: './send-back-modal.html',
})
export class SendBackModal {
  private readonly _requestsService = inject(RequestService);
  private readonly _toastService = inject(ToastService);
  private readonly _translateService = inject(TranslateService);

  readonly open = input<boolean>(false);
  readonly request = input<Request | null>(null);

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
    const requestId = this.request()?.id;
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
          (s) => s.wasVisited && !s.isCurrent && s.stepOrder < currentOrder
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

  close(): void {
    this.openChange.emit(false);
  }

  confirm(): void {
    if (this.form.invalid || this.isSubmitting()) return;

    const requestId = this.request()?.id;
    const targetId = this.form.value.targetWorkflowStepId;
    if (!requestId || !targetId) return;

    this.isSubmitting.set(true);

    this._requestsService
      .sendBackRequest(requestId, targetId, this.form.value.comments ?? '')
      .subscribe({
        next: () => {
          this._toastService.success(
            this._translateService.instant('MY_APPROVALS.TOAST.SEND_BACK_SUCCESS'),
            this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
          );
          this.openChange.emit(false);
          this.sent.emit();
        },
        error: (error) => {
          this.isSubmitting.set(false);
          this._toastService.error(
            error?.error?.message ?? this._translateService.instant('MY_APPROVALS.TOAST.SEND_BACK_ERROR'),
            this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
          );
          console.error('Error sending back request:', error);
        },
      });
  }
}
