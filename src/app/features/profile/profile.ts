import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";
import { TranslateModule } from '@ngx-translate/core';
import { UserService } from '../../core/services/user-service';
import { User } from '../../data/interfaces/User';

@Component({
  selector: 'app-profile',
  imports: [LucideAngularModule, TranslateModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly userService = inject(UserService);

  readonly profile = signal<User | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly hasError = signal<boolean>(false);

  readonly initials = computed(() => {
    const fullName = this.profile()?.fullName?.trim() ?? '';

    if (!fullName) {
      return 'NA';
    }

    const initials = fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(name => name[0]?.toUpperCase() ?? '')
      .join('');

    return initials || 'NA';
  });

  constructor() {
    this.loadProfile();
  }

  formatDate(date: string | null | undefined): string {
    if (!date) {
      return '-';
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(parsedDate);
  }

  private loadProfile(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    this.userService.getAuthenticatedUserProfile().subscribe({
      next: (user) => {
        this.profile.set(user);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

}
