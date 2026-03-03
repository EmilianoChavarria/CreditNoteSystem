import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap } from 'rxjs';
import { User } from '../../data/interfaces/User';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export interface CursorPagination<T> {
  data: T[];
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
      tap((response: ApiResponse<User[]>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
      map((response: ApiResponse<User[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  getUsersPaginated(perPage = 10, cursor?: string | null): Observable<CursorPagination<User>> {
    const params: { perPage: number; cursor?: string } = { perPage };

    if (cursor) {
      params.cursor = cursor;
    }

    return this._httpService.get<CursorPagination<User>>('/usersPag', { params }).pipe(
      map((response: ApiResponse<CursorPagination<User>>) => {
        const payload = response.data;

        return {
          data: payload?.data ?? [],
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
      tap((response: ApiResponse<User>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
      map((response: ApiResponse<User>) => response.data as User),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  saveUser(user: Partial<User>){
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

  deleteUser(userId:number){
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
