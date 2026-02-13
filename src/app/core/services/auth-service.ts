import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { BehaviorSubject, Observable, tap, catchError, of, map, finalize, shareReplay } from 'rxjs';
import { Router } from '@angular/router';

export interface LoginCredentials {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  private sessionCheck$: Observable<boolean> | null = null;

  constructor(
    private _httpService: HttpService,
    private router: Router
  ) {
    // No verificar sesión automáticamente en el constructor
    // Los guards se encargarán de verificar cuando sea necesario
  }

  /**
   * Login de usuario - la cookie se recibe automáticamente del backend
   */
  login(credentials: LoginCredentials): Observable<any> {
    return this._httpService.post('/auth/login', credentials).pipe(
      tap(response => {
        if (response.success) {
          this.isAuthenticatedSubject.next(true);
          this.sessionCheck$ = null;
        }
      }),
      catchError(error => {
        this.isAuthenticatedSubject.next(false);
        this.sessionCheck$ = null;
        throw error;
      })
    );
  }

  /**
   * Verifica si la sesión es válida usando la cookie
   */
  checkSession(): Observable<boolean> {
    if (this.sessionCheck$) {
      return this.sessionCheck$;
    }

    this.sessionCheck$ = this._httpService.get<any>('/auth/verify').pipe(
      map(response => {
        const isValid = response.success;
        this.isAuthenticatedSubject.next(isValid);
        return isValid;
      }),
      catchError(() => {
        this.isAuthenticatedSubject.next(false);
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
        this.isAuthenticatedSubject.next(false);
        this.sessionCheck$ = null;
        this.router.navigate(['/auth/login']);
      }),
      catchError(error => {
        this.isAuthenticatedSubject.next(false);
        this.sessionCheck$ = null;
        this.router.navigate(['/auth/login']);
        return of(null);
      })
    );
  }

  /**
   * Verifica si el usuario está autenticado (para guards)
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }
}
