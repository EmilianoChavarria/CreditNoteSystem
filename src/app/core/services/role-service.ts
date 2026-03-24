import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap } from 'rxjs';
import { Role } from '../../data/interfaces/User';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { RequestType } from '../../data/interfaces/Request';

export interface AssignPermission {
  requestType: RequestType;
  role: Role;
  hasAccess: boolean;
}

export interface RolePermission {
  id: number;
  roleId: number;
  requestTypeId: number;
  hasAccess: boolean;
  requesttype: RequestType;
  role: Role;
}

export interface PermissionAction {
  id: number;
  name: string;
  slug: string;
}

export interface PermissionModule {
  id: number;
  name: string;
  parentid: number | null;
  url: string | null;
  icon: string | null;
  orderindex: number;
  requiredactionid: number | null;
  children?: PermissionModule[];
}

export interface ModulePermissionAssignment {
  roleid: number;
  moduleid: number;
  actionid: number;
  isallowed: boolean;
}

export interface RequestTypePermissionAssignment {
  role_id: number;
  request_type_id: number;
  action_id: number;
  is_allowed: boolean;
}

export interface PermissionCheckPayload {
  roleid?: number;
  moduleid: number;
  action: string | number;
}

export interface RequestTypePermissionCheckPayload {
  role_id?: number;
  request_type_id: number;
  action: string | number;
}

export interface PermissionCheckResult {
  roleid: number;
  moduleid: number;
  action: string | number;
  isallowed: boolean;
}

export interface RequestTypePermissionCheckResult {
  role_id: number;
  request_type_id: number;
  action: string | number;
  is_allowed: boolean;
}

export interface RequestTypePermissionRecord {
  id: number;
  role_id: number;
  request_type_id: number;
  action_id: number;
  is_allowed: boolean;
}

export interface ModulePermissionRecord {
  id: number;
  roleid: number;
  moduleid: number;
  actionid: number;
  isallowed: boolean;
  role: { id: number; roleName: string };
  module: { id: number; name: string };
  action: { id: number; name: string; slug: string };
}

@Injectable({
  providedIn: 'root'
})
export class RoleService {

  constructor(
    private _httpSevice: HttpService
  ) { }

  getRoles(): Observable<Role[]> {
    return this._httpSevice.get<Role[]>('/roles').pipe(
      tap((response: ApiResponse<Role[]>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
      map((response: ApiResponse<Role[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    )
  }

  saveRole(data: Role) {
    return this._httpSevice.post<Role>('roles', data).pipe(
      tap((response: ApiResponse<Role>) => {
        if (response.success) {

        }
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getAllPermissions(): Observable<RolePermission[]> {
    return this._httpSevice.get<RolePermission[]>('/rolesPermission').pipe(
      map((response: ApiResponse<RolePermission[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    )
  }

  assignPermission(data: { roleId: number, requestTypeId: number, hasAccess: boolean }[]) {
    let formatedData = {
      permissions: data
    }
    return this._httpSevice.post('/rolesPermission/assign', formatedData).pipe(
      tap((response) => {
        if (response.success) {

        }
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getActions(): Observable<PermissionAction[]> {
    return this._httpSevice.get<PermissionAction[]>('/actions').pipe(
      map((response: ApiResponse<PermissionAction[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  getModules(): Observable<PermissionModule[]> {
    return this._httpSevice.get<PermissionModule[]>('/modules').pipe(
      map((response: ApiResponse<PermissionModule[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  assignModulePermissions(permissions: ModulePermissionAssignment[]) {
    return this._httpSevice.post('/rolesPermission/assign', { permissions }).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  assignRequestTypePermissions(permissions: RequestTypePermissionAssignment[]) {
    return this._httpSevice.post('/requestTypePermissions/assign', { permissions }).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  checkModulePermission(payload: PermissionCheckPayload): Observable<PermissionCheckResult | null> {
    return this._httpSevice.post<PermissionCheckResult>('/rolesPermission/check', payload).pipe(
      map((response: ApiResponse<PermissionCheckResult>) => response.data ?? null),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  checkRequestTypePermission(payload: RequestTypePermissionCheckPayload): Observable<RequestTypePermissionCheckResult | null> {
    return this._httpSevice.post<RequestTypePermissionCheckResult>('/requestTypePermissions/check', payload).pipe(
      map((response: ApiResponse<RequestTypePermissionCheckResult>) => response.data ?? null),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  getRequestTypePermissionsByRole(roleId: number): Observable<RequestTypePermissionRecord[]> {
    return this._httpSevice.get<RequestTypePermissionRecord[]>(`/requestTypePermissions/role/${roleId}`).pipe(
      map((response: ApiResponse<RequestTypePermissionRecord[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  getRoleModulePermissions(roleId: number): Observable<ModulePermissionRecord[]> {
    return this._httpSevice.get<ModulePermissionRecord[]>(`/rolesPermission/role/${roleId}`).pipe(
      map((response: ApiResponse<ModulePermissionRecord[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

}
