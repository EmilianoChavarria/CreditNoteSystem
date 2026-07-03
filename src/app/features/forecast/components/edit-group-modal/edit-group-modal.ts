import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ClientGroup, ForecastService } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-edit-group-modal',
  imports: [TranslatePipe, Modal, FormsModule],
  templateUrl: './edit-group-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditGroupModal {
  private readonly forecastService = inject(ForecastService);

  readonly open = input<boolean>(false);
  readonly group = input<ClientGroup | null>(null);

  readonly openChange = output<boolean>();
  readonly updated = output<ClientGroup>();

  readonly name = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  private readonly resetEffect = effect(() => {
    const group = this.group();
    if (this.open() && group) {
      this.name.set(group.name);
      this.error.set(null);
    }
  });

  onSave(): void {
    const group = this.group();
    const name = this.name().trim();
    if (!group || !name || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);
    this.forecastService.updateClientGroup(group.id, { name })
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
