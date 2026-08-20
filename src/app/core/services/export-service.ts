import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpService } from './http-service';

export type ExcelExportModule = 'users' | 'clients' | 'my_approvals' | 'requests' | 'products';

export type ExcelExportParams = Record<string, string | number | boolean | null | undefined>;

@Injectable({
  providedIn: 'root',
})
export class ExportService {
  constructor(private readonly httpService: HttpService) { }

  exportExcel(module: ExcelExportModule, params: ExcelExportParams = {}): Observable<Blob> {
    const sanitizedParams: Record<string, string> = { module };

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      sanitizedParams[key] = String(value);
    });

    return this.httpService.getBlob('/exports/excel', sanitizedParams);
  }

  downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
