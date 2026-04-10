import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpCacheDiagnostics, HttpCacheService } from '../../../../core/services/http-cache.service';

@Component({
    selector: 'app-cache-inspector',
    templateUrl: './cache-inspector.html',
    styleUrl: './cache-inspector.css',
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CacheInspector implements OnInit {
  private readonly cacheService = inject(HttpCacheService);
  private readonly destroyRef = inject(DestroyRef);
  private intervalId: number | null = null;

  public readonly diagnostics = signal<HttpCacheDiagnostics>(this.cacheService.getDiagnostics());

  ngOnInit(): void {
    this.refresh();

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