import { Component, OnInit, signal } from '@angular/core';
import { TabsContainer } from "../../../../shared/components/ui/tab/tab-container/tab-container";
import { Tab } from "../../../../shared/components/ui/tab/tab";
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CommonModule, JsonPipe } from '@angular/common';
import formFieldsConfig from '../../../../data/form-fields-config.json';
import { RequestService } from '../../../../core/services/request-service';
import { Spinner } from "../../../../shared/components/ui/spinner/spinner";

@Component({
    selector: 'app-new-request',
    templateUrl: './new-request.html',
    styleUrl: './new-request.css',
    imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, CommonModule, Spinner],
})
export class NewRequest implements OnInit {
    public profileForm: FormGroup;
    public formConfig: any = formFieldsConfig;
    public selectedRequestType: string = '';
    public currentTabs: any[] = [];
    public submitted: boolean = false;
    public isLoadingForm = signal<boolean>(false);
    private requestNumber = signal<string>('');

    constructor(
        private fb: FormBuilder,
        private _requestService: RequestService

    ) {
        this.profileForm = this.fb.group({});
    }

    ngOnInit() {

    }

    getNextRequestNumber(requestTypeId: number) {
        this.isLoadingForm.set(true);
        this._requestService.getNextRequestNumber(requestTypeId).subscribe({
            next: (response) => {
                this.isLoadingForm.set(false);
                this.requestNumber.set(response.requestNumber);
                const requestNumberControl = this.profileForm.get('requestNumber');
                if (requestNumberControl) {
                    requestNumberControl.setValue(response.requestNumber);
                    requestNumberControl.disable({ emitEvent: false });
                }
            },
            error: (error) => {
                this.isLoadingForm.set(false);
            }
        })

    }

    onRequestTypeChange(event: any) {
        const value = event.target.value;
        this.selectedRequestType = value;

        // Mapear el valor del select al key del JSON
        const moduleMap: { [key: string]: string } = {
            '1': 'credits',
            '2': 'debits',
            '3': 'auditor-credits',
            '4': 'auditor-debits',
            '5': 're-invoicing',
            '6': 'material-return'
        };

        const moduleKey = moduleMap[value];
        console.log(moduleKey);
        if (moduleKey && this.formConfig[moduleKey]) {
            this.getNextRequestNumber(Number(this.selectedRequestType));
            this.currentTabs = this.formConfig[moduleKey].tabs;
            this.buildForm(moduleKey);
        } else {
            this.currentTabs = [];
            this.profileForm = this.fb.group({});
        }
    }

    buildForm(moduleKey: string) {
        const formControls: any = {};
        const tabs = this.formConfig[moduleKey].tabs;

        tabs.forEach((tab: any) => {
            tab.fields.forEach((field: any) => {
                const validators = this.getValidators(field.validators || []);
                const isRequestNumber = field.formControlName === 'requestNumber';
                const defaultValue = isRequestNumber ? this.requestNumber() : this.getDefaultValue(field);
                const isDisabled = Boolean(field.disabled) || isRequestNumber;

                formControls[field.formControlName] = [{
                    value: defaultValue,
                    disabled: isDisabled
                }, validators];
            });
        });

        this.profileForm = this.fb.group(formControls);
    }

    getValidators(validatorArray: string[]) {
        const validators: any[] = [];

        validatorArray.forEach((validator: string) => {
            if (validator === 'required') {
                validators.push(Validators.required);
            } else if (validator.startsWith('min:')) {
                const minValue = parseFloat(validator.split(':')[1]);
                validators.push(Validators.min(minValue));
            } else if (validator === 'email') {
                validators.push(Validators.email);
            }
        });

        return validators;
    }

    getDefaultValue(field: any) {
        if (field.type === 'checkbox') return false;
        if (field.type === 'number') return 0;
        if (field.defaultValue === 'today') return new Date().toISOString().split('T')[0];
        if (field.defaultValue) return field.defaultValue;
        return '';
    }

    getComputedValue(field: any): any {
        if (field.computeFrom && field.formula) {
            const values: any = {};
            field.computeFrom.forEach((controlName: string) => {
                values[controlName] = this.profileForm.get(controlName)?.value || 0;
            });

            // Evaluar la fórmula de forma segura
            try {
                // Para el caso de IVA
                if (field.formula.includes('iva') && field.formula.includes('amount')) {
                    const iva = values.iva || values.replenishmentIva || values.warehouseIva;
                    const amount = values.amount || values.replenishmentAmount || values.warehouseAmount;
                    return iva ? amount * 1.16 : amount;
                }
            } catch (e) {
                return 0;
            }
        }
        return 0;
    }

    campoVacio(campo: string): boolean {
        const control = this.profileForm.get(campo);
        // Mostrar error si el campo está inválido y (fue tocado o se intentó guardar)
        if (control?.invalid && (control?.touched || this.submitted)) {
            return true;
        } else {
            return false;
        }
    }

    getFieldError(campo: string): string {
        const control = this.profileForm.get(campo);
        if (!control || !this.campoVacio(campo)) {
            return '';
        }

        const errors = control.errors;
        if (!errors) return '';

        if (errors['required']) {
            return 'Este campo es obligatorio';
        }
        if (errors['email']) {
            return 'Please enter a valid email';
        }
        if (errors['min']) {
            return `El valor mínimo es ${errors['min'].min}`;
        }
        if (errors['max']) {
            return `El valor máximo es ${errors['max'].max}`;
        }
        if (errors['minlength']) {
            return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
        }
        if (errors['maxlength']) {
            return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
        }
        if (errors['pattern']) {
            return 'El formato no es válido';
        }

        return 'Error en el campo';
    }

    handleSave() {
        this.submitted = true;

        // Marcar todos los campos como touched para mostrar errores
        Object.keys(this.profileForm.controls).forEach(key => {
            this.profileForm.get(key)?.markAsTouched();
        });

        if (this.profileForm.valid) {
            console.log('FormData capturado:', this.profileForm.value);
            console.log('Tipo de request:', this.selectedRequestType);
            alert('Datos impresos en consola');
            this.submitted = false; // Resetear después de guardar exitosamente
        } else {
            alert('Por favor, rellena los campos obligatorios');
        }
    }
}
