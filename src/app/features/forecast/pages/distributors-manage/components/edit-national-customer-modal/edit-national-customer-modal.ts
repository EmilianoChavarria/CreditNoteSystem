import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { finalize, forkJoin, Observable } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import {
  CUSTOMER_CURRENCIES,
  CustomerCurrency,
  ForecastClient,
  ForecastService,
  UpdateClientExtPayload,
} from '../../../../../../core/services/forecast.service';
import { SalesUserOption, UserService } from '../../../../../../core/services/user-service';
import { SelectOption, UiSelect } from '../../../../../../shared/components/ui/select/select';

@Component({
  selector: 'app-edit-national-customer-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal, UiSelect],
  templateUrl: './edit-national-customer-modal.html',
})
export class EditNationalCustomerModal {
  private readonly forecastService = inject(ForecastService);
  private readonly userService = inject(UserService);
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
  readonly currency = signal<CustomerCurrency | ''>('');

  readonly currencies = CUSTOMER_CURRENCIES;

  readonly salesEngineerId = signal('');
  readonly salesManagerId = signal('');
  readonly salesEngineers = signal<SalesUserOption[]>([]);
  readonly salesManagers = signal<SalesUserOption[]>([]);
  readonly loadingSalesUsers = signal(false);
  private salesUsersLoaded = false;

  readonly salesEngineerOptions = computed<SelectOption[]>(() =>
    this.salesEngineers().map(u => ({ value: u.id, label: u.fullName }))
  );

  readonly salesManagerOptions = computed<SelectOption[]>(() =>
    this.salesManagers().map(u => ({ value: u.id, label: u.fullName }))
  );

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
      this.currency.set(c?.currency ?? '');
      this.salesEngineerId.set(c?.salesEngineerId != null ? String(c.salesEngineerId) : '');
      this.salesManagerId.set(c?.salesManagerId != null ? String(c.salesManagerId) : '');
      if (c?.idCliente) {
        this.loadCurrent(c.idCliente);
      }

      if (!this.salesUsersLoaded) {
        this.salesUsersLoaded = true;
        this.loadSalesUsers();
      }
    });
  }

  private loadSalesUsers(): void {
    this.loadingSalesUsers.set(true);
    this.userService.getSalesEngineers().subscribe({
      next: (users) => this.salesEngineers.set(users),
      error: () => this.salesEngineers.set([]),
    });
    this.userService.getSalesManagers()
      .pipe(finalize(() => this.loadingSalesUsers.set(false)))
      .subscribe({
        next: (users) => this.salesManagers.set(users),
        error: () => this.salesManagers.set([]),
      });
  }

  /** Solo viajan los responsables que el usuario cambió, para no pisar los ya guardados. */
  private buildExtPayload(client: ForecastClient): UpdateClientExtPayload {
    const payload: UpdateClientExtPayload = {};

    const engineerId = this.salesEngineerId() ? Number(this.salesEngineerId()) : null;
    const managerId = this.salesManagerId() ? Number(this.salesManagerId()) : null;

    if (engineerId !== (client.salesEngineerId ?? null)) payload.salesEngineerId = engineerId;
    if (managerId !== (client.salesManagerId ?? null)) payload.salesManagerId = managerId;

    return payload;
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
          this.currency.set(match.currency ?? '');
        },
        error: () => {},
      });
  }

  onSave(): void {
    if (this.saving() || this.loadingCurrent()) return;

    const client = this.client();
    const customerNumber = client?.idCliente;
    if (!client || !customerNumber) return;

    const emails = this.emails().trim();
    const rawPercentage = this.returnPercentage().trim();
    const returnPercentage = rawPercentage === '' ? undefined : parseFloat(rawPercentage);
    if (returnPercentage !== undefined && (isNaN(returnPercentage) || returnPercentage < 0 || returnPercentage > 100)) {
      this.toastr.error(this.translate.instant('FORECAST.EDIT_NATIONAL_CUSTOMER.INVALID_PERCENTAGE'));
      return;
    }

    // La moneda solo viaja si el usuario eligió una: así no se borra la ya guardada.
    const currency = this.currency() || undefined;

    const extPayload = this.buildExtPayload(client);
    const requests: Observable<unknown>[] = [
      this.forecastService.updateNationalCustomer(customerNumber, { emails, returnPercentage, currency }),
    ];
    if (Object.keys(extPayload).length > 0) {
      requests.push(this.forecastService.updateClientExt(customerNumber, extPayload));
    }

    this.saving.set(true);
    forkJoin(requests)
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
