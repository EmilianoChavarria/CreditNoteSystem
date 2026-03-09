import { Component, input, output } from '@angular/core';
import { Modal } from "../../../../../../shared/components/ui/modal/modal";
import { Spinner } from "../../../../../../shared/components/ui/spinner/spinner";
import { UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-assign-modal',
  imports: [Modal, UpperCasePipe],
  templateUrl: './assign-modal.html',
  styleUrl: './assign-modal.css',
})
export class AssignModal {
  readonly open = input<boolean>(false);
  readonly isLoading = input<boolean>(false);
  // readonly roles = input<Role[]>([]);

  readonly openChange = output<boolean>();
  readonly primaryAction = output<void>();
}
