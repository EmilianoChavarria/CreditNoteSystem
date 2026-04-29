import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth-service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    if (this.authService.isAuthenticated() && this.authService.getCurrentUser()) {
      if (this.authService.mustChangePassword()) {
        return this.router.createUrlTree(['/auth/change-password']);
      }
      return this.resolveSuperAdminAccess(state.url);
    }

    // Verifica la sesión con el backend
    return this.authService.checkSession().pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          if (this.authService.mustChangePassword()) {
            return this.router.createUrlTree(['/auth/change-password']);
          }
          return this.resolveSuperAdminAccess(state.url);
        } else {
          return this.router.createUrlTree(['/auth/login']);
        }
      })
    );
  }

  private resolveSuperAdminAccess(url: string): boolean | UrlTree {
    const currentUser = this.authService.getCurrentUser();
    const roleName = currentUser?.roleName?.trim().toUpperCase();

    if (roleName !== 'SUPERADMIN') {
      return true;
    }

    const normalizedUrl = (url || '').split('?')[0].toLowerCase();

    if (normalizedUrl === '/app' || normalizedUrl === '/app/my-profile') {
      return true;
    }

    return this.router.createUrlTree(['/app/my-profile']);
  }
}
