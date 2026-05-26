import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-client-invoice-pagination',
  imports: [LucideAngularModule, TranslatePipe],
  templateUrl: './client-invoice-pagination.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientInvoicePagination {
  readonly from = input<number | null>(null);
  readonly to = input<number | null>(null);
  readonly total = input(0);
  readonly page = input(1);
  readonly lastPage = input(1);
  readonly pageNumbers = input<number[]>([]);
  readonly isLoading = input(false);
  readonly pageChange = output<number>();
}
