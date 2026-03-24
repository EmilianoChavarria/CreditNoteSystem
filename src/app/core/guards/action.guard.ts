import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { SidebarService } from '../services/sidebar.service';

@Injectable({
  providedIn: 'root'
})
export class ActionGuard implements CanActivate {

  constructor(
    private sidebarService: SidebarService,
    private router: Router,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | boolean | UrlTree {
    const requiredAction = route.data['requiredAction'] as string | undefined;

    if (!requiredAction) {
      return true;
    }

    return this.sidebarService.ensurePermissionsLoaded().pipe(
      map(() => {
        if (this.sidebarService.hasAction(requiredAction)) {
          return true;
        }

        return this.router.createUrlTree(['/app/dashboard']);
      }),
      catchError(() => of(this.router.createUrlTree(['/app/dashboard'])))
    );
  }
}
