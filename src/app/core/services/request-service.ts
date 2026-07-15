import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { Classification, Reason, Request, RequestType } from '../../data/interfaces/Request';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { CursorPagination } from './user-service';
import { HttpClient } from '@angular/common/http';
import { runtimeConfig } from '../config/runtime-config';
import {
  ApproveMassResponse,
  CancelMassResponse,
  MassActionRequestPayload,
  PagePagination,
  RejectMassResponse,
  RequestAttachment,
  RequestHistoryData,
  RequestNumber,
  SendBackMassPayload,
  SendBackMassResponse,
} from '../../data/interfaces/RequestService';


export type {
  ApproveMassResponse,
  CancelMassResponse,
  MassActionFailedRequest,
  MassActionRequestFilters,
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
  SendBackMassPayload,
  SendBackMassResponse,
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
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const endDate = this.formatDateForBanxico(yesterday);

    const startFrom = new Date(yesterday);
    startFrom.setDate(startFrom.getDate() - 7);
    const startDate = this.formatDateForBanxico(startFrom);

    return this.http.get(`https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos/${startDate}/${endDate}?token=${this.token}`).pipe(
      map((response: any) => {
        const datos: { fecha: string; dato: string }[] = response?.bmx?.series?.[0]?.datos ?? [];
        const available = datos.filter((d) => d.dato && d.dato !== 'N/E');
        return available[available.length - 1]?.dato ?? '';
      }),
      catchError((error: any) => {
        console.log(error);
        throw error;
      })
    );
  }

  private formatDateForBanxico(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

  getRequesters(requestTypeId: number): Observable<{ id: number; fullName: string }[]> {
    return this._httpService.get<{ id: number; fullName: string }[]>('/requests/requesters', {
      params: { requestTypeId }
    }).pipe(
      map((response: ApiResponse<{ id: number; fullName: string }[]>) => response.data ?? []),
      catchError(() => of([]))
    );
  }

  getMyPendingClassifications(requestTypeId: number): Observable<{ type: string }[]> {
    return this._httpService.get<{ type: string }[]>('/classifications/my-pending', {
      params: { requestTypeId }
    }).pipe(
      map((response: ApiResponse<{ type: string }[]>) => response.data ?? []),
      catchError(() => of([]))
    );
  }

  getMyPendingRequests(requestTypeId: number, perPage = 10, page = 1, search?: string, roleName = 'all', requesterId?: string, classificationType?: string, dateFrom?: string, dateTo?: string): Observable<PagePagination<Request>> {
    const params: { requestTypeId: number; per_page: number; page: number; search?: string; roleName?: string; requesterId?: string; classificationType?: string; dateFrom?: string; dateTo?: string } = {
      requestTypeId,
      per_page: perPage,
      page,
    };

    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }

    params.roleName = roleName?.trim() || 'all';

    if (requesterId && requesterId !== 'all') {
      params.requesterId = requesterId;
    }

    if (classificationType && classificationType !== 'all') {
      params.classificationType = classificationType;
    }

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

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

  getAllMyPendingRequests(requestTypeId: number, search?: string, roleName = 'all', requesterId?: string, classificationType?: string, dateFrom?: string, dateTo?: string): Observable<Request[]> {
    const params: { requestTypeId: number; search?: string; roleName?: string; requesterId?: string; classificationType?: string; dateFrom?: string; dateTo?: string } = {
      requestTypeId,
    };

    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }

    params.roleName = roleName?.trim() || 'all';

    if (requesterId && requesterId !== 'all') {
      params.requesterId = requesterId;
    }

    if (classificationType && classificationType !== 'all') {
      params.classificationType = classificationType;
    }

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    return this._httpService.get<Request[]>('/requests/pending/me/all', { params }).pipe(
      map((response: ApiResponse<Request[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
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

  getRequestsByTypeWithPagePagination(id: number, perPage = 10, page = 1, search?: string, roleName = 'all', requesterId?: string, dateFrom?: string, dateTo?: string): Observable<PagePagination<Request>> {
    const params: { per_page: number; page: number; search?: string; roleName?: string; requesterId?: string; dateFrom?: string; dateTo?: string } = { per_page: perPage, page };

    if (search && search.trim().length > 0) {
      params.search = search.trim();
    }

    params.roleName = roleName?.trim() || 'all';

    if (requesterId && requesterId !== 'all') {
      params.requesterId = requesterId;
    }

    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

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

  getDraftsPaginated(perPage = 10, page = 1): Observable<PagePagination<Request>> {
    return this._httpService.get<PagePagination<Request>>('/requests/drafts', {
      params: { per_page: perPage, page }
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
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  getAllDraftsPaginated(
    perPage = 10,
    page = 1,
    search = '',
    requestTypeId: number | null = null,
  ): Observable<PagePagination<Request>> {
    const params: Record<string, string | number> = { per_page: perPage, page };

    if (search.trim()) {
      params['search'] = search.trim();
    }

    if (requestTypeId) {
      params['requestTypeId'] = requestTypeId;
    }

    return this._httpService.get<PagePagination<Request>>('/requests/drafts/all', { params }).pipe(
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

  /**
   * Libera una reserva de folio abandonada (usuario salió del form sin guardar),
   * para cuando el navegador sigue vivo (cambio de tipo, navegación in-app).
   */
  releaseRequestNumber(draftId: number): Observable<ApiResponse<{ released: boolean }>> {
    return this._httpService.post<{ released: boolean }>(`/requests/next-number/${draftId}/release`, {}).pipe(
      catchError(error => {
        console.log(error);
        throw error;
      })
    );
  }

  /**
   * Misma liberación pero disparada vía sendBeacon: única forma confiable de
   * avisar al backend en beforeunload/pagehide (cierre de pestaña), ya que
   * un fetch/XHR normal ahí se puede cancelar a medias.
   */
  releaseRequestNumberOnUnload(draftId: number): void {
    const url = `${runtimeConfig.apiBaseUrl}/requests/next-number/${draftId}/release`;
    navigator.sendBeacon(url);
  }

  saveRequest(formData: FormData): Observable<ApiResponse<Request | null>> {
    return this.http.post<ApiResponse<Request | null>>(
      `${runtimeConfig.apiBaseUrl}/requests/newRequest`,
      formData,
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  linkReturnOrderToRequest(payload: ReturnOrderRequestLinkPayload): Observable<ApiResponse<unknown>> {
    return this._httpService.post<unknown>('/return-order-requests', payload).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  updateRequest(requestId: number, formData: FormData): Observable<ApiResponse<Request | null>> {
    formData.append('_method', 'PUT');
    return this.http.post<ApiResponse<Request | null>>(
      `${runtimeConfig.apiBaseUrl}/requests/${requestId}`,
      formData,
      { withCredentials: true }
    ).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  saveDraft(object: any): Observable<ApiResponse<Request | null>> {
    return this._httpService.post<Request>('/requests/draft', object).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  deleteDraft(id: number): Observable<ApiResponse<null>> {
    return this._httpService.delete<null>(`/requests/drafts/${id}`).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
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

  approveRequest(requestId: number, comments?: string): Observable<any> {
    const body = comments?.trim() ? { comments } : {};
    return this._httpService.post(`/requests/${requestId}/approve`, body).pipe(
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

  sendBackRequest(requestId: number, targetWorkflowStepId: number, comments?: string): Observable<any> {
    const body: { targetWorkflowStepId: number; comments?: string } = { targetWorkflowStepId };
    if (comments?.trim()) body.comments = comments.trim();
    return this._httpService.post(`/requests/${requestId}/send-back`, body).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  cancelRequest(requestId: number, comments?: string): Observable<any> {
    const body: { comments?: string } = {};
    if (comments?.trim()) body.comments = comments.trim();
    return this._httpService.post(`/requests/${requestId}/cancel`, body).pipe(
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  approveMassRequests(payload: MassActionRequestPayload): Observable<ApproveMassResponse> {
    return this._httpService.post<ApproveMassResponse>('/requests/approve-mass', payload, { timeoutMs: 120000 }).pipe(
      map((response: ApiResponse<ApproveMassResponse>) => response.data ?? {
        totalReceived: 0,
        totalApproved: 0,
        totalFailed: 0,
        approvedRequestIds: [],
        failedRequests: []
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  rejectMassRequests(payload: MassActionRequestPayload): Observable<RejectMassResponse> {
    return this._httpService.post<RejectMassResponse>('/requests/reject-mass', payload, { timeoutMs: 120000 }).pipe(
      map((response: ApiResponse<RejectMassResponse>) => response.data ?? {
        totalReceived: 0,
        totalRejected: 0,
        totalFailed: 0,
        rejectedRequestIds: [],
        failedRequests: [],
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  cancelMassRequests(payload: MassActionRequestPayload): Observable<CancelMassResponse> {
    return this._httpService.post<CancelMassResponse>('/requests/cancel-mass', payload, { timeoutMs: 120000 }).pipe(
      map((response: ApiResponse<CancelMassResponse>) => response.data ?? {
        totalReceived: 0,
        totalCancelled: 0,
        totalFailed: 0,
        cancelledRequestIds: [],
        failedRequests: [],
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    );
  }

  sendBackMassRequests(payload: SendBackMassPayload): Observable<SendBackMassResponse> {
    return this._httpService.post<SendBackMassResponse>('/requests/send-back-mass', payload, { timeoutMs: 120000 }).pipe(
      map((response: ApiResponse<SendBackMassResponse>) => response.data ?? {
        totalReceived: 0,
        totalSentBack: 0,
        totalFailed: 0,
        sentBackRequestIds: [],
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

  getRequestPdf(requestId: number): Observable<Blob> {
    return this._httpService.getBlob(`/requests/${requestId}/pdf`);
  }

}
