import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutShellService {
  readonly isMobileSidebarOpen = signal(false);

  openMobileSidebar(): void {
    this.isMobileSidebarOpen.set(true);
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  toggleMobileSidebar(): void {
    this.isMobileSidebarOpen.update((isOpen) => !isOpen);
  }
}
