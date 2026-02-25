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
    public permissionsMatrix = signal<Record<number, Record<number, boolean>>>({});
    public permissionPayload = signal<AssignPermission>({
        requestType: { id: 0, name: '' },
        role: { id: 0, roleName: '' },
        hasAccess: false,
    })
    public toastr = inject(ToastrService);


    constructor(
        private _roleService: RoleService,
        private _requestService: RequestService
    ) {
        this.getData()
    }

    getData() {
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
            matrix[role.id] = {};
            for (const requestType of this.requestTypes()) {
                matrix[role.id][requestType.id] = false;
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

    onPermissionChange(role: Role, requestType: RequestType, event: Event): void {
        event.preventDefault();
        const currentAccess = this.hasPermission(role.id, requestType.id);
        this.permissionPayload.set({ role, requestType, hasAccess: !currentAccess });
        this.onPermissionModalChange(true);
    }

    onPermissionModalChange(isOpen: boolean): void {
        this.showPermissionModal.set(isOpen);
    }

    confirmPermission(): void {
        const payload = {
            roleId: this.permissionPayload().role.id,
            requestTypeId: this.permissionPayload().requestType.id,
            hasAccess: this.permissionPayload().hasAccess,

        };

        this.isSaving.set(true);

        this._roleService.assignPermission(payload).subscribe({
            next: (response) => {
                this.toastr.success(response.message ?? 'Permiso actualizado', 'Éxito');
                this.onPermissionModalChange(false);
                this.isSaving.set(false);
                this.getData();
            },
            error: (error) => {
                this.toastr.error(error?.message ?? 'No se pudo actualizar el permiso', 'Error');
                this.onPermissionModalChange(false);
                this.isSaving.set(false);
            }
        });
    }



}
