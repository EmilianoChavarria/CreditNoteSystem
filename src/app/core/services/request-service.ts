import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { Classification, Reason, Request, RequestType } from '../../data/interfaces/Request';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { CursorPagination } from './user-service';

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

  getMyPendingRequests(): Observable<Request[]>{
    return this._httpService.get<Request[]>('requests/pending/1').pipe(
      tap((response: ApiResponse<Request[]>) => {
        if(response.success){

        }
      }),
      map((response: ApiResponse<Request[]>) => response.data ?? []),
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

  getRequestByTypePaginated(id: number, perPage = 10, cursor?: string | null): Observable<CursorPagination<Request>> {
    const params: { perPage: number; cursor?: string } = { perPage };

    if (cursor) {
      params.cursor = cursor;
    }

    return this._httpService.get<CursorPagination<Request>>(`/requests/${id}`, { params }).pipe(
      map((response: ApiResponse<CursorPagination<Request>>) => {
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
        if (response.success) {
          console.log(response);
        }
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getRequestTypes(): Observable<RequestType[]> {
    return this._httpService.get<RequestType[]>('/requestType').pipe(
      tap((response: ApiResponse<RequestType[]>) => {
        if (response.success) {
        }
      }),
      map((response: ApiResponse<RequestType[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )

  }

}
