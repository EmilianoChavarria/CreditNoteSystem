import { Injectable } from '@angular/core';
import { HttpService, RequestOptions } from './http-service';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { catchError, map, Observable, throwError } from 'rxjs';

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
  subTotal: string;
  iva: string;
  total: string;
  fechaEmision: string;
  moneda: 'MXN' | 'USD'
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
