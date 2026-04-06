import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, throwError } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { DashboardChartQueryParams, DashboardChartResponse } from '../../data/interfaces/DashboardChart';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  constructor(
    private _httpService: HttpService
  ) { }

  public getDaysChart(params?: DashboardChartQueryParams): Observable<DashboardChartResponse | null> {
    const requestParams = this.toRequestParams(params);

    return this._httpService.get<DashboardChartResponse>('/dashboard', { params: requestParams }).pipe(
      map((response: ApiResponse<DashboardChartResponse>) => response.data),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      })
    )
  }

  private toRequestParams(params?: DashboardChartQueryParams): { [key: string]: string | number | boolean } | undefined {
    if (!params) {
      return undefined;
    }

    const entries = Object.entries(params).filter((entry): entry is [string, string | number | boolean] => {
      const [, value] = entry;
      return value !== undefined;
    });

    if (entries.length === 0) {
      return undefined;
    }

    return Object.fromEntries(entries);
  }

}
