import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { SidebarMenuPopoverComponent } from './sidebar-menu-popover';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

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
  public openedOptionIndex: number | null = null;
  public hoveredOptionIndexOnCollapse: number | null = null;
  public sidebarOptions: SidebarOptions[];

  constructor(
    private router: Router
  ) {
    this.sidebarOptions = [
      { iconName: 'layout-dashboard', optionName: 'SIDEBAR.HOME', url: '/app/dashboard' },
      {
        iconName: 'credit-card', optionName: 'SIDEBAR.REQUESTS', url: '/app/request/new-request', children: [
          { iconName: 'plus', optionName: 'SIDEBAR.NEW_REQUEST', url: '/app/request/new-request' },
          { iconName: 'eraser', optionName: 'SIDEBAR.DRAFTS', url: '/app/request/drafts' },
          { iconName: 'FolderUp', optionName: 'SIDEBAR.BULK_UPLOAD', url: '/app/request/bulk-upload' },
        ]
      },
      { iconName: 'clipboard-check', optionName: 'SIDEBAR.PENDING', url: '/app/pending' },
      { iconName: 'clipboard-list', optionName: 'SIDEBAR.HISTORY', url: '/app/history' },
      { iconName: 'bell', optionName: 'SIDEBAR.NOTIFICATIONS', url: '/app/notifications' },
      {
        iconName: 'settings', optionName: 'SIDEBAR.SETTINGS', url: '/app/settings', children: [
          { iconName: 'users', optionName: 'SIDEBAR.USER_MANAGEMENT', url: '/app/settings/users' },
          { iconName: 'building-2', optionName: 'SIDEBAR.CLIENT_MANAGEMENT', url: '/app/settings/customers' },
          { iconName: 'grid-3x2', optionName: 'SIDEBAR.ROLES', url: '/app/settings/roles' },
          { iconName: 'monitor-cog', optionName: 'SIDEBAR.SYS_CONFIG', url: '/app/settings/system-configuration' },
          { iconName: 'shield-check', optionName: 'SIDEBAR.SEC_MANAGE', url: '/app/settings/security-management' },
        ]
      },
    ]

    // Marcar la opción activa al inicializar
    this.setActiveOption(this.router.url);
  }




  onToggleSidebar() {
    this.isOpen = !this.isOpen;
    if (!this.isOpen) {
      this.openedOptionIndex = null;
    }
  }

  onToggleOption(index: number, route: string, hasChildren: boolean = false) {
    if (!this.isOpen) {
      this.isOpen = true;
      this.openedOptionIndex = index;
      if (!hasChildren) {
        this.navigate(route);
      }
      return;
    }
    if (!hasChildren) {
      this.navigate(route);
    } else {
      this.openedOptionIndex = this.openedOptionIndex === index ? null : index;
    }
  }

  onHoverOption(index: number) {
    if (!this.isOpen) {
      this.hoveredOptionIndexOnCollapse = index;
    }
  }

  onLeaveOption() {
    this.hoveredOptionIndexOnCollapse = null;
  }

  setActiveOption(route: string) {
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
        const activeChild = option.children.find(child => child.url === route);
        if (activeChild) {
          activeChild.active = true;
          option.active = true; // Marcar también el padre
          this.openedOptionIndex = this.sidebarOptions.indexOf(option);
          return;
        }
      } else {
        // Si no tiene hijos, marcar la opción directamente
        if (option.url === route) {
          option.active = true;
          return;
        }
      }
    }
  }

  navigate(route: string) {
    this.setActiveOption(route);
    this.router.navigate([route]);
  }

}


