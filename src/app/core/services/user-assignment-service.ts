import { Injectable } from '@angular/core';
import { HttpService, RequestOptions } from './http-service';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { catchError, map, Observable, throwError } from 'rxjs';

export interface AssignmentRole {
  id?: number;
  roleName?: string;
  color?: string;
}

export interface AssignmentUser {
  id: number;
  fullName: string;
  email: string;
  roleId?: number;
  isActive?: boolean;
  role?: AssignmentRole;
}

export interface AssignUserPayload {
  leaderUserId: number;
  assignedUserId: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserAssignmentService {
  constructor(private readonly httpService: HttpService) {}

  getLeaders(): Observable<AssignmentUser[]> {
    return this.httpService.get<AssignmentUser[]>('/users/assignment/leaders', this.withBearer()).pipe(
      map((response: ApiResponse<AssignmentUser[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getAssignableUsers(): Observable<AssignmentUser[]> {
    return this.httpService.get<AssignmentUser[]>('/users/assignment/assignable-users', this.withBearer()).pipe(
      map((response: ApiResponse<AssignmentUser[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  getAssignedUsers(leaderUserId: number): Observable<AssignmentUser[]> {
    return this.httpService.get<AssignmentUser[]>(`/users/${leaderUserId}/assignments`, this.withBearer()).pipe(
      map((response: ApiResponse<AssignmentUser[]>) => response.data ?? []),
      catchError((error) => throwError(() => error))
    );
  }

  assignUser(payload: AssignUserPayload): Observable<ApiResponse<unknown>> {
    return this.httpService.post<unknown>('/users/assignments', payload, this.withBearer()).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  unassignUser(leaderUserId: number, assignedUserId: number): Observable<ApiResponse<unknown>> {
    return this.httpService.delete<unknown>(`/users/${leaderUserId}/assignments/${assignedUserId}`, this.withBearer()).pipe(
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
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem('token')
      ?? localStorage.getItem('authToken')
      ?? localStorage.getItem('access_token');
  }
}
