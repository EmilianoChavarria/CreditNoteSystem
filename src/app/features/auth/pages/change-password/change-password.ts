import { Component, inject } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../../../../core/services/auth-service';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';

function passwordMatchValidator(): ValidatorFn {
    return (group: AbstractControl) => {
        const pw = group.get('newPassword')?.value;
        const confirm = group.get('newPassword_confirmation')?.value;
        return pw && confirm && pw !== confirm ? { passwordMismatch: true } : null;
    };
}

function passwordStrengthValidator(): ValidatorFn {
    return (control: AbstractControl) => {
        const v: string = control.value ?? '';
        if (!v) return null;
        const invalid =
            v.length < 8 ||
            !/[A-Z]/.test(v) ||
            !/[a-z]/.test(v) ||
            !/[0-9]/.test(v) ||
            !/[.!@#$%^&*]/.test(v);
        return invalid ? { passwordStrength: true } : null;
    };
}

@Component({
    selector: 'app-change-password',
    templateUrl: './change-password.html',
    styleUrl: './change-password.css',
    imports: [ReactiveFormsModule, LucideAngularModule, Spinner],
})
export class ChangePassword {
    private readonly _auth = inject(AuthService);
    private readonly _router = inject(Router);
    private readonly _toastr = inject(ToastrService);

    showPassword = false;
    showConfirmPassword = false;
    submitted = false;
    isLoading = false;

    form = new FormGroup({
        newPassword: new FormControl<string>('', [Validators.required, passwordStrengthValidator()]),
        newPassword_confirmation: new FormControl<string>('', Validators.required),
    }, { validators: passwordMatchValidator() });

    requirements: { label: string; test: (v: string | null | undefined) => boolean }[] = [
        { label: 'Mínimo 8 caracteres',                     test: v => (v?.length ?? 0) >= 8 },
        { label: 'Al menos una letra mayúscula',             test: v => /[A-Z]/.test(v ?? '') },
        { label: 'Al menos una letra minúscula',             test: v => /[a-z]/.test(v ?? '') },
        { label: 'Al menos un número',                       test: v => /[0-9]/.test(v ?? '') },
        { label: 'Al menos un carácter especial (.!@#$%^&*)', test: v => /[.!@#$%^&*]/.test(v ?? '') },
    ];

    onSubmit(): void {
        this.submitted = true;
        if (this.form.invalid || this.isLoading) return;

        this.isLoading = true;

        const { newPassword, newPassword_confirmation } = this.form.getRawValue();

        this._auth.changePassword(newPassword!, newPassword_confirmation!).pipe(
            finalize(() => this.isLoading = false)
        ).subscribe({
            next: () => {
                this._toastr.success('Contraseña actualizada correctamente.', 'Éxito');
                this._auth.clearMustChangePassword();
                this._router.navigate(['/app']);
            },
            error: (err: any) => {
                const msg = err?.error?.message ?? 'Error al cambiar la contraseña.';
                this._toastr.error(msg, 'Error');
            }
        });
    }
}
