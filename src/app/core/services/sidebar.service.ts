import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, throwError } from 'rxjs';
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
  private actionSlugs = new Set<string>();
  private allowedUrls: string[] = [];
  private landingUrls: string[] = [];
  private arePermissionsLoaded = false;

  constructor(private _httpService: HttpService) {}

  getSidebarByRole(): Observable<SidebarItem[]> {
    return this._httpService.get<SidebarByRoleData>('/rolesPermission/sidebar').pipe(
      map((response: ApiResponse<SidebarByRoleData>) => {
        const sidebar = response.data?.sidebar ?? [];
        this.cacheActionSlugs(sidebar);
        this.cacheAllowedUrls(sidebar);
        this.arePermissionsLoaded = true;
        return sidebar;
      }),
      catchError((error) => {
        console.log(error);
        this.actionSlugs.clear();
        this.allowedUrls = [];
        this.landingUrls = [];
        this.arePermissionsLoaded = false;
        return throwError(() => error);
      })
    );
  }

  hasAction(actionSlug: string): boolean {
    const normalizedSlug = actionSlug.trim().toLowerCase();
    if (!normalizedSlug) {
      return false;
    }

    return this.actionSlugs.has(normalizedSlug);
  }

  getAllowedUrls(): string[] {
    return [...this.allowedUrls];
  }

  canAccessUrl(url: string): boolean {
    const normalizedUrl = (url || '').split('?')[0].toLowerCase();
    return this.allowedUrls.some(allowed => normalizedUrl.startsWith(allowed.toLowerCase()));
  }

  /**
   * Primera ruta navegable del sidebar, usada como landing del usuario.
   * Solo hojas: los items padre (p. ej. '/app/forecast') son agrupadores de menu
   * y no tienen ruta registrada en el router.
   */
  resolveLandingUrl(): string | null {
    return this.landingUrls[0] ?? null;
  }

  ensurePermissionsLoaded(): Observable<boolean> {
    if (this.arePermissionsLoaded) {
      return of(true);
    }

    return this.getSidebarByRole().pipe(
      map(() => true)
    );
  }

  private cacheAllowedUrls(sidebarItems: SidebarItem[]): void {
    const urls: string[] = [];
    const landings: string[] = [];

    const byOrder = (items: SidebarItem[]): SidebarItem[] =>
      [...(items ?? [])].sort((a, b) => a.orderIndex - b.orderIndex);

    const walk = (item: SidebarItem): void => {
      const url = item.url?.trim();
      const children = byOrder(item.children);

      if (url) {
        urls.push(url);

        if (children.length === 0) {
          landings.push(url);
        }
      }

      children.forEach(child => walk(child));
    };

    byOrder(sidebarItems).forEach(item => walk(item));

    this.allowedUrls = urls;
    this.landingUrls = landings;
  }

  private cacheActionSlugs(sidebarItems: SidebarItem[]): void {
    this.actionSlugs.clear();

    const walk = (item: SidebarItem): void => {
      item.allowedActions?.forEach(action => {
        const slug = action.slug?.trim().toLowerCase();
        if (slug) {
          this.actionSlugs.add(slug);
        }
      });

      item.children?.forEach(child => walk(child));
    };

    sidebarItems.forEach(item => walk(item));
  }
}
