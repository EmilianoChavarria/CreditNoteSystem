import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth-service';

export const authExpirationInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/verify') || req.url.includes('/auth/logout');
      const message = (error.error?.message ?? '').toString().toLowerCase();
      const isIpBlocked = error.status === 423
        || message.includes('direccion ip bloqueada')
        || message.includes('dirección ip bloqueada')
        || message.includes('ip bloqueada')
        || message.includes('ip blocked');

      if (isIpBlocked) {
        authService.handleIpBlockedSession(error.error?.message);
      }

      if (error.status === 401 && !isAuthEndpoint) {
        authService.handleUnauthorizedSession();
      }

      return throwError(() => error);
    })
  );
};
