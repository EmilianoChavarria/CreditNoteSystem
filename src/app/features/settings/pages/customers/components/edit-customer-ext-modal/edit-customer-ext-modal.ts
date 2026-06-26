import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { UiSelect, SelectOption } from '../../../../../../shared/components/ui/select/select';
import { Customer } from '../../../../../../data/interfaces/Customer';
import { CustomerService } from '../../../../../../core/services/customer-service';
import { UserService } from '../../../../../../core/services/user-service';

type EditExtForm = FormGroup<{
  area: FormControl<string>;
  salesEngineerId: FormControl<string>;
  salesManagerId: FormControl<string>;
  processorId: FormControl<string>;
  financeManagerId: FormControl<string>;
  marketingManagerId: FormControl<string>;
  csManagerId: FormControl<string>;
}>;

@Component({
  selector: 'app-edit-customer-ext-modal',
  imports: [Modal, UiSelect, TranslatePipe],
  templateUrl: './edit-customer-ext-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditCustomerExtModal {
  private readonly customerService = inject(CustomerService);
  private readonly userService = inject(UserService);
  private readonly toastr = inject(ToastrService);

  readonly open = input<boolean>(false);
  readonly customer = input<Customer | null>(null);

  readonly openChange = output<boolean>();
  readonly saved = output<void>();

  readonly saving = signal(false);

  readonly areaOptions: SelectOption[] = [
    { value: 'sales', label: 'Original Equipment' },
    { value: 'aftermarket', label: 'Aftermarket' },
  ];

  readonly managerOptions = signal<SelectOption[]>([]);
  readonly requesterOptions = signal<SelectOption[]>([]);

  readonly form: EditExtForm = new FormGroup({
    area: new FormControl('', { nonNullable: true }),
    salesEngineerId: new FormControl('', { nonNullable: true }),
    salesManagerId: new FormControl('', { nonNullable: true }),
    processorId: new FormControl('', { nonNullable: true }),
    financeManagerId: new FormControl('', { nonNullable: true }),
    marketingManagerId: new FormControl('', { nonNullable: true }),
    csManagerId: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.loadManagers();
    this.loadRequesters();

    effect(() => {
      const c = this.customer();
      if (!c) return;
      const ext = c.clienteExt;
      this.form.patchValue({
        area: ext?.area ?? '',
        salesEngineerId: String(ext?.salesEngineerId?.id ?? ''),
        salesManagerId: String(ext?.salesManagerId?.id ?? ''),
        processorId: String(ext?.processorId?.id ?? ''),
        financeManagerId: String(ext?.financeManagerId?.id ?? ''),
        marketingManagerId: String(ext?.marketingManagerId?.id ?? ''),
        csManagerId: String(ext?.customerServiceManagerId?.id ?? ''),
      });
    });
  }

  onSave(): void {
    const c = this.customer();
    if (!c) return;
    const v = this.form.getRawValue();
    const toNum = (s: string) => s ? parseInt(s, 10) : null;

    this.saving.set(true);
    this.customerService.updateClientExt(c.idCliente, {
      area: v.area || null,
      salesEngineerId: toNum(v.salesEngineerId),
      salesManagerId: toNum(v.salesManagerId),
      processorId: toNum(v.processorId),
      financeManagerId: toNum(v.financeManagerId),
      marketingManagerId: toNum(v.marketingManagerId),
      customerServiceManagerId: toNum(v.csManagerId),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toastr.success('Datos del cliente actualizados.', 'Éxito');
        this.saved.emit();
        this.openChange.emit(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.toastr.error(err?.error?.message ?? 'Error al guardar los datos.', 'Error');
      },
    });
  }

  private loadManagers(): void {
    this.userService.getManagers().subscribe({
      next: (users) => {
        this.managerOptions.set(users.map(u => ({ value: u.id, label: u.fullName })));
      },
      error: () => {},
    });
  }

  private loadRequesters(): void {
    this.userService.getRequesters().subscribe({
      next: (users) => {
        this.requesterOptions.set(users.map(u => ({ value: u.id, label: u.fullName })));
      },
      error: () => {},
    });
  }
}
