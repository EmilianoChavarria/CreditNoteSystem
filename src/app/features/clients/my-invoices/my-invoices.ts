import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth-service';
import {
  CustomerInvoiceSummary,
  CustomerService,
  InvoiceSearchFilters,
} from '../../../core/services/customer-service';
import { map, take } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';

interface CustomerInvoice {
  id: string;
  folio: string;
  serie: string;
  invoiceNumber: string;
  date: string;
  status: string;
  tipoComprobante: string;
  receptorRfc: string;
  receptorNombre: string;
  moneda: string;
  total: number;
  uuid: string;
}

@Component({
  selector: 'app-my-invoices',
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './my-invoices.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyInvoices {
  private readonly authService = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentClientId = signal<string>('');
  protected readonly isSearching = signal<boolean>(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly hasSearched = signal<boolean>(false);
  protected readonly invoices = signal<CustomerInvoice[]>([]);
  protected readonly downloadingKeys = signal<Set<string>>(new Set());

  protected readonly searchForm = new FormGroup({
    uuid: new FormControl<string>('', { nonNullable: true }),
    folio: new FormControl<string>('', { nonNullable: true }),
    receptorId: new FormControl<string>('', { nonNullable: true }),
    receptorRfc: new FormControl<string>('', { nonNullable: true }),
    receptorNombre: new FormControl<string>('', { nonNullable: true }),
    moneda: new FormControl<string>('', { nonNullable: true }),
    fechaInicial: new FormControl<string>('', { nonNullable: true }),
    fechaFinal: new FormControl<string>('', { nonNullable: true }),
  });

  protected readonly invoiceCount = computed(() => this.invoices().length);

  constructor() {
    this.authService.user$.pipe(
      map(user => {
        const clientId = user?.clientId;
        return typeof clientId === 'string' ? clientId.trim() : '';
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(clientId => {
      this.currentClientId.set(clientId);
    });
  }

  protected search(): void {
    const clientId = this.currentClientId();
    if (!clientId || this.isSearching()) return;

    const raw = this.searchForm.getRawValue();
    const filters: InvoiceSearchFilters = {
      uuid: raw.uuid || undefined,
      folio: raw.folio || undefined,
      receptorId: raw.receptorId || undefined,
      receptorRfc: raw.receptorRfc || undefined,
      receptorNombre: raw.receptorNombre || undefined,
      moneda: raw.moneda || undefined,
      fechaInicial: raw.fechaInicial || undefined,
      fechaFinal: raw.fechaFinal || undefined,
    };

    this.isSearching.set(true);
    this.searchError.set(null);
    this.invoices.set([]);

    this.customerService
      .searchInvoicesByClientId(clientId, filters)
      .pipe(take(1))
      .subscribe({
        next: summaries => {
          this.invoices.set(summaries.map(s => this.toCustomerInvoice(s)));
          this.hasSearched.set(true);
          this.isSearching.set(false);
        },
        error: (error: unknown) => {
          const apiMessage = (error as { error?: { message?: string } })?.error?.message;
          this.searchError.set(apiMessage?.trim() || 'No fue posible realizar la busqueda.');
          this.hasSearched.set(true);
          this.isSearching.set(false);
        },
      });
  }

  protected clear(): void {
    this.searchForm.reset();
    this.invoices.set([]);
    this.searchError.set(null);
    this.hasSearched.set(false);
  }

  protected isDownloading(key: string): boolean {
    return this.downloadingKeys().has(key);
  }

  protected downloadXml(invoice: CustomerInvoice): void {
    const key = `${invoice.id}-xml`;
    if (!invoice.id || this.downloadingKeys().has(key)) return;

    this.downloadingKeys.update(s => new Set([...s, key]));

    this.customerService.downloadInvoiceXml(invoice.id).pipe(take(1)).subscribe({
      next: (blob) => {
        const filename = `Factura_${invoice.invoiceNumber}.xml`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingKeys.update(s => { const n = new Set(s); n.delete(key); return n; });
      },
      error: () => {
        this.downloadingKeys.update(s => { const n = new Set(s); n.delete(key); return n; });
      },
    });
  }

  protected statusClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'emitido') return 'bg-green-100 text-green-700';
    if (s === 'cancelado') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-600';
  }


  private toCustomerInvoice(invoice: CustomerInvoiceSummary): CustomerInvoice {
    const serie = (invoice.serie ?? '').trim();
    const folio = (invoice.folio ?? '').trim();
    const emissionDate = (invoice.fechaEmision ?? '').trim();

    return {
      id: invoice.id,
      folio,
      serie,
      invoiceNumber: [serie, folio].filter(Boolean).join('-') || invoice.id,
      date: emissionDate ? emissionDate.slice(0, 10) : '',
      status: invoice.status ?? '',
      tipoComprobante: invoice.tipoComprobante ?? '',
      receptorRfc: invoice.receptorRfc ?? '',
      receptorNombre: invoice.receptorNombre ?? '',
      moneda: invoice.moneda ?? '',
      total: Number(invoice.total) || 0,
      uuid: invoice.UUID ?? '',
    };
  }
}
