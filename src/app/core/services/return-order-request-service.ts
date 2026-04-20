import { Injectable } from '@angular/core';
import { catchError, map, Observable } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { HttpService } from './http-service';

export interface ReturnOrderRequestChargePolicy {
  id: number;
  conditional: string;
  day: number;
  percentage: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ReturnOrderRequestReturnOrder {
  id: number;
  clientId: number;
  userId: number;
  status: string;
  notes: string | null;
  charge: boolean;
  chargePolicyId: number | null;
  chargePolicy: ReturnOrderRequestChargePolicy | null;
  createdAt: string;
  updatedAt: string;
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
  replenishmentAccepted: boolean | null;
  replenishmentReasonForRejection: string | null;
  warehouseReceived: boolean | null;
  warehouseAccepted: boolean | null;
  warehouseReasonForRejection: string | null;
  createdAt: string;
  updatedAt: string;
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
}
