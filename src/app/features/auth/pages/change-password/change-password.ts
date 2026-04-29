import { Component } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';

function passwordMatchValidator(): ValidatorFn {
    return (group: AbstractControl) => {
        const pw = group.get('password')?.value;
        const confirm = group.get('confirmPassword')?.value;
        return pw && confirm && pw !== confirm ? { passwordMismatch: true } : null;
    };
}

@Component({
    selector: 'app-change-password',
    templateUrl: './change-password.html',
    styleUrl: './change-password.css',
    imports: [ReactiveFormsModule, LucideAngularModule, Spinner],
})
export class ChangePassword {
    showPassword = false;
    showConfirmPassword = false;
    submitted = false;
    isLoading = false;

    form = new FormGroup({
        password: new FormControl<string>('', Validators.required),
        confirmPassword: new FormControl<string>('', Validators.required),
    }, { validators: passwordMatchValidator() });

    requirements: { label: string; test: (v: string | null | undefined) => boolean }[] = [
        { label: 'Mínimo 8 caracteres',                         test: v => (v?.length ?? 0) >= 8 },
        { label: 'Al menos una letra mayúscula',                 test: v => /[A-Z]/.test(v ?? '') },
        { label: 'Al menos una letra minúscula',                 test: v => /[a-z]/.test(v ?? '') },
        { label: 'Al menos un número',                           test: v => /[0-9]/.test(v ?? '') },
        { label: 'Al menos un carácter especial (!@#$%^&*)',     test: v => /[!@#$%^&*]/.test(v ?? '') },
    ];

    onSubmit(): void {
        this.submitted = true;
        if (this.form.invalid) return;
        // endpoint pending
    }
}
