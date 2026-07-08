import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modal } from '../../../shared/components/ui/modal/modal';

@Component({
  selector: 'app-delete-item-confirm-modal',
  imports: [Modal],
  templateUrl: './delete-item-confirm-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteItemConfirmModal {
  readonly open = input(false);
  readonly loading = input(false);

  readonly openChange = output<boolean>();
  readonly confirmed = output<void>();

  protected onOpenChange(isOpen: boolean): void {
    this.openChange.emit(isOpen);
  }

  protected onConfirm(): void {
    this.confirmed.emit();
  }
}
