import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { HttpService } from './http-service';

export interface SidebarAction {
  id: number;
  name: string;
  slug: string;
}

export interface SidebarItem {
  id: number;
  name: string;
  url: string;
  icon: string;
  orderIndex: number;
  requiredAction: SidebarAction | null;
  allowedActions: SidebarAction[];
  children: SidebarItem[];
}

interface SidebarByRoleData {
  roleid: number;
  sidebar: SidebarItem[];
}

@Injectable({
  providedIn: 'root'
})
export class SidebarService {

  constructor(private _httpService: HttpService) {}

  getSidebarByRole(): Observable<SidebarItem[]> {
    return this._httpService.get<SidebarByRoleData>('/rolesPermission/sidebar').pipe(
      map((response: ApiResponse<SidebarByRoleData>) => response.data?.sidebar ?? []),
      catchError((error) => {
        console.log(error);
        return throwError(() => error);
      })
    );
  }
}
