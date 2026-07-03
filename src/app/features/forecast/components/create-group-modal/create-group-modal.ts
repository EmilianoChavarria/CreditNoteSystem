import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ClientGroup, ForecastService } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-create-group-modal',
  imports: [TranslatePipe, Modal, FormsModule],
  templateUrl: './create-group-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateGroupModal {
  private readonly forecastService = inject(ForecastService);

  readonly open = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly created = output<ClientGroup>();

  readonly name = signal('');
  readonly description = signal('');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  private readonly resetEffect = effect(() => {
    if (this.open()) {
      this.name.set('');
      this.description.set('');
      this.error.set(null);
    }
  });

  onSave(): void {
    const name = this.name().trim();
    if (!name || this.saving()) return;

    const payload = { name };
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
