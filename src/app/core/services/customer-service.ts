import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { Customer, CustomerLocal, CustomerLocalPayload } from '../../data/interfaces/Customer';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export interface UpdateClientExtPayload {
  area?: string | null;
  salesEngineerId?: number | null;
  salesManagerId?: number | null;
  processorId?: number | null;
  financeManagerId?: number | null;
  marketingManagerId?: number | null;
  customerServiceManagerId?: number | null;
}

export interface PagePagination<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page?: number;
  from?: number | null;
  to?: number | null;
  total?: number;
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

export type InvoiceChargeType = 'annual' | 'sporadic' | 'exception';

export interface ChargeTypeOption {
  id: number;
  name: InvoiceChargeType;
  label: string;
  percentage?: string | number;
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
  currency: string;
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
  chargeTypeId?: number | null;
  customRate?: number | null;
  currency?: string | null;
  chargeType?: { percentage: number } | null;
  items: ReturnOrderListItem[];
}

export interface ReturnOrderSearchEntry extends ReturnOrderListEntry {
  razonSocial: string;
}

export interface LinkedReturnOrderRequest {
  returnOrderRequestId: number;
  requestId: number;
  requestStatus: string;
  isFinalized: boolean;
}

export interface ReturnOrderDetailItem extends ReturnOrderListItem {
  isEditable: boolean;
}

export interface ReturnOrderDetail extends Omit<ReturnOrderListEntry, 'items'> {
  orderStatus: boolean;
  linkedRequest: LinkedReturnOrderRequest | null;
  items: ReturnOrderDetailItem[];
}

export interface UpdateReturnOrderItemQuantityPayload {
  requestedQuantity: number;
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
          from: payload?.from ?? null,
          to: payload?.to ?? null,
          total: payload?.total ?? payload?.data?.length ?? 0,
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

  updateClientExt(idCliente: string, payload: UpdateClientExtPayload): Observable<void> {
    return this._httpService.put<void>(`/forecast/clients/${encodeURIComponent(idCliente)}/ext`, payload).pipe(
      map(() => undefined),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      })
    );
  }

  saveExtraData(customer: CustomerLocalPayload) {
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

  getInvoicesByClientId(
    clientId: string,
    chargeType: InvoiceChargeType,
    page = 1,
    perPage = 15,
    search = '',
    currency = '',
  ): Observable<PagePagination<CustomerInvoiceSummary>> {
    const normalizedClientId = clientId.trim();
    const normalizedChargeType = chargeType.trim();
    const normalizedSearch = search.trim();
    const normalizedCurrency = currency.trim();

    if (!normalizedClientId || !normalizedChargeType) {
      return of({
        data: [],
        current_page: 1,
        last_page: 1,
        per_page: 0,
        from: null,
        to: null,
        total: 0,
        next_page_url: null,
        prev_page_url: null,
      });
    }

    return this._httpService
      .get<PagePagination<CustomerInvoiceSummary>>(
        `/invoices/${encodeURIComponent(normalizedClientId)}/charge-type/${encodeURIComponent(normalizedChargeType)}`,
        {
          params: {
            per_page: perPage,
            page,
            ...(normalizedSearch ? { search: normalizedSearch } : {}),
            ...(normalizedCurrency ? { moneda: normalizedCurrency } : {}),
          },
        },
      )
      .pipe(
        map((response: ApiResponse<PagePagination<CustomerInvoiceSummary>>) => {
          const payload = response.data;

          return {
            data: payload?.data ?? [],
            current_page: payload?.current_page ?? page,
            last_page: payload?.last_page ?? 1,
            per_page: payload?.per_page,
            from: payload?.from ?? null,
            to: payload?.to ?? null,
            total: payload?.total ?? payload?.data?.length ?? 0,
            next_page_url: payload?.next_page_url ?? null,
            prev_page_url: payload?.prev_page_url ?? null,
          };
        }),
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

  getReturnOrderById(orderId: number): Observable<ReturnOrderDetail | null> {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return of(null);
    }

    return this._httpService.get<ReturnOrderDetail>(`/return-orders/${orderId}`).pipe(
      map((response: ApiResponse<ReturnOrderDetail>) => response.data ?? null),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      }),
    );
  }

  addReturnOrderItems(orderId: number, items: CreateReturnOrderItemRequest[]): Observable<ReturnOrderDetail> {
    return this._httpService.post<ReturnOrderDetail>(`/return-orders/${orderId}/items`, { items }).pipe(
      map((response: ApiResponse<ReturnOrderDetail>) => response.data as ReturnOrderDetail),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      }),
    );
  }

  updateReturnOrderItemQuantity(
    orderId: number,
    itemId: number,
    requestedQuantity: number,
  ): Observable<ReturnOrderDetail> {
    const payload: UpdateReturnOrderItemQuantityPayload = { requestedQuantity };

    return this._httpService.patch<ReturnOrderDetail>(`/return-orders/${orderId}/items/${itemId}`, payload).pipe(
      map((response: ApiResponse<ReturnOrderDetail>) => response.data as ReturnOrderDetail),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      }),
    );
  }

  deleteReturnOrderItem(orderId: number, itemId: number): Observable<ReturnOrderDetail> {
    return this._httpService.delete<ReturnOrderDetail>(`/return-orders/${orderId}/items/${itemId}`).pipe(
      map((response: ApiResponse<ReturnOrderDetail>) => response.data as ReturnOrderDetail),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      }),
    );
  }

  searchInvoicesByClientId(
    clientId: string,
    filters: InvoiceSearchFilters,
    page = 1,
    perPage = 10,
  ): Observable<PagePagination<CustomerInvoiceSummary>> {
    const normalizedClientId = clientId.trim();

    if (!normalizedClientId) {
      return of({
        data: [],
        current_page: 1,
        last_page: 1,
        per_page: perPage,
        from: null,
        to: null,
        total: 0,
        next_page_url: null,
        prev_page_url: null,
      });
    }

    const params: Record<string, string | number> = { per_page: perPage, page };
    if (filters.uuid?.trim()) params['uuid'] = filters.uuid.trim();
    if (filters.folio?.trim()) params['folio'] = filters.folio.trim();
    if (filters.receptorId?.trim()) params['receptorId'] = filters.receptorId.trim();
    if (filters.receptorRfc?.trim()) params['receptorRfc'] = filters.receptorRfc.trim();
    if (filters.receptorNombre?.trim()) params['receptorNombre'] = filters.receptorNombre.trim();
    if (filters.moneda?.trim()) params['moneda'] = filters.moneda.trim();
    if (filters.fechaInicial?.trim()) params['fechaInicial'] = filters.fechaInicial.trim();
    if (filters.fechaFinal?.trim()) params['fechaFinal'] = filters.fechaFinal.trim();

    return this._httpService
      .get<PagePagination<CustomerInvoiceSummary>>(
        `/invoices/${encodeURIComponent(normalizedClientId)}/search`,
        { params, timeoutMs: 30000 },
      )
      .pipe(
        map((response: ApiResponse<PagePagination<CustomerInvoiceSummary>>) => {
          const payload = response.data;

          return {
            data: payload?.data ?? [],
            current_page: payload?.current_page ?? page,
            last_page: payload?.last_page ?? 1,
            per_page: payload?.per_page ?? perPage,
            from: payload?.from ?? null,
            to: payload?.to ?? null,
            total: payload?.total ?? payload?.data?.length ?? 0,
            next_page_url: payload?.next_page_url ?? null,
            prev_page_url: payload?.prev_page_url ?? null,
          };
        }),
        catchError((error) => {
          console.log(error);
          return throwError(() => error);
        }),
      );
  }

  downloadInvoiceFile(id: string, type: 'xml' | 'pdf'): Observable<Blob> {
    const normalizedId = id.trim();
    if (!normalizedId) {
      return throwError(() => new Error('ID de factura requerido'));
    }
    return this._httpService.getBlob(`/invoices/fesa/test/${type}?idTransaccion=${encodeURIComponent(normalizedId)}`);
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
