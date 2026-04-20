import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RequestService } from '../../../../../core/services/request-service';
import { CustomerService, ReturnOrderListEntry, ReturnOrderListItem } from '../../../../../core/services/customer-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { BaseRequestForm } from '../../shared/base-request-form';
import { TabsContainer } from '../../../../../shared/components/ui/tab/tab-container/tab-container';
import { Tab } from '../../../../../shared/components/ui/tab/tab';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Autocomplete } from '../../../../../shared/components/ui/autocomplete/autocomplete';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { Observable, of, take } from 'rxjs';
import { SimpleChanges } from '@angular/core';
import {
  ReturnOrderRequestByRequestData,
  ReturnOrderRequestItem,
  ReturnOrderRequestService,
} from '../../../../../core/services/return-order-request-service';

@Component({
  selector: 'app-material-return-form',
  imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, Autocomplete, TitleCasePipe, CurrencyPipe, Spinner],
  templateUrl: './material-return-form.html',
  styleUrl: './material-return-form.css',
})
export class MaterialReturnForm extends BaseRequestForm {
  private readonly route = inject(ActivatedRoute);

  protected readonly orderId = signal<number | null>(null);
  protected readonly materialList = signal<ReturnOrderListItem[]>([]);
  protected readonly materialListSubtotal = computed(() =>
    this.materialList().reduce((total, item) => {
      const quantity = Number(item.requestedQuantity) || 0;
      const unitPrice = Number(item.valorUnitario) || 0;
      return total + (quantity * unitPrice);
    }, 0)
  );
  protected readonly hasReturnCharge = signal<boolean>(false);
  protected readonly returnChargePercent = signal<number>(0);
  protected readonly totalWithReturnCharge = computed(() => {
    const subtotal = this.materialListSubtotal();
    const percent = Number(this.returnChargePercent()) || 0;
    return subtotal - (subtotal * (percent / 100));
  });
  protected readonly isLoadingMaterialList = signal<boolean>(false);
  protected readonly materialListError = signal<string | null>(null);

  constructor(
    requestService: RequestService,
    customerService: CustomerService,
    toastService: ToastService,
    private readonly returnOrderRequestService: ReturnOrderRequestService,
  ) {
    super(requestService, customerService, toastService);
  }

  protected override getFormOptions() {
    return {
      includeOrderNumber: false,
      includeCreditNumber: false,
      includeStatus: false,
    };
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadMaterialListContext();
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);

    if (changes['initialRequestData'] && !changes['initialRequestData'].firstChange) {
      this.loadMaterialListContext();
    }
  }

  protected override onRequestCreated(requestId: number, _response: unknown): Observable<unknown> {
    const returnOrderId = this.orderId();
    if (!returnOrderId) {
      return of(null);
    }

    return this._requestService.linkReturnOrderToRequest({
      returnOrderId,
      requestId,
    }).pipe(take(1));
  }

  private loadMaterialListContext(): void {
    const rawOrderId = this.route.snapshot.queryParamMap.get('orderId');
    const parsedOrderId = Number(rawOrderId);

    if (Number.isFinite(parsedOrderId) && parsedOrderId > 0) {
      this.loadMaterialListByOrderId(parsedOrderId);
      return;
    }

    const requestId = Number(this.initialRequestData?.id);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      this.setNoAssignedReturnOrderState();
      return;
    }

    this.loadRelatedReturnOrderByRequestId(requestId);
  }

  private loadRelatedReturnOrderByRequestId(requestId: number): void {
    this.isLoadingMaterialList.set(true);
    this.materialListError.set(null);
    this.materialList.set([]);

    this.returnOrderRequestService.getByRequestId(requestId).pipe(take(1)).subscribe({
      next: (materialReturn: ReturnOrderRequestByRequestData | null) => {
        const returnOrderId = Number(materialReturn?.returnOrderId);
        const hasCharge = materialReturn?.returnOrder?.charge === true;
        const policyPercent = Number(materialReturn?.returnOrder?.chargePolicy?.percentage);
        const returnChargePercent = Number(materialReturn?.returnChargePercent);
        const chargePercent = Number.isFinite(policyPercent)
          ? policyPercent
          : (Number.isFinite(returnChargePercent) ? returnChargePercent : 0);

        this.hasReturnCharge.set(hasCharge);
        this.returnChargePercent.set(chargePercent > 0 ? chargePercent : 0);

        if (!Number.isFinite(returnOrderId) || returnOrderId <= 0) {
          this.setNoAssignedReturnOrderState();
          return;
        }

        this.orderId.set(returnOrderId);

        if (Array.isArray(materialReturn?.items) && materialReturn.items.length > 0) {
          this.materialList.set(
            materialReturn.items.map((item) => this.mapReturnOrderRequestItemToMaterial(item, returnOrderId))
          );
          this.isLoadingMaterialList.set(false);
          return;
        }

        this.loadMaterialListByOrderId(returnOrderId);
      },
      error: (error: unknown) => {
        const statusCode = (error as { status?: number })?.status;
        if (statusCode === 404) {
          this.setNoAssignedReturnOrderState();
          return;
        }

        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.materialListError.set(apiMessage?.trim() || 'No fue posible cargar la orden de devolución relacionada.');
        this.orderId.set(null);
        this.materialList.set([]);
        this.isLoadingMaterialList.set(false);
      },
    });
  }

  private loadMaterialListByOrderId(orderId: number): void {
    this.hasReturnCharge.set(false);
    this.returnChargePercent.set(0);
    this.orderId.set(orderId);
    this.isLoadingMaterialList.set(true);
    this.materialListError.set(null);
    this.materialList.set([]);

    this._customerService.getReturnOrderById(orderId).subscribe({
      next: (order: ReturnOrderListEntry | null) => {
        this.materialList.set(order?.items ?? []);
        this.isLoadingMaterialList.set(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.materialListError.set(apiMessage?.trim() || 'No fue posible cargar la lista de materiales de la orden.');
        this.materialList.set([]);
        this.isLoadingMaterialList.set(false);
      },
    });
  }

  private setNoAssignedReturnOrderState(): void {
    this.hasReturnCharge.set(false);
    this.returnChargePercent.set(0);
    this.orderId.set(null);
    this.materialList.set([]);
    this.materialListError.set(null);
    this.isLoadingMaterialList.set(false);
  }

  protected onReturnChargeToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.hasReturnCharge.set(checked);
  }

  private mapReturnOrderRequestItemToMaterial(item: ReturnOrderRequestItem, returnOrderId: number): ReturnOrderListItem {
    return {
      id: Number(item.id),
      returnOrderId,
      invoiceFolio: item.invoiceFolio,
      invoiceClientId: 0,
      conceptoIndex: 0,
      claveProdServ: '',
      descripcion: item.descripcion,
      claveUnidad: item.claveUnidad,
      unidad: item.unidad,
      valorUnitario: Number(item.unitPrice) || 0,
      originalQuantity: Number(item.qtyToReturn) || 0,
      requestedQuantity: Number(item.qtyToReturn) || 0,
      createdAt: item.createdAt,
    };
  }

}
