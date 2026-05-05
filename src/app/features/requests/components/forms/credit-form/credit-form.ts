import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TabsContainer } from "../../../../../shared/components/ui/tab/tab-container/tab-container";
import { Tab } from "../../../../../shared/components/ui/tab/tab";
import { TranslatePipe } from '@ngx-translate/core';
import { Autocomplete } from "../../../../../shared/components/ui/autocomplete/autocomplete";
import { BaseRequestForm } from '../../shared/base-request-form';
import { RequestService } from '../../../../../core/services/request-service';
import { CustomerService } from '../../../../../core/services/customer-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';

@Component({
  selector: 'app-credit-form',
  imports: [ReactiveFormsModule, CommonModule, TabsContainer, Tab, TranslatePipe, Autocomplete, Spinner],
  templateUrl: './credit-form.html',
  styleUrl: './credit-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditForm extends BaseRequestForm {
  constructor(
    requestService: RequestService,
    customerService: CustomerService,
    toastService: ToastService,
  ) {
    super(requestService, customerService, toastService);
  }
}
