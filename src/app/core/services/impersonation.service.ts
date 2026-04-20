import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ImpersonationService {
  private readonly storageKey = 'impersonate-user-id';
  private readonly impersonatedUserIdSignal = signal<number | null>(this.loadFromSessionStorage());

  constructor() {}

  readonly impersonatedUserId = this.impersonatedUserIdSignal.asReadonly();

  isActive(): boolean {
    return this.impersonatedUserIdSignal() !== null;
  }

  start(userId: number): void {
    if (!Number.isFinite(userId) || userId <= 0) {
      return;
    }

    const normalizedUserId = Math.floor(userId);
    this.impersonatedUserIdSignal.set(normalizedUserId);
    this.persistToSessionStorage(normalizedUserId);
  }

  stop(): void {
    this.impersonatedUserIdSignal.set(null);
    this.removeFromSessionStorage();
  }

  private loadFromSessionStorage(): number | null {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const rawValue = sessionStorage.getItem(this.storageKey);

    if (!rawValue) {
      return null;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
  }

  private persistToSessionStorage(userId: number): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.setItem(this.storageKey, String(userId));
  }

  private removeFromSessionStorage(): void {
    if (typeof sessionStorage === 'undefined') {
      return;
    }

    sessionStorage.removeItem(this.storageKey);
  }
}