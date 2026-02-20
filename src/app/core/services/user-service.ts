import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap } from 'rxjs';
import { User } from '../../data/interfaces/User';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

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
