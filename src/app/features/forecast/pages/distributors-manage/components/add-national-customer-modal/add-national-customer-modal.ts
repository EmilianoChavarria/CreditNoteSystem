import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Modal } from '../../../../../../shared/components/ui/modal/modal';
import {
  CUSTOMER_CURRENCIES,
  CustomerCurrency,
  ForecastService,
  NationalCustomerCandidate,
} from '../../../../../../core/services/forecast.service';

@Component({
  selector: 'app-add-national-customer-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, Modal],
  templateUrl: './add-national-customer-modal.html',
})
export class AddNationalCustomerModal {
  private readonly forecastService = inject(ForecastService);
  private readonly toastr = inject(ToastrService);
  private readonly translate = inject(TranslateService);

  readonly open = input<boolean>(false);

  readonly openChange = output<boolean>();
  readonly saved = output<void>();

  readonly searching = signal(false);
  readonly saving = signal(false);
  readonly term = signal('');
  readonly candidates = signal<NationalCustomerCandidate[]>([]);
  readonly selected = signal<NationalCustomerCandidate | null>(null);

  readonly emails = signal('');
  readonly returnPercentage = signal('');
  readonly currency = signal<CustomerCurrency | ''>('');

  readonly currencies = CUSTOMER_CURRENCIES;

  private readonly term$ = new Subject<string>();
  private wasOpen = false;

  constructor() {
    this.term$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          this.searching.set(true);
          return this.forecastService
            .searchNationalCustomerCandidates(term)
            .pipe(finalize(() => this.searching.set(false)));
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (results) => this.candidates.set(results),
        error: () => this.candidates.set([]),
      });

    effect(() => {
      const isOpen = this.open();
      if (!isOpen) {
        this.wasOpen = false;
        return;
      }
      if (this.wasOpen) return;
      this.wasOpen = true;

      this.reset();
      this.term$.next('');
    });
  }

  onTermInput(value: string): void {
    this.term.set(value);
    this.term$.next(value.trim());
  }

  select(candidate: NationalCustomerCandidate): void {
    this.selected.set(candidate);
  }

  clearSelection(): void {
    this.selected.set(null);
  }

  onSave(): void {
    const candidate = this.selected();
    if (!candidate || this.saving()) return;

    const rawPercentage = this.returnPercentage().trim();
    const returnPercentage = rawPercentage === '' ? undefined : parseFloat(rawPercentage);
    if (returnPercentage !== undefined && (isNaN(returnPercentage) || returnPercentage < 0 || returnPercentage > 100)) {
      this.toastr.error(this.translate.instant('FORECAST.EDIT_NATIONAL_CUSTOMER.INVALID_PERCENTAGE'));
      return;
    }

    const emails = this.emails().trim();

    this.saving.set(true);
    this.forecastService
      .createNationalCustomer({
        customerNumber: candidate.customerNumber,
        emails: emails || undefined,
        returnPercentage,
        currency: this.currency() || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.toastr.success(this.translate.instant('FORECAST.ADD_NATIONAL_CUSTOMER.SAVE_SUCCESS'));
          this.openChange.emit(false);
          this.saved.emit();
        },
        error: (err) => {
          this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.ADD_NATIONAL_CUSTOMER.SAVE_ERROR'));
        },
      });
  }

  private reset(): void {
    this.term.set('');
    this.candidates.set([]);
    this.selected.set(null);
    this.emails.set('');
    this.returnPercentage.set('');
    this.currency.set('');
  }
}
