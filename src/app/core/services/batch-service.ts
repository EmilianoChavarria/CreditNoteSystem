import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, throwError } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { HttpService, RequestOptions } from './http-service';

export interface BatchSummary {
  id: number | string;
  batchType: string;
  requestTypeId?: number | null;
  requestTypeName?: string | null;
  status: string;
  totalRecords: number;
  processedRecords: number;
  processingRecords: number;
  errorRecords: number;
  progressPercent: number;
  createdAt: string;
}

export interface BatchErrorLog {
  id?: number | string;
  requestId?: number | string;
  message?: string;
  detail?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface BatchRequestItem {
  id: number | string;
  status: string;
  processedAt?: string | null;
  requestId?: number | string;
  request?: Record<string, unknown>;
  errorLog?: unknown;
  rawData?: unknown;
  [key: string]: unknown;
}

export interface PagePagination<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
}

export interface BatchDetailResponse {
  batch: BatchSummary | null;
  errors: PagePagination<BatchErrorLog>;
}

export interface BatchRequestsResponse {
  batch: BatchSummary | null;
  items: PagePagination<BatchRequestItem>;
}

@Injectable({
  providedIn: 'root'
})
export class BatchService {
  private readonly baseApiUrl = 'http://192.168.2.52:8000/api';

  constructor(
    private readonly httpService: HttpService,
    private readonly httpClient: HttpClient,
  ) { }

  createBatch(file: File, batchType: string, requestTypeId: number, bearerToken?: string): Observable<BatchSummary | null> {
    const resolvedBearer = bearerToken ?? this.resolveBearerToken();
    const headers = resolvedBearer
      ? new HttpHeaders({ Authorization: `Bearer ${resolvedBearer}` })
      : undefined;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('batchType', batchType);
    formData.append('requestTypeId', String(requestTypeId));

    return this.httpClient.post<ApiResponse<unknown>>(
      `${this.baseApiUrl}/batches`,
      formData,
      {
        headers,
        withCredentials: true,
      }
    ).pipe(
      map((response) => {
        const data = (response.data ?? {}) as Record<string, unknown>;
        const batchCandidate = data['batch'] ?? data;
        return this.toBatchSummary(batchCandidate);
      }),
      catchError((error) => {
        console.error('Error creating batch', error);
        return throwError(() => error);
      })
    );
  }

  createUploadSupportBatch(
    files: File[],
    requestTypeId: number,
    minRange: number,
    maxRange: number,
    bearerToken?: string,
  ): Observable<BatchSummary | null> {
    const resolvedBearer = bearerToken ?? this.resolveBearerToken();
    const headers = resolvedBearer
      ? new HttpHeaders({ Authorization: `Bearer ${resolvedBearer}` })
      : undefined;

    const formData = new FormData();
    formData.append('batchType', 'uploadSupport');
    formData.append('requestTypeId', String(requestTypeId));
    formData.append('minRange', String(minRange));
    formData.append('maxRange', String(maxRange));

    files.forEach((file) => {
      formData.append('file[]', file);
    });

    return this.httpClient.post<ApiResponse<unknown>>(
      `${this.baseApiUrl}/batches`,
      formData,
      {
        headers,
        withCredentials: true,
      }
    ).pipe(
      map((response) => {
        const data = (response.data ?? {}) as Record<string, unknown>;
        const batchCandidate = data['batch'] ?? data;
        return this.toBatchSummary(batchCandidate);
      }),
      catchError((error) => {
        console.error('Error creating uploadSupport batch', error);
        return throwError(() => error);
      })
    );
  }

  getBatches(perPage = 15, page = 1, requestTypeId?: number, bearerToken?: string): Observable<PagePagination<BatchSummary>> {
    const options = this.buildOptions({ perPage, page, requestTypeId }, bearerToken);

    return this.httpService.get<PagePagination<BatchSummary>>('/batches', options).pipe(
      map((response: ApiResponse<PagePagination<BatchSummary>>) => this.toPagination<BatchSummary>(response.data)),
      catchError((error) => {
        console.error('Error loading batches', error);
        return throwError(() => error);
      })
    );
  }

  getBatchDetail(batchId: number | string, perPage = 25, page = 1, bearerToken?: string): Observable<BatchDetailResponse> {
    const options = this.buildOptions({ perPage, page }, bearerToken);

    return this.httpService.get<unknown>(`/batches/${batchId}`, options).pipe(
      map((response: ApiResponse<unknown>) => {
        const data = (response.data ?? {}) as Record<string, unknown>;
        const batch = this.toBatchSummary(data['batch']);
        const errors = this.toPagination<BatchErrorLog>(data['errors']);

        return { batch, errors };
      }),
      catchError((error) => {
        console.error(`Error loading batch detail ${batchId}`, error);
        return throwError(() => error);
      })
    );
  }

  getBatchRequests(batchId: number | string, perPage = 25, page = 1, bearerToken?: string): Observable<BatchRequestsResponse> {
    const options = this.buildOptions({ perPage, page }, bearerToken);

    return this.httpService.get<unknown>(`/batches/${batchId}/requests`, options).pipe(
      map((response: ApiResponse<unknown>) => {
        const data = (response.data ?? {}) as Record<string, unknown>;
        const batch = this.toBatchSummary(data['batch']);
        const items = this.toPagination<BatchRequestItem>(data['items']);

        return { batch, items };
      }),
      catchError((error) => {
        console.error(`Error loading batch requests ${batchId}`, error);
        return throwError(() => error);
      })
    );
  }

  private buildOptions(params: Record<string, string | number | boolean | null | undefined>, bearerToken?: string): RequestOptions {
    const resolvedBearer = bearerToken ?? this.resolveBearerToken();
    const headers = resolvedBearer ? { Authorization: `Bearer ${resolvedBearer}` } : undefined;
    const sanitizedParams = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
    ) as Record<string, string | number | boolean>;

    return {
      params: sanitizedParams,
      headers,
    };
  }

  private resolveBearerToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    return localStorage.getItem('token')
      ?? localStorage.getItem('authToken')
      ?? localStorage.getItem('access_token');
  }

  private toPagination<T>(source: unknown): PagePagination<T> {
    const payload = (source ?? {}) as Record<string, unknown>;
    const dataValue = payload['data'];
    const data = Array.isArray(dataValue) ? (dataValue as T[]) : [];

    return {
      data,
      current_page: Number(payload['current_page'] ?? 1),
      last_page: Number(payload['last_page'] ?? 1),
      per_page: Number(payload['per_page'] ?? data.length),
      total: Number(payload['total'] ?? data.length),
      next_page_url: (payload['next_page_url'] as string | null | undefined) ?? null,
      prev_page_url: (payload['prev_page_url'] as string | null | undefined) ?? null,
    };
  }

  private toBatchSummary(source: unknown): BatchSummary | null {
    if (!source || typeof source !== 'object') {
      return null;
    }

    const raw = source as Record<string, unknown>;

    return {
      id: (raw['id'] as number | string) ?? '',
      batchType: String(raw['batchType'] ?? ''),
      requestTypeId: raw['requestTypeId'] !== undefined
        ? Number(raw['requestTypeId'])
        : raw['request_type_id'] !== undefined
          ? Number(raw['request_type_id'])
          : null,
      requestTypeName: raw['requestTypeName'] !== undefined
        ? String(raw['requestTypeName'])
        : raw['request_type_name'] !== undefined
          ? String(raw['request_type_name'])
          : null,
      status: String(raw['status'] ?? ''),
      totalRecords: Number(raw['totalRecords'] ?? 0),
      processedRecords: Number(raw['processedRecords'] ?? 0),
      processingRecords: Number(raw['processingRecords'] ?? 0),
      errorRecords: Number(raw['errorRecords'] ?? 0),
      progressPercent: Number(raw['progressPercent'] ?? 0),
      createdAt: String(raw['createdAt'] ?? ''),
    };
  }
}
