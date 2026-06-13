import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth-service';
import { CustomerService, ReturnOrderListEntry, ReturnOrderListItem } from '../../core/services/customer-service';
import { catchError, distinctUntilChanged, map, of, switchMap } from 'rxjs';

interface ReturnOrderProduct {
  id: string;
  invoiceFolio: string;
  conceptoIndex: number;
  claveProdServ: string;
  descripcion: string;
  requestedQuantity: number;
  originalQuantity: number;
  unit: string;
  unitPrice: number;
}

interface ReturnOrder {
  id: number;
  clientId: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  notes: string | null;
  subtotal: number;
  total: number;
  invoices: string[];
  products: ReturnOrderProduct[];
}

@Component({
  selector: 'app-client-orders',
  imports: [CommonModule],
  templateUrl: './client-orders.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientOrders {
  private readonly authService = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly orders = signal<ReturnOrder[]>([]);
  protected readonly isLoadingOrders = signal<boolean>(false);
  protected readonly ordersLoadError = signal<string | null>(null);
  private readonly expandedOrderIds = signal<Set<number>>(new Set());
  private readonly currentClientId = signal<string>('');

  protected readonly totalOrders = computed(() => this.orders().length);
  protected readonly totalItems = computed(() => this.orders().reduce((sum, order) => sum + order.products.length, 0));
  protected readonly totalAmount = computed(() => this.orders().reduce((sum, order) => sum + order.total, 0));

  constructor() {
    this.syncOrdersFromAuthenticatedClient();
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

  protected statusClasses(status: string): string {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'approved') {
      return 'border-green-200 bg-green-50 text-green-700';
    }

    if (normalized === 'pending') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    if (normalized === 'rejected') {
      return 'border-red-200 bg-red-50 text-red-700';
    }

    if (normalized === 'in_process' || normalized === 'in process') {
      return 'border-blue-200 bg-blue-50 text-blue-700';
    }

    if (normalized === 'cancelled') {
      return 'border-red-200 bg-red-50 text-red-700';
    }

    if (normalized === 'released') {
      return 'border-green-200 bg-green-50 text-green-700';
    }

    return 'border-gray-200 bg-gray-50 text-gray-700';
  }

  protected statusLabel(status: string): string {
    const normalized = status.trim().toLowerCase();

    if (normalized === 'approved') {
      return 'Aprobada';
    }

    if (normalized === 'pending') {
      return 'Pendiente';
    }

    if (normalized === 'rejected') {
      return 'Rechazada';
    }

    if (normalized === 'in_process' || normalized === 'in process') {
      return 'En proceso';
    }

    if (normalized === 'cancelled') {
      return 'Cancelada';
    }

    if (normalized === 'released') {
      return 'Liberada';
    }

    return status || 'Sin estado';
  }

  private syncOrdersFromAuthenticatedClient(): void {
    this.authService.user$
      .pipe(
        map(user => {
          const clientId = user?.clientId;
          return typeof clientId === 'string' ? clientId.trim() : '';
        }),
        distinctUntilChanged(),
        switchMap(clientId => {
          this.currentClientId.set(clientId);
          this.expandedOrderIds.set(new Set());
          this.orders.set([]);

          if (!clientId) {
            this.ordersLoadError.set(null);
            this.isLoadingOrders.set(false);
            return of<ReturnOrder[]>([]);
          }

          this.isLoadingOrders.set(true);
          this.ordersLoadError.set(null);

          return this.customerService.getReturnOrdersByClientId(clientId).pipe(
            map(orders => orders.map(order => this.toReturnOrder(order))),
            catchError(() => {
              this.ordersLoadError.set('No fue posible cargar las órdenes de devolución del cliente.');
              return of<ReturnOrder[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(orders => {
        this.orders.set(orders);

        if (orders.length > 0) {
          this.expandedOrderIds.set(new Set([orders[0].id]));
        }

        this.isLoadingOrders.set(false);
      });
  }

  private toReturnOrder(order: ReturnOrderListEntry): ReturnOrder {
    const products = order.items.map(item => this.toReturnOrderProduct(item));
    const subtotal = products.reduce((sum, item) => sum + item.requestedQuantity * item.unitPrice, 0);

    return {
      id: order.id,
      clientId: order.clientId,
      userId: order.userId,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      status: order.status,
      notes: order.notes ?? null,
      subtotal,
      total: subtotal,
      invoices: Array.from(new Set(products.map(product => product.invoiceFolio))),
      products,
    };
  }

  private toReturnOrderProduct(item: ReturnOrderListItem): ReturnOrderProduct {
    return {
      id: String(item.id),
      invoiceFolio: item.invoiceFolio,
      conceptoIndex: item.conceptoIndex,
      claveProdServ: item.claveProdServ,
      descripcion: item.descripcion,
      requestedQuantity: item.requestedQuantity,
      originalQuantity: item.originalQuantity,
      unit: item.unidad || item.claveUnidad,
      unitPrice: item.valorUnitario,
    };
  }
}
