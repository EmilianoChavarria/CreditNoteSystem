import { Injectable } from '@angular/core';
import { HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface HttpCacheEntry<T = unknown> {
  response: HttpResponse<T>;
  storedAt: number;
  expiresAt: number;
  tags: string[];
}

export interface HttpCacheEntrySnapshot {
  key: string;
  method: string;
  url: string;
  variant: string;
  storedAt: number;
  expiresAt: number;
  ttlMs: number;
  ageMs: number;
  remainingMs: number;
  tags: string[];
  approxSizeBytes: number;
  status: number;
}

export interface HttpCacheDiagnostics {
  totalEntries: number;
  pendingRequests: number;
  approxSizeBytes: number;
  approxSizeKb: number;
  tagCounts: Record<string, number>;
  entries: HttpCacheEntrySnapshot[];
}

@Injectable({
  providedIn: 'root',
})
export class HttpCacheService {
  private readonly entries = new Map<string, HttpCacheEntry>();
  private readonly pendingRequests = new Map<string, Observable<unknown>>();
  private readonly maxEntries = 150;

  get<T>(key: string): HttpResponse<T> | null {
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return null;
    }

    this.touch(key, entry);
    return entry.response as HttpResponse<T>;
  }

  set<T>(key: string, response: HttpResponse<T>, ttlMs: number, tags: string[] = []): void {
    if (ttlMs <= 0) {
      return;
    }

    this.entries.set(key, {
      response,
      storedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      tags,
    });

    this.trimToLimit();
  }

  getPending<T>(key: string): Observable<T> | null {
    return (this.pendingRequests.get(key) as Observable<T> | undefined) ?? null;
  }

  setPending<T>(key: string, request$: Observable<T>): void {
    this.pendingRequests.set(key, request$ as Observable<unknown>);
  }

  clearPending(key: string): void {
    this.pendingRequests.delete(key);
  }

  invalidateByTags(tags: string[]): void {
    if (tags.length === 0) {
      return;
    }

    const normalizedTags = new Set(tags);

    for (const [key, entry] of this.entries) {
      if (entry.tags.some((tag) => normalizedTags.has(tag))) {
        this.entries.delete(key);
      }
    }
  }

  invalidateByPredicate(predicate: (entry: HttpCacheEntry, key: string) => boolean): void {
    for (const [key, entry] of this.entries) {
      if (predicate(entry, key)) {
        this.entries.delete(key);
      }
    }
  }

  invalidateRequest(req: HttpRequest<unknown>): void {
    const normalizedPath = this.normalizeUrl(req.url);

    if (normalizedPath.startsWith('/auth/')) {
      this.clearAll();
      return;
    }

    const tags = this.getInvalidationTags(normalizedPath);

    if (tags.length > 0) {
      this.invalidateByTags(tags);
    }
  }

  clearAll(): void {
    this.entries.clear();
    this.pendingRequests.clear();
  }

  getDiagnostics(): HttpCacheDiagnostics {
    const now = Date.now();
    const entries = Array.from(this.entries.entries()).map(([key, entry]) => this.toSnapshot(key, entry, now));
    const approxSizeBytes = entries.reduce((total, entry) => total + entry.approxSizeBytes, 0);
    const tagCounts = entries.reduce<Record<string, number>>((accumulator, entry) => {
      entry.tags.forEach((tag) => {
        accumulator[tag] = (accumulator[tag] ?? 0) + 1;
      });

      return accumulator;
    }, {});

    return {
      totalEntries: entries.length,
      pendingRequests: this.pendingRequests.size,
      approxSizeBytes,
      approxSizeKb: approxSizeBytes / 1024,
      tagCounts,
      entries: entries.sort((left, right) => right.expiresAt - left.expiresAt),
    };
  }

  clearExpired(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.entries) {
      if (now >= entry.expiresAt) {
        this.entries.delete(key);
        removed += 1;
      }
    }

    return removed;
  }

  buildCacheKey(req: HttpRequest<unknown>): string {
    return [
      req.method.toUpperCase(),
      req.urlWithParams,
      this.readVariantFromHeaders(req),
    ].join('|');
  }

  private touch(key: string, entry: HttpCacheEntry): void {
    this.entries.delete(key);
    this.entries.set(key, entry);
  }

  private trimToLimit(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;

      if (!oldestKey) {
        break;
      }

      this.entries.delete(oldestKey);
    }
  }

  private readVariantFromHeaders(req: HttpRequest<unknown>): string {
    const language = req.headers.get('Accept-Language') ?? '';
    const cacheControl = req.headers.get('X-Cache-Variant') ?? '';

    return [language, cacheControl].filter(Boolean).join(';');
  }

  private getInvalidationTags(pathname: string): string[] {
    if (/^\/customers(?:\/|$)/.test(pathname)) {
      return ['customers', 'dashboard'];
    }

    if (/^\/requests(?:\/|$)/.test(pathname)) {
      return ['requests', 'dashboard'];
    }

    if (/^\/users(?:\/|$)/.test(pathname)) {
      return ['users', 'dashboard'];
    }

    if (/^\/roles(?:\/|$)/.test(pathname)
      || /^\/rolesPermission(?:\/|$)/.test(pathname)
      || /^\/requestTypePermissions(?:\/|$)/.test(pathname)
      || /^\/actions(?:\/|$)/.test(pathname)
      || /^\/modules(?:\/|$)/.test(pathname)
      || /^\/requestType(?:\/|$)/.test(pathname)) {
      return ['roles', 'workflows', 'requests', 'dashboard'];
    }

    if (/^\/password-requirements(?:\/|$)/.test(pathname)
      || /^\/security(?:\/|$)/.test(pathname)) {
      return ['security'];
    }

    if (/^\/users\/assignment(?:\/|$)/.test(pathname)) {
      return ['assignments', 'users', 'dashboard'];
    }

    if (/^\/users\/me(?:\/|$)/.test(pathname)) {
      return ['users'];
    }

    if (/^(\/workflowsteps|\/workflows|\/classifications)(?:\/|$)/.test(pathname)) {
      return ['workflows', 'requests', 'dashboard'];
    }

    if (/^\/batches(?:\/|$)/.test(pathname)) {
      return ['batches', 'dashboard'];
    }

    if (/^\/notifications(?:\/|$)/.test(pathname)) {
      return ['notifications'];
    }

    return [];
  }

  private normalizeUrl(url: string): string {
    try {
      return new URL(url, 'http://local-cache').pathname;
    } catch {
      const [pathname] = url.split('?');
      return pathname.startsWith('/') ? pathname : `/${pathname}`;
    }
  }

  private toSnapshot(key: string, entry: HttpCacheEntry, now: number): HttpCacheEntrySnapshot {
    const [method = '', url = '', variant = ''] = key.split('|');
    const ttlMs = Math.max(entry.expiresAt - entry.storedAt, 0);
    const ageMs = Math.max(now - entry.storedAt, 0);
    const remainingMs = Math.max(entry.expiresAt - now, 0);

    return {
      key,
      method,
      url,
      variant,
      storedAt: entry.storedAt,
      expiresAt: entry.expiresAt,
      ttlMs,
      ageMs,
      remainingMs,
      tags: entry.tags,
      approxSizeBytes: this.estimateSize(entry.response.body),
      status: entry.response.status,
    };
  }

  private estimateSize(value: unknown): number {
    try {
      const serialized = JSON.stringify(value ?? null);
      if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(serialized).length;
      }

      return serialized.length;
    } catch {
      return 0;
    }
  }
}