import { Component, input, output } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { Role } from '../../../../../../data/interfaces/User';

@Component({
  selector: 'app-add-step-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './add-step-modal.html'
})
export class AddStepModal {
  readonly open = input<boolean>(false);
  readonly stepForm = input.required<FormGroup>();
  readonly isStepNumberLocked = input<boolean>(false);
  readonly availableRoles = input<Role[]>([]);
  readonly permissionsOptions = input<string[]>([]);

  readonly openChange = output<boolean>();
  readonly primaryAction = output<void>();
  readonly permissionsChange = output<Event>();
}
