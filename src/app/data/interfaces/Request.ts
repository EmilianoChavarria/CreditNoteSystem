import { Role, User } from './User';

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
    razonSocial: string;
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
    comments: string;
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
    requestType: RequestType;
    user: User;
    customer: Customer;
    reason: Reason;
    classification: Classification;
    workflowCurrentStep: WorkflowCurrentStep
    attachments?: RequestAttachments;
}

export interface WorkflowStep {
    id: number
    workflowId: number
    stepName: string
    stepOrder: number
    roleId: number
    isInitialStep: boolean
    isFinalStep: boolean
    createdAt: string
    updatedAt: string
    deletedAt: string | null
}

export interface WorkflowCurrentStep {
    id: number
    requestId: number
    workflowId: number
    workflowStepId: number
    assignedRoleId: number
    assignedUserId: number
    status: string
    createdAt: string
    updatedAt: string
    workflow_step: WorkflowStep
    assigned_role: Role
    assigned_user: User
}

export interface RequestType {
    id: number;
    name: string;
}

export interface Reason {
    id: number;
    name: string;
}

export interface Customer {
    id: 1;
    customerNumber: number;
    customerName: string;
}

export interface Classification {
    id: number;
    code: string;
    name: string;
}

export interface RequestAttachment {
    id: number;
    requestId: number;
    fileName: string;
    filePath: string;
    fileExtension: string;
    fileSize: number;
    fileType: string;
    isActive: boolean;
    createdAt: string;
    deletedAt: string | null;
}

export interface RequestAttachments {
    sapScreen?: RequestAttachment[];
    uploadSupport?: RequestAttachment[];
}
