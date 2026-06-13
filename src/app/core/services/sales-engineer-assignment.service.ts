import { Injectable } from '@angular/core';
import { HttpService, RequestOptions } from './http-service';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { catchError, map, Observable, throwError } from 'rxjs';
import { AssignmentUser } from './user-assignment-service';

export interface SalesEngineerAssignPayload {
  managerUserId: number;
  assignedUserId: number;
}

export interface SalesEngineerAssignBatchPayload {
  assignments: SalesEngineerAssignPayload[];
}

export interface SalesEngineerBatchItemResult {
  index: number;
  managerUserId: number;
  assignedUserId: number;
  status: 'created' | 'reactivated' | 'already_active' | 'error';
  assignmentId?: number;
  message?: string;
}

export interface SalesEngineerBatchSummary {
  total: number;
  created: number;
  reactivated: number;
  alreadyActive: number;
  errors: number;
  items: SalesEngineerBatchItemResult[];
}

@Injectable({ providedIn: 'root' })
export class SalesEngineerAssignmentService {
  constructor(private readonly httpService: HttpService) {}

  getManagers(): Observable<AssignmentUser[]> {
    return this.httpService.get<AssignmentUser[]>('/sales-engineer-assignment/managers', this.withBearer()).pipe(
      map((response: ApiResponse<AssignmentUser[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getAssignableEngineers(): Observable<AssignmentUser[]> {
    return this.httpService.get<AssignmentUser[]>('/sales-engineer-assignment/assignable-users', this.withBearer()).pipe(
      map((response: ApiResponse<AssignmentUser[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getAssignedEngineers(managerUserId: number): Observable<AssignmentUser[]> {
    return this.httpService.get<AssignmentUser[]>(`/sales-engineer-assignment/${managerUserId}/assignments`, this.withBearer()).pipe(
      map((response: ApiResponse<AssignmentUser[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  assignEngineersBatch(payload: SalesEngineerAssignBatchPayload): Observable<ApiResponse<SalesEngineerBatchSummary>> {
    return this.httpService.put<SalesEngineerBatchSummary>('/sales-engineer-assignment/assignments', payload, this.withBearer()).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  unassignEngineer(managerUserId: number, assignedUserId: number): Observable<ApiResponse<unknown>> {
    return this.httpService.delete<unknown>(`/sales-engineer-assignment/${managerUserId}/assignments/${assignedUserId}`, this.withBearer()).pipe(
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
