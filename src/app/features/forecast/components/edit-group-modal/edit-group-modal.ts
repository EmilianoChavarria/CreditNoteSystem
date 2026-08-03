import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ClientGroup, ForecastService } from '../../../../core/services/forecast.service';
import { SalesEngineerAssignmentService } from '../../../../core/services/sales-engineer-assignment.service';
import { AssignmentUser } from '../../../../core/services/user-assignment-service';
import { UserService, SalesUserOption } from '../../../../core/services/user-service';
import { UiSelect, SelectOption } from '../../../../shared/components/ui/select/select';

@Component({
  selector: 'app-edit-group-modal',
  imports: [TranslatePipe, Modal, FormsModule, UiSelect],
  templateUrl: './edit-group-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditGroupModal {
  private readonly forecastService = inject(ForecastService);
  private readonly salesEngineerAssignmentService = inject(SalesEngineerAssignmentService);
  private readonly userService = inject(UserService);

  readonly open = input<boolean>(false);
  readonly group = input<ClientGroup | null>(null);

  readonly openChange = output<boolean>();
  readonly updated = output<ClientGroup>();

  readonly clientNumber = signal('');
  readonly name = signal('');
  readonly responsibleUserId = signal('');
  readonly engineers = signal<AssignmentUser[]>([]);
  readonly loadingEngineers = signal(false);
  readonly salesManagerId = signal('');
  readonly salesManagers = signal<SalesUserOption[]>([]);
  readonly loadingSalesManagers = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly engineerOptions = computed<SelectOption[]>(() =>
    this.engineers().map((engineer) => ({ value: engineer.id, label: `${engineer.fullName} - ${engineer.role?.roleName}` }))
  );

  readonly salesManagerOptions = computed<SelectOption[]>(() =>
    this.salesManagers().map((manager) => ({ value: manager.id, label: manager.fullName }))
  );

  private readonly resetEffect = effect(() => {
    const group = this.group();
    if (this.open() && group) {
      this.clientNumber.set(group.clientNumber ?? '');
      this.name.set(group.name);
      this.responsibleUserId.set(group.responsibleUserId != null ? String(group.responsibleUserId) : '');
      this.salesManagerId.set(group.salesManagerId != null ? String(group.salesManagerId) : '');
      this.error.set(null);
      this.loadEngineers();
      this.loadSalesManagers();
    }
  });

  private loadEngineers(): void {
    this.loadingEngineers.set(true);
    this.salesEngineerAssignmentService.getAllEngineers()
      .pipe(finalize(() => this.loadingEngineers.set(false)))
      .subscribe({
        next: (engineers) => this.engineers.set(engineers),
        error: () => this.engineers.set([]),
      });
  }

  private loadSalesManagers(): void {
    this.loadingSalesManagers.set(true);
    this.userService.getSalesManagers()
      .pipe(finalize(() => this.loadingSalesManagers.set(false)))
      .subscribe({
        next: (managers) => this.salesManagers.set(managers),
        error: () => this.salesManagers.set([]),
      });
  }

  onSave(): void {
    const group = this.group();
    const name = this.name().trim();
    if (!group || !name || this.saving()) return;

    const payload: { name: string; clientNumber?: string; responsibleUserId?: number; salesManagerId?: number } = { name };
    if (this.clientNumber().trim()) {
      payload.clientNumber = this.clientNumber().trim();
    }
    const responsibleUserId = Number(this.responsibleUserId());
    if (this.responsibleUserId() && Number.isFinite(responsibleUserId)) {
      payload.responsibleUserId = responsibleUserId;
    }
    const salesManagerId = Number(this.salesManagerId());
    if (this.salesManagerId() && Number.isFinite(salesManagerId)) {
      payload.salesManagerId = salesManagerId;
    }

    this.saving.set(true);
    this.error.set(null);
    this.forecastService.updateClientGroup(group.id, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.openChange.emit(false);
          this.updated.emit(updated);
        },
        error: (err) => this.error.set(err?.error?.message ?? null),
      });
  }
}
