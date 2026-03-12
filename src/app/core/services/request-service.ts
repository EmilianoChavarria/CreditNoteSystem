import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { Classification, Reason, Request, RequestType } from '../../data/interfaces/Request';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { CursorPagination } from './user-service';

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

@Injectable({
  providedIn: 'root'
})
export class RequestService {

  constructor(
    private _httpService: HttpService
  ) { }

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

  getMyPendingRequests(): Observable<Request[]>{
    return this._httpService.get<Request[]>('requests/pending/1').pipe(
      tap((response: ApiResponse<Request[]>) => {
        if(response.success){

        }
      }),
      map((response: ApiResponse<Request[]>) => response.data ?? []),
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

}
