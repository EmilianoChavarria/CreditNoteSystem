import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import {
  CustomerInvoice,
  DraftQuantityAdjust,
  DraftQuantityChange,
  InvoiceProduct,
} from '../../clients.types';

@Component({
  selector: 'app-client-invoice-card',
  imports: [CommonModule, LucideAngularModule, TranslatePipe],
  templateUrl: './client-invoice-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientInvoiceCard {
  readonly invoice = input.required<CustomerInvoice>();
  readonly invoiceKey = input.required<string>();
  readonly expanded = input(false);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly draftQuantities = input<Record<string, number>>({});

  readonly toggle = output<void>();
  readonly addProduct = output<{ invoice: CustomerInvoice; product: InvoiceProduct }>();
  readonly addAllProducts = output<{ invoice: CustomerInvoice }>();
  readonly openHistory = output<{ invoice: CustomerInvoice; product: InvoiceProduct }>();
  readonly adjustQuantity = output<DraftQuantityAdjust>();
  readonly quantityChange = output<DraftQuantityChange>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly addedTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private allAddedTimeout: ReturnType<typeof setTimeout> | null = null;
  protected readonly recentlyAddedKeys = signal<ReadonlySet<string>>(new Set());
  protected readonly allRecentlyAdded = signal(false);

  protected readonly canAddAll = computed(() => {
    if (this.loading()) {
      return false;
    }
    return this.invoice().products.some(product => product.qtyShipped > 0);
  });

  protected readonly productCount = computed(() => {
    const invoice = this.invoice();
    const loadedCount = invoice.products.length;

    if (loadedCount > 0) {
      return loadedCount;
    }

    if (invoice.productsCount !== null) {
      return invoice.productsCount;
    }

    return null;
  });

  protected productTotal(product: InvoiceProduct): number {
    return product.qtyShipped * product.unitPrice;
  }

  protected getDraftQuantity(product: InvoiceProduct): number {
    const key = this.returnItemKey(product);
    return this.draftQuantities()[key] ?? 1;
  }

  protected emitAdjustQuantity(product: InvoiceProduct, delta: number): void {
    this.adjustQuantity.emit({ invoice: this.invoice(), product, delta });
  }

  protected emitQuantityChange(product: InvoiceProduct, value: string | number): void {
    this.quantityChange.emit({ invoice: this.invoice(), product, value });
  }

  protected onAddProduct(product: InvoiceProduct): void {
    this.addProduct.emit({ invoice: this.invoice(), product });

    const key = this.returnItemKey(product);

    const existingTimeout = this.addedTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.recentlyAddedKeys.update(keys => new Set(keys).add(key));

    const timeout = setTimeout(() => {
      this.recentlyAddedKeys.update(keys => {
        const next = new Set(keys);
        next.delete(key);
        return next;
      });
      this.addedTimeouts.delete(key);
    }, 1600);

    this.addedTimeouts.set(key, timeout);
    this.destroyRef.onDestroy(() => clearTimeout(timeout));
  }

  protected isRecentlyAdded(product: InvoiceProduct): boolean {
    return this.recentlyAddedKeys().has(this.returnItemKey(product));
  }

  protected addButtonClasses(product: InvoiceProduct): string {
    const base =
      'flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-all duration-300 ease-out';

    if (this.isRecentlyAdded(product)) {
      return `${base} scale-105 border-green-300 bg-green-50 text-green-700`;
    }

    return `${base} border-orange-200 bg-white text-orange-700 hover:bg-orange-50`;
  }

  protected onAddAllProducts(): void {
    const products = this.invoice().products.filter(product => product.qtyShipped > 0);
    if (products.length === 0) {
      return;
    }

    this.addAllProducts.emit({ invoice: this.invoice() });

    const keys = products.map(product => this.returnItemKey(product));

    keys.forEach(key => {
      const existingTimeout = this.addedTimeouts.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
    });

    this.recentlyAddedKeys.update(current => {
      const next = new Set(current);
      keys.forEach(key => next.add(key));
      return next;
    });

    if (this.allAddedTimeout) {
      clearTimeout(this.allAddedTimeout);
    }
    this.allRecentlyAdded.set(true);

    const timeout = setTimeout(() => {
      this.recentlyAddedKeys.update(current => {
        const next = new Set(current);
        keys.forEach(key => next.delete(key));
        return next;
      });
      keys.forEach(key => this.addedTimeouts.delete(key));
      this.allRecentlyAdded.set(false);
      this.allAddedTimeout = null;
    }, 1600);

    keys.forEach(key => this.addedTimeouts.set(key, timeout));
    this.allAddedTimeout = timeout;
    this.destroyRef.onDestroy(() => clearTimeout(timeout));
  }

  protected addAllButtonClasses(): string {
    const base =
      'flex items-center justify-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-all duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-50';

    if (this.allRecentlyAdded()) {
      return `${base} scale-105 border-green-300 bg-green-50 text-green-700`;
    }

    return `${base} border-orange-300 bg-white text-orange-700 hover:bg-orange-50`;
  }

  private returnItemKey(product: InvoiceProduct): string {
    const invoice = this.invoice();
    return `${invoice.id}-${invoice.invoiceNumber}-${product.id}`;
  }
}
