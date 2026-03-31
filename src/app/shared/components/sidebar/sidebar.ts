import { Component, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { NavigationEnd, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService, AuthUser } from '../../../core/services/auth-service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarItem, SidebarService } from '../../../core/services/sidebar.service';
import { ToastService } from '../../../core/services/toast-service';
import { filter } from 'rxjs/operators';

interface SidebarOptions {
  iconName: string,
  optionName: string,
  url: string,
  children?: SidebarOptions[],
  active?: boolean
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TranslateModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {

  public isOpen: boolean = true;
  public isLoadingSidebar: boolean = true;
  public openedOptionIndex: number | null = null;
  public hoveredOptionIndexOnCollapse: number | null = null;
  public sidebarOptions: SidebarOptions[] = [];
  private _sidebarService = inject(SidebarService);
  private _ngZone = inject(NgZone);
  private _cdr = inject(ChangeDetectorRef);

  constructor(
    private router: Router,
    private _authService: AuthService,
    private _toastService: ToastService,
  ) {
    this._authService.user$
      .pipe(takeUntilDestroyed())
      .subscribe(user => {
        this.loadSidebarOptions(user);
      });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(event => {
        this._ngZone.runOutsideAngular(() => {
          this.setActiveOption(event.urlAfterRedirects);
          this._cdr.detectChanges();
        });
      });

    this.loadSidebarOptions(this._authService.getCurrentUser());
  }




  onToggleSidebar() {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.openedOptionIndex = null;
    }
  }

  onToggleOption(index: number, route: string, hasChildren: boolean = false) {
    // Run all state mutations outside Angular zone to avoid change detection errors
    this._ngZone.runOutsideAngular(() => {
      if (!this.isOpen) {
        this.isOpen = true;
        this.openedOptionIndex = index;
        if (!hasChildren) {
          this.setActiveOption(route);
          this.router.navigate([route]);
        }
        // Force change detection explicitly
        this._cdr.detectChanges();
        return;
      }
      if (!hasChildren) {
        this.setActiveOption(route);
        this.router.navigate([route]);
      } else {
        this.openedOptionIndex = this.openedOptionIndex === index ? null : index;
      }
      // Force change detection explicitly
      this._cdr.detectChanges();
    });
  }

  onHoverOption(index: number) {
    if (!this.isOpen) {
      this.hoveredOptionIndexOnCollapse = index;
    }
  }

  onLeaveOption() {
    this.hoveredOptionIndexOnCollapse = null;
  }

  private loadSidebarOptions(user: AuthUser | null): void {
    // Don't load sidebar if user is not authenticated (e.g., after logout)
    if (!user) {
      this.isLoadingSidebar = false;
      this.sidebarOptions = [];
      this.openedOptionIndex = null;
      this._cdr.detectChanges();
      return;
    }

    this.isLoadingSidebar = true;

    this._sidebarService.getSidebarByRole().subscribe({
      next: (sidebarItems: SidebarItem[]) => {
        this._ngZone.runOutsideAngular(() => {
          this.sidebarOptions = this.mapSidebarItems(sidebarItems);
          this.ensureRouteAccess(user);
          this.setActiveOption(this.router.url);
          this.isLoadingSidebar = false;
          // Force change detection explicitly
          this._cdr.detectChanges();
        });
      },
      error: () => {
        this._ngZone.runOutsideAngular(() => {
          this.sidebarOptions = this.getFallbackSidebarOptions(user);
          this.ensureRouteAccess(user);
          this.setActiveOption(this.router.url);
          this.isLoadingSidebar = false;
          // Force change detection explicitly
          this._cdr.detectChanges();
        });
        this._toastService.error('No se pudo cargar el menu del usuario', 'Sidebar');
      }
    });
  }

  private ensureRouteAccess(user: AuthUser | null): void {
    const allowedRoutes = this.getAllowedRoutes(this.sidebarOptions);

    if (!allowedRoutes.length) {
      const fallbackHome = this.isCustomer(user) ? '/app/clients' : '/app/dashboard';
      // Execute navigation outside Angular zone
      this._ngZone.runOutsideAngular(() => {
        this.router.navigate([fallbackHome]);
        this._cdr.detectChanges();
      });
      return;
    }

    const canAccessCurrentRoute = allowedRoutes.some(route => this.router.url.startsWith(route));

    if (!canAccessCurrentRoute) {
      // Execute navigation outside Angular zone
      this._ngZone.runOutsideAngular(() => {
        this.router.navigate([allowedRoutes[0]]);
        this._cdr.detectChanges();
      });
    }
  }

  private mapSidebarItems(items: SidebarItem[]): SidebarOptions[] {
    return [...items]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map(item => ({
        iconName: item.icon,
        optionName: item.name,
        url: item.url,
        children: item.children?.length
          ? [...item.children]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map(child => ({
                iconName: child.icon,
                optionName: child.name,
                url: child.url,
              }))
          : undefined,
      }));
  }

  private getAllowedRoutes(options: SidebarOptions[]): string[] {
    const routes: string[] = [];

    options.forEach(option => {
      if (option.url) {
        routes.push(option.url);
      }

      if (option.children?.length) {
        option.children.forEach(child => {
          if (child.url) {
            routes.push(child.url);
          }
        });
      }
    });

    return routes;
  }

  private createSidebarOptions(): SidebarOptions[] {
    return [
      { iconName: 'layout-dashboard', optionName: 'SIDEBAR.HOME', url: '/app/dashboard' },
      {
        iconName: 'credit-card', optionName: 'SIDEBAR.REQUESTS', url: '/app/request/new-request', children: [
          { iconName: 'plus', optionName: 'SIDEBAR.NEW_REQUEST', url: '/app/request/new-request' },
          { iconName: 'eraser', optionName: 'SIDEBAR.DRAFTS', url: '/app/request/drafts' },
          { iconName: 'FolderUp', optionName: 'SIDEBAR.BULK_UPLOAD', url: '/app/request/bulk-upload' },
        ]
      },
      { iconName: 'file-clock', optionName: 'SIDEBAR.APPROVE', url: '/app/my-approvals' },
      { iconName: 'clipboard-check', optionName: 'SIDEBAR.PENDING', url: '/app/pending' },
      { iconName: 'square-arrow-down', optionName: 'SIDEBAR.RETURN_ORDERS_APPROVAL', url: '/app/approvals/return-orders' },
      // { iconName: 'clipboard-list', optionName: 'SIDEBAR.HISTORY', url: '/app/history' },
      { iconName: 'bell', optionName: 'SIDEBAR.NOTIFICATIONS', url: '/app/notifications' },
      {
        iconName: 'settings', optionName: 'SIDEBAR.SETTINGS', url: '/app/settings', children: [
          { iconName: 'users', optionName: 'SIDEBAR.USER_MANAGEMENT', url: '/app/settings/users' },
          { iconName: 'user-plus', optionName: 'SIDEBAR.ASSIGN_USER', url: '/app/settings/assign-user' },
          { iconName: 'building-2', optionName: 'SIDEBAR.CLIENT_MANAGEMENT', url: '/app/settings/customers' },
          { iconName: 'grid-3x2', optionName: 'SIDEBAR.ROLES', url: '/app/settings/roles' },
          { iconName: 'network', optionName: 'SIDEBAR.WORKFLOWS', url: '/app/settings/workflows' },
          // { iconName: 'monitor-cog', optionName: 'SIDEBAR.SYS_CONFIG', url: '/app/settings/system-configuration' },
          // { iconName: 'shield-check', optionName: 'SIDEBAR.SEC_MANAGE', url: '/app/settings/security-management' },
        ]
      },
    ];
  }

  private createCustomerSidebarOptions(): SidebarOptions[] {
    return [
      { iconName: 'receipt', optionName: 'SIDEBAR.MY_INVOICES', url: '/app/clients' },
      { iconName: 'clipboard-check', optionName: 'SIDEBAR.ORDERS', url: '/app/clients/orders' },
    ];
  }

  private getFallbackSidebarOptions(user: AuthUser | null): SidebarOptions[] {
    if (this.isCustomer(user)) {
      return this.createCustomerSidebarOptions();
    }

    const isAdmin = this.isAdmin(user);
    return this.createSidebarOptions().filter(option => {
      if (option.url === '/app/settings') {
        return isAdmin;
      }
      return true;
    });
  }

  private isAdmin(user: AuthUser | null): boolean {
    const roleName = user?.roleName?.trim().toUpperCase();
    return roleName === 'ADMIN';
  }

  private isCustomer(user: AuthUser | null): boolean {
    const roleName = user?.roleName?.trim().toUpperCase();
    return roleName === 'CUSTOMER';
  }

  setActiveOption(route: string) {
    const normalizedRoute = this.normalizeRoute(route);

    this.sidebarOptions.forEach(option => {
      option.active = false;
      if (option.children) {
        option.children.forEach(child => child.active = false);
      }
    });

    // Buscar y marcar la opción activa
    for (let option of this.sidebarOptions) {
      if (option.children) {
        // Si tiene hijos, buscar en los hijos
        const activeChild = option.children.find(child => this.normalizeRoute(child.url) === normalizedRoute);
        if (activeChild) {
          activeChild.active = true;
          option.active = true; // Marcar también el padre
          const index = this.sidebarOptions.indexOf(option);
          if (index >= 0) {
            this.openedOptionIndex = index;
          }
          return;
        }
      } else {
        // Si no tiene hijos, marcar la opción directamente
        if (this.normalizeRoute(option.url) === normalizedRoute) {
          option.active = true;
          return;
        }
      }
    }
  }

  private normalizeRoute(route: string): string {
    if (!route) {
      return '';
    }

    const routeWithoutQuery = route.split('?')[0].split('#')[0];
    if (routeWithoutQuery.length > 1 && routeWithoutQuery.endsWith('/')) {
      return routeWithoutQuery.slice(0, -1);
    }

    return routeWithoutQuery;
  }

  navigate(route: string) {
    // Run all state mutations outside Angular zone to avoid change detection errors
    this._ngZone.runOutsideAngular(() => {
      this.setActiveOption(route);
      this.router.navigate([route]);
      // Force change detection explicitly
      this._cdr.detectChanges();
    });
  }

}


