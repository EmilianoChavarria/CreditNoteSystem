import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, throwError } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export interface ChargeType {
  id: number
  name: string
  label: string
  percentage: number
  createdAt: string
  updatedAt: string
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {

  constructor(
    private _httpService: HttpService
  ) { }

  getChargeType() {
    return this._httpService.get<ChargeType[]>('/charge-types').pipe(
      map((response: ApiResponse<ChargeType[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        return throwError(() => error);
      })
    );
  }

}
