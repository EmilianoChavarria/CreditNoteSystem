import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, AsyncValidatorFn, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { UserService } from '../../../../core/services/user-service';
import { Role, User } from '../../../../data/interfaces/User';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ToastrService } from 'ngx-toastr';
import { Badge } from '../../../../shared/components/ui/badge/badge';
import moment from 'moment';
import { TranslatePipe } from '@ngx-translate/core';
import { catchError, debounceTime, distinctUntilChanged, finalize, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { RoleService } from '../../../../core/services/role-service';
import { SecurityService } from '../../../../core/services/security-service';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { Autocomplete as UiAutocomplete, AutocompleteOption } from '../../../../shared/components/ui/autocomplete/autocomplete';
import { CustomerService } from '../../../../core/services/customer-service';

interface UserData {
    id: number;
    fullName: string;
    role: Role;
}

@Component({
    selector: 'app-users',
    templateUrl: './users.html',
    styleUrl: './users.css',
    imports: [Table, Modal, Badge, TranslatePipe, ReactiveFormsModule, Spinner, UiAutocomplete],
})
export class Users implements OnInit {
    toastr = inject(ToastrService);
    public users = signal<User[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    private nextCursor = signal<string | null>(null);
    private prevCursor = signal<string | null>(null);
    public showDeleteModal = signal<boolean>(false);
    public selectedUserToDelete = signal<User | null>(null);
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
        customerId: new FormControl<any>(null),
        supervisorId: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
        preferredLanguage: new FormControl<string>('DEF', [Validators.required, Validators.pattern(/^(en|es)$/)]),
    });

    public columns: Column<User>[] = [
        {
            key: 'fullName',
            label: 'Nombre',
            sortable: true
        },
        {
            key: 'email',
            label: 'Email',
            sortable: true
        },
        {
            key: 'preferredLanguage',
            label: 'Preferred Language',
            sortable: true
        },
        {
            key: 'role',
            label: 'Rol',
            sortable: false,
            render: (value, item) => item.role?.roleName ?? 'Sin rol'
        },
        {
            key: 'isActive',
            label: 'Status',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'createdAt',
            label: 'Fecha de Creación',
            sortable: true,
            render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
        }
    ];

    acciones: AccionPersonalizada<User>[] = [
        {
            key: 'reset',
            icon: 'rotate-ccw',
            label: 'Reset password',
            accion: (user) => this.resetPassword(user)
        },
        {
            key: 'edit',
            icon: 'pencil',
            label: 'Editar',
            accion: (user) => this.openUserModalForEdit(user)
        },
        {
            key: 'delete',
            icon: 'trash',
            label: 'Eliminar',
            accion: (user) => this.openDeleteModal(user)
        }
    ];

    resetPassword(user: User) {
        console.log('Reset', user.fullName);
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
            return 'Este campo es obligatorio';
        }

        if (control.errors['email']) {
            return 'Ingresa un correo valido';
        }

        if (control.errors['passwordInvalid']) {
            return '';
        }

        if (control.errors['min']) {
            return 'Selecciona una opcion valida';
        }

        if (control.errors['pattern']) {
            return 'Selecciona un idioma valido';
        }

        return 'Valor no valido';
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
                    this.toastr.success(response.message ?? 'Usuario actualizado', 'Exito');
                    this.closeUserModal();
                    this.getUsers();
                },
                error: (error) => {
                    this.toastr.error(error?.error?.message ?? 'Error al actualizar usuario', 'Error');
                }
            });

            return;
        }

        this._userService.saveUser(this.userPayload).pipe(
            finalize(() => this.isSavingUser.set(false))
        ).subscribe({
            next: (response: any) => {
                this.toastr.success(response.message ?? 'Usuario creado', 'Exito');
                this.closeUserModal();
                this.getUsers();
            },
            error: (error) => {
                this.toastr.error(error?.error?.message ?? 'Error al crear usuario', 'Error');
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
                this.toastr.success(response.message ?? 'Usuario eliminado', 'Exito');
                this.getUsers();
            },
            (error) => {
                this.toastr.error(error.message ?? 'Error al eliminar', 'Error');
            }
        )
        this.cancelDelete();
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

    getUsers(cursor?: string | null): void {
        this.isLoadingTable.set(true);

        this._userService.getUsersPaginated(this.pageSize(), cursor).pipe(
            finalize(() => this.isLoadingTable.set(false))
        ).subscribe({
            next: (response) => {
                this.users.set(response.data);
                this.nextCursor.set(response.next_cursor ?? null);
                this.prevCursor.set(response.prev_cursor ?? null);
                this.hasNextPage.set(!!response.next_cursor || !!response.next_page_url);
                this.hasPrevPage.set(!!response.prev_cursor || !!response.prev_page_url);
                console.log('✅ Usuarios cargados:', response);
            },
            error: (error) => {
                console.error('❌ Error al cargar usuarios:', error);
            }
        });
    }

    onNextPage(): void {
        const cursor = this.nextCursor();
        if (!cursor) {
            return;
        }

        this.currentPage.update((value) => value + 1);
        this.getUsers(cursor);
    }

    onPrevPage(): void {
        const cursor = this.prevCursor();
        if (!cursor) {
            return;
        }

        this.currentPage.update((value) => Math.max(1, value - 1));
        this.getUsers(cursor);
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.currentPage.set(1);
        this.nextCursor.set(null);
        this.prevCursor.set(null);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);
        this.getUsers();
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
                this.toastr.error('No fue posible cargar los datos del formulario', 'Error');
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
        const resolvedCustomer = (user as any).customer ?? (user as any).customerId ?? null;

        this.userForm.patchValue({
            fullName: user.fullName ?? '',
            email: user.email ?? '',
            roleId: resolvedRoleId,
            customerId: resolvedCustomer,
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
                                this.passwordErrors.set(['Error al validar la contrasena']);
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
            customerId: null,
            supervisorId: 0,
            preferredLanguage: 'DEF',
        });
    }

    private get userPayload(): Partial<User> {
        const payload = { ...this.userForm.getRawValue() } as Partial<User> & { password?: string; customerId?: any };

        if (payload.customerId && typeof payload.customerId === 'object') {
            payload.customerId = payload.customerId.id;
        }

        if (!this.isCustomerRoleSelected()) {
            delete payload.customerId;
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
                    label: customer.razonSocial,
                    customer,
                }));
            }),
            catchError(() => of([]))
        );
    }

    public displayCustomer(customer: any): string {
        return customer?.label || customer?.customer?.razonSocial || customer?.razonSocial || '';
    }

    public onCustomerSelected(option: AutocompleteOption): void {
        this.userForm.get('customerId')?.setValue(option, { emitEvent: false });
    }

    private updateCustomerControlState(): void {
        const customerControl = this.userForm.get('customerId');
        if (!customerControl) {
            return;
        }

        if (this.isCustomerRoleSelected()) {
            customerControl.setValidators([Validators.required]);
        } else {
            customerControl.clearValidators();
            customerControl.setValue(null, { emitEvent: false });
        }

        customerControl.updateValueAndValidity({ emitEvent: false });
    }
}
