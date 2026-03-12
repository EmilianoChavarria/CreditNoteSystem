import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { Workflow } from '../../data/interfaces/Workflow';
import { catchError, map, tap } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';

export interface ClassificationTypeGroup {
  type: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class WorkflowService {

  constructor(
    private _httpService: HttpService
  ) { }

  getWorkflows() {
    return this._httpService.get<Workflow[]>('/workflowsteps/workflows').pipe(
      tap((response: ApiResponse<Workflow[]>) => {
        if (response.success) {

        }
      }),
      map((response: ApiResponse<Workflow[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getClassificationTypes() {
    return this._httpService.get<ClassificationTypeGroup[]>('/classifications/grouped').pipe(
      tap((response: ApiResponse<ClassificationTypeGroup[]>) => {
        if (response.success) { }

      }),
      map((response: ApiResponse<ClassificationTypeGroup[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  storeClassification(data: Workflow) {
    return this._httpService.post<Workflow>('workflows', data).pipe(
      tap((response: ApiResponse<Workflow>) => {
        if (response.success) { }
      }),
      map((response) => response.data ?? {}),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  storeWorkflowStep(data: any) {
    return this._httpService.post<any>('/workflowsteps', data).pipe(
      tap((response: ApiResponse<any>) => {
        if (response.success) { }
      }),
      map((response) => response.data ?? {}),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  updateWorkflowStep(id: number, data: any) {
    return this._httpService.put<any>(`/workflowsteps/${id}`, data).pipe(
      tap((response: ApiResponse<any>) => {
        if (response.success) { }
      }),
      map((response) => response.data ?? {}),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getWorkflowSteps(workflowId: number) {
    return this._httpService.get<any>(`/workflowsteps/workflow/${workflowId}`).pipe(
      tap((response: ApiResponse<any>) => {
        if (response.success) { }
      }),
      map((response) => response.data?.steps ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

}
