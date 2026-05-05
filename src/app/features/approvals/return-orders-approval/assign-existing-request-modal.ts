import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { take } from 'rxjs';
import { RequestService } from '../../../core/services/request-service';
import { Request } from '../../../data/interfaces/Request';
import { Modal } from '../../../shared/components/ui/modal/modal';
import { LucideAngularModule } from "lucide-angular";
import { ToastService } from '../../../core/services/toast-service';

interface ExistingRequestSummary {
  id: number;
  requestNumber: string;
  createdAt: string;
  reason: string;
  area: string;
  classification: string;
  totalAmount: number;
  workflowStepName: string;
}

@Component({
  selector: 'app-assign-existing-request-modal',
  imports: [CommonModule, Modal, LucideAngularModule],
  templateUrl: './assign-existing-request-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignExistingRequestModal {
  private readonly requestService = inject(RequestService);
  private readonly toastService = inject(ToastService);

  readonly open = input<boolean>(false);
  readonly clientId = input<number | null>(null);
  readonly orderId = input<number | null>(null);
  readonly orderNumber = input<string | null>(null);

  readonly openChange = output<boolean>();
  readonly assigned = output<void>();

  protected readonly existingRequests = signal<ExistingRequestSummary[]>([]);
  protected readonly isLoadingExistingRequests = signal<boolean>(false);
  protected readonly existingRequestsError = signal<string | null>(null);
  protected readonly selectedRequestId = signal<number | null>(null);
  protected readonly isAssigningOrder = signal<boolean>(false);

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const customerId = this.clientId();

      if (!isOpen) {
        this.resetState();
        return;
      }

      if (!customerId) {
        this.existingRequestsError.set('No se encontró clientId para consultar solicitudes.');
        return;
      }

      this.loadExistingRequests(customerId);
    });
  }

  protected onModalOpenChange(isOpen: boolean): void {
    this.openChange.emit(isOpen);
  }

  protected selectRequest(requestId: number): void {
    this.selectedRequestId.set(requestId);
  }

  protected isRequestSelected(requestId: number): boolean {
    return this.selectedRequestId() === requestId;
  }

  protected assignOrderToSelectedRequest(): void {
    if (this.isAssigningOrder()) {
      return;
    }

    const returnOrderId = Number(this.orderId());
    const requestId = Number(this.selectedRequestId());

    if (!Number.isFinite(returnOrderId) || returnOrderId <= 0) {
      this.toastService.error('No se encontró una orden de devolución válida para asignar.', 'Error');
      return;
    }

    if (!Number.isFinite(requestId) || requestId <= 0) {
      this.toastService.error('Selecciona una solicitud para continuar con la asignación.', 'Error');
      return;
    }

    this.isAssigningOrder.set(true);

    this.requestService.linkReturnOrderToRequest({
      returnOrderId,
      requestId,
    }).pipe(take(1)).subscribe({
      next: (response) => {
        this.toastService.success(response?.message ?? 'Orden asignada correctamente a la solicitud.', 'Exito');
        this.isAssigningOrder.set(false);
        this.assigned.emit();
        this.onModalOpenChange(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.toastService.error(apiMessage?.trim() || 'No fue posible asignar la orden a la solicitud.', 'Error');
        this.isAssigningOrder.set(false);
      },
    });
  }

  private loadExistingRequests(customerId: number): void {
    this.isLoadingExistingRequests.set(true);
    this.existingRequestsError.set(null);
    this.selectedRequestId.set(null);

    this.requestService.getRequestsByCustomerId(customerId).pipe(take(1)).subscribe({
      next: (response) => {
        const mappedRequests = (response.data ?? []).map((request) => this.mapExistingRequestSummary(request));
        this.existingRequests.set(mappedRequests);
        this.isLoadingExistingRequests.set(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.existingRequestsError.set(apiMessage?.trim() || 'No fue posible obtener las solicitudes del cliente.');
        this.existingRequests.set([]);
        this.isLoadingExistingRequests.set(false);
      }
    });
  }

  private mapExistingRequestSummary(request: Request): ExistingRequestSummary {
    return {
      id: Number(request.id ?? 0),
      requestNumber: request.requestNumber ?? '-',
      createdAt: request.createdAt ?? '',
      reason: request.reason?.name ?? '-',
      area: request.area ?? '-',
      classification: request.classification?.name ?? '-',
      totalAmount: Number(request.totalAmount ?? 0),
      workflowStepName: (request as {
        workflowCurrentStep?: { workflow_step?: { stepName?: string } };
      })?.workflowCurrentStep?.workflow_step?.stepName ?? 'REQUESTER/PROCESSOR',
    };
  }

  private resetState(): void {
    this.existingRequests.set([]);
    this.isLoadingExistingRequests.set(false);
    this.existingRequestsError.set(null);
    this.selectedRequestId.set(null);
    this.isAssigningOrder.set(false);
  }
}
