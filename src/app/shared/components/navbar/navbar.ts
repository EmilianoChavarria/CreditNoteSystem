import { AsyncPipe, isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth-service';
import { NotificationService } from '../../../core/services/notification-service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';
import { Popover } from '../ui/popover/popover';
import { LucideAngularModule } from 'lucide-angular';
import { map, Observable } from 'rxjs';
import { AuthUser } from '../../../core/services/auth-service';
import { Router, RouterLink } from "@angular/router";
import { AppNotification } from '../../../data/interfaces/Notification';

@Component({
    selector: 'app-navbar',
    templateUrl: './navbar.html',
    styleUrl: './navbar.css',
    imports: [
    Popover,
    LucideAngularModule,
    TranslatePipe,
    AsyncPipe,
    RouterLink
],
})
export class Navbar {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly isBrowser: boolean;
  public user$: Observable<AuthUser | null>;
  public userInitials$: Observable<string>;
  readonly unreadNotifications = this.notificationService.unreadNotifications;
  readonly unreadCount = this.notificationService.unreadCount;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    public translate: TranslateService,
    private _authService: AuthService,
  ) {
    this.user$ = this._authService.user$;
    this.userInitials$ = this.user$.pipe(map(user => this.getInitials(user?.fullName)));
    this.isBrowser = isPlatformBrowser(this.platformId);

    this.translate.addLangs(['es', 'en']);
    this.translate.setDefaultLang('es');

    if (this.isBrowser) {
      const browserLang = this.translate.getBrowserLang();
      const savedLang = localStorage.getItem('lang');
      const userLang = this._authService.getCurrentUser()?.preferredLanguage;
      const language = savedLang || (userLang === 'en' || userLang === 'es' ? userLang : null) || (browserLang?.match(/en|es/) ? browserLang : 'es');
      this.translate.use(language);
    } else {
      this.translate.use('es');
    }
  }

  switchLang(lang: string) {
    this.translate.use(lang);
    if (this.isBrowser) {
      localStorage.setItem('lang', lang);
    }
  }

  logout() {
    this._authService.logout().subscribe({
      next: (response: any) => console.log(response),
      error: (error: any) => console.log(error)
    });
  }

  markAsRead(notification: AppNotification, event?: Event): void {
    event?.stopPropagation();

    if (this.notificationService.isRead(notification)) {
      return;
    }

    this.notificationService.markAsRead(notification.id).subscribe({
      error: (error) => console.error('[Navbar] Failed to mark notification as read:', error)
    });
  }

  openNotification(notification: AppNotification): void {
    const routePath = this.isBulkUploadNotification(notification)
      ? ['/app/request/bulk-upload']
      : ['/app/notifications'];

    const queryParams = this.isBulkUploadNotification(notification)
      ? this.buildBulkHistoryQuery(notification)
      : undefined;

    this.router.navigate(routePath, { queryParams }).catch((error) => {
      console.error('[Navbar] Notification navigation failed:', error);
    });

    if (!this.notificationService.isRead(notification)) {
      this.markAsRead(notification);
    }
  }

  formatNotificationDate(value?: string | null): string {
    if (!value) {
      return 'Reciente';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(this.translate.currentLang || 'es', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  }

  private getInitials(fullName?: string): string {
    if (!fullName?.trim()) {
      return 'NA';
    }

    const names = fullName.trim().split(/\s+/);
    const first = names[0]?.[0] ?? '';
    const second = names[1]?.[0] ?? '';

    return `${first}${second}`.toUpperCase();
  }

  private isBulkUploadNotification(notification: AppNotification): boolean {
    const raw = notification as Record<string, unknown>;
    const composedText = [
      String(notification.type ?? ''),
      String(notification.title ?? ''),
      String(notification.message ?? ''),
      String(raw['event'] ?? ''),
      String(raw['category'] ?? ''),
    ].join(' ').toLowerCase();

    return composedText.includes('batch') || composedText.includes('bulk');
  }

  private buildBulkHistoryQuery(notification: AppNotification): Record<string, string | number> {
    const raw = notification as Record<string, unknown>;
    const data = (raw['data'] ?? null) as Record<string, unknown> | null;
    const batch = (raw['batch'] ?? null) as Record<string, unknown> | null;
    const batchId = raw['batchId']
      ?? raw['batch_id']
      ?? data?.['batchId']
      ?? data?.['batch_id']
      ?? batch?.['id'];

    if (batchId === undefined || batchId === null || String(batchId).length === 0) {
      return { tab: 'bulk-history' };
    }

    return {
      tab: 'bulk-history',
      batchId: String(batchId),
    };
  }
}