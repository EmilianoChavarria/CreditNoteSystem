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
  countrycode?: string;
  salesEngineerId?: number | null;
  salesEngineerName?: string | null;
  salesManagerId?: number | null;
  salesManagerName?: string | null;
}

export interface DistributorRecord {
  id: number;
  businessName: string;
  taxId: string;
  address: string;
  emails: string;
  clientNumber: string;
  countrycode: string;
  salesEngineerId: number | null;
  salesEngineerName: string | null;
  salesManagerId: number | null;
  salesManagerName: string | null;
}

export interface DistributorPage {
  data: DistributorRecord[];
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
}

export interface UpdateDistributorPayload {
  businessName?: string;
  taxId?: string;
  address?: string;
  emails?: string;
  clientNumber?: string;
  countrycode?: string;
  salesEngineerId?: number;
  salesManagerId?: number;
}

export interface DistributorForecastMonth {
  month: number;
  forecast: number;
  sales: number;
  modification: null;
}

export interface StoreDistributorForecastPayload {
  year: number;
  months: Array<{ month: number; forecast: number; sales: number }>;
}

export interface UpdateDistributorForecastMonthPayload {
  forecast?: number;
  sales?: number;
}

export interface ClientGroupResponsible {
  id: number;
  fullName: string;
  email: string;
  roleId: number | null;
  supervisorId: number | null;
  preferredLanguage: string | null;
  isActive: boolean;
  clientId: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  role: { id: number; roleName: string } | null;
  supervisor: unknown | null;
}

export interface ClientGroup {
  id: number;
  name: string;
  memberCount: number;
  createdAt: string;
  responsibleUserId?: number | null;
  responsible?: ClientGroupResponsible | null;
}

export interface ClientGroupForecastClient {
  clientId: number;
  name: string;
  total: number;
}

export interface ClientGroupForecastMonth {
  total: number;
  clients: ClientGroupForecastClient[];
}

export interface ClientGroupForecastSummary {
  group: { id: number; name: string; description: string | null };
  year: number;
  months: Record<string, ClientGroupForecastMonth>;
}

export interface CreateClientGroupPayload {
  name: string;
  responsibleUserId?: number;
}

export interface ClientGroupMember {
  clientId: string;
  razonSocial: string;
}

export interface ClientGroupMembers {
  group: { id: number; name: string };
  members: ClientGroupMember[];
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
  proposedAmount?: string | number;
  proposedForecast?: string | number;
  status: 'pending' | 'approved' | 'rejected';
  currentStep: 'sales_manager' | 'general_manager';
  submittedAt: string;
}

export interface ForecastMonthApi {
  month: number;
  amount?: string | number | null;
  forecast?: string | number | null;
  modification: PendingRequest | null;
  sales: string | number;
}

export interface ForecastClientApi {
  isGroup?: false;
  idCliente: string;
  razonSocial: string;
  year: number;
  months: ForecastMonthApi[];
}

export interface ForecastGroupMemberMonthApi {
  month: number;
  sales: string | number;
}

export interface ForecastGroupMemberApi {
  idCliente: number;
  razonSocial: string;
  year: number;
  months: ForecastGroupMemberMonthApi[];
}

export interface ForecastGroupApi {
  isGroup: true;
  id: number;
  razonSocial: string;
  year: number;
  months: ForecastMonthApi[];
  clients: ForecastGroupMemberApi[];
}

export type ForecastRowApi = ForecastClientApi | ForecastGroupApi;

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

export interface InvoiceSection {
  clientId: number;
  razonSocial: string;
  invoices: Invoice[];
}

export interface InvoiceProduct {
  noIdentificacion: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
  importeUsd: number;
  clasificacion: string;
  excluido: boolean;
}

export interface InvoiceProductsBreakdown {
  totalFacturado: number;
  totalNoRodamientos: number;
  totalConsiderado: number;
}

export interface InvoiceProductsEntry {
  folio: string;
  fechaEmision: string;
  moneda: string;
  tipoCambio: number | null;
  products: InvoiceProduct[];
  breakdown: InvoiceProductsBreakdown;
}

export interface GroupInvoicesApi {
  isGroup: true;
  id: number;
  name: string;
  month: number;
  year: number;
  sections: InvoiceSection[];
}

export interface MonthEntry {
  forecast: number;
  pendingRequest: PendingRequest | null;
  sales: number;
}

export interface GroupMemberSales {
  id: number;
  name: string;
  monthlySales: number[];
}

export interface Distributor {
  id: number;
  name: string;
  months: MonthEntry[];
  isGroup?: boolean;
  members?: GroupMemberSales[];
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

export interface DistributorChangeRequestHistory {
  action: 'submitted' | 'approved' | 'rejected' | 'auto_approved';
  step: 'sales_manager' | 'general_manager' | 'auto_approved';
  forecast: number;
  actor: ChangeRequestUser | null;
  at: string;
}

export interface DistributorChangeRequest {
  id: number;
  distributorId: number;
  year: number;
  month: number;
  previousForecast: number;
  proposedForecast: number;
  status: 'pending' | 'approved' | 'rejected';
  currentStep: 'sales_manager' | 'general_manager' | 'auto_approved';
  distributor: { id: number; businessName: string } | null;
  submittedBy: ChangeRequestUser | null;
  approver: ChangeRequestUser | null;
  history: DistributorChangeRequestHistory[];
  submittedAt: string;
}

export interface DistributorChangeRequestPayload {
  distributorId: number;
  year: number;
  month: number;
  forecast: number;
}

function buildMonthEntries(months: ForecastMonthApi[]): MonthEntry[] {
  const monthMap = new Map(months.map(m => [m.month, m]));
  return Array.from({ length: 12 }, (_, i) => {
    const apiMonth = monthMap.get(i + 1);
    return {
      forecast: apiMonth ? parseFloat(String(apiMonth.amount ?? apiMonth.forecast ?? '0')) || 0 : 0,
      pendingRequest: apiMonth?.modification ?? null,
      sales: apiMonth ? parseFloat(String(apiMonth.sales)) || 0 : 0,
    };
  });
}

function mapClientToDistributor(client: ForecastClientApi): Distributor {
  return {
    id: parseInt(client.idCliente),
    name: client.razonSocial,
    months: buildMonthEntries(client.months),
  };
}

function mapGroupMemberSales(member: ForecastGroupMemberApi): GroupMemberSales {
  const monthMap = new Map(member.months.map(m => [m.month, m]));
  return {
    id: member.idCliente,
    name: member.razonSocial,
    monthlySales: Array.from({ length: 12 }, (_, i) => {
      const apiMonth = monthMap.get(i + 1);
      return apiMonth ? parseFloat(String(apiMonth.sales)) || 0 : 0;
    }),
  };
}

function mapGroupToDistributor(group: ForecastGroupApi): Distributor {
  return {
    id: group.id,
    name: group.razonSocial,
    isGroup: true,
    months: buildMonthEntries(group.months),
    members: group.clients.map(mapGroupMemberSales),
  };
}

export function mapApiToDistributors(rows: ForecastRowApi[]): Distributor[] {
  return rows.map(row => row.isGroup ? mapGroupToDistributor(row) : mapClientToDistributor(row));
}

export function mapDistributorChangeRequestToChangeRequest(reqs: DistributorChangeRequest[]): ChangeRequest[] {
  return reqs.map(req => ({
    id: req.id,
    idClient: req.distributorId,
    year: req.year,
    month: req.month,
    previousAmount: String(req.previousForecast),
    proposedAmount: String(req.proposedForecast),
    status: req.status,
    currentStep: req.currentStep === 'auto_approved' ? 'general_manager' : req.currentStep,
    submittedBy: req.submittedBy ?? { id: 0, fullName: '—' },
    approver: req.approver ?? { id: 0, fullName: '—' },
    history: req.history.map(h => ({
      action: h.action === 'auto_approved' ? 'approved' : h.action,
      step: h.step,
      amount: String(h.forecast),
      actor: h.actor ?? { id: 0, fullName: '—' },
      at: h.at,
    })),
    submittedAt: req.submittedAt,
  }));
}

@Injectable({ providedIn: 'root' })
export class ForecastService {
  constructor(private readonly httpService: HttpService) {}

  getByEngineer(engineerId: number, year: number): Observable<ForecastRowApi[]> {
    return this.httpService.get<ForecastRowApi[]>(
      `/forecast/sales-engineer/${engineerId}/${year}`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ForecastRowApi[]>) => response.data ?? []),
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

  getDistributorsByEngineer(engineerId: number, year: number): Observable<ForecastRowApi[]> {
    return this.httpService.get<ForecastRowApi[]>(
      `/distributors/sales-engineer/${engineerId}/${year}`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ForecastRowApi[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  submitDistributorChangeRequest(payload: DistributorChangeRequestPayload): Observable<DistributorChangeRequest> {
    return this.httpService.post<DistributorChangeRequest>(
      '/distributors/forecast/change-requests',
      payload,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<DistributorChangeRequest>) => response.data!),
      catchError((error) => throwError(() => error))
    );
  }

  getDistributorMyRequests(): Observable<DistributorChangeRequest[]> {
    return this.httpService.get<DistributorChangeRequest[]>(
      '/distributors/forecast/change-requests/mine',
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<DistributorChangeRequest[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getDistributorPendingApprovals(): Observable<DistributorChangeRequest[]> {
    return this.httpService.get<DistributorChangeRequest[]>(
      '/distributors/forecast/change-requests/pending',
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<DistributorChangeRequest[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getDistributorHistory(distributorId: number, year: number, month: number): Observable<DistributorChangeRequest[]> {
    return this.httpService.get<DistributorChangeRequest[]>(
      `/distributors/forecast/change-requests/history?distributorId=${distributorId}&year=${year}&month=${month}`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<DistributorChangeRequest[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  approveDistributorRequest(id: number): Observable<void> {
    return this.httpService.post<unknown>(
      `/distributors/forecast/change-requests/${id}/approve`,
      {},
      this.withBearer()
    ).pipe(
      map(() => void 0),
      catchError((error) => throwError(() => error))
    );
  }

  rejectDistributorRequest(id: number): Observable<void> {
    return this.httpService.post<unknown>(
      `/distributors/forecast/change-requests/${id}/reject`,
      {},
      this.withBearer()
    ).pipe(
      map(() => void 0),
      catchError((error) => throwError(() => error))
    );
  }

  getInvoices(idClient: number, year: number, month: number): Observable<InvoiceSection[]> {
    return this.httpService.get<Invoice[] | GroupInvoicesApi>(
      `/forecast/${idClient}/${year}/${month}/invoices`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<Invoice[] | GroupInvoicesApi>) => {
        const data = response.data;
        if (!data) return [];
        if (Array.isArray(data)) {
          return [{ clientId: idClient, razonSocial: '', invoices: data }];
        }
        return data.sections ?? [];
      }),
      catchError((error) => throwError(() => error))
    );
  }

  getInvoiceProducts(idClient: number, year: number, month: number): Observable<InvoiceProductsEntry[]> {
    return this.httpService.get<InvoiceProductsEntry[]>(
      `/forecast/${idClient}/${year}/${month}/invoices/products`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<InvoiceProductsEntry[]>) => response.data ?? []),
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

  exportInvoicesExcel(idClient: number, year: number, month: number): Observable<Blob> {
    return this.httpService.getBlob(`/forecast/${idClient}/${year}/${month}/invoices/export`);
  }

  getClientGroups(): Observable<ClientGroup[]> {
    return this.httpService.get<ClientGroup[]>('/client-groups', this.withBearer()).pipe(
      map((response: ApiResponse<ClientGroup[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getGroupForecast(groupId: number, year: number): Observable<ClientGroupForecastSummary | null> {
    return this.httpService.get<ClientGroupForecastSummary>(
      `/client-groups/${groupId}/${year}/forecast`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<ClientGroupForecastSummary>) => response.data ?? null),
      catchError((error) => throwError(() => error))
    );
  }

  createClientGroup(payload: CreateClientGroupPayload): Observable<ClientGroup> {
    return this.httpService.post<ClientGroup>('/client-groups', payload, this.withBearer()).pipe(
      map((response: ApiResponse<ClientGroup>) => response.data!),
      catchError((error) => throwError(() => error))
    );
  }

  updateClientGroup(groupId: number, payload: CreateClientGroupPayload): Observable<ClientGroup> {
    return this.httpService.put<ClientGroup>(`/client-groups/${groupId}`, payload, this.withBearer()).pipe(
      map((response: ApiResponse<ClientGroup>) => response.data!),
      catchError((error) => throwError(() => error))
    );
  }

  deleteClientGroup(groupId: number): Observable<void> {
    return this.httpService.delete<unknown>(`/client-groups/${groupId}`, this.withBearer()).pipe(
      map(() => void 0),
      catchError((error) => throwError(() => error))
    );
  }

  getGroupMembers(groupId: number): Observable<ClientGroupMembers> {
    return this.httpService.get<ClientGroupMembers>(`/client-groups/${groupId}/members`, this.withBearer()).pipe(
      map((response: ApiResponse<ClientGroupMembers>) => response.data ?? { group: { id: groupId, name: '' }, members: [] }),
      catchError((error) => throwError(() => error))
    );
  }

  addGroupMember(groupId: number, clientId: string): Observable<void> {
    return this.httpService.post<unknown>(`/client-groups/${groupId}/members`, { clientId }, this.withBearer()).pipe(
      map(() => void 0),
      catchError((error) => throwError(() => error))
    );
  }

  addGroupMembersBulk(groupId: number, clientIds: string[]): Observable<void> {
    return this.httpService.post<unknown>(`/client-groups/${groupId}/members/bulk`, { clientIds }, this.withBearer()).pipe(
      map(() => void 0),
      catchError((error) => throwError(() => error))
    );
  }

  removeGroupMember(groupId: number, clientId: string): Observable<void> {
    return this.httpService.delete<unknown>(`/client-groups/${groupId}/members/${encodeURIComponent(clientId)}`, this.withBearer()).pipe(
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

  getDistributorsPaginated(perPage = 15, page = 1, search?: string, zone?: string): Observable<DistributorPage> {
    const params: { per_page: number; page: number; search?: string; zone?: string } = { per_page: perPage, page };
    if (search?.trim()) {
      params.search = search.trim();
    }
    if (zone?.trim()) {
      params.zone = zone.trim();
    }

    return this.httpService.get<DistributorPage>('/distributors', { ...this.withBearer(), params }).pipe(
      map((response: ApiResponse<DistributorPage>) => {
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

  getDistributorForecast(distributorId: number, year: number): Observable<DistributorForecastMonth[]> {
    return this.httpService.get<DistributorForecastMonth[]>(
      `/distributors/${distributorId}/forecast/${year}`,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<DistributorForecastMonth[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  storeDistributorForecast(distributorId: number, payload: StoreDistributorForecastPayload): Observable<DistributorForecastMonth[]> {
    return this.httpService.post<DistributorForecastMonth[]>(
      `/distributors/${distributorId}/forecast`,
      payload,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<DistributorForecastMonth[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  updateDistributorForecastMonth(
    distributorId: number,
    year: number,
    month: number,
    payload: UpdateDistributorForecastMonthPayload
  ): Observable<DistributorForecastMonth> {
    return this.httpService.put<DistributorForecastMonth>(
      `/distributors/${distributorId}/forecast/${year}/${month}`,
      payload,
      this.withBearer()
    ).pipe(
      map((response: ApiResponse<DistributorForecastMonth>) => response.data!),
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
