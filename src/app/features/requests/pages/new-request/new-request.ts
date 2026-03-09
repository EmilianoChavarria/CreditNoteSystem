import { Component, inject, OnInit, signal } from '@angular/core';
import { TabsContainer } from "../../../../shared/components/ui/tab/tab-container/tab-container";
import { Tab } from "../../../../shared/components/ui/tab/tab";
import { FormBuilder, FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { CommonModule, JsonPipe } from '@angular/common';
import formFieldsConfig from '../../../../data/form-fields-config.json';
import { RequestService } from '../../../../core/services/request-service';
import { CustomerService } from '../../../../core/services/customer-service';
import { Spinner } from "../../../../shared/components/ui/spinner/spinner";
import { Autocomplete, AutocompleteOption } from '../../../../shared/components/ui/autocomplete/autocomplete';
import { Observable, of, forkJoin, combineLatest, Subscription } from 'rxjs';
import { map, catchError, startWith } from 'rxjs/operators';
import { Classification, Reason, RequestType } from '../../../../data/interfaces/Request';
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-new-request',
    templateUrl: './new-request.html',
    styleUrl: './new-request.css',
    imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, CommonModule, Spinner, Autocomplete],
})
export class NewRequest implements OnInit {
    public profileForm: FormGroup;
    public formConfig: any = formFieldsConfig;
    public selectedRequestType: string = '';
    public currentTabs: any[] = [];
    public submitted: boolean = false;
    public isLoadingForm = signal<boolean>(false);
    private requestNumber = signal<string>('');
    public reasons = signal<Reason[]>([]);
    public classifications = signal<Classification[]>([]);
    private computedSubscriptions: Subscription[] = [];
    private toastr = inject(ToastrService);
    constructor(
        private fb: FormBuilder,
        private _requestService: RequestService,
        private _customerService: CustomerService

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

    getReasons() {
        this._requestService.getReasons().subscribe({
            next: (response) => {
                this.reasons.set(response);
            },
            error: (error) => {
                console.log(error);
            }
        })
    }

    getClassifications(requestTypeId: number) {
        this._requestService.getClassificationsByType(requestTypeId).subscribe({
            next: (response) => {
                this.classifications.set(response);
            },
            error: (error) => {
                console.log(error);
            }
        })
    }

    onRequestTypeChange(event: any) {
        const value = event.target.value;
        this.selectedRequestType = value;
        this.isLoadingForm.set(true);

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
        // console.log(moduleKey);
        if (moduleKey && this.formConfig[moduleKey]) {
            const requestTypeId = Number(this.selectedRequestType);

            // Combinar los 3 observables
            forkJoin({
                requestNumber: this._requestService.getNextRequestNumber(requestTypeId),
                reasons: this._requestService.getReasons(),
                classifications: this._requestService.getClassificationsByType(requestTypeId)
            }).subscribe({
                next: (results) => {
                    // Actualizar los signals con los datos
                    this.requestNumber.set(results.requestNumber.requestNumber);
                    this.reasons.set(results.reasons);
                    this.classifications.set(results.classifications);

                    // Actualizar tabs y form
                    this.currentTabs = this.formConfig[moduleKey].tabs;
                    this.buildForm(moduleKey);

                    // Establecer el request number en el form
                    const requestNumberControl = this.profileForm.get('requestNumber');
                    if (requestNumberControl) {
                        requestNumberControl.setValue(results.requestNumber.requestNumber);
                        requestNumberControl.disable({ emitEvent: false });
                    }

                    this.isLoadingForm.set(false);
                },
                error: (error) => {
                    console.error('Error cargando datos del form:', error);
                    this.isLoadingForm.set(false);
                }
            });
        } else {
            this.currentTabs = [];
            this.profileForm = this.fb.group({});
            this.isLoadingForm.set(false);
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
        this.setupComputedFields(tabs);
    }

    private setupComputedFields(tabs: any[]) {
        this.computedSubscriptions.forEach((sub) => sub.unsubscribe());
        this.computedSubscriptions = [];

        tabs.forEach((tab: any) => {
            tab.fields.forEach((field: any) => {
                if (field.type !== 'computed' || !Array.isArray(field.computeFrom)) {
                    return;
                }

                const targetControl = this.profileForm.get(field.formControlName) as FormControl | null;
                if (!targetControl) {
                    return;
                }

                const dependencyControls = field.computeFrom
                    .map((controlName: string) => this.profileForm.get(controlName) as FormControl | null)
                    .filter((control: FormControl | null) => Boolean(control)) as FormControl[];

                if (dependencyControls.length === 0) {
                    return;
                }

                const sources = dependencyControls.map((control) =>
                    control.valueChanges.pipe(startWith(control.value))
                );

                const sub = combineLatest(sources).subscribe(() => {
                    const computedValue = this.getComputedValue(field);
                    targetControl.setValue(computedValue, { emitEvent: false });
                });

                this.computedSubscriptions.push(sub);
            });
        });
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
                if (field.formula.includes('hasIva') && field.formula.includes('amount')) {
                    const iva = values.hasIva || values.replenishmentIva || values.warehouseIva;
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

    saveRequest(object: any) {
        this._requestService.saveRequest(object).subscribe({
            next: (response) => {
                this.toastr.success(response.message, 'Sucess');
            },
            error: (error) => {

            }
        })
    }

    handleSave() {
        this.submitted = true;

        // Marcar todos los campos como touched para mostrar errores
        Object.keys(this.profileForm.controls).forEach(key => {
            this.profileForm.get(key)?.markAsTouched();
        });

        if (this.profileForm.valid) {
            const formValue = this.profileForm.getRawValue();
            console.log('FormData capturado con profileForm:', formValue);
            console.log('Tipo de request:', this.selectedRequestType);
            delete formValue.sapScreen;
            delete formValue.attachSupports;
            delete formValue.reviewComments;
            delete formValue.creditNumber;
            delete formValue.orderNumber;
            const newObject = {
                requestTypeId: this.selectedRequestType,
                ...formValue,
                customerId: formValue.customerId.id,
                totalAmount: formValue.totalAmount.toFixed(2),
                status: 'created'
            }
            console.log("Form parseado", newObject);
            // alert('Datos impresos en consola');
            this.saveRequest(newObject);
            this.submitted = false; // Resetear después de guardar exitosamente
        } else {
            this.toastr.error('Por favor, rellena los campos obligatorios', 'Error');
        }
    }

    searchCustomers(term: string): Observable<AutocompleteOption[]> {
        if (!term || term.trim().length === 0) {
            return of([]);
        }
        return this._customerService.getCustomersByName(term).pipe(
            map(customers => {
                // Validar que customers sea un array
                if (!Array.isArray(customers)) {
                    console.warn('Expected array but got:', customers);
                    return [];
                }
                return customers.map((customer): AutocompleteOption => ({
                    id: customer.idCliente,
                    label: customer.razonSocial,
                    customer
                }));
            }),
            catchError(error => {
                console.error('Error searching customers:', error);
                return of([]);
            })
        );
    }

    displayCustomer(customer: any) {
        return customer?.label || customer?.customer?.razonSocial || customer?.razonSocial || '';
    }
}
