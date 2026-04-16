import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth-service';
import {
  CreateReturnOrderRequest,
  CustomerInvoiceProduct,
  CustomerInvoiceSummary,
  CustomerService,
  ProductReturnHistoryData,
  ProductReturnHistoryEntry,
  ReturnOrderCreated,
} from '../../core/services/customer-service';
import { catchError, distinctUntilChanged, map, of, startWith, switchMap, take } from 'rxjs';
import { LucideAngularModule } from "lucide-angular";
import { UiProductHistoryModal } from './components/product-history-modal/product-history-modal';

interface InvoiceProduct {
  id: string;
  conceptoIndex: number;
  invoiceFolio: string;
  invoiceClientId: number;
  orderNumber: string;
  customerPoNumber: string;
  deliveryNote: string;
  qtyOrdered: number;
  qtyShipped: number;
  qtyBackorder: number;
  partNumber: string;
  customerPart: string;
  satCode: string;
  unit: string;
  origin: string;
  unitPrice: number;
}

interface CustomerInvoice {
  id: string;
  folio: string;
  invoiceNumber: string;
  date: string;
  products: InvoiceProduct[];
}

interface ReturnOrderItem {
  key: string;
  invoiceId: string;
  invoiceFolio: string;
  invoiceClientId: number;
  invoiceNumber: string;
  invoiceDate: string;
  conceptoIndex: number;
  deliveryNote: string;
  partNumber: string;
  customerPart: string;
  satCode: string;
  unit: string;
  unitPrice: number;
  maxQuantity: number;
  quantity: number;
}

interface GroupedReturnItems {
  invoiceId: string;
  invoiceFolio: string;
  invoiceNumber: string;
  invoiceDate: string;
  deliveryNote: string;
  items: ReturnOrderItem[];
}

interface GeneratedReturnOrder {
  id: number;
  clientId: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  items: ReturnOrderItem[];
}

interface ProductHistorySummaryView {
  totalSent: number;
  totalReturned: number;
  available: number;
  unit: string;
}

@Component({
  selector: 'app-clients',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, UiProductHistoryModal],
  templateUrl: './clients.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients {
  private readonly authService = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly taxRate = 0.16;
  protected readonly collapsedInvoiceKeys = signal<Set<string>>(new Set());
  protected readonly draftQuantities = signal<Record<string, number>>({});
  protected readonly isLoadingInvoices = signal<boolean>(false);
  protected readonly invoicesLoadError = signal<string | null>(null);
  protected readonly invoiceProductsLoading = signal<Record<string, boolean>>({});
  protected readonly invoiceProductsError = signal<Record<string, string | null>>({});
  private readonly loadedInvoiceKeys = signal<Set<string>>(new Set());
  private readonly currentClientId = signal<string>('');
  private readonly currentClientIdNumber = signal<number | null>(null);
  protected readonly returnOrderNotes = new FormControl<string>('', { nonNullable: true });
  protected readonly isCreatingReturnOrder = signal<boolean>(false);
  protected readonly returnOrderError = signal<string | null>(null);
  protected readonly isHistoryModalOpen = signal<boolean>(false);
  protected readonly isLoadingProductHistory = signal<boolean>(false);
  protected readonly productHistoryError = signal<string | null>(null);
  protected readonly historyModalTitle = signal<string>('Historial de devoluciones');
  protected readonly historyModalSubtitle = signal<string>('');
  protected readonly productHistorySummary = signal<ProductHistorySummaryView | null>(null);
  protected readonly productHistoryRows = signal<ProductReturnHistoryEntry[]>([]);

  protected readonly filtersForm = new FormGroup({
    from: new FormControl<string>('2026-01-01', { nonNullable: true }),
    to: new FormControl<string>('2026-12-31', { nonNullable: true }),
  });

  private readonly filters = toSignal(
    this.filtersForm.valueChanges.pipe(startWith(this.filtersForm.getRawValue())),
    { initialValue: this.filtersForm.getRawValue() },
  );

  protected readonly invoices = signal<CustomerInvoice[]>([]);

  protected readonly returnItems = signal<ReturnOrderItem[]>([]);
  protected readonly generatedOrder = signal<GeneratedReturnOrder | null>(null);

  protected readonly filteredInvoices = computed(() => {
    const invoices = this.invoices();
    const filters = this.filters();
    const from = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
    const to = filters.to ? new Date(`${filters.to}T23:59:59`) : null;

    return invoices.filter(invoice => {
      const invoiceDate = new Date(`${invoice.date}T12:00:00`);

      if (from && invoiceDate < from) {
        return false;
      }

      if (to && invoiceDate > to) {
        return false;
      }

      return true;
    });
  });

  protected readonly filteredInvoiceIds = computed(
    () => new Set(this.filteredInvoices().map(invoice => invoice.id)),
  );

  protected readonly canGenerateOrder = computed(() => this.returnItems().length > 0);

  protected readonly returnOrderSubtotal = computed(() => {
    return this.returnItems().reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  });

  protected readonly returnOrderTax = computed(() => this.returnOrderSubtotal() * this.taxRate);

  protected readonly returnOrderTotal = computed(() => this.returnOrderSubtotal() + this.returnOrderTax());

  protected readonly groupedReturnItems = computed<GroupedReturnItems[]>(() => {
    const groups = new Map<string, GroupedReturnItems>();

    this.returnItems().forEach(item => {
      const current = groups.get(item.invoiceId);
      if (current) {
        current.items.push(item);
      } else {
        groups.set(item.invoiceId, {
          invoiceId: item.invoiceId,
          invoiceFolio: item.invoiceFolio,
          invoiceNumber: item.invoiceNumber,
          invoiceDate: item.invoiceDate,
          deliveryNote: item.deliveryNote,
          items: [item],
        });
      }
    });

    return Array.from(groups.values()).map(group => ({
      ...group,
      items: [...group.items],
    }));
  });

  constructor() {
    this.syncInvoicesFromAuthenticatedClient();
  }

  protected addToReturnOrder(invoice: CustomerInvoice, product: InvoiceProduct): void {
    if (product.qtyShipped <= 0) {
      return;
    }

    const key = this.returnItemKey(invoice, product);
    const selectedQuantity = this.getDraftQuantity(invoice, product);
    const existing = this.returnItems().find(item => item.key === key);

    if (existing) {
      this.returnItems.update(items =>
        items.map(item =>
          item.key === key
            ? { ...item, quantity: Math.min(item.maxQuantity, selectedQuantity) }
            : item,
        ),
      );
      this.generatedOrder.set(null);
      return;
    }

    const item: ReturnOrderItem = {
      key,
      invoiceId: invoice.id,
      invoiceFolio: invoice.folio,
      invoiceClientId: this.currentClientIdNumber() ?? 0,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.date,
      conceptoIndex: product.conceptoIndex,
      deliveryNote: product.deliveryNote,
      partNumber: product.partNumber,
      customerPart: product.customerPart,
      satCode: product.satCode,
      unit: product.unit,
      unitPrice: product.unitPrice,
      maxQuantity: product.qtyShipped,
      quantity: selectedQuantity,
    };

    this.returnItems.update(items => [...items, item]);
    this.generatedOrder.set(null);
  }

  protected invoiceKey(invoice: CustomerInvoice, index: number): string {
    return `${invoice.id}-${index}`;
  }

  protected isInvoiceExpanded(key: string): boolean {
    return !this.collapsedInvoiceKeys().has(key);
  }

  protected toggleInvoice(invoice: CustomerInvoice, key: string): void {
    const isCollapsed = this.collapsedInvoiceKeys().has(key);

    if (isCollapsed) {
      this.loadInvoiceProducts(invoice, key);
    }

    this.collapsedInvoiceKeys.update(current => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  protected isInvoiceProductsLoading(key: string): boolean {
    return this.invoiceProductsLoading()[key] ?? false;
  }

  protected invoiceProductsErrorMessage(key: string): string | null {
    return this.invoiceProductsError()[key] ?? null;
  }

  protected getDraftQuantity(invoice: CustomerInvoice, product: InvoiceProduct): number {
    const key = this.returnItemKey(invoice, product);
    return this.draftQuantities()[key] ?? 1;
  }

  protected setDraftQuantity(invoice: CustomerInvoice, product: InvoiceProduct, rawValue: string | number): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const quantity = Math.max(1, Math.min(product.qtyShipped, Math.floor(parsed)));
    const key = this.returnItemKey(invoice, product);
    this.draftQuantities.update(current => ({
      ...current,
      [key]: quantity,
    }));
  }

  protected adjustDraftQuantity(invoice: CustomerInvoice, product: InvoiceProduct, delta: number): void {
    const next = this.getDraftQuantity(invoice, product) + delta;
    this.setDraftQuantity(invoice, product, next);
  }

  protected openProductHistory(invoice: CustomerInvoice, product: InvoiceProduct): void {
    const clientId = this.currentClientId();

    if (!clientId || !invoice.folio) {
      return;
    }

    this.isHistoryModalOpen.set(true);
    this.isLoadingProductHistory.set(true);
    this.productHistoryError.set(null);
    this.productHistorySummary.set(null);
    this.productHistoryRows.set([]);

    this.historyModalTitle.set('Historial de Devoluciones');
    this.historyModalSubtitle.set(`${product.partNumber} - Factura ${invoice.folio}`);

    this.customerService
      .getInvoiceProductHistory(invoice.folio, clientId, product.conceptoIndex)
      .pipe(take(1))
      .subscribe({
        next: (historyData: ProductReturnHistoryData | null) => {
          if (!historyData) {
            this.productHistoryError.set('No se encontró historial para este producto.');
            this.isLoadingProductHistory.set(false);
            return;
          }

          this.productHistorySummary.set({
            totalSent: Number(historyData.summary?.totalSent) || 0,
            totalReturned: Number(historyData.summary?.totalReturned) || 0,
            available: Number(historyData.summary?.available) || 0,
            unit: historyData.summary?.unidad || product.unit || 'PC',
          });
          this.productHistoryRows.set(historyData.history ?? []);
          this.isLoadingProductHistory.set(false);
        },
        error: (error: unknown) => {
          const apiMessage = (error as { error?: { message?: string } })?.error?.message;
          this.productHistoryError.set(apiMessage?.trim() || 'No fue posible cargar el historial de devoluciones.');
          this.isLoadingProductHistory.set(false);
        },
      });
  }

  protected closeProductHistoryModal(): void {
    this.isHistoryModalOpen.set(false);
  }

  protected updateItemQuantity(key: string, rawQuantity: string): void {
    const parsed = Number(rawQuantity);

    this.returnItems.update(items =>
      items.map(item => {
        if (item.key !== key) {
          return item;
        }

        if (!Number.isFinite(parsed)) {
          return item;
        }

        return {
          ...item,
          quantity: Math.max(1, Math.min(item.maxQuantity, Math.floor(parsed))),
        };
      }),
    );

    this.generatedOrder.set(null);
  }

  protected removeReturnItem(key: string): void {
    this.returnItems.update(items => items.filter(item => item.key !== key));
    this.generatedOrder.set(null);
  }

  protected clearReturnOrder(): void {
    this.returnItems.set([]);
    this.generatedOrder.set(null);
    this.returnOrderError.set(null);
    this.returnOrderNotes.setValue('');
  }

  protected generateReturnOrder(): void {
    if (!this.canGenerateOrder() || this.isCreatingReturnOrder()) {
      return;
    }

    const clientId = this.currentClientIdNumber();

    if (!clientId) {
      this.returnOrderError.set('No se pudo determinar el clientId del usuario autenticado.');
      return;
    }

    const items = this.returnItems().map(item => ({
      invoiceFolio: item.invoiceFolio,
      invoiceClientId: item.invoiceClientId || clientId,
      conceptoIndex: item.conceptoIndex,
      requestedQuantity: item.quantity,
    }));

    const payload: CreateReturnOrderRequest = {
      clientId,
      items,
    };

    const notes = this.returnOrderNotes.value.trim();

    if (notes) {
      payload.notes = notes;
    }

    this.isCreatingReturnOrder.set(true);
    this.returnOrderError.set(null);

    this.customerService.createReturnOrder(payload).pipe(take(1)).subscribe({
      next: response => {
        this.generatedOrder.set({
          id: response.id,
          clientId: response.clientId,
          status: response.status,
          notes: response.notes ?? null,
          createdAt: response.createdAt,
          items: this.returnItems(),
        });
        this.isCreatingReturnOrder.set(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.returnOrderError.set(apiMessage?.trim() || 'No fue posible crear la orden de devolución.');
        this.isCreatingReturnOrder.set(false);
      },
    });
  }

  protected productTotal(product: InvoiceProduct): number {
    return product.qtyShipped * product.unitPrice;
  }

  private returnItemKey(invoice: CustomerInvoice, product: InvoiceProduct): string {
    return `${invoice.id}-${invoice.invoiceNumber}-${product.id}`;
  }

  private syncInvoicesFromAuthenticatedClient(): void {
    this.authService.user$
      .pipe(
        map(user => {
          const clientId = user?.clientId;
          return typeof clientId === 'string' ? clientId.trim() : '';
        }),
        distinctUntilChanged(),
        switchMap(clientId => {
          this.currentClientId.set(clientId);
          this.currentClientIdNumber.set(Number(clientId) || null);
          this.collapsedInvoiceKeys.set(new Set());
          this.loadedInvoiceKeys.set(new Set());
          this.invoiceProductsLoading.set({});
          this.invoiceProductsError.set({});
          this.returnItems.set([]);
          this.generatedOrder.set(null);
          this.returnOrderError.set(null);
          this.returnOrderNotes.setValue('');

          if (!clientId) {
            this.invoicesLoadError.set(null);
            this.isLoadingInvoices.set(false);
            return of<CustomerInvoice[]>([]);
          }

          this.isLoadingInvoices.set(true);
          this.invoicesLoadError.set(null);

          return this.customerService.getInvoicesByClientId(clientId).pipe(
            map(invoices => invoices.map(invoice => this.toCustomerInvoice(invoice))),
            catchError(() => {
              this.invoicesLoadError.set('No fue posible cargar las facturas del cliente.');
              return of<CustomerInvoice[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(invoices => {
        this.invoices.set(invoices);
        this.collapsedInvoiceKeys.set(new Set(invoices.map((invoice, index) => this.invoiceKey(invoice, index))));
        this.isLoadingInvoices.set(false);
      });
  }

  private toCustomerInvoice(invoice: CustomerInvoiceSummary): CustomerInvoice {
    const serie = (invoice.serie ?? '').trim();
    const folio = (invoice.folio ?? '').trim();
    const emissionDate = (invoice.fechaEmision ?? '').trim();

    return {
      id: invoice.id,
      folio,
      invoiceNumber: [serie, folio].filter(Boolean).join('-') || invoice.id,
      date: emissionDate ? emissionDate.slice(0, 10) : '',
      products: [],
    };
  }

  private loadInvoiceProducts(invoice: CustomerInvoice, invoiceKey: string): void {
    const clientId = this.currentClientId();

    if (!clientId || !invoice.folio) {
      return;
    }

    if (this.loadedInvoiceKeys().has(invoiceKey) || this.isInvoiceProductsLoading(invoiceKey)) {
      return;
    }

    this.invoiceProductsLoading.update(current => ({
      ...current,
      [invoiceKey]: true,
    }));

    this.invoiceProductsError.update(current => ({
      ...current,
      [invoiceKey]: null,
    }));

    this.customerService
      .getInvoiceProductsByFolio(invoice.folio, clientId)
      .pipe(
        map(products => products.map((product, index) => this.toInvoiceProduct(invoice, product, index))),
        catchError((error: unknown) => {
          const apiMessage = (error as { error?: { message?: string } })?.error?.message;
          this.invoiceProductsError.update(current => ({
            ...current,
            [invoiceKey]: apiMessage?.trim() || 'No fue posible cargar los productos de la factura.',
          }));
          return of<InvoiceProduct[]>([]);
        }),
        take(1),
      )
      .subscribe(products => {
        this.invoices.update(currentInvoices =>
          currentInvoices.map(item => {
            if (item.id !== invoice.id || item.folio !== invoice.folio) {
              return item;
            }

            return {
              ...item,
              products,
            };
          }),
        );

        this.loadedInvoiceKeys.update(current => {
          const next = new Set(current);
          next.add(invoiceKey);
          return next;
        });

        this.invoiceProductsLoading.update(current => ({
          ...current,
          [invoiceKey]: false,
        }));
      });
  }

  private toInvoiceProduct(invoice: CustomerInvoice, product: CustomerInvoiceProduct, index: number): InvoiceProduct {
    const descriptionParts = this.parseDescriptionParts(product.descripcion);
    const quantityOrdered = Number(product.cantidad) || 0;
    const quantityAvailable = Number(product.availableQuantity) || 0;
    const returnedQuantity = Number(product.returnedQuantity) || 0;

    return {
      id: `${invoice.id}-${product.conceptoIndex}-${index}`,
      conceptoIndex: product.conceptoIndex,
      invoiceFolio: invoice.folio,
      invoiceClientId: this.currentClientIdNumber() ?? 0,
      orderNumber: descriptionParts.orderNumber,
      customerPoNumber: descriptionParts.customerPoNumber,
      deliveryNote: descriptionParts.deliveryNote,
      qtyOrdered: quantityOrdered,
      qtyShipped: quantityAvailable,
      qtyBackorder: Math.max(0, returnedQuantity),
      partNumber: descriptionParts.partNumber,
      customerPart: descriptionParts.customerPart,
      satCode: product.claveProdServ || '',
      unit: product.unidad || product.claveUnidad || '',
      origin: '-',
      unitPrice: Number(product.valorUnitario) || 0,
    };
  }

  private parseDescriptionParts(rawDescription: string): {
    partNumber: string;
    customerPart: string;
    orderNumber: string;
    customerPoNumber: string;
    deliveryNote: string;
  } {
    const normalized = (rawDescription ?? '').trim();

    if (!normalized) {
      return {
        partNumber: '-',
        customerPart: '-',
        orderNumber: '-',
        customerPoNumber: '-',
        deliveryNote: '-',
      };
    }

    const tokens = normalized
      .split('^')
      .map(token => token.trim())
      .filter(Boolean);

    const firstToken = tokens[0] ?? '';
    const partNumber = firstToken.includes(';') ? firstToken.split(';')[0].trim() : firstToken;
    const orderNumber = tokens[1] ?? '-';
    const deliveryNote = tokens[2] ?? '-';

    return {
      partNumber: partNumber || '-',
      customerPart: partNumber || '-',
      orderNumber,
      customerPoNumber: orderNumber,
      deliveryNote,
    };
  }
}
