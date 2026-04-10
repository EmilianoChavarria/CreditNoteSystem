import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth-service';
import { HttpCacheDiagnostics, HttpCacheService } from '../../../core/services/http-cache.service';

@Component({
  selector: 'app-cache-inspector-widget',
  templateUrl: './cache-inspector-widget.html',
  styleUrl: './cache-inspector-widget.css',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CacheInspectorWidget {
  private readonly cacheService = inject(HttpCacheService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private intervalId: number | null = null;

  private readonly currentUser = toSignal(this.authService.user$, {
    initialValue: null,
  });

  public readonly isAdmin = computed(() => {
    const roleName = this.currentUser()?.roleName?.trim().toUpperCase();
    return roleName === 'ADMIN';
  });

  public readonly isOpen = signal(false);
  public readonly diagnostics = signal<HttpCacheDiagnostics>(this.cacheService.getDiagnostics());

  constructor() {
    if (typeof window !== 'undefined') {
      this.intervalId = window.setInterval(() => {
        this.refresh();
      }, 1000);
    }

    this.destroyRef.onDestroy(() => {
      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
      }
    });
  }

  public open(): void {
    this.isOpen.set(true);
    this.refresh();
  }

  public close(): void {
    this.isOpen.set(false);
  }

  public toggle(): void {
    this.isOpen.update((value) => !value);
    this.refresh();
  }

  public refresh(): void {
    this.cacheService.clearExpired();
    this.diagnostics.set(this.cacheService.getDiagnostics());
  }

  public clearCache(): void {
    this.cacheService.clearAll();
    this.refresh();
  }

  public clearExpired(): void {
    this.cacheService.clearExpired();
    this.refresh();
  }

  public formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    const kilobytes = bytes / 1024;

    if (kilobytes < 1024) {
      return `${kilobytes.toFixed(1)} KB`;
    }

    return `${(kilobytes / 1024).toFixed(2)} MB`;
  }

  public formatTime(ms: number): string {
    if (ms <= 0) {
      return '0s';
    }

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes === 0) {
      return `${seconds}s`;
    }

    return `${minutes}m ${seconds % 60}s`;
  }
}