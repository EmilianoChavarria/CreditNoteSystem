// src/app/services/analytics.service.ts
import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

declare let gtag: Function; // Declara la función global de GA

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  constructor(private router: Router) {}

  public init() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      // Registra la vista de página manualmente
      gtag('config', 'G-Y5P774SRZP', {
        page_path: event.urlAfterRedirects
      });
    });
  }

  // Método para eventos personalizados (clics, conversiones, etc.)
  public trackEvent(eventName: string, params: object) {
    gtag('event', eventName, params);
  }
}