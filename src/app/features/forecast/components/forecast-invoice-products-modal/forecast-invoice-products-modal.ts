import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { InvoiceProductsBreakdown, InvoiceProductsEntry } from '../../../../core/services/forecast.service';

const EMPTY_BREAKDOWN: InvoiceProductsBreakdown = {
  totalFacturado: 0,
  totalNoRodamientos: 0,
  totalConsiderado: 0,
};

@Component({
  selector: 'app-forecast-invoice-products-modal',
  imports: [TranslatePipe, Modal, DecimalPipe, DatePipe],
  templateUrl: './forecast-invoice-products-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastInvoiceProductsModal {
  readonly open = input<boolean>(false);
  readonly clientName = input<string>('');
  readonly folio = input<string>('');
  readonly loading = input<boolean>(false);
  readonly entry = input<InvoiceProductsEntry | null>(null);

  readonly closed = output<void>();

  readonly products = computed(() => this.entry()?.products ?? []);

  readonly breakdown = computed<InvoiceProductsBreakdown>(() => this.entry()?.breakdown ?? EMPTY_BREAKDOWN);

  readonly hasExclusions = computed(() => this.breakdown().totalNoRodamientos > 0);

  /** Moneda en la que vienen los importes convertidos y los totales del desglose. */
  readonly moneda = computed(() => this.entry()?.moneda ?? 'USD');

  /** Nota de crédito de devolución: su total resta de la venta del mes. */
  readonly esDevolucion = computed(() => (this.entry()?.signo ?? 1) < 0);
}
