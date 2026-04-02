import { Component } from '@angular/core';
import { RequestService } from '../../../../../core/services/request-service';
import { CustomerService } from '../../../../../core/services/customer-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { BaseRequestForm } from '../../shared/base-request-form';
import { TabsContainer } from '../../../../../shared/components/ui/tab/tab-container/tab-container';
import { Tab } from '../../../../../shared/components/ui/tab/tab';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Autocomplete } from '../../../../../shared/components/ui/autocomplete/autocomplete';
import { TitleCasePipe } from '@angular/common';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';

@Component({
  selector: 'app-material-return-form',
  imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, Autocomplete, TitleCasePipe, Spinner],
  templateUrl: './material-return-form.html',
  styleUrl: './material-return-form.css',
})
export class MaterialReturnForm extends BaseRequestForm {
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
}
