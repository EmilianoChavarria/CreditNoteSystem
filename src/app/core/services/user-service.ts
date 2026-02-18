import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, Observable, tap } from 'rxjs';
import { User } from '../../data/interfaces/User';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(
    private _httpService: HttpService
  ) {
    // No verificar sesión automáticamente en el constructor
    // Los guards se encargarán de verificar cuando sea necesario
  }

  getUsers(): Observable<any> {
    return this._httpService.get('/users').pipe(
      tap(response => {
        if (response.success) {
          // console.log(response);
        }
      }),
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

}
