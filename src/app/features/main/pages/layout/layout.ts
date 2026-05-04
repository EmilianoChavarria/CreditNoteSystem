import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Sidebar } from '../../../../shared/components/sidebar/sidebar';
import { Navbar } from '../../../../shared/components/navbar/navbar';
import { RouterOutlet } from '@angular/router';

import { ImpersonationService } from '../../../../core/services/impersonation.service';
import { UserService } from '../../../../core/services/user-service';
import { User } from '../../../../data/interfaces/User';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { Footer } from '../../../auth/components/footer/footer';

@Component({
    selector: 'app-layout',
    templateUrl: './layout.html',
    styleUrl: './layout.css',
        changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        Sidebar,
        Navbar,
        RouterOutlet,
        Footer,
    ],
    
})
export class Layout {
    private readonly impersonationService = inject(ImpersonationService);
    private readonly userService = inject(UserService);
    private readonly destroyRef = inject(DestroyRef);

    readonly impersonatedUserId = this.impersonationService.impersonatedUserId;
    readonly isImpersonating = computed(() => this.impersonatedUserId() !== null);
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
