import { Component, input, output } from '@angular/core';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { Customer } from '../../../../../../data/interfaces/Customer';

@Component({
  selector: 'app-customer-info-modal',
  imports: [Modal],
  templateUrl: './customer-info-modal.html',
})
export class CustomerInfoModal {
  readonly open = input<boolean>(false);
  readonly customer = input<Customer | undefined>(undefined);
  readonly openChange = output<boolean>();
}
