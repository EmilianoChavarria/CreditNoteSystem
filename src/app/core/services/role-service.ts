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

  getAllPermissions(): Observable<RolePermission[]> {
    return this._httpSevice.get<RolePermission[]>('/rolesPermission').pipe(
      map((response: ApiResponse<RolePermission[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    )
  }

  assignPermission(data: { roleId: number, requestTypeId: number, hasAccess: boolean }) {
    return this._httpSevice.post('/rolesPermission/assign', data).pipe(
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

}
