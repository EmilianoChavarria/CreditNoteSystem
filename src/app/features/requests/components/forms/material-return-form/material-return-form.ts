import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RequestService } from '../../../../../core/services/request-service';
import { CustomerService, ReturnOrderListEntry, ReturnOrderListItem } from '../../../../../core/services/customer-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { BaseRequestForm } from '../../shared/base-request-form';
import { TabsContainer } from '../../../../../shared/components/ui/tab/tab-container/tab-container';
import { Tab } from '../../../../../shared/components/ui/tab/tab';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Autocomplete } from '../../../../../shared/components/ui/autocomplete/autocomplete';
import { CurrencyPipe, TitleCasePipe } from '@angular/common';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';

@Component({
  selector: 'app-material-return-form',
  imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, Autocomplete, TitleCasePipe, CurrencyPipe, Spinner],
  templateUrl: './material-return-form.html',
  styleUrl: './material-return-form.css',
})
export class MaterialReturnForm extends BaseRequestForm {
  private readonly route = inject(ActivatedRoute);

  protected readonly orderId = signal<number | null>(null);
  protected readonly materialList = signal<ReturnOrderListItem[]>([]);
  protected readonly isLoadingMaterialList = signal<boolean>(false);
  protected readonly materialListError = signal<string | null>(null);

  constructor(
    requestService: RequestService,
    customerService: CustomerService,
    toastService: ToastService,
  ) {
    super(requestService, customerService, toastService);
  }

  protected override getFormOptions() {
    return {
      includeOrderNumber: false,
      includeCreditNumber: false,
      includeStatus: false,
    };
  }

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadMaterialListFromOrderId();
  }

  private loadMaterialListFromOrderId(): void {
    const rawOrderId = this.route.snapshot.queryParamMap.get('orderId');
    const parsedOrderId = Number(rawOrderId);

    if (!Number.isFinite(parsedOrderId) || parsedOrderId <= 0) {
      this.orderId.set(null);
      this.materialList.set([]);
      this.materialListError.set(null);
      return;
    }

    this.orderId.set(parsedOrderId);
    this.isLoadingMaterialList.set(true);
    this.materialListError.set(null);

    this._customerService.getReturnOrderById(parsedOrderId).subscribe({
      next: (order: ReturnOrderListEntry | null) => {
        this.materialList.set(order?.items ?? []);
        this.isLoadingMaterialList.set(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.materialListError.set(apiMessage?.trim() || 'No fue posible cargar la lista de materiales de la orden.');
        this.materialList.set([]);
        this.isLoadingMaterialList.set(false);
      },
    });
  }
}
