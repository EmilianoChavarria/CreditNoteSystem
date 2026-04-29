import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth-service';

@Injectable({
  providedIn: 'root'
})
export class LoginGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {

    if (this.authService.isAuthenticated() && this.authService.getCurrentUser()) {
      if (state.url.includes('change-password') && this.authService.mustChangePassword()) {
        return true;
      }
      return this.getAuthenticatedRedirectUrl();
    }

    // Verifica la sesión con el backend
    return this.authService.checkSession().pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          if (state.url.includes('change-password') && this.authService.mustChangePassword()) {
            return true;
          }
          return this.getAuthenticatedRedirectUrl();
        } else {
          return true;
        }
      })
    );
  }

  private getAuthenticatedRedirectUrl(): UrlTree {
    const roleName = this.authService.getCurrentUser()?.roleName?.trim().toUpperCase();

    if (roleName === 'SUPERADMIN') {
      return this.router.createUrlTree(['/app/my-profile']);
    }

    return this.router.createUrlTree(['/app/dashboard']);
  }
}
