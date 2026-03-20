import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

interface ApprovalOrderProduct {
  id: string;
  invoiceNumber: string;
  partNumber: string;
  customerPart: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

type ApprovalStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

interface ReturnOrderForApproval {
  id: string;
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
  imports: [CommonModule],
  templateUrl: './return-orders-approval.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReturnOrdersApproval {
  protected readonly orders = signal<ReturnOrderForApproval[]>([
    {

      id: 'ROA-1',
      orderNumber: 'DEV-2026-834201',
      customerName: 'Timken Mexico',
      customerCode: 'C-00122',
      createdBy: 'Mario Hernandez',
      createdAt: '2026-03-18T10:45:00',
      subtotal: 9832.2,
      tax: 1573.15,
      total: 11405.35,
      status: 'PENDIENTE',
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
      id: 'ROA-2',
      orderNumber: 'DEV-2026-771094',
      customerName: 'SKF Monterrey',
      customerCode: 'C-00480',
      createdBy: 'Ana Ruiz',
      createdAt: '2026-03-16T08:30:00',
      subtotal: 6176.25,
      tax: 988.2,
      total: 7164.45,
      status: 'PENDIENTE',
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
      ],
    },
  ]);

  protected readonly expandedOrderIds = signal<Set<string>>(new Set([this.orders()[0]?.id ?? '']));

  protected readonly pendingOrders = computed(() => this.orders().filter(order => order.status === 'PENDIENTE'));
  protected readonly pendingAmount = computed(() =>
    this.pendingOrders().reduce((total, order) => total + order.total, 0),
  );

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

  
  protected approveOrder(orderId: string): void {
    this.orders.update(current =>
      current.map(order => (order.id === orderId ? { ...order, status: 'APROBADA' } : order)),
    );
  }

  protected rejectOrder(orderId: string): void {
    this.orders.update(current =>
      current.map(order => (order.id === orderId ? { ...order, status: 'RECHAZADA' } : order)),
    );
  }
}
