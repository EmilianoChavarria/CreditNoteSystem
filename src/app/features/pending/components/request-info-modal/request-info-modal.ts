import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { Request } from '../../../../data/interfaces/Request';
import { CurrencyPipe, DatePipe, UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-request-info-modal',
  imports: [Modal, TranslatePipe, DatePipe, UpperCasePipe, CurrencyPipe],
  templateUrl: './request-info-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RequestInfoModal {
  readonly open = input(false);
  readonly request = input<Request | null>(null);

  readonly openChange = output<boolean>();

  onOpenChange(isOpen: boolean): void {
    this.openChange.emit(isOpen);
  }
}
