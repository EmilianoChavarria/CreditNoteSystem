import { HttpEvent, HttpEventType, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of, shareReplay, tap, finalize } from 'rxjs';
import { HttpCachePolicyService } from '../services/http-cache-policy.service';
import { HttpCacheService } from '../services/http-cache.service';

export const httpCacheInterceptor: HttpInterceptorFn = (req, next) => {
  const cachePolicyService = inject(HttpCachePolicyService);
  const cacheService = inject(HttpCacheService);

  if (req.method !== 'GET') {
    return next(req).pipe(
      tap((event: HttpEvent<unknown>) => {
        if (event.type === HttpEventType.Response) {
          cacheService.invalidateRequest(req);
        }
      })
    );
  }

  const policy = cachePolicyService.resolve(req);

  if (!policy) {
    return next(req);
  }

  const key = cachePolicyService.buildCacheKey(req);
  const cachedResponse = cacheService.get<unknown>(key);

  if (cachedResponse) {
    return of(cachedResponse.clone());
  }

  const pendingRequest = cacheService.getPending<HttpEvent<unknown>>(key);

  if (pendingRequest) {
    return pendingRequest as Observable<HttpEvent<unknown>>;
  }

  const request$ = next(req).pipe(
    tap((event: HttpEvent<unknown>) => {
      if (event instanceof HttpResponse && event.status >= 200 && event.status < 300) {
        cacheService.set(key, event, policy.ttlMs, policy.tags);
      }
    }),
    finalize(() => {
      cacheService.clearPending(key);
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  cacheService.setPending(key, request$);

  return request$;
};