import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, take } from 'rxjs';
import { AuthService } from '../services/auth-service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    // Evita redirecciones durante SSR; verifica solo en navegador
    if (!isPlatformBrowser(this.platformId)) {
      return true;
    }

    // Verifica la sesión con el backend
    return this.authService.checkSession().pipe(
      take(1),
      map(isAuthenticated => {
        if (isAuthenticated) {
          return true;
        } else {
          // Redirige al login si no está autenticado
          return this.router.createUrlTree(['/auth/login'], {
            queryParams: { returnUrl: state.url }
          });
        }
      })
    );
  }
}
