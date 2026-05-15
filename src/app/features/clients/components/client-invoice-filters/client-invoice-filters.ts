import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ChargeTypeOption } from '../../../../core/services/customer-service';

@Component({
  selector: 'app-client-invoice-filters',
  imports: [ReactiveFormsModule, LucideAngularModule],
  templateUrl: './client-invoice-filters.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientInvoiceFilters {
  readonly chargeType = input.required<FormControl<number | null>>();
  readonly search = input.required<FormControl<string>>();
  readonly chargeTypeOptions = input<ChargeTypeOption[]>([]);
  readonly clearSearch = output<void>();
}
