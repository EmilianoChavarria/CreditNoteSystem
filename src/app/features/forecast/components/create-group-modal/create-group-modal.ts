import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ClientGroup, ForecastService } from '../../../../core/services/forecast.service';
import { SalesEngineerAssignmentService } from '../../../../core/services/sales-engineer-assignment.service';
import { AssignmentUser } from '../../../../core/services/user-assignment-service';
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

  readonly open = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly created = output<ClientGroup>();

  readonly name = signal('');
  readonly description = signal('');
  readonly responsibleUserId = signal('');
  readonly engineers = signal<AssignmentUser[]>([]);
  readonly loadingEngineers = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly engineerOptions = computed<SelectOption[]>(() =>
    this.engineers().map((engineer) => ({ value: engineer.id, label: `${engineer.fullName} - ${engineer.role?.roleName}` }))
  );

  private readonly resetEffect = effect(() => {
    if (this.open()) {
      this.name.set('');
      this.description.set('');
      this.responsibleUserId.set('');
      this.error.set(null);
      this.loadEngineers();
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

  onSave(): void {
    const name = this.name().trim();
    if (!name || this.saving()) return;

    const payload: { name: string; responsibleUserId?: number } = { name };
    const responsibleUserId = Number(this.responsibleUserId());
    if (this.responsibleUserId() && Number.isFinite(responsibleUserId)) {
      payload.responsibleUserId = responsibleUserId;
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
