import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from "lucide-angular";
import { UiSwitch } from "../../../../../../shared/components/ui/switch/switch";
import {
  ModulePermissionAssignment,
  PermissionAction,
  PermissionModule,
  RequestTypePermissionAssignment,
  RoleService,
  ModulePermissionRecord,
} from '../../../../../../core/services/role-service';
import { RequestService } from '../../../../../../core/services/request-service';
import { RequestType } from '../../../../../../data/interfaces/Request';
import { forkJoin, map, of } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { TitleCasePipe } from '@angular/common';

interface GeneralPermissionItem {
  key: string;
  label: string;
  description: string;
  moduleUrl: string;
  actionSlug: string;
}

interface ModuleCheckState {
  key: string;
  isAllowed: boolean;
}

interface RequestCheckState {
  requestTypeId: number;
  actionSlug: string;
  isAllowed: boolean;
}

@Component({
  selector: 'app-manage-roles',
  imports: [LucideAngularModule, UiSwitch, TranslatePipe, TitleCasePipe],
  templateUrl: './manage-roles.html',
  styleUrl: './manage-roles.css',
})
export class ManageRoles {
  public readonly isLoading = signal<boolean>(true);
  public readonly isSaving = signal<boolean>(false);
  public readonly selectedRoleId = signal<number | null>(null);
  public readonly selectedRoleName = signal<string>('ROL');
  public readonly requestTypes = signal<RequestType[]>([]);
  public readonly modules = signal<PermissionModule[]>([]);
  public readonly actions = signal<PermissionAction[]>([]);

  public readonly moduleSwitches = signal<Record<string, boolean>>({});
  public readonly requestTypeSwitches = signal<Record<number, Record<string, boolean>>>({});

  private readonly actionIdBySlug = signal<Record<string, number>>({});
  private readonly _roleService = inject(RoleService);
  private readonly _requestService = inject(RequestService);
  private readonly _route = inject(ActivatedRoute);
  private readonly _router = inject(Router);
  private readonly _toastr = inject(ToastrService);

  constructor() {
    this._route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe(params => {
        const roleIdParam = Number(params.get('roleId'));
        const roleNameParam = params.get('roleName');

        this.selectedRoleId.set(Number.isFinite(roleIdParam) && roleIdParam > 0 ? roleIdParam : null);
        this.selectedRoleName.set(roleNameParam?.trim() || 'ROL');

        this.loadCatalogAndPermissionState();
      });
  }

  public isPermissionActive(key: string): boolean {
    return this.moduleSwitches()[key] ?? false;
  }

  public setPermissionActive(key: string, value: boolean): void {
    this.moduleSwitches.update(current => ({
      ...current,
      [key]: value,
    }));
  }

  public isRequestPermissionActive(requestTypeId: number, actionSlug: string): boolean {
    return this.requestTypeSwitches()[requestTypeId]?.[actionSlug] ?? false;
  }

  public setRequestPermissionActive(requestTypeId: number, actionSlug: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    this.requestTypeSwitches.update(current => ({
      ...current,
      [requestTypeId]: {
        ...(current[requestTypeId] ?? {}),
        [actionSlug]: checked,
      }
    }));
  }

  public onCancel(): void {
    this._router.navigate(['/app/settings/roles']);
  }

  public onSaveChanges(): void {
    const roleId = this.selectedRoleId();
    if (!roleId) {
      this._toastr.warning('Selecciona un rol para guardar permisos', 'Permisos');
      return;
    }

    const modulePayload = this.buildModulePermissionPayload(roleId);
    const requestTypePayload = this.buildRequestTypePermissionPayload(roleId);

    if (!modulePayload.length && !requestTypePayload.length) {
      this._toastr.warning('No hay permisos configurables para guardar', 'Permisos');
      return;
    }

    this.isSaving.set(true);

    forkJoin({
      moduleAssign: modulePayload.length ? this._roleService.assignModulePermissions(modulePayload) : of(null),
      requestTypeAssign: requestTypePayload.length ? this._roleService.assignRequestTypePermissions(requestTypePayload) : of(null),
    }).subscribe({
      next: () => {
        this._toastr.success('Permisos guardados correctamente', 'Permisos');
        this.loadPermissionStateByCheck(roleId);
      },
      error: (error) => {
        this._toastr.error(error?.message ?? 'No se pudieron guardar los permisos', 'Error');
        this.isSaving.set(false);
      }
    });
  }

  private loadCatalogAndPermissionState(): void {
    this.isLoading.set(true);

    forkJoin({
      actions: this._roleService.getActions(),
      modules: this._roleService.getModules(),
      requestTypes: this._requestService.getRequestTypes(),
    }).subscribe({
      next: ({ actions, modules, requestTypes }) => {
        this.actions.set(actions);
        this.actionIdBySlug.set(this.buildActionSlugMap(actions));
        this.modules.set(modules);
        this.requestTypes.set(requestTypes);
        this.initializeLocalState();

        const roleId = this.selectedRoleId();
        if (!roleId) {
          this.isLoading.set(false);
          return;
        }

        this.loadPermissionStateByCheck(roleId);
      },
      error: (error) => {
        this._toastr.error(error?.message ?? 'No se pudo cargar catálogo de permisos', 'Error');
        this.isLoading.set(false);
      }
    });
  }

  private initializeLocalState(): void {
    const baseModuleState = this.modules().reduce<Record<string, boolean>>((acc, module) => {
      acc[String(module.id)] = false;
      return acc;
    }, {});

    const baseRequestTypeState = this.requestTypes().reduce<Record<number, Record<string, boolean>>>((acc, requestType) => {
      acc[requestType.id] = this.actions().reduce<Record<string, boolean>>((actionsAcc, action) => {
        actionsAcc[action.slug] = false;
        return actionsAcc;
      }, {});
      return acc;
    }, {});

    this.moduleSwitches.set(baseModuleState);
    this.requestTypeSwitches.set(baseRequestTypeState);
  }

  private loadPermissionStateByCheck(roleId: number): void {
    // Load module permissions from the role's permission list
    this._roleService.getRoleModulePermissions(roleId).subscribe({
      next: (modulePermissions: ModulePermissionRecord[]) => {
        // Build a map of module IDs to their permission records (filtered by "view" action)
        const permissionsByModuleId = new Map<number, ModulePermissionRecord>();
        
        for (const perm of modulePermissions) {
          // Only use "view" action for general permissions
          if (perm.action?.slug?.toLowerCase() === 'view') {
            permissionsByModuleId.set(perm.moduleid, perm);
          }
        }

        // Update module switches based on loaded permissions
        // Key is the moduleId as string
        const moduleState = { ...this.moduleSwitches() };
        for (const module of this.modules()) {
          const perm = permissionsByModuleId.get(module.id);
          moduleState[String(module.id)] = perm?.isallowed ?? false;
        }

        this.moduleSwitches.set(moduleState);

        // Now load request type permissions
        this.loadRequestTypePermissionsForRole(roleId);
      },
      error: (error) => {
        console.warn('Could not load module permissions from role endpoint, falling back to checks', error);
        // Fallback to the old check-based approach
        this.loadPermissionStateByCheckFallback(roleId);
      }
    });
  }

  private loadRequestTypePermissionsForRole(roleId: number): void {
    this._roleService.getRequestTypePermissionsByRole(roleId).subscribe({
      next: (requestPermissions: RequestTypePermissionAssignment[]) => {
        const actionMap = this.actionIdBySlug();
        const requestState = { ...this.requestTypeSwitches() };

        for (const perm of requestPermissions) {
          // Find the action slug from actionMap by ID
          const actionSlug = Object.entries(actionMap).find(([_, id]) => id === perm.action_id)?.[0];
          
          if (actionSlug && requestState[perm.request_type_id]) {
            requestState[perm.request_type_id][actionSlug] = perm.is_allowed;
          }
        }

        this.requestTypeSwitches.set(requestState);
        this.isLoading.set(false);
        this.isSaving.set(false);
      },
      error: (error) => {
        console.warn('Could not load request type permissions, attempting individual checks', error);
        this.loadRequestTypePermissionsByCheck(roleId);
      }
    });
  }

  private loadRequestTypePermissionsByCheck(roleId: number): void {
    const requestChecks = this.requestTypes().flatMap(requestType =>
      this.actions().map(action =>
        this._roleService.checkRequestTypePermission({
          role_id: roleId,
          request_type_id: requestType.id,
          action: action.slug,
        }).pipe(
          map(result => ({
            requestTypeId: requestType.id,
            actionSlug: action.slug,
            isAllowed: result?.is_allowed ?? false,
          } as RequestCheckState))
        )
      )
    );

    (requestChecks.length ? forkJoin(requestChecks) : of<RequestCheckState[]>([])).subscribe({
      next: (resolvedRequestChecks) => {
        const requestState = { ...this.requestTypeSwitches() };
        for (const requestCheck of resolvedRequestChecks) {
          requestState[requestCheck.requestTypeId] = {
            ...(requestState[requestCheck.requestTypeId] ?? {}),
            [requestCheck.actionSlug]: requestCheck.isAllowed,
          };
        }

        this.requestTypeSwitches.set(requestState);
        this.isLoading.set(false);
        this.isSaving.set(false);
      },
      error: (error) => {
        this._toastr.error(error?.message ?? 'No se pudo verificar permisos de tipos de solicitud', 'Error');
        this.isLoading.set(false);
        this.isSaving.set(false);
      }
    });
  }

  private loadPermissionStateByCheckFallback(roleId: number): void {
    const moduleChecks = this.modules().map(module => {
      return this._roleService.checkModulePermission({
        roleid: roleId,
        moduleid: module.id,
        action: 'view',
      }).pipe(
        map(result => ({ key: String(module.id), isAllowed: result?.isallowed ?? false } as ModuleCheckState))
      );
    });

    forkJoin({
      moduleChecks: moduleChecks.length ? forkJoin(moduleChecks) : of<ModuleCheckState[]>([]),
    }).subscribe({
      next: ({ moduleChecks: resolvedModules }) => {
        const moduleState: Record<string, boolean> = {};
        for (const module of this.modules()) {
          moduleState[String(module.id)] = false;
        }
        for (const moduleCheck of resolvedModules as ModuleCheckState[]) {
          moduleState[moduleCheck.key] = moduleCheck.isAllowed;
        }

        this.moduleSwitches.set(moduleState);
        this.loadRequestTypePermissionsByCheck(roleId);
      },
      error: (error) => {
        this._toastr.error(error?.message ?? 'No se pudo verificar permisos por rol', 'Error');
        this.isLoading.set(false);
        this.isSaving.set(false);
      }
    });
  }

  private buildActionSlugMap(actions: PermissionAction[]): Record<string, number> {
    return actions.reduce<Record<string, number>>((acc, action) => {
      const slug = action.slug?.trim().toLowerCase();
      if (slug) {
        acc[slug] = action.id;
      }
      return acc;
    }, {});
  }

  private buildModulePermissionPayload(roleId: number): ModulePermissionAssignment[] {
    const actionMap = this.actionIdBySlug();
    const actionId = actionMap['view'];

    if (!actionId) {
      return [];
    }

    return this.modules()
      .map(module => ({
        roleid: roleId,
        moduleid: module.id,
        actionid: actionId,
        isallowed: this.isPermissionActive(String(module.id)),
      } as ModulePermissionAssignment))
      .filter((item): item is ModulePermissionAssignment => !!item);
  }

  private buildRequestTypePermissionPayload(roleId: number): RequestTypePermissionAssignment[] {
    const payload: RequestTypePermissionAssignment[] = [];

    for (const requestType of this.requestTypes()) {
      for (const action of this.actions()) {
        payload.push({
          role_id: roleId,
          request_type_id: requestType.id,
          action_id: action.id,
          is_allowed: this.isRequestPermissionActive(requestType.id, action.slug),
        });
      }
    }

    return payload;
  }

}
