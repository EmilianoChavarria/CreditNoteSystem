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
  selector: 'app-create-group-modal',
  imports: [TranslatePipe, Modal, FormsModule, UiSelect],
  templateUrl: './create-group-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateGroupModal {
  private readonly forecastService = inject(ForecastService);
  private readonly salesEngineerAssignmentService = inject(SalesEngineerAssignmentService);
  private readonly userService = inject(UserService);

  readonly open = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly created = output<ClientGroup>();

  readonly name = signal('');
  readonly clientNumber = signal('');
  readonly description = signal('');
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
    if (this.open()) {
      this.name.set('');
      this.clientNumber.set('');
      this.description.set('');
      this.responsibleUserId.set('');
      this.salesManagerId.set('');
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
    const name = this.name().trim();
    if (!name || this.saving()) return;

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
    this.forecastService.createClientGroup(payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (group) => {
          this.openChange.emit(false);
          this.created.emit(group);
        },
        error: (err) => this.error.set(err?.error?.message ?? null),
      });
  }
}
