import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, shareReplay } from 'rxjs';
import { Classification, Reason, Request, RequestType } from '../../data/interfaces/Request';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { CursorPagination } from './user-service';
import { HttpClient } from '@angular/common/http';
import {
  ApproveMassResponse,
  MassActionRequestPayload,
  PagePagination,
  RejectMassResponse,
  RequestAttachment,
  RequestHistoryData,
  RequestNumber,
} from '../../data/interfaces/RequestService';

export type {
  ApproveMassResponse,
  MassActionFailedRequest,
  MassActionRequestPayload,
  PagePagination,
  RejectMassResponse,
  RequestAttachment,
  RequestHistoryData,
  RequestHistoryLog,
  RequestHistoryRole,
  RequestHistoryStep,
  RequestHistoryTimelineItem,
  RequestNumber,
} from '../../data/interfaces/RequestService';

interface RequestAttachmentsPayload {
  requestId?: number;
  request_id?: number;
  total?: number;
  attachments?: RequestAttachment[];
}

interface RequestAttachmentFilePayload {
  fileUrl?: string;
  file_url?: string;
  url?: string;
  path?: string;
}

export interface ReturnOrderRequestLinkPayload {
  returnOrderId: number;
  requestId: number;
}

@Injectable({
  providedIn: 'root'
})
export class RequestService {

  private token = 'df86e3c71f798ed791afff85b7074abefeb34558903553b6e1aa37f0214aa0bb';
  private reasonsByType = new Map<number, Observable<Reason[]>>();

  constructor(
    private _httpService: HttpService,
    private http: HttpClient
  ) { }

  getExchangeRate(): Observable<string> {
    return this.http.get(`https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/oportuno?token=${this.token}`).pipe(
      map((response: any) => response?.bmx?.series?.[0]?.datos?.[0]?.dato ?? ''),
      catchError((error: any) => {
        console.log(error);
        throw error;
      })
    )
  }

  getReasons(requestTypeId: number): Observable<Reason[]> {
    const cachedReasons = this.reasonsByType.get(requestTypeId);
    if (cachedReasons) {
      return cachedReasons;
    }

    const reasons$ = this._httpService.get<Reason[]>(`/requests/reasons/${requestTypeId}`).pipe(
        map((response: ApiResponse<Reason[]>) => response.data ?? []),
        catchError((error) => {
          this.reasonsByType.delete(requestTypeId);
          console.log(error);
          throw error;
        }),
        shareReplay(1),
      );

    this.reasonsByType.set(requestTypeId, reasons$);
    return reasons$;
  }

  getMyPendingRequests(requestTypeId: number, perPage = 10, page = 1, search?: string): Observable<PagePagination<Request>> {
    const params: { requestTypeId: number; per_page: number; page: number; search?: string } = {
      requestTypeId,
      per_page: perPage,
      page,
    };

    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }

    return this._httpService.get<PagePagination<Request>>('/requests/pending/me', {
      params
    }).pipe(
      map((response: ApiResponse<PagePagination<Request>>) => {
        const payload = response.data;

        return {
          data: payload?.data ?? [],
          current_page: payload?.current_page ?? 1,
          last_page: payload?.last_page ?? 1,
          per_page: payload?.per_page,
          total: payload?.total,
          next_page_url: payload?.next_page_url ?? null,
          prev_page_url: payload?.prev_page_url ?? null,
        };
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getRequestsByCustomerId(customerId: number | string): Observable<PagePagination<Request>> {
    return this._httpService.get<PagePagination<Request>>(`/requests/customer/${customerId}`).pipe(
      map((response: ApiResponse<PagePagination<Request>>) => {
        const payload = response.data;

        return {
          data: payload?.data ?? [],
          current_page: payload?.current_page ?? 1,
          last_page: payload?.last_page ?? 1,
          per_page: payload?.per_page,
          total: payload?.total,
          next_page_url: payload?.next_page_url ?? null,
          prev_page_url: payload?.prev_page_url ?? null,
        };
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  getRequestHistory(requestId: number): Observable<RequestHistoryData | null> {
    return this._httpService.get<RequestHistoryData>(`/requests/${requestId}/history`).pipe(
      map((response: ApiResponse<RequestHistoryData>) => response.data ?? null),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getClassificationsByType(id: number): Observable<Classification[]> {
    return this._httpService.get<Classification[]>(`classifications/requestType/${id}`).pipe(
      map((response: ApiResponse<Classification[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    )
  }

  getRequestsByType(id: number): Observable<Request[]> {
    return this._httpService.get<Request[]>(`/requests/${id}`).pipe(
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

  getRequestsByTypeWithPagePagination(id: number, perPage = 10, page = 1, search?: string): Observable<PagePagination<Request>> {
    const params: { per_page: number; page: number; search?: string } = { per_page: perPage, page };

    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }

    return this._httpService.get<PagePagination<Request>>(`/requests/${id}`, { params }).pipe(
      map((response: ApiResponse<PagePagination<Request>>) => {
        const payload = response.data;

        return {
          data: payload?.data ?? [],
          current_page: payload?.current_page ?? 1,
          last_page: payload?.last_page ?? 1,
          per_page: payload?.per_page,
          total: payload?.total,
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

  getDraftsPaginated(perPage = 10, cursor?: string | null): Observable<CursorPagination<Request>> {
    const params: { perPage: number; cursor?: string } = { perPage };

    if (cursor) {
      params.cursor = cursor;
    }

    return this._httpService.get<CursorPagination<Request>>(`/requests/drafts`, { params }).pipe(
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

  saveRequest(object: any): Observable<ApiResponse<Request | null>> {
    return this._httpService.post<Request>('/requests/newRequest', object).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  linkReturnOrderToRequest(payload: ReturnOrderRequestLinkPayload): Observable<ApiResponse<unknown>> {
    return this._httpService.post<unknown>('/return-order-requests', payload).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  updateRequest(requestId: number, object: any): Observable<ApiResponse<Request | null>> {
    return this._httpService.put<Request>(`/requests/${requestId}`, object).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  saveDraft(object: any): Observable<ApiResponse<Request | null>> {
    return this._httpService.post<Request>('/requests/draft', object).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getRequestTypes(): Observable<RequestType[]> {
    return this._httpService.get<RequestType[]>('/requestType').pipe(
      map((response: ApiResponse<RequestType[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  approveRequest(requestId: number): Observable<any> {
    return this._httpService.post(`/requests/${requestId}/approve`, {}).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  rejectRequest(requestId: number, comments: string): Observable<any> {
    return this._httpService.post(`/requests/${requestId}/reject`, { comments }).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  approveMassRequests(requestIds: number[], comments?: string): Observable<ApproveMassResponse> {
    const payload: MassActionRequestPayload = {
      requestIds,
      comments,
    };

    return this._httpService.post<ApproveMassResponse>('/requests/approve-mass', payload).pipe(
      map((response: ApiResponse<ApproveMassResponse>) => response.data ?? {
        totalReceived: requestIds.length,
        totalApproved: 0,
        totalFailed: requestIds.length,
        approvedRequestIds: [],
        failedRequests: []
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  rejectMassRequests(requestIds: number[], comments: string): Observable<RejectMassResponse> {
    const payload: MassActionRequestPayload = {
      requestIds,
      comments,
    };

    return this._httpService.post<RejectMassResponse>('/requests/reject-mass', payload).pipe(
      map((response: ApiResponse<RejectMassResponse>) => response.data ?? {
        totalReceived: requestIds.length,
        totalRejected: 0,
        totalFailed: requestIds.length,
        rejectedRequestIds: [],
        failedRequests: [],
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  getRequestAttachments(requestId: number): Observable<RequestAttachment[]> {
    return this._httpService.get<RequestAttachment[] | RequestAttachmentsPayload>(`/requests/${requestId}/attachments`).pipe(
      map((response: ApiResponse<RequestAttachment[] | RequestAttachmentsPayload>) => {
        const payload = response.data;

        if (Array.isArray(payload)) {
          return payload;
        }

        if (payload?.attachments && Array.isArray(payload.attachments)) {
          return payload.attachments;
        }

        return [];
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  getRequestAttachmentFileUrl(attachmentId: number): Observable<string | null> {
    return this._httpService.get<RequestAttachmentFilePayload>(`/requests/attachments/${attachmentId}`).pipe(
      map((response: ApiResponse<RequestAttachmentFilePayload>) => {
        const payload = response.data;
        return payload?.fileUrl ?? payload?.file_url ?? payload?.url ?? payload?.path ?? null;
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  deleteRequestAttachment(requestId: number, attachmentId: number): Observable<ApiResponse<boolean>> {
    return this._httpService.delete<boolean>(`/requests/${requestId}/attachments/${attachmentId}`).pipe(
      map((response: ApiResponse<boolean>) => response),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

}
