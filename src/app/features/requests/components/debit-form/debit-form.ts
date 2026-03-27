import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Tab } from "../../../../shared/components/ui/tab/tab";
import { TabsContainer } from "../../../../shared/components/ui/tab/tab-container/tab-container";
import { Autocomplete } from "../../../../shared/components/ui/autocomplete/autocomplete";
import { TranslatePipe } from '@ngx-translate/core';
import { TitleCasePipe } from '@angular/common';
import { BaseRequestForm } from '../shared/base-request-form';
import { RequestService } from '../../../../core/services/request-service';
import { CustomerService } from '../../../../core/services/customer-service';
import { ToastService } from '../../../../core/services/toast-service';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';

@Component({
  selector: 'app-debit-form',
  imports: [Tab, TabsContainer, Autocomplete, ReactiveFormsModule, TranslatePipe, TitleCasePipe, Spinner],
  templateUrl: './debit-form.html',
  styleUrl: './debit-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebitForm extends BaseRequestForm {
  constructor(
    requestService: RequestService,
    customerService: CustomerService,
    toastService: ToastService,
  ) {
    super(requestService, customerService, toastService);
  }
}
