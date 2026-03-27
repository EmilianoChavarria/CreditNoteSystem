import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TabsContainer } from "../../../../shared/components/ui/tab/tab-container/tab-container";
import { Tab } from "../../../../shared/components/ui/tab/tab";
import { TranslatePipe } from '@ngx-translate/core';
import { Autocomplete } from "../../../../shared/components/ui/autocomplete/autocomplete";
import { TitleCasePipe } from '@angular/common';
import { BaseRequestForm } from '../shared/base-request-form';
import { RequestService } from '../../../../core/services/request-service';
import { CustomerService } from '../../../../core/services/customer-service';
import { ToastService } from '../../../../core/services/toast-service';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';

@Component({
  selector: 'app-auditor-credit-form',
  imports: [TabsContainer, Tab, ReactiveFormsModule, TranslatePipe, Autocomplete, TitleCasePipe, Spinner],
  templateUrl: './auditor-credit-form.html',
  styleUrl: './auditor-credit-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditorCreditForm extends BaseRequestForm {
  constructor(
    requestService: RequestService,
    customerService: CustomerService,
    toastService: ToastService,
  ) {
    super(requestService, customerService, toastService);
  }

  protected override getFormOptions() {
    return {
      includeOrderNumber: true,
      includeCreditNumber: false,
      includeStatus: false,
    };
  }

}
