import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { Customer, CustomerLocal } from '../../data/interfaces/Customer';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export interface PagePagination<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
}

interface SearchCustomerResponse {
  search: string;
  count: number;
  customers: Customer[]
}

export interface CustomerInvoiceSummary {
  id: string;
  serie: string | null;
  folio: string | null;
  status: string | null;
  fechaEmision: string | null;
  total: string | null;
  tipoComprobante: string | null;
  receptorRfc: string | null;
  receptorNombre: string | null;
  moneda: string | null;
  UUID: string | null;
  subTotal: string | null;
}

export type InvoiceChargeType = 'annual' | 'sporadic';

export interface ChargeTypeOption {
  id: number;
  name: InvoiceChargeType;
  label: string;
}

export interface CustomerInvoiceProduct {
  conceptoIndex: number;
  claveProdServ: string;
  cantidad: number;
  claveUnidad: string;
  unidad: string;
  descripcion: string;
  valorUnitario: number;
  importe: number;
  returnedQuantity: number;
  availableQuantity: number;
}

export interface CreateReturnOrderItemRequest {
  invoiceFolio: string;
  invoiceClientId: number;
  conceptoIndex: number;
  requestedQuantity: number;
}

export interface CreateReturnOrderRequest {
  clientId: number;
  notes?: string;
  chargeTypeId: number;
  items: CreateReturnOrderItemRequest[];
}

export interface ReturnOrderCreatedItem {
  id: number;
  returnOrderId: number;
  invoiceFolio: string;
  invoiceClientId: number;
  conceptoIndex: number;
  claveProdServ: string;
  descripcion: string;
  claveUnidad: string;
  unidad: string;
  valorUnitario: number;
  originalQuantity: number;
  requestedQuantity: number;
  createdAt: string;
}

export interface ReturnOrderCreated {
  id: number;
  clientId: number;
  userId: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: ReturnOrderCreatedItem[];
}

export interface ReturnOrderListItem {
  id: number;
  returnOrderId: number;
  invoiceFolio: string;
  invoiceClientId: number;
  conceptoIndex: number;
  claveProdServ: string;
  descripcion: string;
  claveUnidad: string;
  unidad: string;
  valorUnitario: number;
  originalQuantity: number;
  requestedQuantity: number;
  createdAt: string;
}

export interface ReturnOrderListEntry {
  id: number;
  clientId: number;
  userId: number;
  status: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReturnOrderListItem[];
}

export interface ReturnOrderSearchEntry extends ReturnOrderListEntry {
  razonSocial: string;
}

export interface ProductReturnHistoryProduct {
  invoiceFolio: string;
  conceptoIndex: number;
  claveProdServ: string;
  descripcion: string;
  claveUnidad: string;
  unidad: string;
  valorUnitario: number;
}

export interface ProductReturnHistorySummary {
  totalSent: number;
  totalReturned: number;
  available: number;
  unidad: string;
}

export interface ProductReturnHistoryEntry {
  date: string;
  orderNumber: string;
  returnOrderId: number;
  quantity: number;
  status: string;
  notes?: string | null;
}

export interface InvoiceSearchFilters {
  uuid?: string;
  folio?: string;
  receptorId?: string;
  receptorRfc?: string;
  receptorNombre?: string;
  moneda?: string;
  fechaInicial?: string;
  fechaFinal?: string;
}

export interface ProductReturnHistoryData {
  product: ProductReturnHistoryProduct;
  summary: ProductReturnHistorySummary;
  history: ProductReturnHistoryEntry[];
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  constructor(
    private _httpService: HttpService
  ) { }

  getCustomers(): Observable<Customer[]> {
    return this._httpService.get<Customer[]>('/customers').pipe(
      map((response: ApiResponse<Customer[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        return throwError(() => error);
      })
    );
  }

  getCustomersPaginated(perPage = 10, page = 1, search?: string): Observable<PagePagination<Customer>> {
    const params: { per_page: number; page: number; search?: string } = { per_page: perPage, page };

    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }

    return this._httpService.get<PagePagination<Customer>>('/customers', { params }).pipe(
      map((response: ApiResponse<PagePagination<Customer>>) => {
        const payload = response.data;

        return {
          data: payload?.data ?? [],
          current_page: payload?.current_page ?? 1,
          last_page: payload?.last_page ?? 1,
          per_page: payload?.per_page,
          next_page_url: payload?.next_page_url ?? null,
          prev_page_url: payload?.prev_page_url ?? null,
        };
      }),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  saveCustomer(customer: Customer) {
    return this._httpService.post('/customers', customer).pipe(
      tap((response) => {

      }),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      })
    )
  }

  saveExtraData(customer: CustomerLocal) {
    return this._httpService.post('/customers/saveLocal', customer).pipe(
      tap((response) => {

      }),
      catchError((error) => {
        return throwError(() => error);
      })
    )
  }

  getCustomerById(id: number) {
    return this._httpService.get(`/customers/${id}`).pipe(
      tap((response) => {

      }),
      catchError((error) => {
        console.log(error);
        return throwError(() => error)
      })
    )

  }

  getCustomersByName(customerName: string): Observable<Customer[]> {
    return this._httpService.get<SearchCustomerResponse>(`/customers/search?search=${customerName}`).pipe(
      map((response: ApiResponse<SearchCustomerResponse>) => response.data?.customers ?? []),
      catchError(error => {
        console.log(error);
        return throwError(() => error);
      })
    );
  }

  updateReturnOrderCharge(
    returnOrderId: number,
    payload: { chargeTypeId?: number; customRate?: number },
  ): Observable<void> {
    return this._httpService.patch<void>(`/return-orders/${returnOrderId}/charge`, payload).pipe(
      map(() => undefined),
      catchError(error => {
        console.log(error);
        return throwError(() => error);
      }),
    );
  }

  getChargeTypes(): Observable<ChargeTypeOption[]> {
    return this._httpService.get<ChargeTypeOption[]>('/charge-types').pipe(
      map((response: ApiResponse<ChargeTypeOption[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        return throwError(() => error);
      })
    );
  }

  getInvoicesByClientId(clientId: string, chargeType: InvoiceChargeType): Observable<CustomerInvoiceSummary[]> {
    const normalizedClientId = clientId.trim();
    const normalizedChargeType = chargeType.trim();

    if (!normalizedClientId || !normalizedChargeType) {
      return of([]);
    }

    return this._httpService
      .get<CustomerInvoiceSummary[]>(
        `/invoices/${encodeURIComponent(normalizedClientId)}/charge-type/${encodeURIComponent(normalizedChargeType)}`,
      )
      .pipe(
        map((response: ApiResponse<CustomerInvoiceSummary[]>) => response.data ?? []),
        catchError((error) => {
          console.log(error);
          return throwError(() => error);
        }),
      );
  }

  getInvoiceProductsByFolio(folio: string, clientId: string): Observable<CustomerInvoiceProduct[]> {
    const normalizedFolio = folio.trim();
    const normalizedClientId = clientId.trim();

    if (!normalizedFolio || !normalizedClientId) {
      return of([]);
    }

    return this._httpService
      .get<CustomerInvoiceProduct[]>(
        `/invoices/${encodeURIComponent(normalizedFolio)}/products/${encodeURIComponent(normalizedClientId)}`,
      )
      .pipe(
        map((response: ApiResponse<CustomerInvoiceProduct[]>) => response.data ?? []),
        catchError((error) => {
          console.log(error);
          return throwError(() => error);
        }),
      );
  }

  createReturnOrder(payload: CreateReturnOrderRequest): Observable<ReturnOrderCreated> {
    return this._httpService.post<ReturnOrderCreated>('/return-orders', payload).pipe(
      map((response: ApiResponse<ReturnOrderCreated>) => response.data as ReturnOrderCreated),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      }),
    );
  }

  getReturnOrdersByClientId(clientId: string): Observable<ReturnOrderListEntry[]> {
    const normalizedClientId = clientId.trim();

    if (!normalizedClientId) {
      return of([]);
    }

    return this._httpService.get<ReturnOrderListEntry[]>(`/return-orders/client/${encodeURIComponent(normalizedClientId)}`).pipe(
      map((response: ApiResponse<ReturnOrderListEntry[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      }),
    );
  }

  searchReturnOrders(query: string): Observable<ReturnOrderSearchEntry[]> {
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return of([]);
    }

    return this._httpService
      .get<ReturnOrderSearchEntry[]>(`/return-orders/search`, { params: { q: normalizedQuery } })
      .pipe(
        map((response: ApiResponse<ReturnOrderSearchEntry[]>) => response.data ?? []),
        catchError((error) => {
          console.log(error);
          return throwError(() => error);
        }),
      );
  }

  getReturnOrderById(orderId: number): Observable<ReturnOrderListEntry | null> {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return of(null);
    }

    return this._httpService.get<ReturnOrderListEntry>(`/return-orders/${orderId}`).pipe(
      map((response: ApiResponse<ReturnOrderListEntry>) => response.data ?? null),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      }),
    );
  }

  searchInvoicesByClientId(clientId: string, filters: InvoiceSearchFilters): Observable<CustomerInvoiceSummary[]> {
    const normalizedClientId = clientId.trim();

    if (!normalizedClientId) {
      return of([]);
    }

    const params: Record<string, string> = {};
    if (filters.uuid?.trim()) params['uuid'] = filters.uuid.trim();
    if (filters.folio?.trim()) params['folio'] = filters.folio.trim();
    if (filters.receptorId?.trim()) params['receptorId'] = filters.receptorId.trim();
    if (filters.receptorRfc?.trim()) params['receptorRfc'] = filters.receptorRfc.trim();
    if (filters.receptorNombre?.trim()) params['receptorNombre'] = filters.receptorNombre.trim();
    if (filters.moneda?.trim()) params['moneda'] = filters.moneda.trim();
    if (filters.fechaInicial?.trim()) params['fechaInicial'] = filters.fechaInicial.trim();
    if (filters.fechaFinal?.trim()) params['fechaFinal'] = filters.fechaFinal.trim();

    return this._httpService
      .get<CustomerInvoiceSummary[]>(
        `/invoices/${encodeURIComponent(normalizedClientId)}/search`,
        { params, timeoutMs: 30000 },
      )
      .pipe(
        map((response: ApiResponse<CustomerInvoiceSummary[]>) => response.data ?? []),
        catchError((error) => {
          console.log(error);
          return throwError(() => error);
        }),
      );
  }

  downloadInvoiceXml(folio: string, clientId: string): Observable<Blob> {
    const normalizedFolio = folio.trim();
    if (!normalizedFolio) {
      return throwError(() => new Error('Folio requerido'));
    }
    return this._httpService.getBlob(
      `/invoices/${encodeURIComponent(normalizedFolio)}/download/xml`,
      { clientId: clientId.trim() },
    );
  }

  downloadInvoicePdf(folio: string, clientId: string): Observable<Blob> {
    const normalizedFolio = folio.trim();
    if (!normalizedFolio) {
      return throwError(() => new Error('Folio requerido'));
    }
    return this._httpService.getBlob(
      `/invoices/${encodeURIComponent(normalizedFolio)}/download/pdf`,
      { clientId: clientId.trim() },
    );
  }

  getInvoiceProductHistory(
    folio: string,
    clientId: string,
    conceptoIndex: number,
  ): Observable<ProductReturnHistoryData | null> {
    const normalizedFolio = folio.trim();
    const normalizedClientId = clientId.trim();

    if (!normalizedFolio || !normalizedClientId || !Number.isFinite(conceptoIndex)) {
      return of(null);
    }

    return this._httpService
      .get<ProductReturnHistoryData>(
        `/invoices/${encodeURIComponent(normalizedFolio)}/products/${encodeURIComponent(normalizedClientId)}/${conceptoIndex}/history`,
      )
      .pipe(
        map((response: ApiResponse<ProductReturnHistoryData>) => response.data),
        catchError((error) => {
          console.log(error);
          return throwError(() => error);
        }),
      );
  }

}
