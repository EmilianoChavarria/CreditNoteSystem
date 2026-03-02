import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { Customer } from '../../data/interfaces/Customer';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

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
