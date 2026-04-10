import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { BehaviorSubject, Observable, tap, catchError, of, map, finalize, shareReplay, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { ApiResponse } from '../../data/interfaces/ApiResponse-interface';
import { ToastService } from './toast-service';
import { HttpCacheService } from './http-cache.service';
import { ImpersonationService } from './impersonation.service';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  roleId: number;
  roleName: string;
  preferredLanguage?: string;
}

interface LoginData {
  user?: AuthUser;
  expiresIn?: number;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  private userSubject = new BehaviorSubject<AuthUser | null>(null);
  public user$ = this.userSubject.asObservable();
  private sessionCheck$: Observable<boolean> | null = null;
  private lastSuccessfulSessionCheckAt = 0;
  private readonly sessionCheckTtlMs = 60_000;
  private isHandlingSessionExpiration = false;

  constructor(
    private _httpService: HttpService,
    private router: Router,
    private toastService: ToastService,
    private cacheService: HttpCacheService,
    private impersonationService: ImpersonationService,
  ) {}

  /**
   * Login de usuario - la cookie se recibe automáticamente del backend
   */
  login(credentials: LoginCredentials): Observable<ApiResponse<LoginData>> {
    return this._httpService.post<LoginData>('/auth/login', credentials).pipe(
      tap(response => {
        if (response.success) {
          this.impersonationService.stop();
          this.cacheService.clearAll();
          this.isAuthenticatedSubject.next(true);
          const user = response.data?.user;
          if (user) {
            this.setUser(user);
          } else {
            this.clearUser();
          }
          this.sessionCheck$ = null;
        }
      }),
      catchError(error => {
        this.clearAuthState();
        return throwError(() => error);
      })
    );
  }

  /**
   * Verifica si la sesión es válida usando la cookie
   */
  checkSession(force = false): Observable<boolean> {
    const hadKnownSession = this.isAuthenticated() || !!this.getCurrentUser() || this.lastSuccessfulSessionCheckAt > 0;

    if (
      !force &&
      this.isAuthenticated() &&
      this.getCurrentUser() &&
      Date.now() - this.lastSuccessfulSessionCheckAt < this.sessionCheckTtlMs
    ) {
      return of(true);
    }

    if (this.sessionCheck$) {
      return this.sessionCheck$;
    }

    this.sessionCheck$ = this._httpService.get<LoginData>('/auth/verify').pipe(
      map(response => {
        if (this.isIpBlockedResponse(response)) {
          this.handleIpBlockedSession(response.message);
          return false;
        }

        const isValid = response.success;
        this.isAuthenticatedSubject.next(isValid);

        if (!isValid) {
          if (hadKnownSession) {
            this.notifySessionExpired();
          }
          this.lastSuccessfulSessionCheckAt = 0;
          this.clearUser();
          return false;
        }

        const user = response.data?.user;
        if (user) {
          this.setUser(user);
          this.lastSuccessfulSessionCheckAt = Date.now();
        } else {
          this.clearUser();
        }

        return isValid;
      }),
      catchError((error) => {
        if (this.isIpBlockedError(error)) {
          const blockedMessage = this.extractApiMessage(error) ?? undefined;
          this.handleIpBlockedSession(blockedMessage);
          return of(false);
        }

        if (hadKnownSession) {
          this.notifySessionExpired();
        }
        this.clearAuthState();
        this.lastSuccessfulSessionCheckAt = 0;
        return of(false);
      }),
      finalize(() => {
        this.sessionCheck$ = null;
      }),
      shareReplay(1)
    );

    return this.sessionCheck$;
  }

  /**
   * Logout - elimina la cookie en el backend
   */
  logout(): Observable<any> {
    return this._httpService.post('/auth/logout', {}).pipe(
      tap(() => {
        this.clearAuthState();
        this.lastSuccessfulSessionCheckAt = 0;
        this.clearClientPreferences();
        this.router.navigate(['/auth/login']);
      }),
      catchError(error => {
        this.clearAuthState();
        this.lastSuccessfulSessionCheckAt = 0;
        this.clearClientPreferences();
        this.router.navigate(['/auth/login']);
        return of(null);
      })
    );
  }

  handleUnauthorizedSession(): void {
    if (this.isHandlingSessionExpiration) {
      return;
    }

    this.isHandlingSessionExpiration = true;
    this.notifySessionExpired();
    this.clearAuthState();
    this.lastSuccessfulSessionCheckAt = 0;
    this.clearClientPreferences();
    this.router.navigate(['/auth/login']).finally(() => {
      this.isHandlingSessionExpiration = false;
    });
  }

  handleIpBlockedSession(message?: string): void {
    if (this.isHandlingSessionExpiration) {
      return;
    }

    this.isHandlingSessionExpiration = true;
    this.notifyIpBlocked(message);
    this.clearAuthState();
    this.lastSuccessfulSessionCheckAt = 0;
    this.clearClientPreferences();
    this.router.navigate(['/auth/login']).finally(() => {
      this.isHandlingSessionExpiration = false;
    });
  }

  /**
   * Verifica si el usuario está autenticado (para guards)
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getCurrentUser(): AuthUser | null {
    return this.userSubject.value;
  }

  private setUser(user: AuthUser): void {
    this.userSubject.next(user);
  }

  private clearUser(): void {
    this.userSubject.next(null);
  }

  private clearAuthState(): void {
    this.impersonationService.stop();
    this.isAuthenticatedSubject.next(false);
    this.sessionCheck$ = null;
    this.lastSuccessfulSessionCheckAt = 0;
    this.clearUser();
    this.cacheService.clearAll();
  }

  private clearClientPreferences(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('lang');
    }
  }

  private notifySessionExpired(): void {
    this.toastService.error(
      'Tu sesion ha caducado. Inicia sesión de nuevo.',
      'Sesion caducada'
    );
  }

  private notifyIpBlocked(message?: string): void {
    this.toastService.error(
      message?.trim() || 'Dirección IP bloqueada permanentemente.',
      'Acceso bloqueado'
    );
  }

  private isIpBlockedResponse(response: ApiResponse<LoginData>): boolean {
    return response.codeStatus === 423 || this.isIpBlockedMessage(response.message);
  }

  private isIpBlockedError(error: unknown): boolean {
    const status = (error as { status?: number })?.status;

    if (status === 423) {
      return true;
    }

    const message = this.extractApiMessage(error);
    return this.isIpBlockedMessage(message);
  }

  private isIpBlockedMessage(message?: string | null): boolean {
    if (!message) {
      return false;
    }

    const normalized = message.toLowerCase();
    return normalized.includes('direccion ip bloqueada')
      || normalized.includes('dirección ip bloqueada')
      || normalized.includes('ip bloqueada')
      || normalized.includes('ip blocked');
  }

  private extractApiMessage(error: unknown): string | null {
    const errorObj = error as { error?: { message?: string } };
    return errorObj?.error?.message ?? null;
  }
}
