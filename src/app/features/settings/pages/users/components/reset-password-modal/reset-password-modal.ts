import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { User } from '../../../../../../data/interfaces/User';
import { UserService } from '../../../../../../core/services/user-service';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';

@Component({
    selector: 'app-reset-password-modal',
    templateUrl: './reset-password-modal.html',
    imports: [Modal, ReactiveFormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordModal {
    readonly open = input<boolean>(false);
    readonly user = input<User | null>(null);
    readonly openChange = output<boolean>();
    readonly passwordReset = output<void>();

    private readonly _userService = inject(UserService);
    private readonly _toastr = inject(ToastrService);

    public submitted = signal<boolean>(false);
    public isSaving = signal<boolean>(false);
    public showPassword = signal<boolean>(false);
    public showConfirmation = signal<boolean>(false);

    public form = new FormGroup(
        {
            newPassword: new FormControl<string>('', [Validators.required]),
            newPassword_confirmation: new FormControl<string>('', [Validators.required]),
        },
        { validators: this.passwordMatchValidator }
    );

    private passwordMatchValidator(group: AbstractControl) {
        const password = group.get('newPassword')?.value;
        const confirmation = group.get('newPassword_confirmation')?.value;
        if (!password || !confirmation) {
            return null;
        }
        return password === confirmation ? null : { passwordMismatch: true };
    }

    onOpenChange(isOpen: boolean): void {
        this.openChange.emit(isOpen);
        if (!isOpen) {
            this.reset();
        }
    }

    onSave(): void {
        this.submitted.set(true);
        this.form.markAllAsTouched();

        if (this.form.invalid || this.isSaving()) {
            return;
        }

        const userId = this.user()?.id;
        if (!userId) {
            return;
        }

        const { newPassword, newPassword_confirmation } = this.form.getRawValue();

        this.isSaving.set(true);
        this._userService.resetUserPassword(userId, newPassword!, newPassword_confirmation!).pipe(
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: (response: any) => {
                this._toastr.success(response?.message ?? 'Contraseña actualizada correctamente', 'Éxito');
                this.passwordReset.emit();
                this.openChange.emit(false);
                this.reset();
            },
            error: (error: any) => {
                this._toastr.error(error?.error?.message ?? 'Error al actualizar la contraseña', 'Error');
            }
        });
    }

    togglePassword(): void {
        this.showPassword.update(v => !v);
    }

    toggleConfirmation(): void {
        this.showConfirmation.update(v => !v);
    }

    campoVacio(controlName: string): boolean {
        const control = this.form.get(controlName);
        return !!(control?.invalid && (control?.touched || this.submitted()));
    }

    hasMismatch(): boolean {
        return !!(this.form.hasError('passwordMismatch') &&
            (this.submitted() || this.form.get('newPassword_confirmation')?.touched));
    }

    private reset(): void {
        this.submitted.set(false);
        this.form.reset({ newPassword: '', newPassword_confirmation: '' });
        this.showPassword.set(false);
        this.showConfirmation.set(false);
    }
}
