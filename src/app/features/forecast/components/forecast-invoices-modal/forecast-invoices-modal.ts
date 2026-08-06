import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { Invoice, InvoiceSection } from '../../../../core/services/forecast.service';

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
  readonly sections = input<InvoiceSection[]>([]);
  readonly loading = input<boolean>(false);
  readonly exporting = input<boolean>(false);

  readonly closed = output<void>();
  readonly exportRequested = output<void>();
  readonly viewProducts = output<{ clientId: number; clientName: string; folio: string }>();

  readonly selectedClientId = signal<number | null>(null);

  private readonly selectDefaultEffect = effect(() => {
    const sections = this.sections();
    if (sections.length === 0) {
      this.selectedClientId.set(null);
      return;
    }
    if (sections.some(s => s.clientId === this.selectedClientId())) return;
    this.selectedClientId.set((sections.find(s => s.invoices.length > 0) ?? sections[0]).clientId);
  });

  readonly isMultiClient = computed(() => this.sections().length > 1);

  readonly selectedSection = computed<InvoiceSection | null>(() => {
    const sections = this.sections();
    if (sections.length === 0) return null;
    return sections.find(s => s.clientId === this.selectedClientId()) ?? sections[0];
  });

  readonly selectedInvoices = computed(() => this.selectedSection()?.invoices ?? []);

  readonly totalInvoiceCount = computed(() => this.sections().reduce((s, sec) => s + sec.invoices.length, 0));

  selectClient(clientId: number): void {
    this.selectedClientId.set(clientId);
  }

  onViewProducts(inv: Invoice): void {
    const section = this.selectedSection();
    if (!section) return;
    this.viewProducts.emit({ clientId: section.clientId, clientName: section.razonSocial || this.clientName(), folio: inv.folio });
  }

  grandTotal(): number {
    return this.selectedInvoices().reduce((s, inv) => s + Number(inv.total) * inv.signo, 0);
  }

  grandSubTotal(): number {
    return this.selectedInvoices().reduce((s, inv) => s + Number(inv.subTotal) * inv.signo, 0);
  }

  grandIva(): number {
    return this.selectedInvoices().reduce((s, inv) => s + Number(inv.iva) * inv.signo, 0);
  }

  /** Suma de facturas (signo +1). */
  totalFacturas(): number {
    return this.selectedInvoices()
      .filter(inv => inv.signo > 0)
      .reduce((s, inv) => s + Number(inv.total), 0);
  }

  /** Suma de notas de crédito de devolución (signo -1) — se muestra en positivo y se resta del total. */
  totalDevoluciones(): number {
    return this.selectedInvoices()
      .filter(inv => inv.signo < 0)
      .reduce((s, inv) => s + Number(inv.total), 0);
  }
}
