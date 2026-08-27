import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RequestService } from '../../../../../core/services/request-service';
import { ChargeTypeOption, CustomerService, ReturnOrderListItem } from '../../../../../core/services/customer-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { BaseRequestForm } from '../../shared/base-request-form';
import { ConstraintContext, WorkflowFieldConstraint, WORKFLOW_FIELD_CONSTRAINTS, shouldHideMaterialRow } from '../../shared/request-form-workflow-constraints';
import { TabsContainer } from '../../../../../shared/components/ui/tab/tab-container/tab-container';
import { Tab } from '../../../../../shared/components/ui/tab/tab';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Autocomplete } from '../../../../../shared/components/ui/autocomplete/autocomplete';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { Observable, of, forkJoin, switchMap, take, catchError, Subscription } from 'rxjs';
import { SimpleChanges } from '@angular/core';
import {
  ReturnOrderRequestByRequestData,
  ReturnOrderRequestItem,
  ReturnOrderRequestItemUpdate,
  ReturnOrderRequestService,
} from '../../../../../core/services/return-order-request-service';
import { InvalidInvoicesModal } from '../invalid-invoices-modal/invalid-invoices-modal';

@Component({
  selector: 'app-material-return-form',
  imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, Autocomplete, TitleCasePipe, Spinner, DecimalPipe, LucideAngularModule, InvalidInvoicesModal],
  templateUrl: './material-return-form.html',
  styleUrl: './material-return-form.css',
})
export class MaterialReturnForm extends BaseRequestForm {
  private readonly route = inject(ActivatedRoute);
  private readonly returnOrderRequestId = signal<number | null>(null);

  protected readonly orderId = signal<number | null>(null);
  protected readonly materialList = signal<ReturnOrderListItem[]>([]);
  /** Solo suma las filas no rechazadas: un accepted en 0 sale del total al instante. */
  protected readonly materialListSubtotal = computed(() => {
    const rejected = this.rejectedMaterialIds();
    const hidden = this.hiddenMaterialIds();
    return this.materialList().reduce((total, item) => {
      if (rejected.has(item.id) || hidden.has(item.id)) return total;
      const quantity = Number(item.requestedQuantity) || 0;
      const unitPrice = Number(item.valorUnitario) || 0;
      return total + (quantity * unitPrice);
    }, 0);
  });
  protected readonly hasReturnCharge = signal<boolean>(false);
  protected readonly returnChargePercent = signal<number>(0);
  private readonly chargeTypeId = signal<number | null>(null);
  protected readonly isSavingCharge = signal<boolean>(false);
  protected readonly totalWithReturnCharge = computed(() => {
    const subtotal = this.materialListSubtotal();
    if (!this.hasReturnCharge()) return subtotal;
    const percent = Number(this.returnChargePercent()) || 0;
    return subtotal - (subtotal * (percent / 100));
  });
  protected readonly isLoadingMaterialList = signal<boolean>(false);
  protected readonly materialListError = signal<string | null>(null);

  protected readonly replenishmentAcceptedByMaterialId = signal<Map<number, number>>(new Map());
  protected readonly warehouseReceivedByMaterialId = signal<Map<number, number>>(new Map());
  protected readonly warehouseAcceptedByMaterialId = signal<Map<number, number>>(new Map());
  protected readonly replenishmentReasonByMaterialId = signal<Map<number, string>>(new Map());
  protected readonly warehouseReasonByMaterialId = signal<Map<number, string>>(new Map());
  protected readonly sapIdByMaterialId = signal<Map<number, string>>(new Map());

  private readonly currentConstraintCtx = signal<ConstraintContext>({ step: undefined, assignedRoleName: undefined });

  /**
   * Filas rechazadas (accepted en 0 en cualquier etapa), incluida la que el rol actual
   * acaba de poner en 0: siguen visibles para quien las edita pero no suman al total.
   */
  protected readonly rejectedMaterialIds = computed(() => {
    const replenishmentMap = this.replenishmentAcceptedByMaterialId();
    const warehouseMap = this.warehouseAcceptedByMaterialId();
    const rejected = new Set<number>();
    for (const item of this.materialList()) {
      if (replenishmentMap.get(item.id) === 0 || warehouseMap.get(item.id) === 0) rejected.add(item.id);
    }
    return rejected;
  });

  protected readonly hiddenMaterialIds = computed(() => {
    const ctx = this.currentConstraintCtx();
    const acceptedMap = this.replenishmentAcceptedByMaterialId();
    const warehouseMap = this.warehouseAcceptedByMaterialId();
    const hidden = new Set<number>();
    for (const item of this.materialList()) {
      const id = item.id;
      if (shouldHideMaterialRow(ctx, acceptedMap.get(id) ?? null, warehouseMap.get(id) ?? null)) hidden.add(id);
    }
    return hidden;
  });

  protected readonly allReplenishmentZero = computed(() => {
    const list = this.materialList();
    if (list.length === 0) return false;
    const acceptedMap = this.replenishmentAcceptedByMaterialId();
    if (acceptedMap.size === 0) return false;
    return !Array.from(acceptedMap.values()).some(v => v > 0);
  });

  protected readonly allWarehouseAcceptedZero = computed(() => {
    const list = this.materialList();
    if (list.length === 0) return false;
    const acceptedMap = this.warehouseAcceptedByMaterialId();
    if (acceptedMap.size === 0) return false;
    return !Array.from(acceptedMap.values()).some(v => v > 0);
  });

  protected readonly shouldBlockSave = computed(() =>
    this.allReplenishmentZero() || this.allWarehouseAcceptedZero()
  );

  protected readonly hasReplenishmentIva = signal<boolean>(false);
  protected readonly hasWarehouseIva = signal<boolean>(false);

  protected readonly replenishmentAcceptedTotal = computed(() => this.totalWithReturnCharge());

  protected readonly warehouseReceivedTotal = computed(() => {
    const map = this.warehouseReceivedByMaterialId();
    let total = 0;
    map.forEach((value) => { total += Number(value) || 0; });
    return total;
  });

  protected readonly warehouseAcceptedTotal = computed(() => this.totalWithReturnCharge());

  protected readonly replenishmentIvaAmount = computed(() => {
    const total = this.replenishmentAcceptedTotal();
    return this.hasReplenishmentIva() ? total * 0.16 : 0;
  });

  protected readonly warehouseIvaAmount = computed(() => {
    const total = this.warehouseAcceptedTotal();
    return this.hasWarehouseIva() ? total * 0.16 : 0;
  });

  get materialItemsForm(): FormArray<FormGroup> {
    return this.form.get('materialItems') as FormArray<FormGroup>;
  }

  private materialItemsSub: Subscription | null = null;

  constructor(
    requestService: RequestService,
    customerService: CustomerService,
    toastService: ToastService,
    private readonly returnOrderRequestService: ReturnOrderRequestService,
  ) {
    super(requestService, customerService, toastService);
  }

  protected override createForm(): FormGroup {
    const base = super.createForm();
    base.addControl('materialItems', new FormArray([]));
    return base;
  }

  override saveRequest(): void {
    if (this.shouldBlockSave()) { return; }
    super.saveRequest();
  }

  override saveAndCancel(): void {
    if (this.shouldBlockSave()) {
      this.cancelActionTriggered.emit();
      return;
    }
    super.saveAndCancel();
  }

  protected override getFormOptions() {
    return { includeOrderNumber: true, includeCreditNumber: true, includeStatus: false };
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.materialItemsSub = this.materialItemsForm.valueChanges.subscribe(() => {
      this.syncFormArrayToSignals();
      this.syncMaterialAmountsToForm();
    });
    this.syncIvaFlagsFromForm();
    this.loadMaterialListContext();
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this.materialItemsSub?.unsubscribe();
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

  protected override applyConstraintsToArrayFields(constraints: WorkflowFieldConstraint[], ctx: ConstraintContext): void {
    this.currentConstraintCtx.set(ctx);
    for (const constraint of constraints) {
      if (!constraint.arrayFields?.length) continue;
      const shouldDisable = constraint.disableWhen(ctx);
      for (const group of this.materialItemsForm.controls) {
        for (const field of constraint.arrayFields) {
          const control = (group as FormGroup).get(field);
          if (!control) continue;
          if (shouldDisable) control.disable({ emitEvent: false });
          else control.enable({ emitEvent: false });
        }
      }
    }
  }

  protected override getExtraPayloadKeysToExclude(): string[] {
    return ['materialItems', 'replenishmentTotal', 'warehouseTotal'];
  }

  protected override onRequestCreated(requestId: number, _response: unknown): Observable<unknown> {
    const returnOrderId = this.orderId();
    if (!returnOrderId) { return of(null); }
    return this._requestService.linkReturnOrderToRequest({ returnOrderId, requestId }).pipe(
      take(1),
      switchMap(() => this.returnOrderRequestService.getByRequestId(requestId).pipe(take(1), catchError(() => of(null)))),
      switchMap((returnOrderRequest: ReturnOrderRequestByRequestData | null) => {
        const resolvedId = Number(returnOrderRequest?.id);
        if (!Number.isFinite(resolvedId) || resolvedId <= 0) { return of(null); }
        this.returnOrderRequestId.set(resolvedId);

        const serverItems = returnOrderRequest?.items;
        if (!Array.isArray(serverItems) || serverItems.length === 0) { return of(null); }

        return this.returnOrderRequestService.updateItems(resolvedId, {
          items: this.buildReturnOrderItemsPayloadWithServerIds(serverItems),
        }).pipe(take(1), catchError(() => of(null)));
      }),
      catchError(() => of(null))
    );
  }

  private buildReturnOrderItemsPayloadWithServerIds(serverItems: ReturnOrderRequestItem[]): ReturnOrderRequestItemUpdate[] {
    const materials = this.materialList();
    return serverItems.map((serverItem) => {
      const idx = materials.findIndex(m => m.id === Number(serverItem.returnOrderItemId));
      const group = idx >= 0 ? this.materialItemsForm.at(idx) as FormGroup : null;
      const v = group?.getRawValue() ?? {};
      return {
        id: Number(serverItem.id),
        replenishmentAccepted: v.replenishmentAccepted ?? null,
        replenishmentReasonForRejection: v.replenishmentReason || null,
        warehouseReceived: v.warehouseReceived ?? null,
        warehouseAccepted: v.warehouseAccepted ?? null,
        warehouseReasonForRejection: v.warehouseReason || null,
        sapId: v.sapId || null,
      };
    });
  }

  protected override onRequestUpdated(requestId: number, _response: unknown): Observable<unknown> {
    return this.resolveReturnOrderRequestId(requestId).pipe(
      take(1),
      switchMap((resolvedReturnOrderRequestId) => {
        if (!resolvedReturnOrderRequestId) { return of(null); }
        return this.returnOrderRequestService.updateItems(resolvedReturnOrderRequestId, {
          items: this.buildReturnOrderItemsPayload(),
        }).pipe(take(1), catchError(() => of(null)));
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
    this.rebuildMaterialFormArray();
    this.resetItemInputState();

    this.returnOrderRequestService.getByRequestId(requestId).pipe(take(1)).subscribe({
      next: (materialReturn: ReturnOrderRequestByRequestData | null) => {
        this.returnOrderRequestId.set(Number(materialReturn?.id) || null);
        const returnOrderId = Number(materialReturn?.returnOrderId);
        const chargeTypeId = materialReturn?.returnOrder?.chargeTypeId ?? null;
        const customRate = materialReturn?.returnOrder?.customRate ?? null;
        const hasCharge = chargeTypeId != null || (customRate != null && Number(customRate) > 0);

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

        const currency = materialReturn?.returnOrder?.currency;
        if (currency) {
          this.form.patchValue({ currency }, { emitEvent: false });
        }

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
          this.rebuildMaterialFormArray();
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
        this.rebuildMaterialFormArray();
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
    this.rebuildMaterialFormArray();
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

        const orderCurrency = order?.currency;
        if (orderCurrency) {
          this.form.patchValue({ currency: orderCurrency }, { emitEvent: false });
        }

        const clientId = order?.clientId;
        if (clientId && Number.isFinite(clientId) && clientId > 0) {
          this.preFillCustomerFromClientId(clientId);
        }

        this.materialList.set(order?.items ?? []);
        this.rebuildMaterialFormArray();
        this.syncMaterialAmountsToForm();
        this.isLoadingMaterialList.set(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.materialListError.set(apiMessage?.trim() || 'No fue posible cargar la lista de materiales de la orden.');
        this.materialList.set([]);
        this.rebuildMaterialFormArray();
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
    this.rebuildMaterialFormArray();
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

  protected onSapIdInput(event: Event, idx: number): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    const digits = input.value.replace(/[^0-9]/g, '').slice(0, 9);
    if (digits === input.value) return;
    input.value = digits;
    this.materialItemsForm.at(idx).get('sapId')?.setValue(digits, { emitEvent: false });
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

  protected validateReplenishmentInput(materialId: number, idx: number): void {
    const group = this.materialItemsForm.at(idx) as FormGroup;
    const control = group.get('replenishmentAccepted');
    const numValue = Number(control?.value) || 0;
    const material = this.materialList().find(m => m.id === materialId);
    const maxAllowed = Number(material?.requestedQuantity) || 0;
    if (numValue > maxAllowed) {
      this._toastService.error(`Replanishment accepted no puede ser mayor a ${maxAllowed} (Cant. devuelta)`);
      control?.setValue(null);
    }
    this.updateReasonValidators(idx);
  }

  protected validateWarehouseReceivedInput(materialId: number, idx: number): void {
    const group = this.materialItemsForm.at(idx) as FormGroup;
    const control = group.get('warehouseReceived');
    const numValue = Number(control?.value) || 0;
    const material = this.materialList().find(m => m.id === materialId);
    const maxAllowed = Number(material?.requestedQuantity) || 0;
    if (numValue > maxAllowed) {
      this._toastService.error(`Warehouse received no puede ser mayor a ${maxAllowed} (Cant. devuelta)`);
      control?.setValue(null);
    }
    this.updateReasonValidators(idx);
  }

  protected validateWarehouseAcceptedInput(materialId: number, idx: number): void {
    const group = this.materialItemsForm.at(idx) as FormGroup;
    const control = group.get('warehouseAccepted');
    const numValue = Number(control?.value) || 0;
    const warehouseReceivedQty = this.warehouseReceivedByMaterialId().get(materialId) || 0;
    if (numValue > warehouseReceivedQty) {
      this._toastService.error(`Warehouse accepted no puede ser mayor a ${warehouseReceivedQty} (Warehouse received)`);
      control?.setValue(null);
    }
    this.updateReasonValidators(idx);
  }

  private updateReasonValidators(idx: number): void {
    const group = this.materialItemsForm.at(idx) as FormGroup | undefined;
    const material = this.materialList()[idx];
    if (!group || !material) return;

    const raw = group.getRawValue();

    const repAccepted = raw.replenishmentAccepted;
    const requestedQty = Number(material.requestedQuantity) || 0;
    const repReasonCtrl = group.get('replenishmentReason');
    const repNeedsReason = repAccepted !== null && repAccepted !== '' &&
      Number.isFinite(Number(repAccepted)) && Number(repAccepted) < requestedQty;
    repReasonCtrl?.setValidators(repNeedsReason ? [Validators.required] : null);
    repReasonCtrl?.updateValueAndValidity({ emitEvent: false });

    const whAccepted = raw.warehouseAccepted;
    const whReceived = raw.warehouseReceived;
    const whReasonCtrl = group.get('warehouseReason');
    const whNeedsReason = whAccepted !== null && whAccepted !== '' &&
      whReceived !== null && whReceived !== '' &&
      Number.isFinite(Number(whAccepted)) && Number.isFinite(Number(whReceived)) &&
      Number(whAccepted) < Number(whReceived);
    whReasonCtrl?.setValidators(whNeedsReason ? [Validators.required] : null);
    whReasonCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  private rebuildMaterialFormArray(): void {
    const array = this.materialItemsForm;
    array.clear({ emitEvent: false });
    for (const material of this.materialList()) {
      const id = material.id;
      array.push(new FormGroup({
        replenishmentAccepted: new FormControl<number | null>(this.replenishmentAcceptedByMaterialId().get(id) ?? null),
        replenishmentReason: new FormControl<string>(this.replenishmentReasonByMaterialId().get(id) ?? ''),
        warehouseReceived: new FormControl<number | null>(this.warehouseReceivedByMaterialId().get(id) ?? null),
        warehouseAccepted: new FormControl<number | null>(this.warehouseAcceptedByMaterialId().get(id) ?? null),
        warehouseReason: new FormControl<string>(this.warehouseReasonByMaterialId().get(id) ?? ''),
        sapId: new FormControl<string>(this.sapIdByMaterialId().get(id) ?? '', [Validators.required, Validators.pattern(/^[0-9]{9}$/)]),
      }), { emitEvent: false });
    }

    const ctx: ConstraintContext = {
      step: this.initialRequestData?.workflowCurrentStep?.workflow_step,
      assignedRoleName: this.initialRequestData?.workflowCurrentStep?.assigned_role?.roleName,
    };
    this.applyConstraintsToArrayFields(WORKFLOW_FIELD_CONSTRAINTS, ctx);

    this.materialItemsForm.controls.forEach((_, idx) => this.updateReasonValidators(idx));
  }

  private syncFormArrayToSignals(): void {
    const materials = this.materialList();
    const repMap = new Map<number, number>();
    const recMap = new Map<number, number>();
    const accMap = new Map<number, number>();
    const repReasonMap = new Map<number, string>();
    const whReasonMap = new Map<number, string>();
    const sapIdMap = new Map<number, string>();

    this.materialItemsForm.controls.forEach((group, idx) => {
      const id = materials[idx]?.id;
      if (id == null) return;
      const v = (group as FormGroup).getRawValue();
      if (v.replenishmentAccepted != null) repMap.set(id, v.replenishmentAccepted);
      if (v.warehouseReceived != null) recMap.set(id, v.warehouseReceived);
      if (v.warehouseAccepted != null) accMap.set(id, v.warehouseAccepted);
      if (v.replenishmentReason) repReasonMap.set(id, v.replenishmentReason);
      if (v.warehouseReason) whReasonMap.set(id, v.warehouseReason);
      if (v.sapId) sapIdMap.set(id, v.sapId);
    });

    this.replenishmentAcceptedByMaterialId.set(repMap);
    this.warehouseReceivedByMaterialId.set(recMap);
    this.warehouseAcceptedByMaterialId.set(accMap);
    this.replenishmentReasonByMaterialId.set(repReasonMap);
    this.warehouseReasonByMaterialId.set(whReasonMap);
    this.sapIdByMaterialId.set(sapIdMap);

    this.materialItemsForm.controls.forEach((_, idx) => this.updateReasonValidators(idx));
  }

  private syncMaterialAmountsToForm(): void {
    const replenishmentAmount = this.replenishmentAcceptedTotal();
    const warehouseAmount = this.warehouseAcceptedTotal();
    const replenishmentTotal = this.hasReplenishmentIva() ? replenishmentAmount * 1.16 : replenishmentAmount;
    const warehouseTotal = this.hasWarehouseIva() ? warehouseAmount * 1.16 : warehouseAmount;

    const subtotal = this.totalWithReturnCharge();
    const hasIva = this.hasReplenishmentIva() || this.hasWarehouseIva();
    const totalAmount = hasIva ? subtotal * 1.16 : subtotal;

    this.form.patchValue({
      replenishmentAmount: replenishmentAmount.toFixed(2),
      warehouseAmount: warehouseAmount.toFixed(2),
      replenishmentTotal: replenishmentTotal.toFixed(2),
      warehouseTotal: warehouseTotal.toFixed(2),
      amount: subtotal,
      hasIva,
      totalAmount: totalAmount.toFixed(2),
    }, { emitEvent: false });
  }

  private syncIvaFlagsFromForm(): void {
    this.hasReplenishmentIva.set(this.form.get('hasReplenishmentIva')?.value === true);
    this.hasWarehouseIva.set(this.form.get('hasWarehouseIva')?.value === true);
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
      if (!Number.isFinite(itemId) || itemId <= 0) continue;

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
      if (replenishmentReason.length > 0) replenishmentReasonMap.set(itemId, replenishmentReason);

      const warehouseReason = (item.warehouseReasonForRejection ?? '').trim();
      if (warehouseReason.length > 0) warehouseReasonMap.set(itemId, warehouseReason);

      const sapId = (item.sapId ?? '').trim();
      if (sapId.length > 0) sapIdMap.set(itemId, sapId);
    }

    this.replenishmentAcceptedByMaterialId.set(replenishmentMap);
    this.warehouseReceivedByMaterialId.set(warehouseReceivedMap);
    this.warehouseAcceptedByMaterialId.set(warehouseAcceptedMap);
    this.replenishmentReasonByMaterialId.set(replenishmentReasonMap);
    this.warehouseReasonByMaterialId.set(warehouseReasonMap);
    this.sapIdByMaterialId.set(sapIdMap);
  }

  private buildReturnOrderItemsPayload(): ReturnOrderRequestItemUpdate[] {
    return this.materialList().map((material, idx) => {
      const group = this.materialItemsForm.at(idx) as FormGroup;
      const v = group.getRawValue();
      return {
        id: Number(material.id),
        replenishmentAccepted: v.replenishmentAccepted ?? null,
        replenishmentReasonForRejection: v.replenishmentReason || null,
        warehouseReceived: v.warehouseReceived ?? null,
        warehouseAccepted: v.warehouseAccepted ?? null,
        warehouseReasonForRejection: v.warehouseReason || null,
        sapId: v.sapId || null,
      };
    });
  }

  private resolveReturnOrderRequestId(requestId: number): Observable<number | null> {
    const currentId = this.returnOrderRequestId();
    if (currentId && currentId > 0) { return of(currentId); }

    return this.returnOrderRequestService.getByRequestId(requestId).pipe(
      take(1),
      switchMap((response) => {
        const resolvedId = Number(response?.id);
        if (!Number.isFinite(resolvedId) || resolvedId <= 0) { return of(null); }
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

      const rows = materials.map((m, idx) => {
        const group = this.materialItemsForm.at(idx) as FormGroup;
        const v = group.getRawValue();
        return {
          '_id': m.id,
          'Invoice Folio': m.invoiceFolio,
          'Descripción': m.descripcion,
          'Cant. devuelta': m.requestedQuantity,
          'Replenishment Accepted': v.replenishmentAccepted ?? '',
          'Replenishment Rejection Reason': v.replenishmentReason ?? '',
          'Warehouse Received': v.warehouseReceived ?? '',
          'Warehouse Accepted': v.warehouseAccepted ?? '',
          'Warehouse Rejection Reason': v.warehouseReason ?? '',
          'SAP ID': v.sapId ?? '',
        };
      });

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
          const idx = materials.findIndex(m => m.id === materialId);
          if (idx === -1) {
            errors.push(`ID ${materialId} no coincide con ningún material.`);
            continue;
          }

          const group = this.materialItemsForm.at(idx) as FormGroup;
          const material = materials[idx];

          const repAcc = row['Replenishment Accepted'];
          if (repAcc !== '') {
            const val = Number(repAcc);
            if (Number.isFinite(val) && val >= 0) {
              const max = Number(material.requestedQuantity) || 0;
              group.get('replenishmentAccepted')?.setValue(val > max ? null : val, { emitEvent: false });
            }
          }

          const repReason = String(row['Replenishment Rejection Reason'] ?? '').trim();
          if (repReason) group.get('replenishmentReason')?.setValue(repReason, { emitEvent: false });

          const whRec = row['Warehouse Received'];
          if (whRec !== '') {
            const val = Number(whRec);
            if (Number.isFinite(val) && val >= 0) {
              const max = Number(material.requestedQuantity) || 0;
              group.get('warehouseReceived')?.setValue(val > max ? null : val, { emitEvent: false });
            }
          }

          const whAcc = row['Warehouse Accepted'];
          if (whAcc !== '') {
            const val = Number(whAcc);
            if (Number.isFinite(val) && val >= 0) {
              group.get('warehouseAccepted')?.setValue(val, { emitEvent: false });
            }
          }

          const whReason = String(row['Warehouse Rejection Reason'] ?? '').trim();
          if (whReason) group.get('warehouseReason')?.setValue(whReason, { emitEvent: false });

          const sapId = String(row['SAP ID'] ?? '').trim();
          if (sapId) group.get('sapId')?.setValue(sapId, { emitEvent: false });
        }

        if (errors.length) {
          this._toastService.error(errors.join(' | '));
        } else {
          this._toastService.success('Datos importados correctamente');
        }

        this.syncFormArrayToSignals();
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
