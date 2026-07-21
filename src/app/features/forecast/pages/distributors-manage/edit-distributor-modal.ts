import { ChangeDetectionStrategy, Component, input, output, signal, effect, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ForecastClient, ForecastService, UpdateDistributorPayload } from '../../../../core/services/forecast.service';

export interface AddressParts {
  calle: string;
  noExterior: string;
  noInterior: string;
  colonia: string;
  localidad: string;
  municipio: string;
  estado: string;
  cp: string;
  pais: string;
  referencia: string;
}

@Component({
  selector: 'app-edit-distributor-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal, FormsModule],
  templateUrl: './edit-distributor-modal.html',
})
export class EditDistributorModal {
  readonly countryOptions = [
    { code: 'BLZ', name: 'Belice' },
    { code: 'CRI', name: 'Costa Rica' },
    { code: 'SLV', name: 'El Salvador' },
    { code: 'GTM', name: 'Guatemala' },
    { code: 'HND', name: 'Honduras' },
    { code: 'NIC', name: 'Nicaragua' },
    { code: 'PAN', name: 'Panamá' },
    { code: 'ARG', name: 'Argentina' },
  ];

  readonly client = input<ForecastClient | null>(null);
  readonly open = input<boolean>(false);
  readonly forceDisableSave = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly saved = output<void>();

  readonly isCreate = computed(() => this.client() === null);

  readonly saving = signal(false);
  readonly showAddressAssistant = signal(false);

  readonly form = signal<UpdateDistributorPayload>({
    businessName: '',
    taxId: '',
    address: '',
    emails: '',
    clientNumber: '',
  });

  readonly addressParts = signal<AddressParts>({
    calle: '',
    noExterior: '',
    noInterior: '',
    colonia: '',
    localidad: '',
    municipio: '',
    estado: '',
    cp: '',
    pais: '',
    referencia: '',
  });

  readonly addressPreview = computed(() => this.buildAddress(this.addressParts()));

  constructor(private readonly forecastService: ForecastService) {
    effect(() => {
      const c = this.client();
      const isOpen = this.open();
      if (!isOpen) return;

      this.form.set(c ? {
        businessName: c.razonSocial ?? '',
        taxId: c.rfc ?? '',
        address: c.direccion ?? '',
        emails: c.correosForecast?.replace(/;/g, ',') ?? '',
        clientNumber: c.idCliente ?? '',
      } : {
        businessName: '',
        taxId: '',
        address: '',
        emails: '',
        clientNumber: '',
      });
      this.showAddressAssistant.set(false);
      this.addressParts.set({ calle: '', noExterior: '', noInterior: '', colonia: '', localidad: '', municipio: '', estado: '', cp: '', pais: '', referencia: '' });
    });
  }

  patchForm(field: keyof UpdateDistributorPayload, value: string): void {
    this.form.update(f => ({ ...f, [field]: value }));
  }

  patchAddressPart(field: keyof AddressParts, value: string): void {
    this.addressParts.update(p => ({ ...p, [field]: value }));
  }

  private buildAddress(parts: AddressParts): string {
    return [
      parts.calle,
      parts.noExterior,
      parts.noInterior,
      parts.colonia,
      parts.localidad,
      parts.municipio,
      parts.estado,
      parts.cp,
      parts.pais,
      parts.referencia,
    ].map(v => v.trim()).filter(Boolean).join(', ');
  }

  applyAddressAssistant(): void {
    const address = this.buildAddress(this.addressParts());
    this.form.update(f => ({ ...f, address }));
    this.showAddressAssistant.set(false);
  }

  onSave(): void {
    const client = this.client();
    if (!client || this.saving() || this.forceDisableSave()) return;

    const raw = this.form();
    const payload: UpdateDistributorPayload = {};
    if (raw.businessName?.trim()) payload.businessName = raw.businessName.trim();
    if (raw.taxId?.trim()) payload.taxId = raw.taxId.trim();
    if (raw.address?.trim()) payload.address = raw.address.trim();
    if (raw.emails?.trim()) payload.emails = raw.emails.trim();
    if (raw.clientNumber?.trim()) payload.clientNumber = raw.clientNumber.trim();

    this.saving.set(true);
    this.forecastService
      .updateDistributor(client.idCliente, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.openChange.emit(false);
          this.saved.emit();
        },
        error: (err) => console.error('Error updating distributor', err),
      });
  }
}
