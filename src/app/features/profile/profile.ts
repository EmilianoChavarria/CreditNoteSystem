import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from "lucide-angular";
import { TranslateModule } from '@ngx-translate/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { UserService } from '../../core/services/user-service';
import { User } from '../../data/interfaces/User';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-profile',
  imports: [LucideAngularModule, TranslateModule, ReactiveFormsModule, CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly userService = inject(UserService);

  readonly profile = signal<User | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly hasError = signal<boolean>(false);
  readonly isChangingPassword = signal<boolean>(false);
  readonly passwordFormVisible = signal<boolean>(false);

  readonly changePasswordForm = new FormGroup({
    currentPassword: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    newPassword: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    confirmPassword: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] })
  });

  readonly passwordsMatch = computed(() => {
    const newPassword = this.changePasswordForm.get('newPassword')?.value ?? '';
    const confirmPassword = this.changePasswordForm.get('confirmPassword')?.value ?? '';
    return newPassword === confirmPassword && newPassword.length > 0;
  });

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

  togglePasswordForm(): void {
    this.passwordFormVisible.set(!this.passwordFormVisible());
    if (!this.passwordFormVisible()) {
      this.changePasswordForm.reset();
    }
  }

  submitPasswordChange(): void {
    if (!this.changePasswordForm.valid || !this.passwordsMatch()) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    this.isChangingPassword.set(true);

    // TODO: Call UserService.changePassword()
    // For now, just simulate
    console.log('Change password submitted:', this.changePasswordForm.value);
    
    setTimeout(() => {
      this.isChangingPassword.set(false);
      this.passwordFormVisible.set(false);
      this.changePasswordForm.reset();
    }, 1500);
  }

}
