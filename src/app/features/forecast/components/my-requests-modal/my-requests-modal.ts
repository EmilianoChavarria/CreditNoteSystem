import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { MyRequests } from '../my-requests/my-requests';

@Component({
  selector: 'app-my-requests-modal',
  imports: [TranslatePipe, Modal, MyRequests],
  templateUrl: './my-requests-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyRequestsModal {
  readonly open = input<boolean>(false);
  readonly refreshTrigger = input<number>(0);

  readonly closed = output<void>();
}
