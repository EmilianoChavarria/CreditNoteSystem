import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap } from 'rxjs';
import { Classification, Reason, Request } from '../../data/interfaces/Request';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export interface RequestNumber {
  requestTypeId: number;
  requestNumber: string;
  prefix: string;
}

@Injectable({
  providedIn: 'root'
})
export class RequestService {

  constructor(
    private _httpService: HttpService
  ) { }

  getReasons(): Observable<Reason[]> {
    return this._httpService.get<Reason[]>('/requests/reasons').pipe(
      tap((response: ApiResponse<Reason[]>) => {
        if (response.success) {

        }
      }),
      map((response: ApiResponse<Reason[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getClassificationsByType(id: number): Observable<Classification[]> {
    return this._httpService.get<Classification[]>(`classifications/requestType/${id}`).pipe(
      tap((response: ApiResponse<Classification[]>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
      map((response: ApiResponse<Classification[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    )
  }

  getRequestsByType(id: number): Observable<Request[]> {
    return this._httpService.get<Request[]>(`/requests/${id}`).pipe(
      tap((response: ApiResponse<Request[]>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
      map((response: ApiResponse<Request[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    )
  }

  getNextRequestNumber(requestTypeId: number): Observable<RequestNumber> {
    return this._httpService.get<RequestNumber>(`/requests/next-number/${requestTypeId}`).pipe(
      tap((response: ApiResponse<RequestNumber>) => {
        if (response.success) {

        }
      }),
      map((response: ApiResponse<RequestNumber>) => response.data ?? {
        requestTypeId,
        requestNumber: '',
        prefix: ''
      }),
      catchError(error => {
        console.log(error);
        throw error;
      })
    )
  }

  saveRequest(object: any) {
    return this._httpService.post('/requests/newRequest', object).pipe(
      tap((response) => {
        if(response.success){
          console.log(response);
        }
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

}
