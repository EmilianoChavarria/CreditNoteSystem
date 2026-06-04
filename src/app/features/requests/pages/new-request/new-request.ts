import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormControl, FormGroup as FG, Validators, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import formFieldsConfig from '../../../../data/form-fields-config.json';
import { RequestService } from '../../../../core/services/request-service';
import { CustomerService } from '../../../../core/services/customer-service';
import { ToastService } from '../../../../core/services/toast-service';
import { AutocompleteOption } from '../../../../shared/components/ui/autocomplete/autocomplete';
import { Observable, of, forkJoin, combineLatest, Subscription } from 'rxjs';
import { map, catchError, startWith, finalize } from 'rxjs/operators';
import { Classification, Reason, RequestType, Request } from '../../../../data/interfaces/Request';
import { ToastrService } from 'ngx-toastr';
import { CreditForm } from "../../components/forms/credit-form/credit-form";
import { PermissionAction, RequestTypePermissionRecord, RoleService } from '../../../../core/services/role-service';
import { DebitForm } from "../../components/forms/debit-form/debit-form";
import { AuditorCreditForm } from "../../components/forms/auditor-credit-form/auditor-credit-form";
import { AuditorDebitForm } from "../../components/forms/auditor-debit-form/auditor-debit-form";
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialReturnForm } from "../../components/forms/material-return-form/material-return-form";
import { ReInvoicingForm } from "../../components/forms/re-invoicing-form/re-invoicing-form";
import { ApprovalContext } from '../../components/shared/base-request-form';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ApproveConfirmModal } from '../../../pages/my-approvals/components/approve-confirm-modal/approve-confirm-modal';
import { SendBackModal } from '../../../pages/my-approvals/components/send-back-modal/send-back-modal';

@Component({
    selector: 'app-new-request',
    templateUrl: './new-request.html',
    styleUrl: './new-request.css',
    imports: [ReactiveFormsModule, TranslatePipe, CommonModule, CreditForm, DebitForm, AuditorCreditForm, AuditorDebitForm, MaterialReturnForm, ReInvoicingForm, Modal, ApproveConfirmModal, SendBackModal],
})
export class NewRequest implements OnInit {
    public profileForm: FormGroup;
    public formConfig: any = formFieldsConfig;
    public selectedRequestType: string = '';
    public selectedRequestTypeId: number | null = null;
    public currentTabs: any[] = [];
    public submitted: boolean = false;
    public isLoadingForm = signal<boolean>(false);
    public isRegisterRequestDisabled = signal<boolean>(false);
    private requestNumber = signal<string>('');
    public reasons = signal<Reason[]>([]);
    public classifications = signal<Classification[]>([]);
    public availableRequestTypes = signal<RequestType[]>([]);
    public editingRequestData = signal<Partial<Request> | null>(null);
    public isEditingRequest = computed(() => {
        const requestId = Number(this.editingRequestData()?.id);
        return Number.isFinite(requestId) && requestId > 0;
    });
    public approvalContext = signal<ApprovalContext | null>(null);
    private returnTo = '/app/pending';

    public showApproveModal = signal<boolean>(false);
    public showDeclineModal = signal<boolean>(false);
    public showCancelModal = signal<boolean>(false);
    public showSendBackModal = signal<boolean>(false);
    public isApproving = signal<boolean>(false);
    public isDeclining = signal<boolean>(false);
    public isCancelling = signal<boolean>(false);
    public cancelComments = new FormControl<string>('');
    public declineForm = new FormGroup({ comments: new FormControl<string>('', Validators.required) });
    public declineSubmitted = signal<boolean>(false);

    private computedSubscriptions: Subscription[] = [];
    private requestTypeActionPermissions = signal<Record<number, Record<string, boolean>>>({});
    private toastr = inject(ToastrService);
    private readonly _toastService = inject(ToastService);
    private readonly _translateService = inject(TranslateService);
    private roleService = inject(RoleService);
    constructor(
        private fb: FormBuilder,
        private _requestService: RequestService,

        private readonly route: ActivatedRoute,
        private readonly router: Router,

    ) {
        this.profileForm = this.fb.group({});
    }

    ngOnInit() {
        this.applyIncomingEditState();
        this.loadAllowedRequestTypes();
    }

    private applyIncomingEditState(): void {
        const requestTypeIdParam = this.route.snapshot.queryParamMap.get('requestTypeId');
        const requestTypeId = Number(requestTypeIdParam);

        if (!Number.isNaN(requestTypeId) && requestTypeId > 0) {
            this.selectedRequestTypeId = requestTypeId;
            this.selectedRequestType = this.resolveRequestTypeModuleKey(requestTypeId);
        }

        const navigationState = this.router.getCurrentNavigation()?.extras?.state as { editRequest?: Request; approvalActions?: ApprovalContext; returnTo?: string } | undefined;
        const browserState = history.state as { editRequest?: Request; approvalActions?: ApprovalContext; returnTo?: string };
        console.log("🚀 ~ NewRequest ~ applyIncomingEditState ~ browserState:", browserState)
        
        const editRequest = navigationState?.editRequest ?? browserState?.editRequest;
        const approvalActions = navigationState?.approvalActions ?? browserState?.approvalActions;
        const returnTo = navigationState?.returnTo ?? browserState?.returnTo;

        if (returnTo) {
            this.returnTo = returnTo;
        }

        if (approvalActions) {
            this.approvalContext.set(approvalActions);
        }

        if (editRequest) {
            this.editingRequestData.set(editRequest);

            if ((this.selectedRequestTypeId === null || this.selectedRequestType === '') && Number(editRequest.requestTypeId) > 0) {
                this.selectedRequestTypeId = Number(editRequest.requestTypeId);
                this.selectedRequestType = this.resolveRequestTypeModuleKey(this.selectedRequestTypeId);
            }
        }
    }

    private resolveRequestTypeModuleKey(requestTypeId: number): string {
        const moduleMap: Record<number, string> = {
            1: 'credits',
            2: 'debits',
            3: 'auditor-credits',
            4: 'auditor-debits',
            5: 're-invoicing',
            6: 'material-return',
        };

        return moduleMap[requestTypeId] ?? '';
    }

    private loadAllowedRequestTypes(): void {
        this.loadRequestTypesByContext();
    }

    private loadRequestTypesByContext(): void {
        forkJoin({
            actions: this.roleService.getActions(),
            requestTypes: this._requestService.getRequestTypes(),
            permissions: this.roleService.getRequestTypePermissionsForCurrentContext(),
        }).subscribe({
            next: ({ actions, requestTypes, permissions }) => {
                const permissionMatrix = this.buildRequestTypeActionPermissions(actions, permissions);
                this.requestTypeActionPermissions.set(permissionMatrix);

                const filteredTypes = requestTypes.filter((requestType) => {
                    const permissionsBySlug = permissionMatrix[requestType.id] ?? {};
                    return Boolean(permissionsBySlug['create'] || permissionsBySlug['new_request']);
                });

                this.availableRequestTypes.set(filteredTypes);
            },
            error: () => {
                this.availableRequestTypes.set([]);
            }
        });
    }

    private buildRequestTypeActionPermissions(
        actions: PermissionAction[],
        permissions: RequestTypePermissionRecord[]
    ): Record<number, Record<string, boolean>> {
        const actionSlugById = actions.reduce<Record<number, string>>((acc, action) => {
            acc[action.id] = action.slug?.trim().toLowerCase() ?? '';
            return acc;
        }, {});

        const permissionMatrix: Record<number, Record<string, boolean>> = {};

        for (const permission of permissions) {
            const slug = actionSlugById[permission.action_id];
            if (!slug) {
                continue;
            }

            if (!permissionMatrix[permission.request_type_id]) {
                permissionMatrix[permission.request_type_id] = {};
            }

            permissionMatrix[permission.request_type_id][slug] = Boolean(permission.is_allowed);
        }

        return permissionMatrix;
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
        const numericRequestTypeId = Number(value);
        this.isLoadingForm.set(true);
        this.isRegisterRequestDisabled.set(false);

        const moduleKey = this.resolveRequestTypeModuleKey(numericRequestTypeId);
        console.log(moduleKey);
        this.selectedRequestType = moduleKey;
        this.selectedRequestTypeId = Number.isNaN(numericRequestTypeId) ? null : numericRequestTypeId;

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

            delete formValue.sapScreen;
            delete formValue.attachSupports;
            delete formValue.reviewComments;
            delete formValue.creditNumber;
            delete formValue.orderNumber;
            const newObject = {
                requestTypeId: this.selectedRequestTypeId,
                ...formValue,
                customerId: formValue.customerId.id,
                totalAmount: formValue.totalAmount.toFixed(2),
                status: 'created'
            }
            this.saveRequest(newObject);
            this.submitted = false; // Resetear después de guardar exitosamente
        } else {
            this.toastr.error('Por favor, rellena los campos obligatorios', 'Error');
        }
    }

    saveDraft(object: any) {
        this._requestService.saveDraft(object).subscribe({
            next: (response) => {
                this.toastr.success(response.message, 'Success');
                this.submitted = false; // Resetear después de guardar como borrador
            },
            error: (error) => {
                this.toastr.error('Error al guardar el borrador', 'Error');
            }
        })
    }

    handleSaveDraft() {
        // No validar campos obligatorios - guardar como borrador
        const formValue = this.profileForm.getRawValue();
        delete formValue.sapScreen;
        delete formValue.attachSupports;
        delete formValue.reviewComments;
        delete formValue.creditNumber;
        delete formValue.orderNumber;

        const newObject = {
            requestTypeId: this.selectedRequestTypeId,
            ...formValue,
            customerId: formValue.customerId?.id || null,
            totalAmount: formValue.totalAmount ? formValue.totalAmount.toFixed(2) : 0,
            status: 'draft'
        }

        this.saveDraft(newObject);
        this.submitted = false;
    }

    onSavedForApproval(): void {
        this.showApproveModal.set(true);
    }

    onApproveConfirmed(comments: string): void {
        const ctx = this.approvalContext();
        if (!ctx) return;
        this.isApproving.set(true);
        this._requestService.approveRequest(ctx.requestId, comments).pipe(
            finalize(() => this.isApproving.set(false))
        ).subscribe({
            next: () => {
                this.showApproveModal.set(false);
                this._toastService.success(
                    this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_APPROVED_SUCCESS'),
                    this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                );
                this.router.navigate([this.returnTo]);
            },
            error: (error: any) => {
                this._toastService.error(
                    error?.error?.message ?? this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_APPROVED_ERROR'),
                    this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
            }
        });
    }

    openDeclineModal(): void {
        this.declineForm.reset();
        this.declineSubmitted.set(false);
        this.showDeclineModal.set(true);
    }

    submitDecline(): void {
        this.declineSubmitted.set(true);
        if (this.declineForm.invalid) {
            this.declineForm.markAllAsTouched();
            return;
        }
        const ctx = this.approvalContext();
        if (!ctx) return;
        const comments = this.declineForm.get('comments')?.value ?? '';
        this.isDeclining.set(true);
        this._requestService.rejectRequest(ctx.requestId, comments).pipe(
            finalize(() => this.isDeclining.set(false))
        ).subscribe({
            next: () => {
                this.showDeclineModal.set(false);
                this._toastService.success(
                    this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_REJECTED_SUCCESS'),
                    this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                );
                this.router.navigate([this.returnTo]);
            },
            error: (error: any) => {
                this._toastService.error(
                    error?.error?.message ?? this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_REJECTED_ERROR'),
                    this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
            }
        });
    }

    openCancelModal(): void {
        this.cancelComments.reset();
        this.showCancelModal.set(true);
    }

    submitCancel(): void {
        const ctx = this.approvalContext();
        if (!ctx) return;
        this.isCancelling.set(true);
        this._requestService.cancelRequest(ctx.requestId, this.cancelComments.value ?? '').pipe(
            finalize(() => this.isCancelling.set(false))
        ).subscribe({
            next: () => {
                this.showCancelModal.set(false);
                this._toastService.success(
                    this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_CANCELLED_SUCCESS'),
                    this._translateService.instant('MY_APPROVALS.TOAST.SUCCESS')
                );
                this.router.navigate([this.returnTo]);
            },
            error: (error: any) => {
                this._toastService.error(
                    error?.error?.message ?? this._translateService.instant('MY_APPROVALS.TOAST.REQUEST_CANCELLED_ERROR'),
                    this._translateService.instant('MY_APPROVALS.TOAST.ERROR')
                );
            }
        });
    }

    openReturnModal(): void {
        this.showSendBackModal.set(true);
    }

    onSendBackSent(): void {
        this.showSendBackModal.set(false);
        this.router.navigate([this.returnTo]);
    }

    declineCampoVacio(controlName: string): boolean {
        const control = this.declineForm.get(controlName);
        return !!control?.invalid && (!!control?.touched || this.declineSubmitted());
    }

}
