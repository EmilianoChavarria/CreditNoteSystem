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
import { CurrencyPipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { Observable, of, switchMap, take } from 'rxjs';
import { SimpleChanges } from '@angular/core';
import {
  ReturnOrderRequestByRequestData,
  ReturnOrderRequestItem,
  ReturnOrderRequestItemUpdate,
  ReturnOrderRequestService,
} from '../../../../../core/services/return-order-request-service';

@Component({
  selector: 'app-material-return-form',
  imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, Autocomplete, TitleCasePipe, Spinner, DecimalPipe],
  templateUrl: './material-return-form.html',
  styleUrl: './material-return-form.css',
})
export class MaterialReturnForm extends BaseRequestForm {
  private readonly route = inject(ActivatedRoute);
  private readonly returnOrderRequestId = signal<number | null>(null);

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

  // Signals for table row data (keyed by material.id)
  protected readonly replenishmentAcceptedByMaterialId = signal<Map<number, number>>(new Map());
  protected readonly warehouseReceivedByMaterialId = signal<Map<number, number>>(new Map());
  protected readonly warehouseAcceptedByMaterialId = signal<Map<number, number>>(new Map());
  protected readonly replenishmentReasonByMaterialId = signal<Map<number, string>>(new Map());
  protected readonly warehouseReasonByMaterialId = signal<Map<number, string>>(new Map());
  protected readonly sapIdByMaterialId = signal<Map<number, string>>(new Map());

  // Flags for IVA
  protected readonly hasReplenishmentIva = signal<boolean>(false);
  protected readonly hasWarehouseIva = signal<boolean>(false);

  // Computed totals for replenishment (quantity * unit price)
  protected readonly replenishmentAcceptedTotal = computed(() => {
    const acceptedMap = this.replenishmentAcceptedByMaterialId();
    const materials = this.materialList();
    let total = 0;
    
    materials.forEach((material) => {
      const acceptedQty = acceptedMap.get(material.id) || 0;
      const unitPrice = Number(material.valorUnitario) || 0;
      total += (acceptedQty * unitPrice);
    });
    
    return total;
  });

  // Computed total for warehouse received (quantity only, no price multiplication)
  protected readonly warehouseReceivedTotal = computed(() => {
    const map = this.warehouseReceivedByMaterialId();
    let total = 0;
    map.forEach((value) => {
      total += Number(value) || 0;
    });
    return total;
  });

  // Computed total for warehouse accepted (quantity * unit price)
  protected readonly warehouseAcceptedTotal = computed(() => {
    const acceptedMap = this.warehouseAcceptedByMaterialId();
    const materials = this.materialList();
    let total = 0;
    
    materials.forEach((material) => {
      const acceptedQty = acceptedMap.get(material.id) || 0;
      const unitPrice = Number(material.valorUnitario) || 0;
      total += (acceptedQty * unitPrice);
    });
    
    return total;
  });

  // Computed IVA amounts (16% = 0.16)
  protected readonly replenishmentIvaAmount = computed(() => {
    const total = this.replenishmentAcceptedTotal();
    return this.hasReplenishmentIva() ? total * 0.16 : 0;
  });

  protected readonly warehouseIvaAmount = computed(() => {
    const total = this.warehouseAcceptedTotal();
    return this.hasWarehouseIva() ? total * 0.16 : 0;
  });

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
    this.syncIvaFlagsFromForm();
    this.loadMaterialListContext();
  }

  override ngOnChanges(changes: SimpleChanges): void {
    super.ngOnChanges(changes);

    if (changes['initialRequestData']) {
      this.syncIvaFlagsFromForm();
      this.syncMaterialAmountsToForm();
    }

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

  protected override onRequestUpdated(requestId: number, _response: unknown): Observable<unknown> {
    return this.resolveReturnOrderRequestId(requestId).pipe(
      take(1),
      switchMap((resolvedReturnOrderRequestId) => {
        if (!resolvedReturnOrderRequestId) {
          return of(null);
        }

        return this.returnOrderRequestService.updateItems(resolvedReturnOrderRequestId, {
          items: this.buildReturnOrderItemsPayload(),
        }).pipe(take(1));
      })
    );
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
    this.resetItemInputState();

    this.returnOrderRequestService.getByRequestId(requestId).pipe(take(1)).subscribe({
      next: (materialReturn: ReturnOrderRequestByRequestData | null) => {
        this.returnOrderRequestId.set(Number(materialReturn?.id) || null);
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
          this.applyExistingItemValues(materialReturn.items);
          this.materialList.set(
            materialReturn.items.map((item) => this.mapReturnOrderRequestItemToMaterial(item, returnOrderId))
          );
          this.syncMaterialAmountsToForm();
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
        this.returnOrderRequestId.set(null);
        this.materialList.set([]);
        this.resetItemInputState();
        this.isLoadingMaterialList.set(false);
      },
    });
  }

  private loadMaterialListByOrderId(orderId: number): void {
    this.returnOrderRequestId.set(null);
    this.hasReturnCharge.set(false);
    this.returnChargePercent.set(0);
    this.orderId.set(orderId);
    this.isLoadingMaterialList.set(true);
    this.materialListError.set(null);
    this.materialList.set([]);
    this.resetItemInputState();

    this._customerService.getReturnOrderById(orderId).subscribe({
      next: (order: ReturnOrderListEntry | null) => {
        this.materialList.set(order?.items ?? []);
        this.syncMaterialAmountsToForm();
        this.isLoadingMaterialList.set(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.materialListError.set(apiMessage?.trim() || 'No fue posible cargar la lista de materiales de la orden.');
        this.materialList.set([]);
        this.resetItemInputState();
        this.isLoadingMaterialList.set(false);
      },
    });
  }

  private setNoAssignedReturnOrderState(): void {
    this.hasReturnCharge.set(false);
    this.returnChargePercent.set(0);
    this.orderId.set(null);
    this.returnOrderRequestId.set(null);
    this.materialList.set([]);
    this.resetItemInputState();
    this.materialListError.set(null);
    this.isLoadingMaterialList.set(false);
    this.syncMaterialAmountsToForm();
  }

  protected onReturnChargeToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.hasReturnCharge.set(checked);
  }

  protected onReplenishmentIvaToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.hasReplenishmentIva.set(checked);
    this.syncMaterialAmountsToForm();
  }

  protected onWarehouseIvaToggle(event: Event): void {
    const checked = (event.target as HTMLInputElement | null)?.checked === true;
    this.hasWarehouseIva.set(checked);
    this.syncMaterialAmountsToForm();
  }

  protected onTableInputChange(materialId: number, fieldType: 'replenishment' | 'warehouseReceived' | 'warehouseAccepted', event: any): void {
    const value = event?.target?.value || '';
    
    if (fieldType === 'replenishment') {
      this.updateReplenishmentAccepted(materialId, value);
    } else if (fieldType === 'warehouseReceived') {
      this.updateWarehouseReceived(materialId, value);
    } else if (fieldType === 'warehouseAccepted') {
      this.updateWarehouseAccepted(materialId, value);
    }

    this.syncMaterialAmountsToForm();
  }

  protected onTextFieldChange(
    materialId: number,
    fieldType: 'replenishmentReason' | 'warehouseReason' | 'sapId',
    event: Event
  ): void {
    const value = ((event.target as HTMLInputElement | null)?.value ?? '').trim();

    if (fieldType === 'replenishmentReason') {
      this.setTextMapValue(this.replenishmentReasonByMaterialId, materialId, value);
      return;
    }

    if (fieldType === 'warehouseReason') {
      this.setTextMapValue(this.warehouseReasonByMaterialId, materialId, value);
      return;
    }

    this.setTextMapValue(this.sapIdByMaterialId, materialId, value);
  }

  protected getTextFieldValue(
    materialId: number,
    fieldType: 'replenishmentReason' | 'warehouseReason' | 'sapId'
  ): string {
    if (fieldType === 'replenishmentReason') {
      return this.replenishmentReasonByMaterialId().get(materialId) ?? '';
    }

    if (fieldType === 'warehouseReason') {
      return this.warehouseReasonByMaterialId().get(materialId) ?? '';
    }

    return this.sapIdByMaterialId().get(materialId) ?? '';
  }

  protected getMaterialAmount(materialId: number, fieldType: 'replenishment' | 'warehouseAccepted'): number {
    const material = this.materialList().find(m => m.id === materialId);
    if (!material) return 0;
    
    const unitPrice = Number(material.valorUnitario) || 0;
    let quantity = 0;
    
    if (fieldType === 'replenishment') {
      quantity = this.replenishmentAcceptedByMaterialId().get(materialId) || 0;
    } else if (fieldType === 'warehouseAccepted') {
      quantity = this.warehouseAcceptedByMaterialId().get(materialId) || 0;
    }
    
    return quantity * unitPrice;
  }

  protected validateReplenishmentInput(materialId: number, event: any): void {
    const numValue = Number(event.target.value) || 0;
    const material = this.materialList().find(m => m.id === materialId);
    const maxAllowed = Number(material?.requestedQuantity) || 0;
    
    if (numValue > maxAllowed) {
      event.target.value = '';
    }
  }

  protected validateWarehouseReceivedInput(materialId: number, event: any): void {
    const numValue = Number(event.target.value) || 0;
    const material = this.materialList().find(m => m.id === materialId);
    const maxAllowed = Number(material?.requestedQuantity) || 0;
    
    if (numValue > maxAllowed) {
      event.target.value = '';
    }
  }

  protected validateWarehouseAcceptedInput(materialId: number, event: any): void {
    const numValue = Number(event.target.value) || 0;
    const warehouseReceivedQty = this.warehouseReceivedByMaterialId().get(materialId) || 0;
    
    if (numValue > warehouseReceivedQty) {
      event.target.value = '';
    }
  }

  protected updateReplenishmentAccepted(materialId: number, value: string | number): void {
    const numValue = Number(value) || 0;
    const material = this.materialList().find(m => m.id === materialId);
    const maxAllowed = Number(material?.requestedQuantity) || 0;
    
    if (numValue > maxAllowed) {
      this._toastService.error(`Replanishment accepted no puede ser mayor a ${maxAllowed} (Cant. devuelta)`);
      return;
    }
    
    const newMap = new Map(this.replenishmentAcceptedByMaterialId());
    if (numValue === 0) {
      newMap.delete(materialId);
    } else {
      newMap.set(materialId, numValue);
    }
    this.replenishmentAcceptedByMaterialId.set(newMap);
    this.syncMaterialAmountsToForm();
  }

  protected updateWarehouseReceived(materialId: number, value: string | number): void {
    const numValue = Number(value) || 0;
    const material = this.materialList().find(m => m.id === materialId);
    const maxAllowed = Number(material?.requestedQuantity) || 0;
    
    if (numValue > maxAllowed) {
      this._toastService.error(`Warehouse received no puede ser mayor a ${maxAllowed} (Cant. devuelta)`);
      return;
    }
    
    const newMap = new Map(this.warehouseReceivedByMaterialId());
    if (numValue === 0) {
      newMap.delete(materialId);
    } else {
      newMap.set(materialId, numValue);
    }
    this.warehouseReceivedByMaterialId.set(newMap);
    this.syncMaterialAmountsToForm();
  }

  protected updateWarehouseAccepted(materialId: number, value: string | number): void {
    const numValue = Number(value) || 0;
    const warehouseReceivedQty = this.warehouseReceivedByMaterialId().get(materialId) || 0;
    
    if (numValue > warehouseReceivedQty) {
      this._toastService.error(`Warehouse accepted no puede ser mayor a ${warehouseReceivedQty} (Warehouse received)`);
      return;
    }
    
    const newMap = new Map(this.warehouseAcceptedByMaterialId());
    if (numValue === 0) {
      newMap.delete(materialId);
    } else {
      newMap.set(materialId, numValue);
    }
    this.warehouseAcceptedByMaterialId.set(newMap);
    this.syncMaterialAmountsToForm();
  }

  private syncMaterialAmountsToForm(): void {
    const replenishmentAmount = this.replenishmentAcceptedTotal();
    const warehouseAmount = this.warehouseAcceptedTotal();
    const replenishmentTotal = this.hasReplenishmentIva()
      ? replenishmentAmount * 1.16
      : replenishmentAmount;
    const warehouseTotal = this.hasWarehouseIva()
      ? warehouseAmount * 1.16
      : warehouseAmount;

    this.form.patchValue({
      replenishmentAmount: replenishmentAmount.toFixed(2),
      warehouseAmount: warehouseAmount.toFixed(2),
      replenishmentTotal: replenishmentTotal.toFixed(2),
      warehouseTotal: warehouseTotal.toFixed(2),
    }, { emitEvent: false });
  }

  private syncIvaFlagsFromForm(): void {
    const hasReplenishmentIva = this.form.get('hasReplenishmentIva')?.value === true;
    const hasWarehouseIva = this.form.get('hasWarehouseIva')?.value === true;

    this.hasReplenishmentIva.set(hasReplenishmentIva);
    this.hasWarehouseIva.set(hasWarehouseIva);
  }

  private setTextMapValue(targetSignal: { (): Map<number, string>; set(value: Map<number, string>): void }, materialId: number, value: string): void {
    const newMap = new Map(targetSignal());
    if (value.length === 0) {
      newMap.delete(materialId);
    } else {
      newMap.set(materialId, value);
    }
    targetSignal.set(newMap);
  }

  private resetItemInputState(): void {
    this.replenishmentAcceptedByMaterialId.set(new Map());
    this.warehouseReceivedByMaterialId.set(new Map());
    this.warehouseAcceptedByMaterialId.set(new Map());
    this.replenishmentReasonByMaterialId.set(new Map());
    this.warehouseReasonByMaterialId.set(new Map());
    this.sapIdByMaterialId.set(new Map());
  }

  private applyExistingItemValues(items: ReturnOrderRequestItem[]): void {
    const replenishmentMap = new Map<number, number>();
    const warehouseReceivedMap = new Map<number, number>();
    const warehouseAcceptedMap = new Map<number, number>();
    const replenishmentReasonMap = new Map<number, string>();
    const warehouseReasonMap = new Map<number, string>();
    const sapIdMap = new Map<number, string>();

    for (const item of items) {
      const itemId = Number(item.id);
      if (!Number.isFinite(itemId) || itemId <= 0) {
        continue;
      }

      const replenishmentAccepted = Number(item.replenishmentAccepted);
      if (Number.isFinite(replenishmentAccepted) && replenishmentAccepted > 0) {
        replenishmentMap.set(itemId, replenishmentAccepted);
      }

      const warehouseReceived = Number(item.warehouseReceived);
      if (Number.isFinite(warehouseReceived) && warehouseReceived > 0) {
        warehouseReceivedMap.set(itemId, warehouseReceived);
      }

      const warehouseAccepted = Number(item.warehouseAccepted);
      if (Number.isFinite(warehouseAccepted) && warehouseAccepted > 0) {
        warehouseAcceptedMap.set(itemId, warehouseAccepted);
      }

      const replenishmentReason = (item.replenishmentReasonForRejection ?? '').trim();
      if (replenishmentReason.length > 0) {
        replenishmentReasonMap.set(itemId, replenishmentReason);
      }

      const warehouseReason = (item.warehouseReasonForRejection ?? '').trim();
      if (warehouseReason.length > 0) {
        warehouseReasonMap.set(itemId, warehouseReason);
      }

      const sapId = (item.sapId ?? '').trim();
      if (sapId.length > 0) {
        sapIdMap.set(itemId, sapId);
      }
    }

    this.replenishmentAcceptedByMaterialId.set(replenishmentMap);
    this.warehouseReceivedByMaterialId.set(warehouseReceivedMap);
    this.warehouseAcceptedByMaterialId.set(warehouseAcceptedMap);
    this.replenishmentReasonByMaterialId.set(replenishmentReasonMap);
    this.warehouseReasonByMaterialId.set(warehouseReasonMap);
    this.sapIdByMaterialId.set(sapIdMap);
  }

  private buildReturnOrderItemsPayload(): ReturnOrderRequestItemUpdate[] {
    return this.materialList().map((material) => {
      const itemId = Number(material.id);

      return {
        id: itemId,
        replenishmentAccepted: this.replenishmentAcceptedByMaterialId().get(itemId) ?? null,
        replenishmentReasonForRejection: this.replenishmentReasonByMaterialId().get(itemId) ?? null,
        warehouseReceived: this.warehouseReceivedByMaterialId().get(itemId) ?? null,
        warehouseAccepted: this.warehouseAcceptedByMaterialId().get(itemId) ?? null,
        warehouseReasonForRejection: this.warehouseReasonByMaterialId().get(itemId) ?? null,
        sapId: this.sapIdByMaterialId().get(itemId) ?? null,
      };
    });
  }

  private resolveReturnOrderRequestId(requestId: number): Observable<number | null> {
    const currentId = this.returnOrderRequestId();
    if (currentId && currentId > 0) {
      return of(currentId);
    }

    return this.returnOrderRequestService.getByRequestId(requestId).pipe(
      take(1),
      switchMap((response) => {
        const resolvedId = Number(response?.id);
        if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
          return of(null);
        }

        this.returnOrderRequestId.set(resolvedId);
        return of(resolvedId);
      })
    );
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
