import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AssignPermission, RolePermission, RoleService } from '../../../../core/services/role-service';
import { Role } from '../../../../data/interfaces/User';
import { RequestService } from '../../../../core/services/request-service';
import { RequestType } from '../../../../data/interfaces/Request';
import { TitleCasePipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { Spinner } from "../../../../shared/components/ui/spinner/spinner";
import { Modal } from "../../../../shared/components/ui/modal/modal";
import { ToastrService } from 'ngx-toastr';

@Component({
    selector: 'app-roles',
    templateUrl: './roles.html',
    styleUrl: './roles.css',
    imports: [TranslatePipe, TitleCasePipe, Spinner, Modal]
})
export class Roles {

    public roles = signal<Role[]>([]);
    public requestTypes = signal<RequestType[]>([]);
    public isLoading = signal<boolean>(true);
    public isSaving = signal<boolean>(false);
    public showPermissionModal = signal<boolean>(false);
    public showPermissionManyModal = signal<boolean>(false);
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
