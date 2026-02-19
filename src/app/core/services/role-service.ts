import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap } from 'rxjs';
import { Role } from '../../data/interfaces/User';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

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

}
