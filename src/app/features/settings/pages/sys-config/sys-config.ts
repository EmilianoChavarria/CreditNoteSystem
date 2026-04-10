import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UiSwitch } from '../../../../shared/components/ui/switch/switch';
import { SecurityService } from '../../../../core/services/security-service';
import { forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';

interface ChargePolicyItem {
    days: number;
    percentage: number;
}

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
    public requireUppercase = true;
    public requireLowercase = true;
    public requireNumbers = false;
    public requireSpecialCharacters = true;
    public allowedSpecialChars = '';
    public minimumPasswordLength = 13;
    public inactivityTimeoutMinutes = 30;
    public maxAuthFailuresUser = 5;
    public maxAuthFailuresIp = 10;
    public chargePolicies: ChargePolicyItem[] = [
        { days: 8, percentage: 10 },
        { days: 30, percentage: 25 },
    ];

    ngOnInit(): void {
        this.loadSettings();
    }

    private loadSettings(): void {
        this.isLoading.set(true);

        forkJoin({
            passwordRequirements: this._securityService.getFormattedPasswordRequirements(),
            loginSettings: this._securityService.getLoginAttemptSettings(),
        }).subscribe({
            next: ({ passwordRequirements, loginSettings }) => {
                this.minimumPasswordLength = Number(passwordRequirements?.minLength?.value ?? this.minimumPasswordLength);
                this.requireUppercase = Boolean(passwordRequirements?.requireUppercase?.value);
                this.requireLowercase = Boolean(passwordRequirements?.requireLowercase?.value);
                this.requireNumbers = Boolean(passwordRequirements?.requireNumbers?.value);
                this.requireSpecialCharacters = Boolean(passwordRequirements?.requireSpecialChars?.value);
                this.allowedSpecialChars = passwordRequirements?.requireSpecialChars?.allowedChars ?? '';

                this.inactivityTimeoutMinutes = Number(loginSettings?.sessionTimeoutMinutes ?? this.inactivityTimeoutMinutes);
                this.maxAuthFailuresUser = Number(loginSettings?.maxUserAttempts ?? this.maxAuthFailuresUser);
                this.maxAuthFailuresIp = Number(loginSettings?.maxIpAttempts ?? this.maxAuthFailuresIp);

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

    public specialCharsDescription(): string {
        const chars = this.allowedSpecialChars?.trim()
            || this._translate.instant('SYS_CONFIG.ALLOWED_SPECIAL_PLACEHOLDER');

        return this._translate.instant('SYS_CONFIG.REQUIRE_SPECIAL_HELP', { chars });
    }

    public minLengthHelperText(): string {
        return this._translate.instant('SYS_CONFIG.MIN_LENGTH_HELP', { min: this.minimumPasswordLength });
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

    public addChargePolicy(): void {
        this.chargePolicies = [...this.chargePolicies, { days: 0, percentage: 0 }];
    }

    public removeChargePolicy(index: number): void {
        if (this.chargePolicies.length <= 1) {
            return;
        }

        this.chargePolicies = this.chargePolicies.filter((_, currentIndex) => currentIndex !== index);
    }

    public onChargePolicyInput(index: number, field: 'days' | 'percentage', event: Event): void {
        const rawValue = Number((event.target as HTMLInputElement).value);
        let normalizedValue = Number.isFinite(rawValue) ? Math.floor(rawValue) : 0;

        if (field === 'days') {
            normalizedValue = Math.max(0, normalizedValue);
        } else {
            normalizedValue = Math.min(100, Math.max(0, normalizedValue));
        }

        this.chargePolicies = this.chargePolicies.map((item, currentIndex) => {
            if (currentIndex !== index) {
                return item;
            }

            return {
                ...item,
                [field]: normalizedValue,
            };
        });
    }

    public saveSettings(): void {
        if (this.isLoading() || this.isSaving()) {
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
