import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Classification, Customer, Reason } from '../../../../data/interfaces/Request';
import { map, Observable, Subscription } from 'rxjs';
import { RequestService } from '../../../../core/services/request-service';
import { CustomerService } from '../../../../core/services/customer-service';
import { ToastService } from '../../../../core/services/toast-service';
import { Tab } from "../../../../shared/components/ui/tab/tab";
import { TabsContainer } from "../../../../shared/components/ui/tab/tab-container/tab-container";
import { Autocomplete } from "../../../../shared/components/ui/autocomplete/autocomplete";
import { TranslatePipe } from '@ngx-translate/core';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'app-debit-form',
  imports: [Tab, TabsContainer, Autocomplete, ReactiveFormsModule, TranslatePipe, TitleCasePipe],
  templateUrl: './debit-form.html',
  styleUrl: './debit-form.css',
})
export class DebitForm {


  private readonly maxSupportFiles = 10;
  public submitted = signal<boolean>(false);
  public reasons = signal<Reason[]>([]);
  public classifications = signal<Classification[]>([]);
  public selectedCustomer = signal<Customer | null>(null);
  public selectedSupportFiles = signal<File[]>([]);
  

  private subscriptions: Subscription[] = [];
  private amountSubscription: Subscription | null = null;
  private ivaSubscription: Subscription | null = null;

  constructor(
    private _requestService: RequestService,
    private _customerService: CustomerService,
    private _toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.getReasons();
    this.getClassifications();
    this.setupTotalAmountListener();
  }

  public form = new FormGroup({
    requestNumber: new FormControl<string>({ value: '', disabled: true }, []),
    orderNumber: new FormControl<string>(''),
    creditNumber: new FormControl<string>(''),
    requestDate: new FormControl(new Date().toISOString().split('T')[0], [Validators.required]),
    customerId: new FormControl<string>('', [Validators.required]),
    customerNumber: new FormControl<string>({ value: '', disabled: true }, [Validators.required]),
    area: new FormControl<string>('', [Validators.required]),
    reasonId: new FormControl<string>('', [Validators.required]),
    classificationId: new FormControl<string>('', [Validators.required]),
    deliveryNote: new FormControl<string>(''),
    invoiceNumber: new FormControl<string>('', [Validators.required]),
    invoiceDate: new FormControl<string>('', [Validators.required]),
    sapScreen: new FormControl<File | null>(null),
    currency: new FormControl<string>('', [Validators.required]),
    exchangeRate: new FormControl<number>(1, [Validators.required, Validators.min(0)]),
    amount: new FormControl<number>(0, [Validators.required, Validators.min(0)]),
    hasIva: new FormControl<boolean>(false),
    totalAmount: new FormControl<string>({ value: '', disabled: true }, []),
    attachSupports: new FormControl<File[] | null>(null),
    comments: new FormControl<string>(''),
    reviewComments: new FormControl<string>({ value: '', disabled: true }, []),
    status: new FormControl<string>({ value: 'DRAFT', disabled: true }, []),
  })

  getReasons() {
    this._requestService.getReasons().subscribe({
      next: (response: Reason[]) => {
        this.reasons.set(response)
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  getClassifications() {
    this._requestService.getClassificationsByType(1).subscribe({
      next: (response: Classification[]) => {
        this.classifications.set(response);
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  campoVacio(controlName: string): boolean {
    const control = this.form.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || this.submitted());
  }

  getErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Este campo es obligatorio';
    }

    if (control.errors['email']) {
      return 'Ingresa un correo valido';
    }

    if (control.errors['passwordInvalid']) {
      return '';
    }

    if (control.errors['min']) {
      return 'Selecciona una opcion valida';
    }

    if (control.errors['pattern']) {
      return 'Selecciona un idioma valido';
    }

    return 'Valor no valido';
  }

  getFieldError(campo: string): string {
    const control = this.form.get(campo);
    if (!control || !this.campoVacio(campo)) {
      return '';
    }

    const errors = control.errors;
    if (!errors) return '';

    if (errors['required']) {
      return 'Este campo es obligatorio';
    }
    if (errors['email']) {
      return 'Please enter a valid email';
    }
    if (errors['min']) {
      return `El valor mínimo es ${errors['min'].min}`;
    }
    if (errors['max']) {
      return `El valor máximo es ${errors['max'].max}`;
    }
    if (errors['minlength']) {
      return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
    }
    if (errors['maxlength']) {
      return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    }
    if (errors['pattern']) {
      return 'El formato no es válido';
    }
    if (errors['maxFiles']) {
      return `Solo puedes subir hasta ${this.maxSupportFiles} archivos`;
    }

    return 'Error en el campo';
  }

  onAttachSupportsChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    const attachSupportsControl = this.form.get('attachSupports');

    if (!attachSupportsControl) {
      return;
    }

    if (files.length > this.maxSupportFiles) {
      const limitedFiles = files.slice(0, this.maxSupportFiles);
      this.selectedSupportFiles.set(limitedFiles);
      attachSupportsControl.setValue(limitedFiles);
      attachSupportsControl.setErrors({ maxFiles: true });
      attachSupportsControl.markAsTouched();
      this._toastService.error(`Solo puedes subir hasta ${this.maxSupportFiles} archivos`, 'Carga de archivos');
      input.value = '';
      return;
    }

    this.selectedSupportFiles.set(files);
    attachSupportsControl.setValue(files);
    attachSupportsControl.setErrors(null);
    attachSupportsControl.markAsTouched();
  }

  removeSupportFile(index: number): void {
    const attachSupportsControl = this.form.get('attachSupports');
    const currentFiles = [...this.selectedSupportFiles()];

    if (!attachSupportsControl || index < 0 || index >= currentFiles.length) {
      return;
    }

    currentFiles.splice(index, 1);
    this.selectedSupportFiles.set(currentFiles);
    attachSupportsControl.setValue(currentFiles.length ? currentFiles : null);
    attachSupportsControl.setErrors(null);
    attachSupportsControl.markAsTouched();
  }

  formatFileSize(bytes: number): string {
    if (!bytes) {
      return '0 KB';
    }

    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) {
      return `${kilobytes.toFixed(1)} KB`;
    }

    return `${(kilobytes / 1024).toFixed(2)} MB`;
  }

  saveRequest() {
    console.log(this.form.value);
  }

  // Autocomplete methods
  searchCustomers(searchTerm: string): Observable<any[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return new Observable(observer => {
        observer.next([]);
        observer.complete();
      });
    }
    return this._customerService.getCustomersByName(searchTerm).pipe(
      map(customers =>
        customers.map(customer => ({
          id: customer.idCliente,
          label: `${customer.idCliente} - ${customer.razonSocial}`,
          data: customer
        }))
      )
    );
  }

  displayCustomer(option: any): string {
    if (!option) return '';
    return option.label || '';
  }

  onCustomerSelected(option: any): void {
    // console.log(option);
    if (option) {
      this.form.controls['customerNumber'].setValue(option.id);
    }
  }

  // Setup total amount calculation
  private setupTotalAmountListener(): void {
    const amountControl = this.form.get('amount');
    const ivaControl = this.form.get('hasIva');

    if (amountControl && ivaControl) {
      this.amountSubscription = amountControl.valueChanges.subscribe(() => {
        this.updateTotalAmount();
      });

      this.ivaSubscription = ivaControl.valueChanges.subscribe(() => {
        this.updateTotalAmount();
      });

      // Initial calculation
      this.updateTotalAmount();
    }
  }

  private updateTotalAmount(): void {
    const amountControl = this.form.get('amount');
    const ivaControl = this.form.get('hasIva');
    const totalControl = this.form.get('totalAmount');

    if (amountControl && ivaControl && totalControl) {
      const amount = amountControl.value || 0;
      const hasIva = ivaControl.value || false;
      const total = hasIva ? amount * 1.16 : amount;
      totalControl.setValue(Number(total).toFixed(2), { emitEvent: false });
    }
  }

  ngOnDestroy(): void {
    if (this.amountSubscription) {
      this.amountSubscription.unsubscribe();
    }
    if (this.ivaSubscription) {
      this.ivaSubscription.unsubscribe();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
