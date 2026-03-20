import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

interface ReturnOrderProduct {
  id: string;
  invoiceNumber: string;
  partNumber: string;
  customerPart: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

interface ReturnOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: 'GENERADA' | 'EN REVISION' | 'APROBADA' | 'RECHAZADA';
  subtotal: number;
  tax: number;
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
  protected readonly orders = signal<ReturnOrder[]>([
    {
      id: 'ORD-1',
      orderNumber: 'DEV-2026-834201',
      createdAt: '2026-03-18T10:45:00',
      status: 'EN REVISION',
      subtotal: 9832.2,
      tax: 1573.15,
      total: 11405.35,
      invoices: ['F001-000981', 'F001-001025'],
      products: [
        {
          id: 'P-1',
          invoiceNumber: 'F001-000981',
          partNumber: 'AXL-RED-10',
          customerPart: 'C-AXL-100A',
          quantity: 4,
          unit: 'PZA',
          unitPrice: 43.7,
        },
        {
          id: 'P-2',
          invoiceNumber: 'F001-001025',
          partNumber: 'SEAL-90-XL',
          customerPart: 'CUS-SEAL-90X',
          quantity: 12,
          unit: 'KIT',
          unitPrice: 91.4,
        },
      ],
    },
    {
      id: 'ORD-2',
      orderNumber: 'DEV-2026-771094',
      createdAt: '2026-03-10T08:30:00',
      status: 'APROBADA',
      subtotal: 6176.25,
      tax: 988.2,
      total: 7164.45,
      invoices: ['F001-001188'],
      products: [
        {
          id: 'P-1',
          invoiceNumber: 'F001-001188',
          partNumber: 'BRG-STD-05',
          customerPart: 'PART-BRG-05',
          quantity: 5,
          unit: 'PZA',
          unitPrice: 204.11,
        },
        {
          id: 'P-2',
          invoiceNumber: 'F001-001188',
          partNumber: 'HSG-200-GY',
          customerPart: 'CLI-HSG2-00',
          quantity: 8,
          unit: 'PZA',
          unitPrice: 314.65,
        },
      ],
    },
  ]);

  protected readonly expandedOrderIds = signal<Set<string>>(new Set([this.orders()[0]?.id ?? '']));

  protected toggleOrder(orderId: string): void {
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

  protected isExpanded(orderId: string): boolean {
    return this.expandedOrderIds().has(orderId);
  }

  protected statusClasses(status: ReturnOrder['status']): string {
    if (status === 'APROBADA') {
      return 'border-green-200 bg-green-50 text-green-700';
    }

    if (status === 'EN REVISION') {
      return 'border-amber-200 bg-amber-50 text-amber-700';
    }

    if (status === 'RECHAZADA') {
      return 'border-red-200 bg-red-50 text-red-700';
    }

    return 'border-gray-200 bg-gray-50 text-gray-700';
  }
}
