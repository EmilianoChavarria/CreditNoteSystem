import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AssignPermission, RolePermission, RoleService } from '../../../../core/services/role-service';
import { Role } from '../../../../data/interfaces/User';
import { RequestService } from '../../../../core/services/request-service';
import { RequestType } from '../../../../data/interfaces/Request';
import { TitleCasePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Spinner } from "../../../../shared/components/ui/spinner/spinner";
import { Modal } from "../../../../shared/components/ui/modal/modal";
import { ToastrService } from 'ngx-toastr';
import { Badge } from '../../../../shared/components/ui/badge/badge';
import { LucideAngularModule } from "lucide-angular";
import { RouterLink } from "@angular/router";
import { RolesManageModal } from '../workflows/components/roles-manage-modal/roles-manage-modal';
import { RoleFormModal } from '../workflows/components/role-form-modal/role-form-modal';
import { Color } from '../workflows/workflows.types';

@Component({
    selector: 'app-roles',
    templateUrl: './roles.html',
    styleUrl: './roles.css',
    imports: [TranslatePipe, TitleCasePipe, Spinner, Modal, Badge, LucideAngularModule, RouterLink, RolesManageModal, RoleFormModal]
})
export class Roles {

    public roles = signal<Role[]>([]);
    public requestTypes = signal<RequestType[]>([]);
    public isLoading = signal<boolean>(true);
    public isSaving = signal<boolean>(false);
    public showPermissionModal = signal<boolean>(false);
    public showPermissionManyModal = signal<boolean>(false);

    public isOpenModal = signal<boolean>(false);
    public isOpenRoleModal = signal<boolean>(false);
    public isLoadingRoles = signal<boolean>(false);
    public submitted = signal(false);
    public editingRole = signal<Role | null>(null);
    public rolePendingDelete = signal<Role | null>(null);
    public isOpenDeleteConfirmModal = signal<boolean>(false);
    public isDeletingRole = signal<boolean>(false);

    public form = new FormGroup({
        roleName: new FormControl<string>('', Validators.required)
    });

    public selectedItem: Color = { name: '', value: '' };
    public ROLE_COLORS: Color[] = [
        { name: 'Rojo', value: '#EF4444' },
        { name: 'Rosa', value: '#EC4899' },
        { name: 'Fucsia', value: '#D946EF' },
        { name: 'Naranja', value: '#F97316' },
        { name: 'Ambar', value: '#F59E0B' },
        { name: 'Amarillo', value: '#EAB308' },
        { name: 'Lima', value: '#84CC16' },
        { name: 'Verde', value: '#22C55E' },
        { name: 'Esmeralda', value: '#10B981' },
        { name: 'Turquesa', value: '#14B8A6' },
        { name: 'Cian', value: '#06B6D4' },
        { name: 'Celeste', value: '#0EA5E9' },
        { name: 'Azul', value: '#3B82F6' },
        { name: 'Indigo', value: '#6366F1' },
        { name: 'Slate', value: '#64748B' },
        { name: 'Grafito', value: '#374151' }
    ];
    public permissionsMatrix = signal<Record<number, Record<number, boolean>>>({});
    public permissionPayload = signal<AssignPermission>({
        requestType: { id: 0, name: '' },
        role: { id: 0, roleName: '' },
        hasAccess: false,
    })
    public rowArray = signal<any[]>([]);
    public toastr = inject(ToastrService);


    constructor(
        private _roleService: RoleService,
        private _requestService: RequestService
    ) {
        this.getData()
    }

    getData() {
        this.isLoading.set(true);
        forkJoin({
            roles: this._roleService.getRoles(),
            requestTypes: this._requestService.getRequestTypes(),
            permissions: this._roleService.getAllPermissions(),
        }).subscribe({
            next: (results) => {
                this.roles.set(results.roles);
                this.requestTypes.set(results.requestTypes);
                this.initializePermissionsMatrix(results.permissions);
                this.isLoading.set(false);
            },
            error: (error) => {
                console.log(error);
                this.toastr.error(error?.message ?? 'No se pudieron cargar los permisos', 'Error');
                this.isLoading.set(false);
            }
        })
    }

    private initializePermissionsMatrix(permissions: RolePermission[]): void {
        const matrix: Record<number, Record<number, boolean>> = {};

        for (const role of this.roles()) {
            matrix[role.id || 0] = {};
            for (const requestType of this.requestTypes()) {
                matrix[role.id || 0][requestType.id] = false;
            }
        }

        for (const permission of permissions) {
            if (!matrix[permission.roleId]) {
                matrix[permission.roleId] = {};
            }

            matrix[permission.roleId][permission.requestTypeId] = permission.hasAccess;
        }

        this.permissionsMatrix.set(matrix);
    }

    hasPermission(roleId: number, requestTypeId: number): boolean {
        return this.permissionsMatrix()[roleId]?.[requestTypeId] ?? false;
    }

    isRoleChecked(roleId: number): boolean {
        const types = this.requestTypes();
        if (!types.length) {
            return false;
        }

        return types.every(requestType => this.hasPermission(roleId, requestType.id));
    }


    onRoleRowToggle(role: Role, event: Event): void {
        const input = event.target as HTMLInputElement;
        const checked = input.checked;
        const rowPayload = this.requestTypes().map(requestType => ({
            role: role,
            requestType: requestType,
            hasAccess: checked,
        }));

        this.permissionsMatrix.update(current => {
            const updatedRow: Record<number, boolean> = { ...(current[role.id || 0] ?? {}) };

            for (const requestType of this.requestTypes()) {
                updatedRow[requestType.id] = checked;
            }

            return {
                ...current,
                [role.id || 0]: updatedRow,
            };
        });

        this.rowArray.set(rowPayload);
        console.log(rowPayload);
        this.onPermissionManyModalChange(true);
    }

    transformData(payload: any[]) {
        return payload.map(item => ({
            roleId: item.role.id,
            requestTypeId: item.requestType.id,
            hasAccess: item.hasAccess,
        }));
    }

    onPermissionChange(role: Role, requestType: RequestType, event: Event): void {
        event.preventDefault();
        const currentAccess = this.hasPermission(role.id || 0, requestType.id);
        this.permissionPayload.set({ role, requestType, hasAccess: !currentAccess });
        this.onPermissionModalChange(true);
    }

    onPermissionModalChange(isOpen: boolean): void {
        this.showPermissionModal.set(isOpen);
    }

    onPermissionManyModalChange(isOpen: boolean): void {
        this.showPermissionManyModal.set(isOpen);
    }

    public openModal(): void {
        this.isOpenModal.set(true);
        this.isLoadingRoles.set(true);
        this._roleService.getRoles().subscribe({
            next: (roles) => { this.roles.set(roles); this.isLoadingRoles.set(false); },
            error: () => this.isLoadingRoles.set(false)
        });
    }

    public openRoleModal(): void {
        this.editingRole.set(null);
        this.form.reset();
        this.selectedItem = { name: '', value: '' };
        this.isOpenRoleModal.set(true);
    }
    public showModal(isOpen: boolean): void { this.isOpenModal.set(isOpen); }
    public showRoleModal(isOpen: boolean): void { this.isOpenRoleModal.set(isOpen); }
    public onSelectColor(item: Color): void { this.selectedItem = item; }

    public onEditRole(role: Role): void {
        this.editingRole.set(role);
        this.selectedItem = this.ROLE_COLORS.find(c => c.value === role.color) ?? { name: '', value: role.color ?? '' };
        this.form.patchValue({ roleName: role.roleName });
        this.isOpenRoleModal.set(true);
    }

    public onDeleteRole(role: Role): void {
        this.rolePendingDelete.set(role);
        this.isOpenDeleteConfirmModal.set(true);
    }

    public showDeleteConfirmModal(isOpen: boolean): void {
        this.isOpenDeleteConfirmModal.set(isOpen);
        if (!isOpen) this.rolePendingDelete.set(null);
    }

    public confirmDeleteRole(): void {
        const role = this.rolePendingDelete();
        if (!role?.id) return;
        this.isDeletingRole.set(true);
        this._roleService.deleteRole(role.id).subscribe({
            next: (response: any) => {
                this.toastr.success(response.message || 'Rol eliminado correctamente', 'Éxito');
                this.isDeletingRole.set(false);
                this.showDeleteConfirmModal(false);
                this.openModal();
            },
            error: (error: any) => {
                this.toastr.error(error?.error?.message ?? 'No se pudo eliminar el rol', 'Error');
                this.isDeletingRole.set(false);
            }
        });
    }

    public saveRole(): void {
        const editing = this.editingRole();
        const data = { color: this.selectedItem.value, roleName: this.form.value.roleName?.toUpperCase() } as Role;

        const request$ = editing?.id
            ? this._roleService.updateRole(editing.id, data)
            : this._roleService.saveRole(data);

        request$.subscribe({
            next: (response: any) => {
                this.toastr.success(response.message || '', 'Éxito');
                this.isOpenRoleModal.set(false);
                this.editingRole.set(null);
                this.form.reset();
                this.selectedItem = { name: '', value: '' };
                this.openModal();
            },
            error: (error: any) => this.toastr.error(error?.error?.message ?? 'Error al guardar', 'Error')
        });
    }

    confirmPermission(): void {
        const sourcePayload = this.showPermissionManyModal()
            ? this.rowArray()
            : [this.permissionPayload()];

        const formattedPayload = this.transformData(sourcePayload);
        if (!formattedPayload.length) {
            return;
        }

        this.isSaving.set(true);

        this._roleService.assignPermission(formattedPayload).subscribe({
            next: (response) => {
                this.toastr.success(response.message ?? 'Permiso actualizado', 'Éxito');
                this.onPermissionModalChange(false);
                this.onPermissionManyModalChange(false);
                this.isSaving.set(false);
                this.getData();
            },
            error: (error) => {
                this.toastr.error(error?.message ?? 'No se pudo actualizar el permiso', 'Error');
                this.onPermissionModalChange(false);
                this.onPermissionManyModalChange(false);
                this.isSaving.set(false);
            }
        });
    }



}
