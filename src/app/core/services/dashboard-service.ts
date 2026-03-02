import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap } from 'rxjs';
import { ChartDataS } from '../../features/dashboard/pages/dashboard/dashboard';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor(
    private _httpService: HttpService
  ) { }

  public getDaysChart(): Observable<ChartDataS[]> {
    return this._httpService.get<ChartDataS[]>('/dashboard').pipe(
      tap((response: ApiResponse<ChartDataS[]>) => {
        if (response.success) {

        }
      }),
      map((response: ApiResponse<ChartDataS[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw (error);
      })
    )
  }

}
