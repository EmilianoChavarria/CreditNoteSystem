import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap } from 'rxjs';
import { User } from '../../data/interfaces/User';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export interface CursorPagination<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  next_cursor?: string | null;
  next_page_url?: string | null;
  prev_cursor?: string | null;
  prev_page_url?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private _httpService: HttpService
  ) {

  }

  getUsers(): Observable<User[]> {
    return this._httpService.get<User[]>('/users').pipe(

      map((response: ApiResponse<User[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  getManagers(): Observable<User[]> {
    return this._httpService.get<User[]>('users/managers').pipe(
      map((response: ApiResponse<User[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getRequesters(): Observable<User[]> {
    return this._httpService.get<User[]>('users/by-role/requesters').pipe(
      map((response: ApiResponse<User[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  getUsersPaginated(per_page = 10, page = 1, search?: string, roleName = 'all'): Observable<CursorPagination<User>> {
    const params: { per_page: number; page: number; search?: string; roleName?: string } = { per_page, page };

    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }

    params.roleName = roleName?.trim() || 'all';

    return this._httpService.get<CursorPagination<User>>('/usersPag', { params }).pipe(
      map((response: ApiResponse<CursorPagination<User>>) => {
        const payload = response.data;

        return {
          data: payload?.data ?? [],
          current_page: payload?.current_page,
          last_page: payload?.last_page,
          per_page: payload?.per_page,
          next_cursor: payload?.next_cursor ?? null,
          next_page_url: payload?.next_page_url ?? null,
          prev_cursor: payload?.prev_cursor ?? null,
          prev_page_url: payload?.prev_page_url ?? null,
        };
      }),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  getUserById(userId: number): Observable<User> {
    return this._httpService.get<User>(`/users/${userId}`).pipe(
      map((response: ApiResponse<User>) => response.data as User),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  getAuthenticatedUserProfile(): Observable<User> {
    return this._httpService.get<User>('/users/me').pipe(
      map((response: ApiResponse<User>) => response.data as User),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  changePassword(currentPassword: string, newPassword: string, newPassword_confirmation: string): Observable<ApiResponse<null>> {
    return this._httpService.patch<null>('/users/me/password', { currentPassword, newPassword, newPassword_confirmation });
  }

  resetUserPassword(userId: number, newPassword: string, newPassword_confirmation: string): Observable<ApiResponse<null>> {
    return this._httpService.patch<null>(`/users/${userId}/password`, { newPassword, newPassword_confirmation }).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  saveUser(user: Partial<User>) {
    return this._httpService.post('/auth/register', user).pipe(
      tap(() => {

      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  updateUser(userId: number, user: Partial<User>) {
    return this._httpService.put(`/users/${userId}`, user).pipe(
      tap((response) => {

      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  deleteUser(userId: number) {
    return this._httpService.delete(`/users/${userId}`).pipe(
      tap((response) => {

      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

}
