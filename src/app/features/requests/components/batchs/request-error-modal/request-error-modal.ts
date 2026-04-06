import { Component, input, output } from '@angular/core';
import { Modal } from '../../../../../shared/components/ui/modal/modal';
import { TranslatePipe } from '@ngx-translate/core';

interface RequestHistoryRow {
  requestNumber: string;
  status: string;
  errorMessage?: string;
}

@Component({
  selector: 'app-request-error-modal',
  imports: [Modal, TranslatePipe],
  templateUrl: './request-error-modal.html',
})
export class RequestErrorModal {
  open = input.required<boolean>();
  selectedRequestError = input<RequestHistoryRow | null>(null);

  openChange = output<boolean>();
}
