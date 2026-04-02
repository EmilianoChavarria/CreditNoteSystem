import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap } from 'rxjs';
import { Classification, Reason, Request, RequestType } from '../../data/interfaces/Request';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { CursorPagination } from './user-service';
import { HttpClient } from '@angular/common/http';

export interface PagePagination<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page?: number;
  total?: number;
  next_page_url?: string | null;
  prev_page_url?: string | null;
}

export interface RequestNumber {
  requestTypeId: number;
  requestNumber: string;
  prefix: string;
}

export interface RequestHistoryRole {
  id: number;
  roleName: string;
}

export interface RequestHistoryStep {
  id: number;
  stepName: string;
  stepOrder: number;
  role: RequestHistoryRole;
  isInitialStep: boolean;
  isFinalStep: boolean;
  isCurrent: boolean;
  wasVisited: boolean;
  latestStatus: string | null;
  latestStartedAt: string | null;
  latestCompletedAt: string | null;
}

export interface RequestHistoryLog {
  id: number;
  requestWorkflowStepId: number;
  requestId: number;
  workflowStepId: number;
  actionUserId: number;
  actionType: string;
  comments: string | null;
  createdAt: string;
  workflow_step: {
    id: number;
    workflowId: number;
    stepName: string;
    stepOrder: number;
    roleId: number;
    isInitialStep: boolean;
    isFinalStep: boolean;
  };
  action_user: {
    id: number;
    fullName: string;
    email: string;
    roleId: number;
  };
  request_step: {
    id: number;
    requestId: number;
    workflowStepId: number;
    assignedRoleId: number;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
  };
}

export interface RequestHistoryTimelineItem {
  sequence: number;
  timestamp: string;
  actionType: string;
  message: string;
  comments: string | null;
  step: {
    id: number;
    name: string;
    order: number;
  };
  fromStep: {
    id: number;
    name: string;
    order: number;
  } | null;
  toStep: {
    id: number;
    name: string;
    order: number;
  } | null;
  actionUser: {
    id: number;
    fullName: string;
    email: string;
    roleId: number;
  };
}

export interface RequestHistoryData {
  request: Request;
  workflow: {
    id: number;
    name: string | null;
  };
  progress: {
    currentStepOrder: number;
    totalSteps: number;
    percent: number;
  };
  steps: RequestHistoryStep[];
  history: RequestHistoryLog[];
  timeline?: RequestHistoryTimelineItem[];
  currentStep: {
    id: number;
    requestId: number;
    workflowId: number;
    workflowStepId: number;
    assignedRoleId: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    workflow_step: {
      id: number;
      workflowId: number;
      stepName: string;
      stepOrder: number;
      roleId: number;
      isInitialStep: boolean;
      isFinalStep: boolean;
      role: RequestHistoryRole;
    };
    assigned_role: RequestHistoryRole;
    workflow: {
      id: number;
      name: string;
      description: string;
      isActive: boolean;
      requestTypeId: number;
      classificationType: string;
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
    };
  };
}

export interface RequestAttachment {
  id: number;
  requestId?: number;
  request_id?: number;
  fileName?: string;
  file_name?: string;
  originalName?: string;
  original_name?: string;
  name?: string;
  mimeType?: string;
  mime_type?: string;
  size?: number;
  fileSize?: number;
  file_size?: number;
  url?: string;
  fileUrl?: string;
  file_url?: string;
  path?: string;
  createdAt?: string;
  created_at?: string;
}

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

@Injectable({
  providedIn: 'root'
})
export class RequestService {

  private token = 'df86e3c71f798ed791afff85b7074abefeb34558903553b6e1aa37f0214aa0bb';

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

  getReasons(): Observable<Reason[]> {
    return this._httpService.get<Reason[]>('/requests/reasons').pipe(
      tap((response: ApiResponse<Reason[]>) => {
        if (response.success) {

        }
      }),
      map((response: ApiResponse<Reason[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getMyPendingRequests(requestTypeId: number, perPage = 10, page = 1): Observable<PagePagination<Request>> {
    return this._httpService.get<PagePagination<Request>>('/requests/pending/me', {
      params: {
        requestTypeId,
        perPage,
        page,
      }
    }).pipe(
      tap((response: ApiResponse<PagePagination<Request>>) => {
        if (response.success) {

        }
      }),
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

  getRequestHistory(requestId: number): Observable<RequestHistoryData | null> {
    return this._httpService.get<RequestHistoryData>(`/requests/${requestId}/history`).pipe(
      tap((response: ApiResponse<RequestHistoryData>) => {
        if (response.success) {

        }
      }),
      map((response: ApiResponse<RequestHistoryData>) => response.data ?? null),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getClassificationsByType(id: number): Observable<Classification[]> {
    return this._httpService.get<Classification[]>(`classifications/requestType/${id}`).pipe(
      tap((response: ApiResponse<Classification[]>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
      map((response: ApiResponse<Classification[]>) => response.data ?? []),
      catchError(error => {
        console.log(error);
        throw error;
      })
    )
  }

  getRequestsByType(id: number): Observable<Request[]> {
    return this._httpService.get<Request[]>(`/requests/${id}`).pipe(
      tap((response: ApiResponse<Request[]>) => {
        if (response.success) {
          // console.log(response);
        }
      }),
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

  getRequestsByTypeWithPagePagination(id: number, perPage = 10, page = 1): Observable<PagePagination<Request>> {
    const params = { per_page: perPage, page };

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
      tap((response: ApiResponse<RequestNumber>) => {
        if (response.success) {

        }
      }),
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

  saveRequest(object: any) {
    return this._httpService.post('/requests/newRequest', object).pipe(
      tap((response) => {
        if (response.success) {
          console.log(response);
        }
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  saveDraft(object: any) {
    return this._httpService.post('/requests/draft', object).pipe(
      tap((response) => {
        if (response.success) {
          console.log('Draft saved successfully', response);
        }
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getRequestTypes(): Observable<RequestType[]> {
    return this._httpService.get<RequestType[]>('/requestType').pipe(
      tap((response: ApiResponse<RequestType[]>) => {
        if (response.success) {
        }
      }),
      map((response: ApiResponse<RequestType[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )

  }

  approveRequest(requestId: number): Observable<any> {
    return this._httpService.post(`/requests/${requestId}/approve`, {}).pipe(
      tap((response: ApiResponse<any>) => {
        if (response.success) {
          console.log('Request approved successfully');
        }
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  rejectRequest(requestId: number, comments: string): Observable<any> {
    return this._httpService.post(`/requests/${requestId}/reject`, { comments }).pipe(
      tap((response: ApiResponse<any>) => {
        if (response.success) {
          console.log('Request rejected successfully');
        }
      }),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
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
