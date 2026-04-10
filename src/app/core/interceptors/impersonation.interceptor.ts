import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth-service';
import { ImpersonationService } from '../services/impersonation.service';

export const impersonationInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const impersonationService = inject(ImpersonationService);

  if (req.method !== 'GET') {
    return next(req);
  }

  if (/^\/assets\//.test(req.url) || /\/auth\//.test(req.url)) {
    return next(req);
  }

  const currentUser = authService.getCurrentUser();
  const isSuperAdmin = currentUser?.roleName?.trim().toUpperCase() === 'SUPERADMIN';
  const impersonatedUserId = impersonationService.impersonatedUserId();

  if (!isSuperAdmin || !impersonatedUserId) {
    return next(req);
  }

  return next(req.clone({
    setHeaders: {
      'X-Impersonate-User-Id': String(impersonatedUserId),
    },
  }));
};