import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
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
  readonly openHistory = output<{ invoice: CustomerInvoice; product: InvoiceProduct }>();
  readonly adjustQuantity = output<DraftQuantityAdjust>();
  readonly quantityChange = output<DraftQuantityChange>();

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

  private returnItemKey(product: InvoiceProduct): string {
    const invoice = this.invoice();
    return `${invoice.id}-${invoice.invoiceNumber}-${product.id}`;
  }
}
