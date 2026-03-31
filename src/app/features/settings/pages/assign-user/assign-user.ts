import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import {
  AssignmentBatchItemResult,
  AssignmentBatchSummary,
  AssignmentUser,
  AssignUserPayload,
  UserAssignmentService,
} from '../../../../core/services/user-assignment-service';

@Component({
  selector: 'app-assign-user',
  imports: [],
  templateUrl: './assign-user.html',
  styleUrl: './assign-user.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssignUser implements OnInit {
  private readonly userAssignmentService = inject(UserAssignmentService);
  private readonly toastr = inject(ToastrService);

  readonly leaders = signal<AssignmentUser[]>([]);
  readonly allAssignableUsers = signal<AssignmentUser[]>([]);
  readonly assignedUsers = signal<AssignmentUser[]>([]);
  readonly pendingUsers = signal<AssignmentUser[]>([]);
  readonly availableUsers = signal<AssignmentUser[]>([]);

  readonly selectedLeaderId = signal<number | null>(null);

  readonly isLoadingCatalogs = signal<boolean>(false);
  readonly isLoadingAssignedUsers = signal<boolean>(false);
  readonly isSavingAssignments = signal<boolean>(false);
  readonly unassigningUserId = signal<number | null>(null);

  readonly batchSummary = signal<AssignmentBatchSummary | null>(null);
  readonly batchItems = signal<AssignmentBatchItemResult[]>([]);

  readonly selectedLeader = computed<AssignmentUser | null>(() => {
    const leaderId = this.selectedLeaderId();
    if (!leaderId) {
      return null;
    }

    return this.leaders().find((leader) => leader.id === leaderId) ?? null;
  });

  readonly rightListUsers = computed<Array<{ user: AssignmentUser; pending: boolean }>>(() => {
    const persisted = this.assignedUsers().map((user) => ({ user, pending: false }));
    const pending = this.pendingUsers().map((user) => ({ user, pending: true }));
    console.log(...persisted, ...pending);
    return [...persisted, ...pending];
  });

  ngOnInit(): void {
    this.loadCatalogs();
  }

  loadCatalogs(): void {
    this.isLoadingCatalogs.set(true);

    forkJoin({
      leaders: this.userAssignmentService.getLeaders(),
      assignableUsers: this.userAssignmentService.getAssignableUsers(),
    }).pipe(
      finalize(() => this.isLoadingCatalogs.set(false))
    ).subscribe({
      next: ({ leaders, assignableUsers }) => {
        this.leaders.set(this.sortUsers(leaders));
        this.allAssignableUsers.set(this.sortUsers(assignableUsers));
      },
      error: (error) => {
        this.toastr.error(this.resolveHttpErrorMessage(error, 'No se pudieron cargar los catálogos de asignación.'), 'Error');
      }
    });
  }

  onLeaderChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const parsedLeaderId = Number.parseInt(value, 10);
    const leaderId = Number.isNaN(parsedLeaderId) ? null : parsedLeaderId;

    this.selectedLeaderId.set(leaderId);
    this.batchSummary.set(null);
    this.batchItems.set([]);
    this.pendingUsers.set([]);

    if (!leaderId) {
      this.assignedUsers.set([]);
      this.rebuildAvailableUsers();
      return;
    }

    const leader = this.leaders().find((item) => item.id === leaderId);
    if (!leader || !this.isCsLeader(leader)) {
      this.toastr.error('El usuario seleccionado no tiene rol CS LEADER.', 'Validación');
      this.selectedLeaderId.set(null);
      this.assignedUsers.set([]);
      this.rebuildAvailableUsers();
      return;
    }

    this.loadAssignedUsers(leaderId);
  }

  addUserToPending(user: AssignmentUser): void {
    const leaderId = this.selectedLeaderId();
    if (!leaderId) {
      this.toastr.warning('Primero selecciona un líder.', 'Asignación');
      return;
    }

    if (!this.isAssignableRole(user)) {
      this.toastr.error('Solo se pueden asignar usuarios REQUESTER, PROCESSOR o REQUESTER / PROCESSOR.', 'Validación');
      return;
    }

    if (user.id === leaderId) {
      this.toastr.error('leaderUserId y assignedUserId no pueden ser iguales.', 'Validación');
      return;
    }

    const existsInPending = this.pendingUsers().some((pendingUser) => pendingUser.id === user.id);
    if (existsInPending) {
      return;
    }

    this.pendingUsers.update((current) => this.sortUsers([...current, user]));
    this.rebuildAvailableUsers();
  }

  removeFromRight(user: AssignmentUser, pending: boolean): void {
    if (pending) {
      this.pendingUsers.update((current) => current.filter((item) => item.id !== user.id));
      this.rebuildAvailableUsers();
      return;
    }

    this.unassignUser(user);
  }

  saveAssignments(): void {
    const leaderId = this.selectedLeaderId();
    const pending = this.pendingUsers();

    if (!leaderId) {
      this.toastr.warning('Selecciona un líder antes de guardar.', 'Asignación');
      return;
    }

    const leader = this.selectedLeader();
    if (!leader || !this.isCsLeader(leader)) {
      this.toastr.error('El líder seleccionado no es CS LEADER.', 'Validación');
      return;
    }

    if (pending.length < 1) {
      this.toastr.warning('Debes agregar al menos un usuario para asignar.', 'Asignación');
      return;
    }

    const assignments: AssignUserPayload[] = pending.map((user) => ({
      leaderUserId: leaderId,
      assignedUserId: user.id,
    }));

    const invalidBySameUser = assignments.some((item) => item.leaderUserId === item.assignedUserId);
    if (invalidBySameUser) {
      this.toastr.error('Hay registros donde leaderUserId y assignedUserId son iguales.', 'Validación');
      return;
    }

    const hasInvalidRole = pending.some((user) => !this.isAssignableRole(user));
    if (hasInvalidRole) {
      this.toastr.error('Hay usuarios con rol no permitido para asignación.', 'Validación');
      return;
    }

    this.isSavingAssignments.set(true);

    this.userAssignmentService.assignUsersBatch({ assignments }).pipe(
      finalize(() => this.isSavingAssignments.set(false))
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

        this.loadAssignedUsers(leaderId);
      },
      error: (error) => {
        this.toastr.error(this.resolveHttpErrorMessage(error, 'No se pudieron procesar las asignaciones.'), 'Error');
      }
    });
  }

  private loadAssignedUsers(leaderId: number): void {
    this.isLoadingAssignedUsers.set(true);

    this.userAssignmentService.getAssignedUsers(leaderId).pipe(
      finalize(() => this.isLoadingAssignedUsers.set(false))
    ).subscribe({
      next: (assignedUsers) => {
        this.assignedUsers.set(this.sortUsers(assignedUsers));
        this.rebuildAvailableUsers();
      },
      error: (error) => {
        this.assignedUsers.set([]);
        this.rebuildAvailableUsers();
        this.toastr.error(this.resolveHttpErrorMessage(error, 'No se pudieron cargar los usuarios asignados.'), 'Error');
      }
    });
  }

  private unassignUser(user: AssignmentUser): void {
    const leaderId = this.selectedLeaderId();
    if (!leaderId) {
      this.toastr.warning('Selecciona un líder antes de desasignar.', 'Desasignación');
      return;
    }

    this.unassigningUserId.set(user.id);

    this.userAssignmentService.unassignUser(leaderId, user.id).pipe(
      finalize(() => this.unassigningUserId.set(null))
    ).subscribe({
      next: () => {
        this.assignedUsers.update((current) => current.filter((item) => item.id !== user.id));
        this.rebuildAvailableUsers();
        this.toastr.success('Usuario desasignado correctamente.', 'Desasignación');
      },
      error: (error) => {
        this.toastr.error(this.resolveHttpErrorMessage(error, 'No se pudo desasignar el usuario.'), 'Error');
      }
    });
  }

  private applyBatchResult(items: AssignmentBatchItemResult[], snapshotPending: AssignmentUser[]): void {
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

    const successfulUsers = snapshotPending.filter((user) => successfulIds.has(user.id));
    const failedUsers = snapshotPending.filter((user) => failedIds.has(user.id));
    const withoutItemResult = snapshotPending.filter((user) => !successfulIds.has(user.id) && !failedIds.has(user.id));

    this.assignedUsers.update((current) => this.sortUsers(this.mergeUniqueUsers(current, successfulUsers)));
    this.pendingUsers.set(this.sortUsers([...failedUsers, ...withoutItemResult]));
    this.rebuildAvailableUsers();
  }

  private rebuildAvailableUsers(): void {
    const assignedIds = new Set(this.assignedUsers().map((user) => user.id));
    const pendingIds = new Set(this.pendingUsers().map((user) => user.id));

    const available = this.allAssignableUsers().filter((user) => !assignedIds.has(user.id) && !pendingIds.has(user.id));
    this.availableUsers.set(this.sortUsers(available));
    console.log("🚀 ~ AssignUser ~ rebuildAvailableUsers ~ this.availableUsers:", this.availableUsers())
  }

  private mergeUniqueUsers(base: AssignmentUser[], incoming: AssignmentUser[]): AssignmentUser[] {
    const byId = new Map<number, AssignmentUser>();

    for (const user of base) {
      byId.set(user.id, user);
    }

    for (const user of incoming) {
      byId.set(user.id, user);
    }

    return Array.from(byId.values());
  }

  private sortUsers(users: AssignmentUser[]): AssignmentUser[] {
    return [...users].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }));
  }

  private isCsLeader(user: AssignmentUser): boolean {
    return this.normalizeRoleName(user.role?.roleName).includes('CS LEADER');
  }

  private isAssignableRole(user: AssignmentUser): boolean {
    const role = this.normalizeRoleName(user.role?.roleName);
    return role === 'REQUESTER' || role === 'PROCESSOR' || role === 'REQUESTER/PROCESSOR';
  }

  private normalizeRoleName(roleName?: string): string {
    if (!roleName) {
      return '';
    }

    return roleName
      .trim()
      .toUpperCase()
      .replace(/\s*\/\s*/g, '/');
  }

  private resolveHttpErrorMessage(error: unknown, defaultMessage: string): string {
    const status = this.readStatusCode(error);
    const backendMessage = this.readBackendMessage(error);

    if (backendMessage) {
      return backendMessage;
    }

    if (status === 401) {
      return 'Sesión inválida. Inicia sesión nuevamente.';
    }

    if (status === 403) {
      return 'No tienes permisos para gestionar asignaciones.';
    }

    if (status === 404) {
      return 'No se encontró el líder o la asignación solicitada.';
    }

    if (status === 422) {
      return 'Se detectó un error de validación o de regla de negocio.';
    }

    if (status === 500) {
      return 'El servidor presentó un error interno. Intenta nuevamente.';
    }

    return defaultMessage;
  }

  private readStatusCode(error: unknown): number | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const status = (error as { status?: number }).status;
    return typeof status === 'number' ? status : null;
  }

  private readBackendMessage(error: unknown): string | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const maybeError = error as { error?: { message?: string } };
    const message = maybeError.error?.message;
    return typeof message === 'string' && message.trim().length > 0 ? message : null;
  }

}
