import { Component, input, output } from '@angular/core';
import { Modal } from '../../../../../shared/components/ui/modal/modal';

interface RequestHistoryRow {
  requestNumber: string;
  status: string;
  errorMessage?: string;
}

@Component({
  selector: 'app-request-error-modal',
  imports: [Modal],
  templateUrl: './request-error-modal.html',
})
export class RequestErrorModal {
  open = input.required<boolean>();
  selectedRequestError = input<RequestHistoryRow | null>(null);

  openChange = output<boolean>();
}
