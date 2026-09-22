import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { Customer } from '../../../../../../data/interfaces/Customer';
import { CustomerService } from '../../../../../../core/services/customer-service';

@Component({
  selector: 'app-edit-customer-returns-emails-modal',
  standalone: true,
  imports: [Modal, FormsModule, TranslatePipe],
  templateUrl: './edit-customer-returns-emails-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditCustomerReturnsEmailsModal {
  private readonly customerService = inject(CustomerService);
  private readonly toastr = inject(ToastrService);

  readonly open = input<boolean>(false);
  readonly customer = input<Customer | null>(null);

  readonly openChange = output<boolean>();
  readonly saved = output<void>();

  readonly saving = signal(false);
  readonly emailsText = signal('');

  constructor() {
    effect(() => {
      const c = this.customer();
      const isOpen = this.open();
      if (!isOpen) return;

      this.emailsText.set((c?.clienteExt?.correosForecast ?? '').split(';').filter(Boolean).join(';\n'));
    });
  }

  onSave(): void {
    const c = this.customer();
    if (!c || this.saving()) return;

    const emails = this.emailsText()
      .split(/[;\n]/)
      .map(e => e.trim())
      .filter(Boolean);

    this.saving.set(true);
    this.customerService.updateReturnsEmails(c.idCliente, emails).subscribe({
      next: () => {
        this.saving.set(false);
        this.toastr.success('Correos de recordatorio actualizados.', 'Éxito');
        this.saved.emit();
        this.openChange.emit(false);
      },
      error: (err) => {
        this.saving.set(false);
        this.toastr.error(err?.error?.message ?? 'Error al guardar los correos.', 'Error');
      },
    });
  }
}
