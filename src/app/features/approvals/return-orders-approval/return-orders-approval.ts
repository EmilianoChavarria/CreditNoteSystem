import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, take } from 'rxjs';
import {
  CustomerInvoiceProduct,
  CustomerService,
  ReturnOrderSearchEntry,
  ReturnOrderListItem,
  ReturnOrderDetail,
  ReturnOrderDetailItem,
} from '../../../core/services/customer-service';
import { AssignExistingRequestModal } from './assign-existing-request-modal';
import { Clients } from '../../clients/clients';
import { Customer } from '../../../data/interfaces/Customer';
import { ToastService } from '../../../core/services/toast-service';
import { Skeleton } from '../../../shared/components/ui/skeleton/skeleton';
import { DeleteItemConfirmModal } from './delete-item-confirm-modal';

interface ApprovalOrderProduct {
  id: string;
  itemId: number;
  invoiceFolio: string;
  conceptoIndex: number;
  claveProdServ: string;
  descripcion: string;
  quantity: number;
  originalQuantity: number;
  unit: string;
  unitPrice: number;
  isEditable: boolean;
}

type ApprovalStatus = 'pending' | 'in process' | 'cancelled' | 'released';

interface ReturnOrderForApproval {
  id: number;
  clientId: number;
  orderNumber: string;
  customerName: string;
  customerCode: string;
  createdBy: string;
  createdAt: string;
  subtotal: number;
  notes:string;
  tax: number;
  total: number;
  status: ApprovalStatus;
  invoices: string[];
  products: ApprovalOrderProduct[];
}

@Component({
  selector: 'app-return-orders-approval',
  imports: [CommonModule, ReactiveFormsModule, AssignExistingRequestModal, TranslatePipe, Clients, Skeleton, DeleteItemConfirmModal],
  templateUrl: './return-orders-approval.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReturnOrdersApproval {
  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  protected readonly viewMode = signal<'search' | 'create'>('search');

  // ── search-existing mode ──────────────────────────────────────────────────
  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });

  // ── create-new mode ───────────────────────────────────────────────────────
  protected readonly clientSearchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly clientSearchResults = signal<Customer[]>([]);
  protected readonly isSearchingClients = signal<boolean>(false);
  protected readonly selectedClient = signal<Customer | null>(null);
  private readonly searchTerm = toSignal(
    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      debounceTime(300),
      map(value => value.trim()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  protected readonly orders = signal<ReturnOrderForApproval[]>([]);
  protected readonly isLoadingOrders = signal<boolean>(false);
  protected readonly ordersLoadError = signal<string | null>(null);
  protected readonly hasSearched = signal<boolean>(false);
  protected readonly emptySearchMessage = signal<string>('Escribe una razon social o un clientId para buscar órdenes.');

  protected readonly expandedOrderIds = signal<Set<number>>(new Set());
  protected readonly assignRequestModalOpen = signal<boolean>(false);
  protected readonly selectedOrderNumber = signal<string | null>(null);
  protected readonly selectedClientId = signal<number | null>(null);
  protected readonly selectedOrderId = signal<number | null>(null);

  // ── order detail / editing ────────────────────────────────────────────────
  protected readonly orderDetails = signal<Map<number, ReturnOrderDetail>>(new Map());
  protected readonly loadingDetailIds = signal<Set<number>>(new Set());
  protected readonly detailErrors = signal<Map<number, string>>(new Map());

  protected readonly editingItemId = signal<number | null>(null);
  protected readonly editQuantityControl = new FormControl<number>(1, { nonNullable: true });
  protected readonly savingItemId = signal<number | null>(null);
  protected readonly deletingItemId = signal<number | null>(null);
  protected readonly deleteConfirmOpen = signal<boolean>(false);
  protected readonly pendingDeleteOrderId = signal<number | null>(null);
  protected readonly pendingDeleteItemId = signal<number | null>(null);

  protected readonly addMaterialOrderId = signal<number | null>(null);
  protected readonly addFolioControl = new FormControl<string>('', { nonNullable: true });
  protected readonly addProducts = signal<CustomerInvoiceProduct[]>([]);
  protected readonly isLoadingAddProducts = signal<boolean>(false);
  protected readonly addProductsError = signal<string | null>(null);
  protected readonly addQuantities = signal<Record<number, number>>({});
  protected readonly addingConceptoIndex = signal<number | null>(null);

  constructor() {
    this.clientSearchControl.valueChanges.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      map(v => v.trim()),
      switchMap(term => {
        if (!term) {
          this.clientSearchResults.set([]);
          this.isSearchingClients.set(false);
          return of([]);
        }
        this.isSearchingClients.set(true);
        return this.customerService.getCustomersByName(term).pipe(
          catchError(() => of([])),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(results => {
      this.clientSearchResults.set(results as Customer[]);
      this.isSearchingClients.set(false);
    });

    effect(() => {
      const term = this.searchTerm();

      if (!term) {
        this.hasSearched.set(false);
        this.orders.set([]);
        this.ordersLoadError.set(null);
        this.isLoadingOrders.set(false);
        this.expandedOrderIds.set(new Set());
        return;
      }

      this.hasSearched.set(true);
      this.loadOrders(term);
    });
  }

  protected selectClient(client: Customer): void {
    this.selectedClient.set(client);
    this.clientSearchControl.setValue('');
    this.clientSearchResults.set([]);
  }

  protected clearSelectedClient(): void {
    this.selectedClient.set(null);
    this.clientSearchControl.setValue('');
    this.clientSearchResults.set([]);
  }

  protected switchMode(mode: 'search' | 'create'): void {
    this.viewMode.set(mode);
    if (mode === 'search') {
      this.clearSelectedClient();
    }
  }

  protected toggleOrder(orderId: number): void {
    this.expandedOrderIds.update(current => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
        this.loadOrderDetail(orderId);
      }
      return next;
    });
  }

  protected isExpanded(orderId: number): boolean {
    return this.expandedOrderIds().has(orderId);
  }

  // ── order detail ───────────────────────────────────────────────────────────
  protected isLoadingDetail(orderId: number): boolean {
    return this.loadingDetailIds().has(orderId);
  }

  protected detailError(orderId: number): string | null {
    return this.detailErrors().get(orderId) ?? null;
  }

  protected productsForOrder(order: ReturnOrderForApproval): ApprovalOrderProduct[] {
    const detail = this.orderDetails().get(order.id);
    if (detail) {
      return detail.items.map(item => this.mapDetailItem(item));
    }
    return order.products;
  }

  protected orderSubtotal(order: ReturnOrderForApproval): number {
    const products = this.productsForOrder(order);
    return products.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
  }

  protected orderInvoices(order: ReturnOrderForApproval): string[] {
    const products = this.productsForOrder(order);
    return Array.from(new Set(products.map(product => product.invoiceFolio)));
  }

  protected canEditOrder(orderId: number): boolean {
    const detail = this.orderDetails().get(orderId);
    if (!detail) {
      return false;
    }
    if (!detail.orderStatus) {
      return true;
    }
    return !(detail.linkedRequest?.isFinalized ?? false);
  }

  protected isOrderFinalized(orderId: number): boolean {
    const detail = this.orderDetails().get(orderId);
    return !!detail?.orderStatus && !!detail.linkedRequest?.isFinalized;
  }

  private loadOrderDetail(orderId: number): void {
    this.loadingDetailIds.update(current => new Set(current).add(orderId));
    this.detailErrors.update(current => {
      const next = new Map(current);
      next.delete(orderId);
      return next;
    });

    this.customerService.getReturnOrderById(orderId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (detail) => {
        if (detail) {
          this.orderDetails.update(current => new Map(current).set(orderId, detail));
        }
        this.loadingDetailIds.update(current => {
          const next = new Set(current);
          next.delete(orderId);
          return next;
        });
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.detailErrors.update(current =>
          new Map(current).set(orderId, apiMessage?.trim() || 'No fue posible cargar el detalle de la orden.'),
        );
        this.loadingDetailIds.update(current => {
          const next = new Set(current);
          next.delete(orderId);
          return next;
        });
      },
    });
  }

  private mapDetailItem(item: ReturnOrderDetailItem): ApprovalOrderProduct {
    return {
      id: String(item.id),
      itemId: item.id,
      invoiceFolio: item.invoiceFolio,
      conceptoIndex: item.conceptoIndex,
      claveProdServ: item.claveProdServ,
      descripcion: item.descripcion,
      quantity: item.requestedQuantity,
      originalQuantity: item.originalQuantity,
      unit: item.unidad || item.claveUnidad,
      unitPrice: Number(item.valorUnitario) || 0,
      isEditable: item.isEditable,
    };
  }

  // ── edit quantity ────────────────────────────────────────────────────────
  protected isEditingItem(itemId: number): boolean {
    return this.editingItemId() === itemId;
  }

  protected isSavingItem(itemId: number): boolean {
    return this.savingItemId() === itemId;
  }

  protected isDeletingItem(itemId: number): boolean {
    return this.deletingItemId() === itemId;
  }

  protected startEditQuantity(item: ApprovalOrderProduct): void {
    this.editingItemId.set(item.itemId);
    this.editQuantityControl.setValue(item.quantity);
  }

  protected cancelEditQuantity(): void {
    this.editingItemId.set(null);
  }

  protected saveQuantity(orderId: number, itemId: number): void {
    const value = Number(this.editQuantityControl.value);

    if (!Number.isFinite(value) || value <= 0) {
      this.toastService.error('Ingresa una cantidad válida mayor a cero.', 'Error');
      return;
    }

    this.savingItemId.set(itemId);

    this.customerService.updateReturnOrderItemQuantity(orderId, itemId, value).pipe(take(1)).subscribe({
      next: (detail) => {
        this.orderDetails.update(current => new Map(current).set(orderId, detail));
        this.editingItemId.set(null);
        this.savingItemId.set(null);
        this.toastService.success('Cantidad actualizada correctamente.', 'Éxito');
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.toastService.error(apiMessage?.trim() || 'No fue posible actualizar la cantidad.', 'Error');
        this.savingItemId.set(null);
      },
    });
  }

  // ── delete item ──────────────────────────────────────────────────────────
  protected deleteItem(orderId: number, itemId: number): void {
    this.pendingDeleteOrderId.set(orderId);
    this.pendingDeleteItemId.set(itemId);
    this.deleteConfirmOpen.set(true);
  }

  protected onDeleteConfirmModalChange(isOpen: boolean): void {
    this.deleteConfirmOpen.set(isOpen);

    if (!isOpen) {
      this.pendingDeleteOrderId.set(null);
      this.pendingDeleteItemId.set(null);
    }
  }

  protected confirmDeleteItem(): void {
    const orderId = this.pendingDeleteOrderId();
    const itemId = this.pendingDeleteItemId();

    if (orderId === null || itemId === null) {
      return;
    }

    this.deletingItemId.set(itemId);

    this.customerService.deleteReturnOrderItem(orderId, itemId).pipe(take(1)).subscribe({
      next: (detail) => {
        this.orderDetails.update(current => new Map(current).set(orderId, detail));
        this.deletingItemId.set(null);
        this.deleteConfirmOpen.set(false);
        this.pendingDeleteOrderId.set(null);
        this.pendingDeleteItemId.set(null);
        this.toastService.success('Material eliminado de la orden.', 'Éxito');
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.toastService.error(apiMessage?.trim() || 'No fue posible eliminar el material.', 'Error');
        this.deletingItemId.set(null);
      },
    });
  }

  // ── add material ─────────────────────────────────────────────────────────
  protected isAddMaterialOpen(orderId: number): boolean {
    return this.addMaterialOrderId() === orderId;
  }

  protected openAddMaterial(orderId: number): void {
    this.addMaterialOrderId.set(orderId);
    this.addFolioControl.setValue('');
    this.addProducts.set([]);
    this.addProductsError.set(null);
    this.addQuantities.set({});
  }

  protected closeAddMaterial(): void {
    this.addMaterialOrderId.set(null);
    this.addProducts.set([]);
    this.addProductsError.set(null);
  }

  protected searchInvoiceForAdd(orderId: number): void {
    const folio = this.addFolioControl.value.trim();
    const detail = this.orderDetails().get(orderId);

    if (!folio || !detail) {
      return;
    }

    this.isLoadingAddProducts.set(true);
    this.addProductsError.set(null);
    this.addProducts.set([]);

    this.customerService.getInvoiceProductsByFolio(folio, String(detail.clientId)).pipe(take(1)).subscribe({
      next: (products) => {
        const availableProducts = products.filter(product => (Number(product.availableQuantity) || 0) > 0);
        this.addProducts.set(availableProducts);
        this.isLoadingAddProducts.set(false);
        if (availableProducts.length === 0) {
          this.addProductsError.set('No hay productos disponibles para esta factura.');
        }
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.addProductsError.set(apiMessage?.trim() || 'No fue posible cargar los productos de la factura.');
        this.isLoadingAddProducts.set(false);
      },
    });
  }

  protected getAddQuantity(product: CustomerInvoiceProduct): number {
    return this.addQuantities()[product.conceptoIndex] ?? 1;
  }

  protected setAddQuantity(product: CustomerInvoiceProduct, rawValue: string): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const quantity = Math.max(1, Math.min(Number(product.availableQuantity) || 1, Math.floor(parsed)));
    this.addQuantities.update(current => ({ ...current, [product.conceptoIndex]: quantity }));
  }

  protected adjustAddQuantity(product: CustomerInvoiceProduct, delta: number): void {
    this.setAddQuantity(product, String(this.getAddQuantity(product) + delta));
  }

  protected isAddingConcepto(conceptoIndex: number): boolean {
    return this.addingConceptoIndex() === conceptoIndex;
  }

  protected addMaterialToOrder(orderId: number, product: CustomerInvoiceProduct): void {
    const detail = this.orderDetails().get(orderId);
    const folio = this.addFolioControl.value.trim();

    if (!detail || !folio) {
      return;
    }

    const quantity = this.getAddQuantity(product);
    const existingItem = detail.items.find(
      item => item.invoiceFolio === folio && item.conceptoIndex === product.conceptoIndex,
    );

    this.addingConceptoIndex.set(product.conceptoIndex);

    const request$ = existingItem
      ? this.customerService.updateReturnOrderItemQuantity(
          orderId,
          existingItem.id,
          existingItem.requestedQuantity + quantity,
        )
      : this.customerService.addReturnOrderItems(orderId, [{
          invoiceFolio: folio,
          invoiceClientId: detail.clientId,
          conceptoIndex: product.conceptoIndex,
          requestedQuantity: quantity,
        }]);

    request$.pipe(take(1)).subscribe({
      next: (updatedDetail) => {
        this.orderDetails.update(current => new Map(current).set(orderId, updatedDetail));
        this.addQuantities.update(current => {
          const next = { ...current };
          delete next[product.conceptoIndex];
          return next;
        });
        this.addingConceptoIndex.set(null);
        this.toastService.success('Material agregado a la orden.', 'Éxito');
        this.searchInvoiceForAdd(orderId);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.toastService.error(apiMessage?.trim() || 'No fue posible agregar el material.', 'Error');
        this.addingConceptoIndex.set(null);
      },
    });
  }

  protected approveOrder(orderId: number): void {
    this.router.navigate(['/app/request/new-request'], {
      queryParams: {
        requestType: 'material return',
        requestTypeId: 6,
        orderId,
      },
    });
  }

  protected openAssignRequestModal(order: ReturnOrderForApproval): void {
    this.selectedClientId.set(order.clientId);
    this.selectedOrderId.set(order.id);
    this.selectedOrderNumber.set(order.orderNumber);
    this.assignRequestModalOpen.set(true);
  }

  protected onAssignRequestModalChange(isOpen = false): void {
    this.assignRequestModalOpen.set(isOpen);

    if (!isOpen) {
      this.selectedOrderNumber.set(null);
      this.selectedClientId.set(null);
      this.selectedOrderId.set(null);
    }
  }

  protected onAssignRequestCompleted(): void {
    const term = this.searchTerm().trim();

    if (!term) {
      this.orders.set([]);
      this.expandedOrderIds.set(new Set());
      this.hasSearched.set(false);
      return;
    }

    this.hasSearched.set(true);
    this.loadOrders(term);
  }

  protected rejectOrder(orderId: number): void {
    this.orders.update(current =>
      current.map(order => (order.id === orderId ? { ...order, status: 'cancelled' } : order)),
    );
  }

  protected statusClasses(status: ApprovalStatus): string {
    if (status === 'pending') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    if (status === 'in process') {
      return 'border-blue-200 bg-blue-50 text-blue-700';
    }

    if (status === 'released') {
      return 'border-green-200 bg-green-50 text-green-700';
    }

    return 'border-red-200 bg-red-50 text-red-700';
  }

  protected statusLabel(status: ApprovalStatus): string {
    if (status === 'pending') {
      return 'Pendiente';
    }

    if (status === 'in process') {
      return 'En proceso';
    }

    if (status === 'released') {
      return 'Liberada';
    }

    return 'Cancelada';
  }

  protected hasFilteredResults(): boolean {
    return this.hasSearched() && this.orders().length === 0;
  }

  private loadOrders(term: string): void {
    this.isLoadingOrders.set(true);
    this.ordersLoadError.set(null);

    this.customerService.searchReturnOrders(term).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (orders) => {
        this.orders.set(orders.map(order => this.mapSearchResult(order)));
        this.orderDetails.set(new Map());
        const firstOrderId = this.orders()[0]?.id;
        this.expandedOrderIds.set(new Set(firstOrderId ? [firstOrderId] : []));
        if (firstOrderId) {
          this.loadOrderDetail(firstOrderId);
        }
        this.isLoadingOrders.set(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.ordersLoadError.set(apiMessage?.trim() || 'No fue posible buscar las órdenes de devolución.');
        this.orders.set([]);
        this.isLoadingOrders.set(false);
      },
    });
  }

  private mapSearchResult(order: ReturnOrderSearchEntry): ReturnOrderForApproval {
    const products = (order.items ?? []).map((item, index) => this.mapOrderProduct(item, index));
    const subtotal = products.reduce((total, item) => total + item.quantity * item.unitPrice, 0);

    return {
      id: order.id,
      clientId: order.clientId,
      orderNumber: `RO-${String(order.id).padStart(6, '0')}`,
      customerName: order.razonSocial,
      customerCode: String(order.clientId),
      createdBy: `Usuario #${order.userId}`,
      createdAt: order.createdAt,
      subtotal,
      tax: 0,
      total: subtotal,
      status: this.normalizeStatus(order.status),
      notes: order.notes ?? '',
      invoices: Array.from(new Set(products.map(product => product.invoiceFolio))),
      products,
    };
  }

  private mapOrderProduct(item: ReturnOrderListItem, index: number): ApprovalOrderProduct {
    return {
      id: String(item.id ?? index),
      itemId: Number(item.id ?? index),
      invoiceFolio: item.invoiceFolio,
      conceptoIndex: item.conceptoIndex,
      claveProdServ: item.claveProdServ,
      descripcion: item.descripcion,
      quantity: item.requestedQuantity,
      originalQuantity: item.originalQuantity,
      unit: item.unidad || item.claveUnidad,
      unitPrice: Number(item.valorUnitario) || 0,
      isEditable: false,
    };
  }

  private normalizeStatus(status: string): ApprovalStatus {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'in process') {
      return 'in process';
    }

    if (normalized === 'released') {
      return 'released';
    }

    if (normalized === 'cancelled') {
      return 'cancelled';
    }

    return 'pending';
  }
}
