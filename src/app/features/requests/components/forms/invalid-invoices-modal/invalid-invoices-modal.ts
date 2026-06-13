import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modal } from '../../../../../shared/components/ui/modal/modal';

@Component({
  selector: 'app-invalid-invoices-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  templateUrl: './invalid-invoices-modal.html',
})
export class InvalidInvoicesModal {
  open = input.required<boolean>();
  invoices = input<string[]>([]);
  message = input<string>('Facturas inválidas o sin status "Emitido"');

  openChange = output<boolean>();
}
