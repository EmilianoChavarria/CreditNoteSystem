import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { switchMap, of, catchError } from 'rxjs';
import { User } from '../../../data/interfaces/User';
import { UserService } from '../../../core/services/user-service';
import { ImpersonationService } from '../../../core/services/impersonation.service';

@Component({
  selector: 'app-impersonation-banner',
  templateUrl: './impersonation-banner.html',
  styleUrl: './impersonation-banner.css',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpersonationBanner {
  private readonly impersonationService = inject(ImpersonationService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  readonly impersonatedUserId = this.impersonationService.impersonatedUserId;
  readonly isActive = computed(() => this.impersonatedUserId() !== null);
  readonly impersonatedUser = signal<User | null>(null);

  constructor() {
    toObservable(this.impersonatedUserId)
      .pipe(
        switchMap((userId) => {
          if (!userId) {
            return of(null);
          }

          return this.userService.getAuthenticatedUserProfile().pipe(
            catchError(() => of(null))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((user) => {
        this.impersonatedUser.set(user);
      });
  }

  stopImpersonation(): void {
    this.impersonationService.stop();

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}