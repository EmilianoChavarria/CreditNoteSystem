import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth-service';
import {
  CustomerInvoiceProduct,
  CustomerInvoiceSummary,
  CustomerService,
  InvoiceSearchFilters,
  ProductReturnHistoryData,
  ProductReturnHistoryEntry,
} from '../../../core/services/customer-service';
import { catchError, map, of, take } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { UiProductHistoryModal } from '../components/product-history-modal/product-history-modal';

interface InvoiceProduct {
  id: string;
  conceptoIndex: number;
  invoiceFolio: string;
  orderNumber: string;
  customerPoNumber: string;
  deliveryNote: string;
  qtyShipped: number;
  partNumber: string;
  customerPart: string;
  satCode: string;
  unit: string;
  unitPrice: number;
}

interface CustomerInvoice {
  id: string;
  folio: string;
  invoiceNumber: string;
  date: string;
  products: InvoiceProduct[];
}

interface ProductHistorySummaryView {
  totalSent: number;
  totalReturned: number;
  available: number;
  unit: string;
}

@Component({
  selector: 'app-my-invoices',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, UiProductHistoryModal],
  templateUrl: './my-invoices.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyInvoices {
  private readonly authService = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentClientId = signal<string>('');
  protected readonly isSearching = signal<boolean>(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly hasSearched = signal<boolean>(false);

  protected readonly invoices = signal<CustomerInvoice[]>([]);
  protected readonly collapsedInvoiceKeys = signal<Set<string>>(new Set());
  protected readonly invoiceProductsLoading = signal<Record<string, boolean>>({});
  protected readonly invoiceProductsError = signal<Record<string, string | null>>({});
  private readonly loadedInvoiceKeys = signal<Set<string>>(new Set());

  protected readonly isHistoryModalOpen = signal<boolean>(false);
  protected readonly isLoadingProductHistory = signal<boolean>(false);
  protected readonly productHistoryError = signal<string | null>(null);
  protected readonly historyModalTitle = signal<string>('Historial de devoluciones');
  protected readonly historyModalSubtitle = signal<string>('');
  protected readonly productHistorySummary = signal<ProductHistorySummaryView | null>(null);
  protected readonly productHistoryRows = signal<ProductReturnHistoryEntry[]>([]);

  protected readonly searchForm = new FormGroup({
    uuid: new FormControl<string>('', { nonNullable: true }),
    folio: new FormControl<string>('', { nonNullable: true }),
    receptorId: new FormControl<string>('', { nonNullable: true }),
    receptorRfc: new FormControl<string>('', { nonNullable: true }),
    receptorNombre: new FormControl<string>('', { nonNullable: true }),
    moneda: new FormControl<string>('', { nonNullable: true }),
    fechaInicial: new FormControl<string>('', { nonNullable: true }),
    fechaFinal: new FormControl<string>('', { nonNullable: true }),
  });

  protected readonly invoiceCount = computed(() => this.invoices().length);

  constructor() {
    this.authService.user$.pipe(
      map(user => {
        const clientId = user?.clientId;
        return typeof clientId === 'string' ? clientId.trim() : '';
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(clientId => {
      this.currentClientId.set(clientId);
    });
  }

  protected search(): void {
    const clientId = this.currentClientId();

    if (!clientId || this.isSearching()) {
      return;
    }

    const raw = this.searchForm.getRawValue();
    const filters: InvoiceSearchFilters = {
      uuid: raw.uuid || undefined,
      folio: raw.folio || undefined,
      receptorId: raw.receptorId || undefined,
      receptorRfc: raw.receptorRfc || undefined,
      receptorNombre: raw.receptorNombre || undefined,
      moneda: raw.moneda || undefined,
      fechaInicial: raw.fechaInicial || undefined,
      fechaFinal: raw.fechaFinal || undefined,
    };

    this.isSearching.set(true);
    this.searchError.set(null);
    this.invoices.set([]);
    this.collapsedInvoiceKeys.set(new Set());
    this.loadedInvoiceKeys.set(new Set());
    this.invoiceProductsLoading.set({});
    this.invoiceProductsError.set({});

    this.customerService
      .searchInvoicesByClientId(clientId, filters)
      .pipe(take(1))
      .subscribe({
        next: summaries => {
          const invoices = summaries.map(s => this.toCustomerInvoice(s));
          this.invoices.set(invoices);
          this.collapsedInvoiceKeys.set(
            new Set(invoices.map((inv, idx) => this.invoiceKey(inv, idx))),
          );
          this.hasSearched.set(true);
          this.isSearching.set(false);
        },
        error: (error: unknown) => {
          const apiMessage = (error as { error?: { message?: string } })?.error?.message;
          this.searchError.set(apiMessage?.trim() || 'No fue posible realizar la busqueda.');
          this.hasSearched.set(true);
          this.isSearching.set(false);
        },
      });
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

  protected productTotal(product: InvoiceProduct): number {
    return product.qtyShipped * product.unitPrice;
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
            this.productHistoryError.set('No se encontro historial para este producto.');
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
          this.productHistoryError.set(apiMessage?.trim() || 'No fue posible cargar el historial.');
          this.isLoadingProductHistory.set(false);
        },
      });
  }

  protected clear(): void {
    this.searchForm.reset();
    this.invoices.set([]);
    this.collapsedInvoiceKeys.set(new Set());
    this.loadedInvoiceKeys.set(new Set());
    this.invoiceProductsLoading.set({});
    this.invoiceProductsError.set({});
    this.searchError.set(null);
    this.hasSearched.set(false);
  }

  protected closeProductHistoryModal(): void {
    this.isHistoryModalOpen.set(false);
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

    this.invoiceProductsLoading.update(current => ({ ...current, [invoiceKey]: true }));
    this.invoiceProductsError.update(current => ({ ...current, [invoiceKey]: null }));

    this.customerService
      .getInvoiceProductsByFolio(invoice.folio, clientId)
      .pipe(
        map(products => products.map((p, idx) => this.toInvoiceProduct(invoice, p, idx))),
        catchError((error: unknown) => {
          const apiMessage = (error as { error?: { message?: string } })?.error?.message;
          this.invoiceProductsError.update(current => ({
            ...current,
            [invoiceKey]: apiMessage?.trim() || 'No fue posible cargar los productos.',
          }));
          return of<InvoiceProduct[]>([]);
        }),
        take(1),
      )
      .subscribe(products => {
        this.invoices.update(list =>
          list.map(item =>
            item.id === invoice.id && item.folio === invoice.folio ? { ...item, products } : item,
          ),
        );

        this.loadedInvoiceKeys.update(current => {
          const next = new Set(current);
          next.add(invoiceKey);
          return next;
        });

        this.invoiceProductsLoading.update(current => ({ ...current, [invoiceKey]: false }));
      });
  }

  private toInvoiceProduct(invoice: CustomerInvoice, product: CustomerInvoiceProduct, index: number): InvoiceProduct {
    const descriptionParts = this.parseDescriptionParts(product.descripcion);
    const quantityAvailable = Number(product.availableQuantity) || 0;

    return {
      id: `${invoice.id}-${product.conceptoIndex}-${index}`,
      conceptoIndex: product.conceptoIndex,
      invoiceFolio: invoice.folio,
      orderNumber: descriptionParts.orderNumber,
      customerPoNumber: descriptionParts.customerPoNumber,
      deliveryNote: descriptionParts.deliveryNote,
      qtyShipped: quantityAvailable,
      partNumber: descriptionParts.partNumber,
      customerPart: descriptionParts.customerPart,
      satCode: product.claveProdServ || '',
      unit: product.unidad || product.claveUnidad || '',
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
      return { partNumber: '-', customerPart: '-', orderNumber: '-', customerPoNumber: '-', deliveryNote: '-' };
    }

    const tokens = normalized.split('^').map(t => t.trim()).filter(Boolean);
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
