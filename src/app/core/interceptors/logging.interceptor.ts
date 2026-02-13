import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.group(`🌐 HTTP Request: ${req.method} ${req.url}`);
    console.log('📤 Request Headers:', req.headers.keys().map(key => `${key}: ${req.headers.get(key)}`));
    console.log('🍪 withCredentials:', (req as any).withCredentials);
    console.log('📦 Request Body:', req.body);
    console.groupEnd();

    return next.handle(req).pipe(
      tap({
        next: (event) => {
          if (event instanceof HttpResponse) {
            console.group(`✅ HTTP Response: ${req.method} ${req.url}`);
            console.log('📥 Status:', event.status);
            console.log('📥 Response Headers:', event.headers.keys().map(key => `${key}: ${event.headers.get(key)}`));
            console.log('🍪 Set-Cookie visible:', event.headers.has('Set-Cookie') ? 'Yes' : 'No (normal, cookies se manejan automáticamente)');
            console.log('📦 Response Body:', event.body);
            console.groupEnd();
          }
        },
        error: (error: HttpErrorResponse) => {
          console.group(`❌ HTTP Error: ${req.method} ${req.url}`);
          console.log('📥 Status:', error.status);
          console.log('📥 Error:', error.error);
          console.log('📥 Message:', error.message);
          console.groupEnd();
        }
      })
    );
  }
}
