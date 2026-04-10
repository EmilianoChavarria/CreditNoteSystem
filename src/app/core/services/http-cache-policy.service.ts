import { Injectable } from '@angular/core';
import { HttpRequest } from '@angular/common/http';
import { runtimeConfig } from '../config/runtime-config';

export interface HttpCachePolicy {
  ttlMs: number;
  tags: string[];
}

interface CacheRule {
  test: RegExp;
  policy: HttpCachePolicy;
}

@Injectable({
  providedIn: 'root',
})
export class HttpCachePolicyService {
  private readonly apiBaseUrl = this.normalizeBaseUrl(runtimeConfig.apiBaseUrl);
  private readonly rules: CacheRule[] = [
    { test: /^\/dashboard(?:\/|$)/, policy: { ttlMs: 45_000, tags: ['dashboard'] } },
    { test: /^\/customers(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['customers'] } },
    { test: /^\/requests(?:\/|$)/, policy: { ttlMs: 30_000, tags: ['requests'] } },
    { test: /^\/users(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['users'] } },
    { test: /^\/roles(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['roles'] } },
    { test: /^\/rolesPermission(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['roles'] } },
    { test: /^\/requestTypePermissions(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['roles'] } },
    { test: /^\/actions(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['roles'] } },
    { test: /^\/modules(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['roles'] } },
    { test: /^\/requestType(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['requests'] } },
    { test: /^\/password-requirements\/formatted(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['security'] } },
    { test: /^\/security\/login-attempt-settings(?:\/|$)/, policy: { ttlMs: 60_000, tags: ['security'] } },
    { test: /^\/security\/users\/blocked(?:\/|$)/, policy: { ttlMs: 20_000, tags: ['security'] } },
    { test: /^\/security\/ips\/blocked(?:\/|$)/, policy: { ttlMs: 20_000, tags: ['security'] } },
    { test: /^\/users\/assignment\/leaders(?:\/|$)/, policy: { ttlMs: 30_000, tags: ['assignments', 'users'] } },
    { test: /^\/users\/assignment\/assignable-users(?:\/|$)/, policy: { ttlMs: 30_000, tags: ['assignments', 'users'] } },
    { test: /^\/users\/\d+\/assignments(?:\/|$)/, policy: { ttlMs: 30_000, tags: ['assignments', 'users'] } },
    { test: /^\/users\/me(?:\/|$)/, policy: { ttlMs: 30_000, tags: ['users'] } },
    {
      test: /^(\/workflowsteps|\/workflows|\/classifications)(?:\/|$)/,
      policy: { ttlMs: 60_000, tags: ['workflows'] },
    },
    { test: /^\/notifications(?:\/|$)/, policy: { ttlMs: 20_000, tags: ['notifications'] } },
    { test: /^\/batches(?:\/|$)/, policy: { ttlMs: 20_000, tags: ['batches'] } },
    {
      test: /^https?:\/\/www\.banxico\.org\.mx\//,
      policy: { ttlMs: 60_000, tags: ['external-rates'] },
    },
  ];

  shouldCache(req: HttpRequest<unknown>): boolean {
    if (req.method !== 'GET') {
      return false;
    }

    if (this.isBypassed(req.url)) {
      return false;
    }

    return this.resolve(req) !== null;
  }

  resolve(req: HttpRequest<unknown>): HttpCachePolicy | null {
    if (req.method !== 'GET') {
      return null;
    }

    const url = this.normalizeUrl(req.url);

    if (this.isBypassed(url)) {
      return null;
    }

    const rule = this.rules.find((candidate) => candidate.test.test(url));

    if (!rule) {
      return null;
    }

    if (this.isHighCardinalityPagination(req)) {
      return null;
    }

    return rule.policy;
  }

  buildCacheKey(req: HttpRequest<unknown>): string {
    const normalizedUrl = this.normalizeUrl(req.urlWithParams);
    const variant = req.headers.get('Accept-Language') ?? '';

    return [req.method.toUpperCase(), normalizedUrl, variant].join('|');
  }

  private isBypassed(url: string): boolean {
    return /^\/auth\/(login|logout|verify|register)(?:\/|$)/.test(url)
      || /^\/assets\/i18n\//.test(url)
      || /^\/customers\/search(?:\?|\/|$)/.test(url)
      || /^\/requests\/drafts(?:\/|$)/.test(url)
      || url.startsWith('blob:')
      || url.startsWith('data:');
  }

  private normalizeUrl(url: string): string {
    if (url.startsWith(this.apiBaseUrl)) {
      return url.slice(this.apiBaseUrl.length) || '/';
    }

    try {
      return new URL(url, 'http://local-cache').pathname;
    } catch {
      const [pathname] = url.split('?');
      return pathname.startsWith('/') ? pathname : `/${pathname}`;
    }
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  private isHighCardinalityPagination(req: HttpRequest<unknown>): boolean {
    const pageValue = req.params.get('page');
    const cursorValue = req.params.get('cursor');
    const perPageValue = req.params.get('perPage') ?? req.params.get('per_page');

    if (!pageValue && !cursorValue && !perPageValue) {
      return false;
    }

    if (cursorValue) {
      return true;
    }

    if (!pageValue) {
      return false;
    }

    const pageNumber = Number(pageValue);

    if (!Number.isFinite(pageNumber) || pageNumber < 1) {
      return true;
    }

    return pageNumber > 2;
  }
}