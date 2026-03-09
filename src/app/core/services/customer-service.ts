import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { Customer } from '../../data/interfaces/Customer';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { CursorPagination } from './user-service';

interface SearchCustomerResponse {
  search: string;
  count: number;
  customers: Customer[]
}

@Injectable({
  providedIn: 'root'
})
export class CustomerService {

  constructor(
    private _httpService: HttpService
  ) { }

  getCustomers(): Observable<Customer[]> {
    return this._httpService.get<Customer[]>('/customers').pipe(
      tap((response: ApiResponse<Customer[]>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
      map((response: ApiResponse<Customer[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        return throwError(() => error);
      })
    );
  }

  getCustomersPaginated(perPage = 10, cursor?: string | null): Observable<CursorPagination<Customer>> {
    const params: { perPage: number; cursor?: string } = { perPage };

    if (cursor) {
      params.cursor = cursor;
    }

    return this._httpService.get<CursorPagination<Customer>>('/customers', { params }).pipe(
      map((response: ApiResponse<CursorPagination<Customer>>) => {
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

  saveCustomer(customer: Customer) {
    return this._httpService.post('/customers', customer).pipe(
      tap((response) => {

      }),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      })
    )
  }

  getCustomerById(id: number) {
    return this._httpService.get(`/customers/${id}`).pipe(
      tap((response) => {

      }),
      catchError((error) => {
        console.log(error);
        return throwError(() => error)
      })
    )

  }

  getCustomersByName(customerName: string): Observable<Customer[]> {
    return this._httpService.get<SearchCustomerResponse>(`/customers/search?search=${customerName}`).pipe(
      tap((response: ApiResponse<SearchCustomerResponse>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
      map((response: ApiResponse<SearchCustomerResponse>) => response.data?.customers ?? []),
      catchError(error => {
        console.log(error);
        return throwError(() => error);
      })
    );
  }

}
