import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { UserService } from '../../../../core/services/user-service';
import { Role, User } from '../../../../data/interfaces/User';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ToastrService } from 'ngx-toastr';
import { Badge } from '../../../../shared/components/ui/badge/badge';
import moment from 'moment';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { RoleService } from '../../../../core/services/role-service';
import { SecurityService } from '../../../../core/services/security-service';
import { AutocompleteOption } from '../../../../shared/components/ui/autocomplete/autocomplete';
import { CustomerService } from '../../../../core/services/customer-service';
import { UserFormModalComponent } from './components/user-form-modal/user-form-modal';
import { ResetPasswordModal } from './components/reset-password-modal/reset-password-modal';
import { BulkUsersUploadModal } from './components/bulk-users-upload-modal/bulk-users-upload-modal';

interface UserData {
    id: number;
    fullName: string;
    role: Role;
}

@Component({
    selector: 'app-users',
    templateUrl: './users.html',
    styleUrl: './users.css',
    imports: [Table, Modal, Badge, TranslatePipe, UserFormModalComponent, ResetPasswordModal, BulkUsersUploadModal],
})
export class Users implements OnInit {
    toastr = inject(ToastrService);
    private readonly _translateService = inject(TranslateService);
    public users = signal<User[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public totalPages = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    public showDeleteModal = signal<boolean>(false);
    public selectedUserToDelete = signal<User | null>(null);
    public showResetPasswordModal = signal<boolean>(false);
    public selectedUserForReset = signal<User | null>(null);
    public showBulkUploadModal = signal<boolean>(false);
    public showUserModal = signal<boolean>(false);
    public isEditMode = signal<boolean>(false);
    public editUserId = signal<number | null>(null);
    public submitted = signal<boolean>(false);
    public passwordErrors = signal<string[]>([]);
    public showPassword = signal<boolean>(false);
    public isUserModalLoading = signal<boolean>(false);
    public isSavingUser = signal<boolean>(false);
    public roles = signal<Role[]>([]);
    public supervisors = signal<UserData[]>([]);
    public searchTerm = signal<string>('');
    private searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

    // public headerButtons = [
    //     {
    //         label: 'Agregar usuario',
    //         icon: 'plus',
    //         className: 'bg-[#3c6194]',
    //         accion: () => this.openUserModalForCreate()
    //     }
    // ];

    public userForm = new FormGroup({
        fullName: new FormControl<string>('', Validators.required),
        email: new FormControl<string>('', [Validators.required, Validators.email]),
        password: new FormControl<string>('', [Validators.required], [this.passwordValidator()]),
        roleId: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
        clientId: new FormControl<any>(null),
        supervisorId: new FormControl<number>(0),
        preferredLanguage: new FormControl<string>('DEF', [Validators.required, Validators.pattern(/^(en|es)$/)]),
    });

    public columns: Column<User>[] = [
        {
            key: 'fullName',
            label: 'USERS_PAGE.NAME',
            sortable: true
        },
        {
            key: 'email',
            label: 'USERS_PAGE.EMAIL_LABEL',
            sortable: true
        },
        {
            key: 'preferredLanguage',
            label: 'USERS_PAGE.PREFERRED_LANGUAGE_LABEL',
            sortable: true
        },
        {
            key: 'role',
            label: 'USERS_PAGE.ROLE_LABEL',
            sortable: false,
            render: (value, item) => item.role?.roleName ?? this._translateService.instant('USERS_PAGE.NO_ROLE')
        },
        {
            key: 'isActive',
            label: 'USERS_PAGE.STATUS',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'createdAt',
            label: 'USERS_PAGE.CREATED_AT',
            sortable: true,
            render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
        }
    ];

    acciones: AccionPersonalizada<User>[] = [
        {
            key: 'reset',
            icon: 'rotate-ccw',
            label: 'USERS_PAGE.RESET_PASSWORD',
            accion: (user) => this.resetPassword(user)
        },
        {
            key: 'edit',
            icon: 'pencil',
            label: 'USERS_PAGE.EDIT',
            accion: (user) => this.openUserModalForEdit(user)
        },
        {
            key: 'delete',
            icon: 'trash',
            label: 'USERS_PAGE.DELETE',
            accion: (user) => this.openDeleteModal(user)
        }
    ];

    resetPassword(user: User): void {
        this.selectedUserForReset.set(user);
        this.showResetPasswordModal.set(true);
    }

    onResetPasswordModalChange(isOpen: boolean): void {
        this.showResetPasswordModal.set(isOpen);
        if (!isOpen) {
            this.selectedUserForReset.set(null);
        }
    }

    toggleUser(user: User) {
        console.log('Toggle', user.fullName);
    }

    openUserModalForCreate(): void {
        this.isEditMode.set(false);
        this.editUserId.set(null);
        this.showUserModal.set(true);
        this.showPassword.set(false);
        this.resetUserForm();
        this.configurePasswordValidation();
        this.loadFormCatalogs();
    }

    openUserModalForEdit(user: User): void {
        this.isEditMode.set(true);
        this.editUserId.set(user.id);
        this.showUserModal.set(true);
        this.showPassword.set(false);
        this.resetUserForm();
        this.configurePasswordValidation();
        this.loadFormCatalogs(user.id);
    }

    onUserModalChange(isOpen: boolean): void {
        this.showUserModal.set(isOpen);
        if (!isOpen) {
            this.closeUserModal();
        }
    }

    togglePassword(): void {
        this.showPassword.update((value) => !value);
    }

    onRoleChange(): void {
        this.updateCustomerControlState();
    }

    campoVacio(controlName: string): boolean {
        const control = this.userForm.get(controlName);
        if (!control) {
            return false;
        }

        return control.invalid && (control.touched || this.submitted());
    }

    getErrorMessage(controlName: string): string {
        const control = this.userForm.get(controlName);
        if (!control || !control.errors) {
            return '';
        }

        if (control.errors['required']) {
            return this._translateService.instant('USERS_PAGE.REQUIRED_FIELD');
        }

        if (control.errors['email']) {
            return this._translateService.instant('USERS_PAGE.INVALID_EMAIL');
        }

        if (control.errors['passwordInvalid']) {
            return '';
        }

        if (control.errors['min']) {
            return this._translateService.instant('USERS_PAGE.INVALID_OPTION');
        }

        if (control.errors['pattern']) {
            return this._translateService.instant('USERS_PAGE.INVALID_LANGUAGE');
        }

        return this._translateService.instant('USERS_PAGE.INVALID_VALUE');
    }

    saveUserFromModal(): void {
        this.submitted.set(true);
        this.userForm.markAllAsTouched();

        if (this.userForm.invalid || this.isSavingUser()) {
            return;
        }

        this.isSavingUser.set(true);

        if (this.isEditMode() && this.editUserId()) {
            this._userService.updateUser(this.editUserId() as number, this.userPayload).pipe(
                finalize(() => this.isSavingUser.set(false))
            ).subscribe({
                next: (response: any) => {
                    this.toastr.success(
                        response.message ?? this._translateService.instant('USERS_PAGE.USER_UPDATED'),
                        this._translateService.instant('USERS_PAGE.SUCCESS')
                    );
                    this.closeUserModal();
                    this.getUsers();
                },
                error: (error) => {
                    this.toastr.error(
                        error?.error?.message ?? this._translateService.instant('USERS_PAGE.ERROR_UPDATING_USER'),
                        this._translateService.instant('USERS_PAGE.ERROR')
                    );
                }
            });

            return;
        }

        this._userService.saveUser(this.userPayload).pipe(
            finalize(() => this.isSavingUser.set(false))
        ).subscribe({
            next: (response: any) => {
                this.toastr.success(
                    response.message ?? this._translateService.instant('USERS_PAGE.USER_CREATED'),
                    this._translateService.instant('USERS_PAGE.SUCCESS')
                );
                this.closeUserModal();
                this.getUsers();
            },
            error: (error) => {
                this.toastr.error(
                    error?.error?.message ?? this._translateService.instant('USERS_PAGE.ERROR_CREATING_USER'),
                    this._translateService.instant('USERS_PAGE.ERROR')
                );
            }
        });
    }

    openDeleteModal(user: User): void {
        this.selectedUserToDelete.set(user);
        this.showDeleteModal.set(true);
    }

    onDeleteModalChange(isOpen: boolean): void {
        this.showDeleteModal.set(isOpen);
        if (!isOpen) {
            this.selectedUserToDelete.set(null);
        }
    }

    cancelDelete(): void {
        this.showDeleteModal.set(false);
        this.selectedUserToDelete.set(null);
    }

    confirmDelete(): void {
        const user = this.selectedUserToDelete();
        if (!user) {
            return;
        }

        console.log('Delete', user.fullName);
        this._userService.deleteUser(user.id).subscribe(
            (response) => {
                this.toastr.success(
                    response.message ?? this._translateService.instant('USERS_PAGE.USER_DELETED'),
                    this._translateService.instant('USERS_PAGE.SUCCESS')
                );
                this.getUsers();
            },
            (error) => {
                this.toastr.error(
                    error.message ?? this._translateService.instant('USERS_PAGE.ERROR_DELETING_USER'),
                    this._translateService.instant('USERS_PAGE.ERROR')
                );
            }
        )
        this.cancelDelete();
    }

    openBulkUploadModal(): void {
        this.showBulkUploadModal.set(true);
    }

    onBulkUploadModalChange(isOpen: boolean): void {
        this.showBulkUploadModal.set(isOpen);
    }

    constructor(
        private _userService: UserService,
        private _roleService: RoleService,
        private _securityService: SecurityService,
        private _customerService: CustomerService
    ) { }

    ngOnInit(): void {
        this.getUsers();
    }

    getUsers(page: number = this.currentPage()): void {
        this.isLoadingTable.set(true);

        this._userService.getUsersPaginated(this.pageSize(), page, this.searchTerm()).pipe(
            finalize(() => this.isLoadingTable.set(false))
        ).subscribe({
            next: (response) => {
                this.users.set(response.data);
                this.currentPage.set(response.current_page ?? page);
                this.totalPages.set(response.last_page ?? 1);
                this.hasNextPage.set(!!response.next_cursor || !!response.next_page_url);
                this.hasPrevPage.set(!!response.prev_cursor || !!response.prev_page_url);
                console.log('✅ Usuarios cargados:', response);
            },
            error: (error) => {
                console.error('❌ Error al cargar usuarios:', error);
            }
        });
    }

    onSearch(term: string): void {
        if (this.searchDebounceTimeout) {
            clearTimeout(this.searchDebounceTimeout);
        }

        this.searchDebounceTimeout = setTimeout(() => {
            const normalizedTerm = term.trim();

            if (normalizedTerm === this.searchTerm()) {
                return;
            }

            this.searchTerm.set(normalizedTerm);
            this.currentPage.set(1);
            this.totalPages.set(1);
            this.hasNextPage.set(false);
            this.hasPrevPage.set(false);
            this.getUsers(1);
        }, 350);
    }

    onNextPage(): void {
        if (!this.hasNextPage()) {
            return;
        }

        const nextPage = this.currentPage() + 1;
        this.getUsers(nextPage);
    }

    onPrevPage(): void {
        if (!this.hasPrevPage()) {
            return;
        }

        const prevPage = Math.max(1, this.currentPage() - 1);
        this.getUsers(prevPage);
    }

    onFirstPage(): void {
        if (this.currentPage() <= 1) {
            return;
        }

        this.getUsers(1);
    }

    onLastPage(): void {
        const lastPage = this.totalPages();

        if (this.currentPage() >= lastPage) {
            return;
        }

        this.getUsers(lastPage);
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.currentPage.set(1);
        this.totalPages.set(1);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);
        this.getUsers(1);
    }

    private loadFormCatalogs(userId?: number): void {
        this.isUserModalLoading.set(true);

        const requests = userId
            ? {
                roles: this.getRoles(),
                users: this.getAssignableUsers(),
                user: this._userService.getUserById(userId),
            }
            : {
                roles: this.getRoles(),
                users: this.getAssignableUsers(),
            };

        forkJoin(requests as any).pipe(
            finalize(() => this.isUserModalLoading.set(false))
        ).subscribe({
            next: (response: any) => {
                this.roles.set(response.roles ?? []);
                this.supervisors.set(response.users ?? []);

                if (response.user) {
                    this.patchForm(response.user as User);
                }

                this.updateCustomerControlState();
            },
            error: () => {
                this.toastr.error(
                    this._translateService.instant('USERS_PAGE.ERROR_LOADING_FORM_DATA'),
                    this._translateService.instant('USERS_PAGE.ERROR')
                );
            }
        });
    }

    private getRoles(): Observable<Role[]> {
        return this._roleService.getRoles();
    }

    private getAssignableUsers(): Observable<UserData[]> {
        return this._userService.getUsers().pipe(
            map((users) => {
                return users.map((user) => ({
                    id: user.id,
                    fullName: user.fullName,
                    role: {
                        id: user.role?.id ?? 0,
                        roleName: user.role?.roleName ?? '',
                    }
                }));
            })
        );
    }

    private patchForm(user: User): void {
        const resolvedRoleId = user.roleId ?? user.role?.id ?? 0;
        const resolvedSupervisorId = typeof user.supervisorId === 'number'
            ? user.supervisorId
            : user.supervisorId?.id ?? 0;
        const resolvedCustomer = this.resolveCustomerOption(user as any);

        this.userForm.patchValue({
            fullName: user.fullName ?? '',
            email: user.email ?? '',
            roleId: resolvedRoleId,
            clientId: resolvedCustomer,
            supervisorId: resolvedSupervisorId,
            preferredLanguage: user.preferredLanguage ?? 'DEF',
            password: '',
        });
    }

    private configurePasswordValidation(): void {
        const passwordControl = this.userForm.get('password');
        if (!passwordControl) {
            return;
        }

        if (this.isEditMode()) {
            passwordControl.clearValidators();
            passwordControl.clearAsyncValidators();
            passwordControl.setValue('');
            this.passwordErrors.set([]);
            passwordControl.updateValueAndValidity();
            return;
        }

        passwordControl.setValidators([Validators.required]);
        passwordControl.setAsyncValidators([this.passwordValidator()]);
        passwordControl.updateValueAndValidity();
    }

    private passwordValidator(): AsyncValidatorFn {
        return (control: AbstractControl) => {
            if (!control.value || control.value.length === 0) {
                this.passwordErrors.set([]);
                return of(null);
            }

            return of(control.value).pipe(
                debounceTime(500),
                distinctUntilChanged(),
                switchMap((password) =>
                    this._securityService.validatePassword(password).pipe(
                        map((response) => {
                            if (response?.isValid) {
                                this.passwordErrors.set([]);
                                return null;
                            }

                            return { passwordInvalid: true };
                        }),
                        catchError((error) => {
                            if (error?.error?.errors?.errors) {
                                this.passwordErrors.set(error.error.errors.errors);
                            } else {
                                this.passwordErrors.set([this._translateService.instant('USERS_PAGE.ERROR_VALIDATING_PASSWORD')]);
                            }

                            return of({ passwordInvalid: true });
                        })
                    )
                )
            );
        };
    }

    private closeUserModal(): void {
        this.showUserModal.set(false);
        this.isEditMode.set(false);
        this.editUserId.set(null);
        this.submitted.set(false);
        this.isUserModalLoading.set(false);
        this.isSavingUser.set(false);
        this.showPassword.set(false);
        this.resetUserForm();
        this.passwordErrors.set([]);
    }

    private resetUserForm(): void {
        this.userForm.reset({
            fullName: '',
            email: '',
            password: '',
            roleId: 0,
            clientId: null,
            supervisorId: 0,
            preferredLanguage: 'DEF',
        });
    }

    private get userPayload(): Partial<User> {
        const payload = { ...this.userForm.getRawValue() } as Partial<User> & { password?: string; clientId?: any };

        if (payload.clientId && typeof payload.clientId === 'object') {
            payload.clientId = payload.clientId.id;
        }

        if (!this.isCustomerRoleSelected()) {
            delete payload.clientId;
        }

        if (this.isEditMode() && !payload.password) {
            delete payload.password;
        }

        return payload;
    }

    public isCustomerRoleSelected(): boolean {
        const roleId = Number(this.userForm.get('roleId')?.value ?? 0);
        if (!roleId) {
            return false;
        }

        const selectedRole = this.roles().find((role) => Number(role.id) === roleId);
        return (selectedRole?.roleName ?? '').trim().toUpperCase() === 'CUSTOMER';
    }

    public searchCustomers(term: string): Observable<AutocompleteOption[]> {
        if (!term || term.trim().length === 0) {
            return of([]);
        }

        return this._customerService.getCustomersByName(term).pipe(
            map((customers) => {
                if (!Array.isArray(customers)) {
                    return [];
                }

                return customers.map((customer): AutocompleteOption => ({
                    id: customer.idCliente,
                    label: `${customer.idCliente} - ${customer.razonSocial}`,
                    customer,
                }));
            }),
            catchError(() => of([]))
        );
    }

    public displayCustomer(customer: any): string {
        if (!customer) {
            return '';
        }

        if (typeof customer.label === 'string' && customer.label.trim().length > 0) {
            return customer.label;
        }

        const customerId = customer?.id ?? customer?.idCliente ?? customer?.customer?.idCliente;
        const customerName = customer?.customer?.razonSocial ?? customer?.razonSocial;

        if (customerId && customerName) {
            return `${customerId} - ${customerName}`;
        }

        return customerName || String(customerId ?? '');
    }

    public onCustomerSelected(option: AutocompleteOption): void {
        this.userForm.get('clientId')?.setValue(option, { emitEvent: false });
    }

    private updateCustomerControlState(): void {
        const customerControl = this.userForm.get('clientId');
        const supervisorControl = this.userForm.get('supervisorId');
        
        if (!customerControl) {
            return;
        }

        if (this.isCustomerRoleSelected()) {
            customerControl.setValidators([Validators.required]);
            if (supervisorControl) {
                supervisorControl.clearValidators();
                supervisorControl.setValue(0, { emitEvent: false });
            }
        } else {
            customerControl.clearValidators();
            customerControl.setValue(null, { emitEvent: false });
            if (supervisorControl) {
                supervisorControl.clearValidators();
            }
        }

        customerControl.updateValueAndValidity({ emitEvent: false });
        if (supervisorControl) {
            supervisorControl.updateValueAndValidity({ emitEvent: false });
        }
    }

    private resolveCustomerOption(user: any): AutocompleteOption | null {
        const customerId = user?.clientId ?? user?.client?.idCliente ?? user?.customer?.idCliente ?? null;
        const customerName = user?.client?.razonSocial ?? user?.customer?.razonSocial ?? '';

        if (!customerId && !customerName) {
            return null;
        }

        return {
            id: customerId,
            label: customerId && customerName ? `${customerId} - ${customerName}` : String(customerName || customerId || ''),
            customer: {
                idCliente: customerId,
                razonSocial: customerName,
            }
        };
    }
}
