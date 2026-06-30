import { Injectable } from '@angular/core';
import { HttpService, RequestOptions } from './http-service';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { catchError, map, Observable, throwError } from 'rxjs';

export interface ForecastClient {
  idCliente: string;
  razonSocial: string;
  direccion: string;
  rfc: string;
  correosForecast: string | null;
}

export interface UpdateDistributorPayload {
  businessName?: string;
  taxId?: string;
  address?: string;
  emails?: string;
  clientNumber?: string;
}

export interface ForecastClientPage {
  data: ForecastClient[];
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
}

export interface PendingRequest {
  id: number;
  proposedAmount: string;
  status: 'pending' | 'approved' | 'rejected';
  currentStep: 'sales_manager' | 'general_manager';
  submittedAt: string;
}

export interface ForecastMonthApi {
  month: number;
  amount: string | null;
  modification: PendingRequest | null;
  sales: string | number;
}

export interface ForecastClientApi {
  idCliente: string;
  razonSocial: string;
  year: number;
  months: ForecastMonthApi[];
}

export interface Invoice {
  folio: string;
  subTotal: number;
  iva: number;
  total: number;
  moneda: 'MXN' | 'USD';
  fechaEmision: string;
  originalSubTotal?: number;
  originalIva?: number;
  originalTotal?: number;
  originalMoneda?: string;
  tipoCambio?: number;
}

export interface MonthEntry {
  forecast: number;
  pendingRequest: PendingRequest | null;
  sales: number;
}

export interface Distributor {
  id: number;
  name: string;
  months: MonthEntry[];
}

export interface ChangeRequestUser {
  id: number;
  fullName: string;
}

export interface ChangeRequestHistory {
  action: 'submitted' | 'approved' | 'rejected';
  step: string;
  amount: string;
  actor: ChangeRequestUser;
  at: string;
}

export interface ChangeRequest {
  id: number;
  idClient: number;
  year: number;
  month: number;
  previousAmount: string;
  proposedAmount: string;
  status: 'pending' | 'approved' | 'rejected';
  currentStep: 'sales_manager' | 'general_manager';
  submittedBy: ChangeRequestUser;
  approver: ChangeRequestUser;
  history: ChangeRequestHistory[];
  submittedAt: string;
}

export interface ChangeRequestPayload {
  idClient: number;
  year: number;
  month: number;
  amount: number;
}

export function mapApiToDistributors(clients: ForecastClientApi[]): Distributor[] {
  return clients.map(client => {
    const monthMap = new Map(client.months.map(m => [m.month, m]));
    return {
      id: parseInt(client.idCliente),
      name: client.razonSocial,
      months: Array.from({ length: 12 }, (_, i) => {
        const apiMonth = monthMap.get(i + 1);
        return {
          forecast: apiMonth ? parseFloat(apiMonth.amount ?? '0') || 0 : 0,
          pendingRequest: apiMonth?.modification ?? null,
          sales: apiMonth ? parseFloat(String(apiMonth.sales)) || 0 : 0,
        };
      }),
    };
  });
}

@Injectable({ providedIn: 'root' })
export class ForecastService {
  constructor(private readonly httpService: HttpService) {}

  getByEngineer(engineerId: number, year: number): Observable<ForecastClientApi[]> {
    return this.httpService.get<ForecastClientApi[]>(
      `/forecast/sales-engineer/${engineerId}/${year}`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ForecastClientApi[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  submitChangeRequest(payload: ChangeRequestPayload): Observable<ChangeRequest> {
    return this.httpService.post<ChangeRequest>(
      '/forecast/change-requests',
      payload,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ChangeRequest>) => response.data!),
      catchError((error) => throwError(() => error))
    );
  }

  getMyRequests(): Observable<ChangeRequest[]> {
    return this.httpService.get<ChangeRequest[]>(
      '/forecast/change-requests/mine',
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ChangeRequest[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getPendingApprovals(): Observable<ChangeRequest[]> {
    return this.httpService.get<ChangeRequest[]>(
      '/forecast/change-requests/pending',
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ChangeRequest[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getHistory(idClient: number, year: number, month: number): Observable<ChangeRequest[]> {
    return this.httpService.get<ChangeRequest[]>(
      `/forecast/change-requests/history?idClient=${idClient}&year=${year}&month=${month}`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ChangeRequest[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  approveRequest(id: number): Observable<void> {
    return this.httpService.post<unknown>(
      `/forecast/change-requests/${id}/approve`,
      {},
      this.withBearer()
    ).pipe(
      map(() => void 0),
      catchError((error) => throwError(() => error))
    );
  }

  rejectRequest(id: number): Observable<void> {
    return this.httpService.post<unknown>(
      `/forecast/change-requests/${id}/reject`,
      {},
      this.withBearer()
    ).pipe(
      map(() => void 0),
      catchError((error) => throwError(() => error))
    );
  }

  getInvoices(idClient: number, year: number, month: number): Observable<Invoice[]> {
    return this.httpService.get<Invoice[]>(
      `/forecast/${idClient}/${year}/${month}/invoices`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<Invoice[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getClientForecast(idClient: number, year: number): Observable<ForecastMonthApi[]> {
    return this.httpService.get<ForecastMonthApi[]>(
      `/forecast/${idClient}/${year}`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ForecastMonthApi[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  updateDistributor(id: string, payload: UpdateDistributorPayload): Observable<void> {
    return this.httpService.put<unknown>(
      `/distributors/${id}`,
      payload,
      this.withBearer()
    ).pipe(
      map(() => void 0),
      catchError((error) => throwError(() => error))
    );
  }

  getClientsPaginated(perPage = 15, page = 1, search?: string): Observable<ForecastClientPage> {
    const params: { per_page: number; page: number; search?: string } = { per_page: perPage, page };
    if (search?.trim()) {
      params.search = search.trim();
    }

    return this.httpService.get<ForecastClientPage>('/forecast/clients', { ...this.withBearer(), params }).pipe(
      map((response: ApiResponse<ForecastClientPage>) => {
        const payload = response.data;
        return {
          data: payload?.data ?? [],
          current_page: payload?.current_page ?? 1,
          last_page: payload?.last_page ?? 1,
          per_page: payload?.per_page,
          total: payload?.total,
          next_page_url: payload?.next_page_url,
          prev_page_url: payload?.prev_page_url,
        };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  private withBearer(): RequestOptions {
    const token = this.resolveBearerToken();
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    };
  }

  private resolveBearerToken(): string | null {
    if (typeof localStorage === 'undefined') return null;
    return (
      localStorage.getItem('token') ??
      localStorage.getItem('authToken') ??
      localStorage.getItem('access_token')
    );
  }
}
