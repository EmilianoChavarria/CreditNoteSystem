import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Role } from '../../../../../../data/interfaces/User';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { Spinner } from '../../../../../../shared/components/ui/spinner/spinner';
import { Autocomplete as UiAutocomplete, AutocompleteOption } from '../../../../../../shared/components/ui/autocomplete/autocomplete';

interface SupervisorOption {
    id: number;
    fullName: string;
    role: {
        roleName: string;
    };
}

@Component({
    selector: 'app-user-form-modal',
    templateUrl: './user-form-modal.html',
    imports: [Modal, Spinner, ReactiveFormsModule, TranslatePipe, UiAutocomplete],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserFormModalComponent {
    readonly open = input<boolean>(false);
    readonly isEditMode = input<boolean>(false);
    readonly isUserModalLoading = input<boolean>(false);
    readonly isSavingUser = input<boolean>(false);
    readonly showPassword = input<boolean>(false);
    readonly passwordErrors = input<string[]>([]);
    readonly userForm = input.required<FormGroup>();
    readonly roles = input<Role[]>([]);
    readonly supervisors = input<SupervisorOption[]>([]);
    readonly isCustomerRoleSelected = input<boolean>(false);
    readonly campoVacioFn = input.required<(controlName: string) => boolean>();
    readonly getErrorMessageFn = input.required<(controlName: string) => string>();
    readonly searchCustomersFn = input.required<(term: string) => Observable<AutocompleteOption[]>>();
    readonly displayCustomerFn = input.required<(option: AutocompleteOption) => string>();

    readonly openChange = output<boolean>();
    readonly save = output<void>();
    readonly togglePassword = output<void>();
    readonly roleChange = output<void>();
    readonly customerSelected = output<AutocompleteOption>();

    onOpenChange(isOpen: boolean): void {
        this.openChange.emit(isOpen);
    }

    onSave(): void {
        this.save.emit();
    }

    onTogglePassword(): void {
        this.togglePassword.emit();
    }

    onRoleChange(): void {
        this.roleChange.emit();
    }

    onCustomerSelected(option: AutocompleteOption): void {
        this.customerSelected.emit(option);
    }

    campoVacio(controlName: string): boolean {
        return this.campoVacioFn()(controlName);
    }

    getErrorMessage(controlName: string): string {
        return this.getErrorMessageFn()(controlName);
    }
}
