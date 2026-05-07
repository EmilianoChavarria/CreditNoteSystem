import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UiSwitch } from '../../../../shared/components/ui/switch/switch';
import { SecurityService } from '../../../../core/services/security-service';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-sys-config',
    templateUrl: './sys-config.html',
    styleUrl: './sys-config.css',
    imports: [TranslatePipe, UiSwitch]
})
export class SysConfig implements OnInit {
    private readonly _securityService = inject(SecurityService);
    private readonly _toastr = inject(ToastrService);
    private readonly _translate = inject(TranslateService);

    public readonly isLoading = signal<boolean>(false);
    public readonly isSaving = signal<boolean>(false);
    public readonly deletingPolicyIds = signal<Set<number>>(new Set());
    public requireUppercase = true;
    public requireLowercase = true;
    public requireNumbers = false;
    public requireSpecialCharacters = true;
    public allowedSpecialChars = '';
    public minimumPasswordLength = 13;
    public inactivityTimeoutMinutes = 30;
    public maxAuthFailuresUser = 5;
    public maxAuthFailuresIp = 10;
    public emailSupport = '';
    public emailTouched = false;

    private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    get isEmailValid(): boolean {
        return this.EMAIL_REGEX.test(this.emailSupport.trim());
    }

    ngOnInit(): void {
        this.loadSettings();
    }

    private loadSettings(): void {
        this.isLoading.set(true);

        forkJoin({
            passwordRequirements: this._securityService.getFormattedPasswordRequirements(),
            loginSettings: this._securityService.getLoginAttemptSettings(),
            emailConfig: this._securityService.getEmailConfig(),
        }).subscribe({
            next: ({ passwordRequirements, loginSettings, emailConfig }) => {
                this.minimumPasswordLength = Number(passwordRequirements?.minLength?.value ?? this.minimumPasswordLength);
                this.requireUppercase = Boolean(passwordRequirements?.requireUppercase?.value);
                this.requireLowercase = Boolean(passwordRequirements?.requireLowercase?.value);
                this.requireNumbers = Boolean(passwordRequirements?.requireNumbers?.value);
                this.requireSpecialCharacters = Boolean(passwordRequirements?.requireSpecialChars?.value);
                this.allowedSpecialChars = passwordRequirements?.requireSpecialChars?.allowedChars ?? '';

                this.inactivityTimeoutMinutes = Number(loginSettings?.sessionTimeoutMinutes ?? this.inactivityTimeoutMinutes);
                this.maxAuthFailuresUser = Number(loginSettings?.maxUserAttempts ?? this.maxAuthFailuresUser);
                this.maxAuthFailuresIp = Number(loginSettings?.maxIpAttempts ?? this.maxAuthFailuresIp);

                this.emailSupport = emailConfig?.emailSupport ?? '';

                this.isLoading.set(false);
            },
            error: () => {
                this.isLoading.set(false);
            }
        });
    }

    public onAllowedSpecialCharsInput(event: Event): void {
        this.allowedSpecialChars = (event.target as HTMLInputElement).value;
    }

    public onEmailInput(event: Event): void {
        this.emailSupport = (event.target as HTMLInputElement).value;
        this.emailTouched = true;
    }

    public specialCharsDescription(): string {
        const chars = this.allowedSpecialChars?.trim()
            || this._translate.instant('SYS_CONFIG.ALLOWED_SPECIAL_PLACEHOLDER');

        return this._translate.instant('SYS_CONFIG.REQUIRE_SPECIAL_HELP', { chars });
    }

    public minLengthHelperText(): string {
        return this._translate.instant('SYS_CONFIG.MIN_LENGTH_HELP', { min: this.minimumPasswordLength });
    }

    public chargeConditionalLabel(conditional: '<' | '>'): string {
        return this._translate.instant(
            conditional === '<' ? 'SYS_CONFIG.CHARGE_BEFORE' : 'SYS_CONFIG.CHARGE_AFTER'
        );
    }

    public decrement(field: 'minimumPasswordLength' | 'inactivityTimeoutMinutes' | 'maxAuthFailuresUser' | 'maxAuthFailuresIp'): void {
        const min = this.getMin(field);
        this[field] = Math.max(min, this[field] - 1);
    }

    public increment(field: 'minimumPasswordLength' | 'inactivityTimeoutMinutes' | 'maxAuthFailuresUser' | 'maxAuthFailuresIp'): void {
        this[field] = this[field] + 1;
    }

    public onNumberInput(field: 'minimumPasswordLength' | 'inactivityTimeoutMinutes' | 'maxAuthFailuresUser' | 'maxAuthFailuresIp', event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        const min = this.getMin(field);

        if (!Number.isFinite(value)) {
            this[field] = min;
            return;
        }

        this[field] = Math.max(min, Math.floor(value));
    }

    public getMin(field: 'minimumPasswordLength' | 'inactivityTimeoutMinutes' | 'maxAuthFailuresUser' | 'maxAuthFailuresIp'): number {
        if (field === 'minimumPasswordLength') {
            return 8;
        }

        return 1;
    }

    public saveSettings(): void {
        if (this.isLoading() || this.isSaving()) {
            return;
        }

        this.emailTouched = true;
        if (!this.isEmailValid) {
            this._toastr.error(
                this._translate.instant('SYS_CONFIG.EMAIL_SUPPORT_INVALID'),
                this._translate.instant('SYS_CONFIG.TOAST.ERROR')
            );
            return;
        }

        this.isSaving.set(true);

        const loginPayload = {
            maxUserAttempts: this.maxAuthFailuresUser,
            maxIpAttempts: this.maxAuthFailuresIp,
            sessionTimeoutMinutes: this.inactivityTimeoutMinutes,
        };

        const passwordPayload = {
            minLength: this.minimumPasswordLength,
            requireUppercase: this.requireUppercase,
            requireLowercase: this.requireLowercase,
            requireNumbers: this.requireNumbers,
            requireSpecialChars: this.requireSpecialCharacters,
            allowedSpecialChars: this.requireSpecialCharacters ? this.allowedSpecialChars.trim() : '',
        };

        forkJoin({
            loginSettings: this._securityService.updateLoginAttemptSettings(loginPayload),
            passwordRequirements: this._securityService.updatePasswordRequirements(passwordPayload),
            emailConfig: this._securityService.updateEmailConfig({ emailSupport: this.emailSupport.trim() }),
        }).subscribe({
            next: () => {
                this._toastr.success(
                    this._translate.instant('SYS_CONFIG.TOAST.SAVE_SUCCESS'),
                    this._translate.instant('SYS_CONFIG.TOAST.SUCCESS')
                );
                this.isSaving.set(false);
            },
            error: (error) => {
                this._toastr.error(
                    error?.error?.message ?? this._translate.instant('SYS_CONFIG.TOAST.SAVE_ERROR'),
                    this._translate.instant('SYS_CONFIG.TOAST.ERROR')
                );
                this.isSaving.set(false);
            }
        });
    }

}
