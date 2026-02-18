export interface Request {
    id?: number;
    requestNumber: string;
    requestTypeId: number;
    userId: number;
    status: string;
    orderNumber?: string;
    requestDate: string;
    currency: string;
    customerId: number;
    area: string;
    reasonId: number;
    classificationId: number;
    deliveryNote: string;
    invoiceNumber: string;
    invoiceDate: string;
    exchangeRate: number;
    creditNumber: string;
    amount: number;
    hasIva: boolean;
    totalAmount: number;
    creditDebitRefId?: number | null;
    newInvoice?: boolean;
    sapReturnOrder?: string | null;
    hasRga: boolean;
    warehouseCode?: string | null;
    replenishmentAmount?: number;
    hasReplenishmentIva: boolean;
    replenishmentTotal?: number;
    warehouseAmount?: number;
    hasWarehouseIva: boolean;
    warehouseTotal?: number;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface Reason {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
}

export interface Classification {
    id: number;
    name: string;
}
