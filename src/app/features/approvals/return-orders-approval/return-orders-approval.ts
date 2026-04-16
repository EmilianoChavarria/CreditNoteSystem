import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { CustomerService, ReturnOrderSearchEntry, ReturnOrderListItem } from '../../../core/services/customer-service';

interface ApprovalOrderProduct {
  id: string;
  invoiceFolio: string;
  conceptoIndex: number;
  claveProdServ: string;
  descripcion: string;
  quantity: number;
  originalQuantity: number;
  unit: string;
  unitPrice: number;
}

type ApprovalStatus = 'pending' | 'approved' | 'cancelled';

interface ReturnOrderForApproval {
  id: number;
  orderNumber: string;
  customerName: string;
  customerCode: string;
  createdBy: string;
  createdAt: string;
  subtotal: number;
  tax: number;
  total: number;
  status: ApprovalStatus;
  invoices: string[];
  products: ApprovalOrderProduct[];
}

@Component({
  selector: 'app-return-orders-approval',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './return-orders-approval.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReturnOrdersApproval {
  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
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

  constructor() {
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

  protected toggleOrder(orderId: number): void {
    this.expandedOrderIds.update(current => {
      const next = new Set(current);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }

  protected isExpanded(orderId: number): boolean {
    return this.expandedOrderIds().has(orderId);
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

  protected rejectOrder(orderId: number): void {
    this.orders.update(current =>
      current.map(order => (order.id === orderId ? { ...order, status: 'cancelled' } : order)),
    );
  }

  protected statusClasses(status: ApprovalStatus): string {
    if (status === 'pending') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    if (status === 'approved') {
      return 'border-green-200 bg-green-50 text-green-700';
    }

    return 'border-red-200 bg-red-50 text-red-700';
  }

  protected statusLabel(status: ApprovalStatus): string {
    if (status === 'pending') {
      return 'Pendiente';
    }

    if (status === 'approved') {
      return 'Aprobada';
    }

    return 'Rechazada';
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
        this.expandedOrderIds.set(new Set([this.orders()[0]?.id ?? 0]));
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
      orderNumber: `RO-${String(order.id).padStart(6, '0')}`,
      customerName: order.razonSocial,
      customerCode: String(order.clientId),
      createdBy: `Usuario #${order.userId}`,
      createdAt: order.createdAt,
      subtotal,
      tax: 0,
      total: subtotal,
      status: this.normalizeStatus(order.status),
      invoices: Array.from(new Set(products.map(product => product.invoiceFolio))),
      products,
    };
  }

  private mapOrderProduct(item: ReturnOrderListItem, index: number): ApprovalOrderProduct {
    return {
      id: String(item.id ?? index),
      invoiceFolio: item.invoiceFolio,
      conceptoIndex: item.conceptoIndex,
      claveProdServ: item.claveProdServ,
      descripcion: item.descripcion,
      quantity: item.requestedQuantity,
      originalQuantity: item.originalQuantity,
      unit: item.unidad || item.claveUnidad,
      unitPrice: Number(item.valorUnitario) || 0,
    };
  }

  private normalizeStatus(status: string): ApprovalStatus {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'approved') {
      return 'approved';
    }

    if (normalized === 'cancelled') {
      return 'cancelled';
    }

    return 'pending';
  }
}
