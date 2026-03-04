import { Component, input, output } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { Spinner } from '../../../../../../shared/components/ui/spinner/spinner';
import { Role } from '../../../../../../data/interfaces/User';

@Component({
  selector: 'app-roles-manage-modal',
  imports: [Modal, Spinner, TitleCasePipe, LucideAngularModule],
  templateUrl: './roles-manage-modal.html'
})
export class RolesManageModal {
  readonly open = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
  readonly roles = input<Role[]>([]);

  readonly openChange = output<boolean>();
  readonly primaryAction = output<void>();
}
