import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { PendingApprovals } from '../pending-approvals/pending-approvals';

@Component({
  selector: 'app-pending-approvals-modal',
  imports: [TranslatePipe, Modal, PendingApprovals],
  templateUrl: './pending-approvals-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingApprovalsModal {
  readonly open = input<boolean>(false);

  readonly closed = output<void>();
  readonly resolved = output<void>();
}
