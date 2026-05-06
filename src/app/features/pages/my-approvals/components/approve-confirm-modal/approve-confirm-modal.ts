import { Component, input, output } from '@angular/core';
import { Modal } from '../../../../../shared/components/ui/modal/modal';
import { Request } from '../../../../../data/interfaces/Request';
import { TranslatePipe } from '@ngx-translate/core';
import { UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-approve-confirm-modal',
  imports: [Modal, TranslatePipe],
  templateUrl: './approve-confirm-modal.html',
})
export class ApproveConfirmModal {
  readonly open = input<boolean>(false);
  readonly request = input<Request | null>(null);
  readonly isLoading = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly confirmed = output<void>();
}
