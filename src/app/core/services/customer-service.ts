import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { Customer, CustomerLocal } from '../../data/interfaces/Customer';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export interface PagePagination<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
}

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

  getCustomersPaginated(perPage = 10, page = 1): Observable<PagePagination<Customer>> {
    const params = { per_page: perPage, page };

    return this._httpService.get<PagePagination<Customer>>('/customers', { params }).pipe(
      map((response: ApiResponse<PagePagination<Customer>>) => {
        const payload = response.data;

        return {
          data: payload?.data ?? [],
          current_page: payload?.current_page ?? 1,
          last_page: payload?.last_page ?? 1,
          per_page: payload?.per_page,
          next_page_url: payload?.next_page_url ?? null,
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

  saveExtraData(customer: CustomerLocal) {
    return this._httpService.post('/customers/saveLocal', customer).pipe(
      tap((response) => {
        
      }),
      catchError((error) => {
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
