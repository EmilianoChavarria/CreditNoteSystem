import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe } from '@ngx-translate/core';
import { AssignmentUser } from '../../../../core/services/user-assignment-service';
import {
  SalesEngineerAssignmentService,
  SalesEngineerAssignPayload,
  SalesEngineerBatchItemResult,
  SalesEngineerBatchSummary,
} from '../../../../core/services/sales-engineer-assignment.service';

@Component({
  selector: 'app-sales-engineer-manage',
  imports: [TranslatePipe],
  templateUrl: './sales-engineer-manage.html',
  styleUrl: './sales-engineer-manage.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesEngineerManage implements OnInit {
  private readonly seAssignmentService = inject(SalesEngineerAssignmentService);
  private readonly toastr = inject(ToastrService);

  readonly managers = signal<AssignmentUser[]>([]);
  readonly allAssignableEngineers = signal<AssignmentUser[]>([]);
  readonly assignedEngineers = signal<AssignmentUser[]>([]);
  readonly pendingEngineers = signal<AssignmentUser[]>([]);
  readonly availableEngineers = signal<AssignmentUser[]>([]);

  readonly selectedManagerId = signal<number | null>(null);

  readonly isLoadingCatalogs = signal<boolean>(false);
  readonly isLoadingAssigned = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly unassigningUserId = signal<number | null>(null);

  readonly batchSummary = signal<SalesEngineerBatchSummary | null>(null);
  readonly batchItems = signal<SalesEngineerBatchItemResult[]>([]);

  readonly selectedManager = computed<AssignmentUser | null>(() => {
    const id = this.selectedManagerId();
    if (!id) return null;
    return this.managers().find((m) => m.id === id) ?? null;
  });

  readonly rightListEngineers = computed<Array<{ user: AssignmentUser; pending: boolean }>>(() => {
    const persisted = this.assignedEngineers().map((user) => ({ user, pending: false }));
    const pending = this.pendingEngineers().map((user) => ({ user, pending: true }));
    return [...persisted, ...pending];
  });

  ngOnInit(): void {
    this.loadCatalogs();
  }

  loadCatalogs(): void {
    this.isLoadingCatalogs.set(true);

    forkJoin({
      managers: this.seAssignmentService.getManagers(),
      assignable: this.seAssignmentService.getAssignableEngineers(),
    }).pipe(
      finalize(() => this.isLoadingCatalogs.set(false))
    ).subscribe({
      next: ({ managers, assignable }) => {
        this.managers.set(this.sortUsers(managers));
        this.allAssignableEngineers.set(this.sortUsers(assignable));
      },
      error: (error) => {
        this.toastr.error(this.resolveHttpErrorMessage(error, 'No se pudieron cargar los catálogos.'), 'Error');
      }
    });
  }

  onManagerChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const parsed = Number.parseInt(value, 10);
    const managerId = Number.isNaN(parsed) ? null : parsed;

    this.selectedManagerId.set(managerId);
    this.batchSummary.set(null);
    this.batchItems.set([]);
    this.pendingEngineers.set([]);

    if (!managerId) {
      this.assignedEngineers.set([]);
      this.rebuildAvailable();
      return;
    }

    this.loadAssignedEngineers(managerId);
  }

  addEngineerToPending(user: AssignmentUser): void {
    const managerId = this.selectedManagerId();
    if (!managerId) {
      this.toastr.warning('Primero selecciona un SALES MANAGER.', 'Asignación');
      return;
    }

    if (user.id === managerId) {
      this.toastr.error('managerUserId y assignedUserId no pueden ser iguales.', 'Validación');
      return;
    }

    const alreadyPending = this.pendingEngineers().some((e) => e.id === user.id);
    if (alreadyPending) return;

    this.pendingEngineers.update((current) => this.sortUsers([...current, user]));
    this.rebuildAvailable();
  }

  removeFromRight(user: AssignmentUser, pending: boolean): void {
    if (pending) {
      this.pendingEngineers.update((current) => current.filter((e) => e.id !== user.id));
      this.rebuildAvailable();
      return;
    }

    this.unassignEngineer(user);
  }

  saveAssignments(): void {
    const managerId = this.selectedManagerId();
    const pending = this.pendingEngineers();

    if (!managerId) {
      this.toastr.warning('Selecciona un SALES MANAGER antes de guardar.', 'Asignación');
      return;
    }

    if (pending.length < 1) {
      this.toastr.warning('Debes agregar al menos un SALES ENGINEER para asignar.', 'Asignación');
      return;
    }

    const assignments: SalesEngineerAssignPayload[] = pending.map((user) => ({
      managerUserId: managerId,
      assignedUserId: user.id,
    }));

    const hasSelfAssign = assignments.some((a) => a.managerUserId === a.assignedUserId);
    if (hasSelfAssign) {
      this.toastr.error('Hay registros donde managerUserId y assignedUserId son iguales.', 'Validación');
      return;
    }

    this.isSaving.set(true);

    this.seAssignmentService.assignEngineersBatch({ assignments }).pipe(
      finalize(() => this.isSaving.set(false))
    ).subscribe({
      next: (response) => {
        const summary = response.data;
        if (!summary) {
          this.toastr.error('No se recibió el detalle del procesamiento en lote.', 'Error');
          return;
        }

        this.batchSummary.set(summary);
        this.batchItems.set(summary.items ?? []);
        this.applyBatchResult(summary.items ?? [], pending);

        this.toastr.success(
          `Total: ${summary.total} | Creadas: ${summary.created} | Reactivadas: ${summary.reactivated} | Ya activas: ${summary.alreadyActive} | Errores: ${summary.errors}`,
          'Asignaciones procesadas'
        );

        this.loadAssignedEngineers(managerId);
      },
      error: (error) => {
        this.toastr.error(this.resolveHttpErrorMessage(error, 'No se pudieron procesar las asignaciones.'), 'Error');
      }
    });
  }

  private loadAssignedEngineers(managerId: number): void {
    this.isLoadingAssigned.set(true);

    this.seAssignmentService.getAssignedEngineers(managerId).pipe(
      finalize(() => this.isLoadingAssigned.set(false))
    ).subscribe({
      next: (engineers) => {
        this.assignedEngineers.set(this.sortUsers(engineers));
        this.rebuildAvailable();
      },
      error: (error) => {
        this.assignedEngineers.set([]);
        this.rebuildAvailable();
        this.toastr.error(this.resolveHttpErrorMessage(error, 'No se pudieron cargar los ingenieros asignados.'), 'Error');
      }
    });
  }

  private unassignEngineer(user: AssignmentUser): void {
    const managerId = this.selectedManagerId();
    if (!managerId) {
      this.toastr.warning('Selecciona un SALES MANAGER antes de desasignar.', 'Desasignación');
      return;
    }

    this.unassigningUserId.set(user.id);

    this.seAssignmentService.unassignEngineer(managerId, user.id).pipe(
      finalize(() => this.unassigningUserId.set(null))
    ).subscribe({
      next: () => {
        this.assignedEngineers.update((current) => current.filter((e) => e.id !== user.id));
        this.rebuildAvailable();
        this.toastr.success('Sales Engineer desasignado correctamente.', 'Desasignación');
      },
      error: (error) => {
        this.toastr.error(this.resolveHttpErrorMessage(error, 'No se pudo desasignar el ingeniero.'), 'Error');
      }
    });
  }

  private applyBatchResult(items: SalesEngineerBatchItemResult[], snapshotPending: AssignmentUser[]): void {
    const successfulIds = new Set<number>();
    const failedIds = new Set<number>();

    for (const item of items) {
      if (item.status === 'created' || item.status === 'reactivated' || item.status === 'already_active') {
        successfulIds.add(item.assignedUserId);
      }
      if (item.status === 'error') {
        failedIds.add(item.assignedUserId);
      }
    }

    const successfulUsers = snapshotPending.filter((u) => successfulIds.has(u.id));
    const failedUsers = snapshotPending.filter((u) => failedIds.has(u.id));
    const withoutResult = snapshotPending.filter((u) => !successfulIds.has(u.id) && !failedIds.has(u.id));

    this.assignedEngineers.update((current) => this.sortUsers(this.mergeUniqueUsers(current, successfulUsers)));
    this.pendingEngineers.set(this.sortUsers([...failedUsers, ...withoutResult]));
    this.rebuildAvailable();
  }

  private rebuildAvailable(): void {
    const assignedIds = new Set(this.assignedEngineers().map((u) => u.id));
    const pendingIds = new Set(this.pendingEngineers().map((u) => u.id));

    const available = this.allAssignableEngineers().filter((u) => !assignedIds.has(u.id) && !pendingIds.has(u.id));
    this.availableEngineers.set(this.sortUsers(available));
  }

  private mergeUniqueUsers(base: AssignmentUser[], incoming: AssignmentUser[]): AssignmentUser[] {
    const byId = new Map<number, AssignmentUser>();
    for (const u of base) byId.set(u.id, u);
    for (const u of incoming) byId.set(u.id, u);
    return Array.from(byId.values());
  }

  private sortUsers(users: AssignmentUser[]): AssignmentUser[] {
    return [...users].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }));
  }

  private resolveHttpErrorMessage(error: unknown, defaultMessage: string): string {
    const status = this.readStatusCode(error);
    const backendMessage = this.readBackendMessage(error);

    if (backendMessage) return backendMessage;

    if (status === 401) return 'Sesión inválida. Inicia sesión nuevamente.';
    if (status === 403) return 'No tienes permisos para gestionar asignaciones.';
    if (status === 404) return 'No se encontró el manager o la asignación solicitada.';
    if (status === 422) return 'Se detectó un error de validación o de regla de negocio.';
    if (status === 500) return 'El servidor presentó un error interno. Intenta nuevamente.';

    return defaultMessage;
  }

  private readStatusCode(error: unknown): number | null {
    if (!error || typeof error !== 'object') return null;
    const status = (error as { status?: number }).status;
    return typeof status === 'number' ? status : null;
  }

  private readBackendMessage(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null;
    const message = (error as { error?: { message?: string } }).error?.message;
    return typeof message === 'string' && message.trim().length > 0 ? message : null;
  }
}
