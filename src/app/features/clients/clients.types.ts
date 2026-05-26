export interface InvoiceProduct {
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

export interface CustomerInvoice {
  id: string;
  folio: string;
  invoiceNumber: string;
  date: string;
  products: InvoiceProduct[];
  productsCount: number | null;
}

export interface ReturnOrderItem {
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

export interface GroupedReturnItems {
  invoiceId: string;
  invoiceFolio: string;
  invoiceNumber: string;
  invoiceDate: string;
  deliveryNote: string;
  items: ReturnOrderItem[];
}

export interface GeneratedReturnOrder {
  id: number;
  clientId: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  items: ReturnOrderItem[];
}

export interface ProductHistorySummaryView {
  totalSent: number;
  totalReturned: number;
  available: number;
  unit: string;
}

export interface DraftQuantityChange {
  invoice: CustomerInvoice;
  product: InvoiceProduct;
  value: string | number;
}

export interface DraftQuantityAdjust {
  invoice: CustomerInvoice;
  product: InvoiceProduct;
  delta: number;
}
