import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";
import { TranslateModule } from '@ngx-translate/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { UserService } from '../../core/services/user-service';
import { User } from '../../data/interfaces/User';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth-service';
import { ImpersonationService } from '../../core/services/impersonation.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

@Component({
  selector: 'app-profile',
  imports: [LucideAngularModule, TranslateModule, ReactiveFormsModule, CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly impersonationService = inject(ImpersonationService);

  readonly profile = signal<User | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly hasError = signal<boolean>(false);
  readonly isChangingPassword = signal<boolean>(false);
  readonly passwordFormVisible = signal<boolean>(false);
  readonly users = signal<User[]>([]);
  readonly isLoadingUsers = signal<boolean>(false);
  private readonly authUser = toSignal(this.authService.user$, { initialValue: null });

  readonly isSuperAdmin = computed(() => this.authUser()?.roleName?.trim().toUpperCase() === 'SUPERADMIN');
  readonly impersonatedUserId = this.impersonationService.impersonatedUserId;
  readonly isImpersonating = computed(() => this.impersonatedUserId() !== null);

  readonly impersonationForm = new FormGroup({
    userId: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(1)] })
  });

  readonly changePasswordForm = new FormGroup({
    currentPassword: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    newPassword: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    confirmPassword: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] })
  });

  readonly passwordsMatch = toSignal(
    this.changePasswordForm.valueChanges.pipe(
      map(({ newPassword, confirmPassword }) => !!newPassword && newPassword === confirmPassword)
    ),
    { initialValue: false }
  );

  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

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
    this.loadUsers();
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

  private loadUsers(): void {
    this.isLoadingUsers.set(true);
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.isLoadingUsers.set(false);
      },
      error: () => this.isLoadingUsers.set(false)
    });
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

  togglePasswordForm(): void {
    this.passwordFormVisible.set(!this.passwordFormVisible());
    if (!this.passwordFormVisible()) {
      this.changePasswordForm.reset();
    }
  }

  startImpersonation(): void {
    if (!this.isSuperAdmin()) {
      return;
    }

    if (this.impersonationForm.invalid) {
      this.impersonationForm.markAllAsTouched();
      return;
    }

    const userId = Number(this.impersonationForm.get('userId')?.value);

    if (!Number.isFinite(userId) || userId <= 0) {
      return;
    }

    this.impersonationService.start(userId);

    if (typeof window !== 'undefined') {
      window.location.reload();
      return;
    }

    this.loadProfile();
  }

  stopImpersonation(): void {
    this.impersonationService.stop();
    this.impersonationForm.reset();

    if (typeof window !== 'undefined') {
      window.location.reload();
      return;
    }

    this.loadProfile();
  }

  submitPasswordChange(): void {
    if (!this.changePasswordForm.valid || !this.passwordsMatch()) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.changePasswordForm.getRawValue();
    this.isChangingPassword.set(true);

    this.userService.changePassword(currentPassword, newPassword, confirmPassword).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.passwordFormVisible.set(false);
        this.changePasswordForm.reset();
      },
      error: () => {
        this.isChangingPassword.set(false);
      }
    });
  }

}
