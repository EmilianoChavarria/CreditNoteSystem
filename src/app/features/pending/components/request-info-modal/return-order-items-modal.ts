import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CurrencyPipe, UpperCasePipe } from '@angular/common';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ReturnOrderRequestByRequestData } from '../../../../core/services/return-order-request-service';

@Component({
  selector: 'app-return-order-items-modal',
  imports: [Modal, TranslatePipe, CurrencyPipe, UpperCasePipe],
  templateUrl: './return-order-items-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReturnOrderItemsModal {
  readonly open = input(false);
  readonly returnOrderData = input.required<ReturnOrderRequestByRequestData>();
  readonly currency = input('MXN');

  readonly openChange = output<boolean>();
}
