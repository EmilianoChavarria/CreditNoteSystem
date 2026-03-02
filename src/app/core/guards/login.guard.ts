import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
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

    // Verifica la sesión con el backend
    return this.authService.checkSession().pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          const returnUrl = route.queryParamMap.get('returnUrl');
          if (returnUrl) {
            return this.router.parseUrl(returnUrl);
          }
          // Si ya está autenticado, redirige al dashboard
          return this.router.createUrlTree(['/app/dashboard']);
        } else {
          // Si no está autenticado, permite acceso al login
          return true;
        }
      })
    );
  }
}
