import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { Invoice } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-forecast-invoices-modal',
  imports: [TranslatePipe, Modal, DecimalPipe, DatePipe],
  templateUrl: './forecast-invoices-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastInvoicesModal {
  readonly open = input<boolean>(false);
  readonly clientName = input<string>('');
  readonly monthLabel = input<string>('');
  readonly invoices = input<Invoice[]>([]);
  readonly loading = input<boolean>(false);

  readonly closed = output<void>();

  grandTotal(): number {
    return this.invoices().reduce((s, inv) => s + parseFloat(inv.total), 0);
  }

  grandSubTotal(): number {
    return this.invoices().reduce((s, inv) => s + parseFloat(inv.subTotal), 0);
  }

  grandIva(): number {
    return this.invoices().reduce((s, inv) => s + parseFloat(inv.iva), 0);
  }
}
