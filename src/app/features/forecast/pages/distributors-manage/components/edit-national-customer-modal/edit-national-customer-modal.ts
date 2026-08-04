import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import { ForecastClient, ForecastService } from '../../../../../../core/services/forecast.service';

@Component({
  selector: 'app-edit-national-customer-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal],
  templateUrl: './edit-national-customer-modal.html',
})
export class EditNationalCustomerModal {
  private readonly forecastService = inject(ForecastService);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);

  readonly client = input<ForecastClient | null>(null);
  readonly open = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly saved = output<void>();

  readonly loadingCurrent = signal(false);
  readonly saving = signal(false);
  readonly emails = signal('');
  readonly returnPercentage = signal('');

  private wasOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.open();
      const c = this.client();
      if (!isOpen) {
        this.wasOpen = false;
        return;
      }
      if (this.wasOpen) return;
      this.wasOpen = true;

      this.emails.set(c?.correosForecast?.replace(/;/g, ',') ?? '');
      this.returnPercentage.set('');
      if (c?.idCliente) {
        this.loadCurrent(c.idCliente);
      }
    });
  }

  private loadCurrent(customerNumber: string): void {
    this.loadingCurrent.set(true);
    this.forecastService.getNationalCustomers(1, 1, customerNumber)
      .pipe(finalize(() => this.loadingCurrent.set(false)))
      .subscribe({
        next: (page) => {
          const match = page.data.find(nc => nc.customerNumber === customerNumber) ?? page.data[0] ?? null;
          if (!match) return;
          this.emails.set(match.emails ?? '');
          this.returnPercentage.set(match.returnPercentage != null ? String(match.returnPercentage) : '');
        },
        error: () => {},
      });
  }

  onSave(): void {
    if (this.saving() || this.loadingCurrent()) return;

    const customerNumber = this.client()?.idCliente;
    if (!customerNumber) return;

    const emails = this.emails().trim();
    const rawPercentage = this.returnPercentage().trim();
    const returnPercentage = rawPercentage === '' ? undefined : parseFloat(rawPercentage);
    if (returnPercentage !== undefined && (isNaN(returnPercentage) || returnPercentage < 0 || returnPercentage > 100)) {
      this.toastr.error(this.translate.instant('FORECAST.EDIT_NATIONAL_CUSTOMER.INVALID_PERCENTAGE'));
      return;
    }

    this.saving.set(true);
    this.forecastService.updateNationalCustomer(customerNumber, { emails, returnPercentage })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('FORECAST.EDIT_NATIONAL_CUSTOMER.SAVE_SUCCESS'));
          this.openChange.emit(false);
          this.saved.emit();
        },
        error: (err) => {
          this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.EDIT_NATIONAL_CUSTOMER.SAVE_ERROR'));
        },
      });
  }
}
