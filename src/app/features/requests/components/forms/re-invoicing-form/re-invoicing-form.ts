import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TabsContainer } from '../../../../../shared/components/ui/tab/tab-container/tab-container';
import { Tab } from '../../../../../shared/components/ui/tab/tab';
import { TranslatePipe } from '@ngx-translate/core';
import { Autocomplete } from '../../../../../shared/components/ui/autocomplete/autocomplete';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';
import { RequestService } from '../../../../../core/services/request-service';
import { CustomerService } from '../../../../../core/services/customer-service';
import { ToastService } from '../../../../../core/services/toast-service';
import { BaseRequestForm } from '../../shared/base-request-form';
import { InvalidInvoicesModal } from '../invalid-invoices-modal/invalid-invoices-modal';

@Component({
  selector: 'app-re-invoicing-form',
  imports: [ReactiveFormsModule, CommonModule, TabsContainer, Tab, TranslatePipe, Autocomplete, Spinner, InvalidInvoicesModal],
  templateUrl: './re-invoicing-form.html',
  styleUrl: './re-invoicing-form.css',
})
export class ReInvoicingForm extends BaseRequestForm {
  constructor(
    requestService: RequestService,
    customerService: CustomerService,
    toastService: ToastService,
  ) {
    super(requestService, customerService, toastService);
  }
}
