import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { Workflow } from '../../data/interfaces/Workflow';
import { catchError, map } from 'rxjs';
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
      map((response: ApiResponse<Workflow[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getClassificationTypes() {
    return this._httpService.get<ClassificationTypeGroup[]>('/classifications/grouped').pipe(
      map((response: ApiResponse<ClassificationTypeGroup[]>) => response.data ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  storeClassification(data: Workflow) {
    return this._httpService.post<Workflow>('workflows', data).pipe(
      map((response) => response.data ?? {}),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  storeWorkflowStep(data: any) {
    return this._httpService.post<any>('/workflowsteps', data).pipe(
      map((response) => response.data ?? {}),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  updateWorkflowStep(id: number, data: any) {
    return this._httpService.put<any>(`/workflowsteps/${id}`, data).pipe(

      map((response) => response.data ?? {}),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

  getWorkflowSteps(workflowId: number) {
    return this._httpService.get<any>(`/workflowsteps/workflow/${workflowId}`).pipe(
      map((response) => response.data?.steps ?? []),
      catchError((error) => {
        console.log(error);
        throw error;
      })
    )
  }

}
