import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';

interface InvoiceProduct {
  id: string;
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
  invoiceNumber: string;
  date: string;
  products: InvoiceProduct[];
}

interface ReturnOrderItem {
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
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
  invoiceNumber: string;
  invoiceDate: string;
  deliveryNote: string;
  items: ReturnOrderItem[];
}

interface GeneratedReturnOrder {
  number: string;
  createdAt: Date;
  items: ReturnOrderItem[];
}

@Component({
  selector: 'app-clients',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './clients.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients {
  protected readonly taxRate = 0.16;
  protected readonly collapsedInvoiceKeys = signal<Set<string>>(new Set());
  protected readonly draftQuantities = signal<Record<string, number>>({});

  protected readonly filtersForm = new FormGroup({
    from: new FormControl<string>('2026-01-01', { nonNullable: true }),
    to: new FormControl<string>('2026-12-31', { nonNullable: true }),
  });

  private readonly filters = toSignal(
    this.filtersForm.valueChanges.pipe(startWith(this.filtersForm.getRawValue())),
    { initialValue: this.filtersForm.getRawValue() },
  );

  protected readonly invoices = signal<CustomerInvoice[]>([
    {
      id: 'INV-1001',
      invoiceNumber: 'F001-000981',
      date: '2026-01-14',
      products: [
        {
          id: 'LN-1',
          orderNumber: 'PO-48011',
          customerPoNumber: 'CPO-99811',
          deliveryNote: 'REM-7750',
          qtyOrdered: 120,
          qtyShipped: 120,
          qtyBackorder: 0,
          partNumber: 'AXL-RED-10',
          customerPart: 'C-AXL-100A',
          satCode: '53131600',
          unit: 'PZA',
          origin: 'MX',
          unitPrice: 43.7,
        },
        {
          id: 'LN-2',
          orderNumber: 'PO-48011',
          customerPoNumber: 'CPO-99811',
          deliveryNote: 'REM-7750',
          qtyOrdered: 55,
          qtyShipped: 48,
          qtyBackorder: 7,
          partNumber: 'SWT-PLUG-22',
          customerPart: 'C-SWT-22',
          satCode: '39121400',
          unit: 'PZA',
          origin: 'US',
          unitPrice: 158.2,
        },
      ],
    },
    {
      id: 'INV-1002',
      invoiceNumber: 'F001-001025',
      date: '2026-02-02',
      products: [
        {
          id: 'LN-1',
          orderNumber: 'PO-48100',
          customerPoNumber: 'CPO-100220',
          deliveryNote: 'REM-7802',
          qtyOrdered: 300,
          qtyShipped: 300,
          qtyBackorder: 0,
          partNumber: 'VAL-08-BR',
          customerPart: 'CLI-VAL-BR08',
          satCode: '40141600',
          unit: 'PZA',
          origin: 'CN',
          unitPrice: 22.9,
        },
        {
          id: 'LN-2',
          orderNumber: 'PO-48100',
          customerPoNumber: 'CPO-100220',
          deliveryNote: 'REM-7802',
          qtyOrdered: 60,
          qtyShipped: 58,
          qtyBackorder: 2,
          partNumber: 'SEAL-90-XL',
          customerPart: 'CUS-SEAL-90X',
          satCode: '31181600',
          unit: 'KIT',
          origin: 'MX',
          unitPrice: 91.4,
        },
      ],
    },
    {
      id: 'INV-1003',
      invoiceNumber: 'F001-001188',
      date: '2026-03-16',
      products: [
        {
          id: 'LN-1',
          orderNumber: 'PO-48302',
          customerPoNumber: 'CPO-100991',
          deliveryNote: 'REM-7887',
          qtyOrdered: 45,
          qtyShipped: 41,
          qtyBackorder: 4,
          partNumber: 'HSG-200-GY',
          customerPart: 'CLI-HSG2-00',
          satCode: '24112400',
          unit: 'PZA',
          origin: 'DE',
          unitPrice: 314.65,
        },
        {
          id: 'LN-2',
          orderNumber: 'PO-48302',
          customerPoNumber: 'CPO-100991',
          deliveryNote: 'REM-7887',
          qtyOrdered: 16,
          qtyShipped: 16,
          qtyBackorder: 0,
          partNumber: 'BRG-STD-05',
          customerPart: 'PART-BRG-05',
          satCode: '31171500',
          unit: 'PZA',
          origin: 'JP',
          unitPrice: 204.11,
        },
      ],
    },
    {
      id: 'INV-1003',
      invoiceNumber: 'F001-001188',
      date: '2026-03-16',
      products: [
        {
          id: 'LN-1',
          orderNumber: 'PO-48302',
          customerPoNumber: 'CPO-100991',
          deliveryNote: 'REM-7887',
          qtyOrdered: 45,
          qtyShipped: 41,
          qtyBackorder: 4,
          partNumber: 'HSG-200-GY',
          customerPart: 'CLI-HSG2-00',
          satCode: '24112400',
          unit: 'PZA',
          origin: 'DE',
          unitPrice: 314.65,
        },
        {
          id: 'LN-2',
          orderNumber: 'PO-48302',
          customerPoNumber: 'CPO-100991',
          deliveryNote: 'REM-7887',
          qtyOrdered: 16,
          qtyShipped: 16,
          qtyBackorder: 0,
          partNumber: 'BRG-STD-05',
          customerPart: 'PART-BRG-05',
          satCode: '31171500',
          unit: 'PZA',
          origin: 'JP',
          unitPrice: 204.11,
        },
      ],
    },
  ]);

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
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.date,
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

  protected toggleInvoice(key: string): void {
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
  }

  protected generateReturnOrder(): void {
    if (!this.canGenerateOrder()) {
      return;
    }

    const now = new Date();
    const orderNumber = `DEV-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;

    this.generatedOrder.set({
      number: orderNumber,
      createdAt: now,
      items: this.returnItems(),
    });
  }

  protected productTotal(product: InvoiceProduct): number {
    return product.qtyShipped * product.unitPrice;
  }

  private returnItemKey(invoice: CustomerInvoice, product: InvoiceProduct): string {
    return `${invoice.id}-${invoice.invoiceNumber}-${product.id}`;
  }
}
