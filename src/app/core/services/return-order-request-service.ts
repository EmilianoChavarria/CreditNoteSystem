import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { HttpService } from './http-service';



export interface ReturnOrderRequestReturnOrder {
  id: number;
  clientId: number;
  userId: number;
  status: string;
  notes: string | null;
  chargeTypeId: number
  customRate?: number;
  currency?: string;
  chargeType: ChargeType;
  createdAt: string;
  updatedAt: string;
}

export interface ChargeType {
  id: number
  name: string
  label: string
  percentage: string
  createdAt: string
  updatedAt: string
}

export interface ReturnOrderRequestItem {
  id: number;
  returnOrderRequestId: number;
  returnOrderItemId: number;
  partNumber: string | null;
  sapId: string | null;
  qtyToReturn: number;
  unitPrice: number;
  subTotal: number | null;
  invoiceFolio: string;
  descripcion: string;
  claveUnidad: string;
  unidad: string;
  replenishmentAccepted: number | null;
  replenishmentReasonForRejection: string | null;
  warehouseReceived: number | null;
  warehouseAccepted: number | null;
  warehouseReasonForRejection: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnOrderRequestItemUpdate {
  id: number;
  replenishmentAccepted?: number | null;
  replenishmentReasonForRejection?: string | null;
  warehouseReceived?: number | null;
  warehouseAccepted?: number | null;
  warehouseReasonForRejection?: string | null;
  sapId?: string | null;
}

export interface UpdateReturnOrderRequestItemsPayload {
  items: ReturnOrderRequestItemUpdate[];
}

export interface ReturnOrderRequestByRequestData {
  id: number;
  returnOrderId: number;
  requestId: number;
  returnChargePercent: number;
  globalSubTotal: number;
  returnChargeAmount: number;
  createdAt: string;
  updatedAt: string;
  returnOrder: ReturnOrderRequestReturnOrder;
  items: ReturnOrderRequestItem[];
}

@Injectable({
  providedIn: 'root'
})
export class ReturnOrderRequestService {
  constructor(private readonly httpService: HttpService) {}

  getByRequestId(requestId: number): Observable<ReturnOrderRequestByRequestData | null> {
    return this.httpService.get<ReturnOrderRequestByRequestData>(`/return-order-requests/by-request/${requestId}`).pipe(
      map((response: ApiResponse<ReturnOrderRequestByRequestData>) => response.data ?? null),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  updateItems(
    returnOrderRequestId: number,
    payload: UpdateReturnOrderRequestItemsPayload
  ): Observable<ApiResponse<ReturnOrderRequestByRequestData | null>> {
    return this.httpService.put<ReturnOrderRequestByRequestData | null>(
      `/return-order-requests/${returnOrderRequestId}/items`,
      payload
    );
  }
}
