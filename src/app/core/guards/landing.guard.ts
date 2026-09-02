import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { SidebarService } from '../services/sidebar.service';

const DEFAULT_URL = '/app/dashboard';

/**
 * Evita caer en rutas que el rol no tiene permitidas (p. ej. usuarios de forecast
 * que no pueden ver el dashboard). Redirige a la primera ruta del sidebar del rol.
 */
@Injectable({
  providedIn: 'root'
})
export class LandingGuard implements CanActivate {

  constructor(
    private sidebarService: SidebarService,
    private router: Router,
  ) {}

  canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | boolean | UrlTree {
    const requestedUrl = (state.url || '').split('?')[0];

    return this.sidebarService.ensurePermissionsLoaded().pipe(
      map(() => this.resolve(requestedUrl)),
      catchError(() => of(this.fallback(requestedUrl)))
    );
  }

  private resolve(requestedUrl: string): boolean | UrlTree {
    const landingUrl = this.sidebarService.resolveLandingUrl();

    // Ruta raíz de la app: mandar siempre a la primera opción del sidebar.
    if (this.isAppRoot(requestedUrl)) {
      return this.router.parseUrl(landingUrl ?? DEFAULT_URL);
    }


    if (this.sidebarService.canAccessUrl(requestedUrl)) {
      return true;
    }

    const target = landingUrl ?? DEFAULT_URL;

    // Evita bucle de redireccion cuando el destino es la misma ruta bloqueada.
    if (this.sameUrl(target, requestedUrl)) {
      return true;
    }

    return this.router.parseUrl(target);
  }

  private sameUrl(a: string, b: string): boolean {
    return this.normalize(a) === this.normalize(b);
  }

  private normalize(url: string): string {
    return (url || '').split('?')[0].replace(/\/+$/, '').toLowerCase();
  }

  private fallback(requestedUrl: string): boolean | UrlTree {
    if (this.isAppRoot(requestedUrl)) {
      return this.router.parseUrl(DEFAULT_URL);
    }

    return true;
  }

  private isAppRoot(url: string): boolean {
    const normalized = url.replace(/\/+$/, '').toLowerCase();
    return normalized === '/app' || normalized === '';
  }
}
