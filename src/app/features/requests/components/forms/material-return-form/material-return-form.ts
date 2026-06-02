import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RequestService } from '../../../../../core/services/request-service';
import { ChargeTypeOption, CustomerService, ReturnOrderListEntry, ReturnOrderListItem } from '../../../../../core/services/customer-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { BaseRequestForm } from '../../shared/base-request-form';
import { TabsContainer } from '../../../../../shared/components/ui/tab/tab-container/tab-container';
import { Tab } from '../../../../../shared/components/ui/tab/tab';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Autocomplete } from '../../../../../shared/components/ui/autocomplete/autocomplete';
import { CurrencyPipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { Observable, of, forkJoin, switchMap, take, catchError } from 'rxjs';
import { SimpleChanges } from '@angular/core';
import {
  ReturnOrderRequestByRequestData,
  ReturnOrderRequestItem,
  ReturnOrderRequestItemUpdate,
  ReturnOrderRequestService,
} from '../../../../../core/services/return-order-request-service';

@Component({
  selector: 'app-material-return-form',
  imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, Autocomplete, TitleCasePipe, Spinner, DecimalPipe, LucideAngularModule],
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
  private readonly chargeTypeId = signal<number | null>(null);
  protected readonly isSavingCharge = signal<boolean>(false);
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

  protected readonly allReplenishmentZero = computed(() => {
    const list = this.materialList();
    if (list.length === 0) return false;
    const acceptedMap = this.replenishmentAcceptedByMaterialId();
    if (acceptedMap.size === 0) return false;
    return !Array.from(acceptedMap.values()).some(v => v > 0);
  });

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

  override saveRequest(): void {
    if (this.allReplenishmentZero()) {
      return;
    }
    super.saveRequest();
  }

  override saveAndCancel(): void {
    if (this.allReplenishmentZero()) {
      this.cancelActionTriggered.emit();
      return;
    }
    super.saveAndCancel();
  }

  protected override getFormOptions() {
    return {
      includeOrderNumber: true,
      includeCreditNumber: true,
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
        }).pipe(
          take(1),
          catchError(() => of(null))
        );
      }),
      catchError(() => of(null))
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
        const chargeTypeId = materialReturn?.returnOrder?.chargeTypeId ?? null;
        const customRate = materialReturn?.returnOrder?.customRate ?? null;
        const hasCharge = chargeTypeId != null;

        let chargePercent = 0;
        let effectiveChargeTypeId: number | null = null;

        if (customRate !== null && Number.isFinite(Number(customRate)) && Number(customRate) > 0) {
          chargePercent = Number(customRate);
          effectiveChargeTypeId = null;
        } else if (chargeTypeId !== null) {
          const policyPercent = Number(materialReturn?.returnOrder?.chargeType?.percentage);
          chargePercent = Number.isFinite(policyPercent) ? policyPercent : 0;
          effectiveChargeTypeId = chargeTypeId;
        }

        this.hasReturnCharge.set(hasCharge);
        this.returnChargePercent.set(chargePercent > 0 ? chargePercent : 0);
        this.chargeTypeId.set(effectiveChargeTypeId);

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
    this.chargeTypeId.set(null);
    this.orderId.set(orderId);
    this.isLoadingMaterialList.set(true);
    this.materialListError.set(null);
    this.materialList.set([]);
    this.resetItemInputState();

    forkJoin({
      order: this._customerService.getReturnOrderById(orderId).pipe(catchError(() => of(null))),
      chargeTypes: this._customerService.getChargeTypes().pipe(catchError(() => of([] as ChargeTypeOption[]))),
    }).subscribe({
      next: ({ order, chargeTypes }) => {
        const chargeTypeId = order?.chargeTypeId ?? null;
        const customRate = order?.customRate ?? null;
        const hasCharge = chargeTypeId != null || (customRate != null && Number(customRate) > 0);

        let chargePercent = 0;
        let effectiveChargeTypeId: number | null = null;

        if (customRate !== null && Number.isFinite(Number(customRate)) && Number(customRate) > 0) {
          chargePercent = Number(customRate);
          effectiveChargeTypeId = null;
        } else if (chargeTypeId !== null) {
          const fromResponse = Number(order?.chargeType?.percentage);
          const fromCatalog = Number(chargeTypes.find(ct => ct.id === chargeTypeId)?.percentage ?? 0);
          const policyPercent = Number.isFinite(fromResponse) && fromResponse > 0 ? fromResponse : fromCatalog;
          chargePercent = Number.isFinite(policyPercent) ? policyPercent : 0;
          effectiveChargeTypeId = chargeTypeId;
        }

        this.hasReturnCharge.set(hasCharge);
        this.returnChargePercent.set(chargePercent > 0 ? chargePercent : 0);
        this.chargeTypeId.set(effectiveChargeTypeId);

        const clientId = order?.clientId;
        if (clientId && Number.isFinite(clientId) && clientId > 0) {
          this.preFillCustomerFromClientId(clientId);
        }

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
    this.chargeTypeId.set(null);
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
    this.patchReturnOrderCharge();
  }

  protected onReturnChargePercentBlur(event: Event): void {
    const raw = (event.target as HTMLInputElement | null)?.value ?? '';
    const value = parseFloat(raw);
    if (!Number.isFinite(value) || value < 0) return;
    this.returnChargePercent.set(value);
    this.chargeTypeId.set(null);
    this.patchReturnOrderCharge();
  }

  private patchReturnOrderCharge(): void {
    const returnOrderId = this.orderId();
    if (!returnOrderId) return;

    const payload: { chargeTypeId?: number; customRate?: number } = {};

    if (this.hasReturnCharge()) {
      const cid = this.chargeTypeId();
      if (cid !== null) {
        payload.chargeTypeId = cid;
      } else {
        const pct = this.returnChargePercent();
        if (Number.isFinite(pct) && pct > 0) {
          payload.customRate = pct;
        }
      }
    }

    this.isSavingCharge.set(true);

    this._customerService.updateReturnOrderCharge(returnOrderId, payload).pipe(take(1)).subscribe({
      next: () => this.isSavingCharge.set(false),
      error: () => {
        this.isSavingCharge.set(false);
        this._toastService.error('No fue posible actualizar el cargo de devolución.');
      },
    });
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
    const value = event?.target?.value ?? '';
    
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
    const str = String(value ?? '').trim();
    const newMap = new Map(this.replenishmentAcceptedByMaterialId());

    if (str === '') {
      newMap.delete(materialId);
      this.replenishmentAcceptedByMaterialId.set(newMap);
      this.syncMaterialAmountsToForm();
      return;
    }

    const numValue = Number(str);
    if (!Number.isFinite(numValue) || numValue < 0) return;

    const material = this.materialList().find(m => m.id === materialId);
    const maxAllowed = Number(material?.requestedQuantity) || 0;
    if (numValue > maxAllowed) {
      this._toastService.error(`Replanishment accepted no puede ser mayor a ${maxAllowed} (Cant. devuelta)`);
      return;
    }

    newMap.set(materialId, numValue);
    this.replenishmentAcceptedByMaterialId.set(newMap);
    this.syncMaterialAmountsToForm();
  }

  protected updateWarehouseReceived(materialId: number, value: string | number): void {
    const str = String(value ?? '').trim();
    const newMap = new Map(this.warehouseReceivedByMaterialId());

    if (str === '') {
      newMap.delete(materialId);
      this.warehouseReceivedByMaterialId.set(newMap);
      this.syncMaterialAmountsToForm();
      return;
    }

    const numValue = Number(str);
    if (!Number.isFinite(numValue) || numValue < 0) return;

    const material = this.materialList().find(m => m.id === materialId);
    const maxAllowed = Number(material?.requestedQuantity) || 0;
    if (numValue > maxAllowed) {
      this._toastService.error(`Warehouse received no puede ser mayor a ${maxAllowed} (Cant. devuelta)`);
      return;
    }

    newMap.set(materialId, numValue);
    this.warehouseReceivedByMaterialId.set(newMap);
    this.syncMaterialAmountsToForm();
  }

  protected updateWarehouseAccepted(materialId: number, value: string | number): void {
    const str = String(value ?? '').trim();
    const newMap = new Map(this.warehouseAcceptedByMaterialId());

    if (str === '') {
      newMap.delete(materialId);
      this.warehouseAcceptedByMaterialId.set(newMap);
      this.syncMaterialAmountsToForm();
      return;
    }

    const numValue = Number(str);
    if (!Number.isFinite(numValue) || numValue < 0) return;

    const warehouseReceivedQty = this.warehouseReceivedByMaterialId().get(materialId) ?? 0;
    if (numValue > warehouseReceivedQty) {
      this._toastService.error(`Warehouse accepted no puede ser mayor a ${warehouseReceivedQty} (Warehouse received)`);
      return;
    }

    newMap.set(materialId, numValue);
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
      if (item.replenishmentAccepted != null && Number.isFinite(replenishmentAccepted)) {
        replenishmentMap.set(itemId, replenishmentAccepted);
      }

      const warehouseReceived = Number(item.warehouseReceived);
      if (item.warehouseReceived != null && Number.isFinite(warehouseReceived)) {
        warehouseReceivedMap.set(itemId, warehouseReceived);
      }

      const warehouseAccepted = Number(item.warehouseAccepted);
      if (item.warehouseAccepted != null && Number.isFinite(warehouseAccepted)) {
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
      }),
      catchError(() => of(null))
    );
  }

  protected exportMaterialList(): void {
    import('xlsx').then(XLSX => {
      const materials = this.materialList();
      if (!materials.length) return;

      const HEADER = [
        '_id', 'Invoice Folio', 'Descripción', 'Cant. devuelta',
        'Replenishment Accepted', 'Replenishment Rejection Reason',
        'Warehouse Received', 'Warehouse Accepted', 'Warehouse Rejection Reason',
        'SAP ID',
      ];

      const rows = materials.map(m => ({
        '_id': m.id,
        'Invoice Folio': m.invoiceFolio,
        'Descripción': m.descripcion,
        'Cant. devuelta': m.requestedQuantity,
        'Replenishment Accepted': this.replenishmentAcceptedByMaterialId().get(m.id) ?? '',
        'Replenishment Rejection Reason': this.replenishmentReasonByMaterialId().get(m.id) ?? '',
        'Warehouse Received': this.warehouseReceivedByMaterialId().get(m.id) ?? '',
        'Warehouse Accepted': this.warehouseAcceptedByMaterialId().get(m.id) ?? '',
        'Warehouse Rejection Reason': this.warehouseReasonByMaterialId().get(m.id) ?? '',
        'SAP ID': this.sapIdByMaterialId().get(m.id) ?? '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows, { header: HEADER });
      ws['!cols'] = [
        { hidden: true }, { wch: 15 }, { wch: 30 }, { wch: 15 },
        { wch: 22 }, { wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 32 }, { wch: 20 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Material List');
      XLSX.writeFile(wb, 'material_list.xlsx');
    });
  }

  protected onBulkTemplateUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';

    const reader = new FileReader();
    reader.onload = (e) => {
      import('xlsx').then(XLSX => {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const materials = this.materialList();

        if (rows.length !== materials.length) {
          this._toastService.error(
            `El archivo tiene ${rows.length} fila(s) pero se esperan ${materials.length}. No agregues ni elimines filas.`
          );
          return;
        }

        const errors: string[] = [];

        for (const row of rows) {
          const materialId = Number(row['_id']);
          const material = materials.find(m => m.id === materialId);
          if (!material) {
            errors.push(`ID ${materialId} no coincide con ningún material.`);
            continue;
          }

          const repAcc = row['Replenishment Accepted'];
          if (repAcc !== '') this.updateReplenishmentAccepted(materialId, String(repAcc));

          const repReason = String(row['Replenishment Rejection Reason'] ?? '').trim();
          if (repReason) this.setTextMapValue(this.replenishmentReasonByMaterialId, materialId, repReason);

          const whRec = row['Warehouse Received'];
          if (whRec !== '') this.updateWarehouseReceived(materialId, String(whRec));

          const whAcc = row['Warehouse Accepted'];
          if (whAcc !== '') this.updateWarehouseAccepted(materialId, String(whAcc));

          const whReason = String(row['Warehouse Rejection Reason'] ?? '').trim();
          if (whReason) this.setTextMapValue(this.warehouseReasonByMaterialId, materialId, whReason);

          const sapId = String(row['SAP ID'] ?? '').trim();
          if (sapId) this.setTextMapValue(this.sapIdByMaterialId, materialId, sapId);
        }

        if (errors.length) {
          this._toastService.error(errors.join(' | '));
        } else {
          this._toastService.success('Datos importados correctamente');
        }

        this.syncMaterialAmountsToForm();
      });
    };
    reader.readAsArrayBuffer(file);
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
