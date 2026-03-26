import { Directive, Input, OnChanges, OnDestroy, OnInit, signal, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { forkJoin, map, Observable, of, Subscription, switchMap } from 'rxjs';
import { Classification, Customer, Reason, Request } from '../../../../data/interfaces/Request';
import { RequestService } from '../../../../core/services/request-service';
import { CustomerService } from '../../../../core/services/customer-service';
import { ToastService } from '../../../../core/services/toast-service';

interface RequestFormOptions {
  includeOrderNumber: boolean;
  includeCreditNumber: boolean;
  includeStatus: boolean;
}

const DEFAULT_OPTIONS: RequestFormOptions = {
  includeOrderNumber: true,
  includeCreditNumber: true,
  includeStatus: true,
};

@Directive()
export abstract class BaseRequestForm implements OnInit, OnDestroy, OnChanges {
  constructor(
    protected readonly _requestService: RequestService,
    protected readonly _customerService: CustomerService,
    protected readonly _toastService: ToastService,
  ) { }

  protected readonly maxSupportFiles = 10;
  @Input() requestTypeId: number | null = null;
  @Input() initialRequestData: Partial<Request> | null = null;
  public submitted = signal<boolean>(false);
  public reasons = signal<Reason[]>([]);
  public classifications = signal<Classification[]>([]);
  public isLoadingInitialData = signal<boolean>(false);
  public selectedCustomer = signal<Customer | null>(null);
  public selectedSupportFiles = signal<File[]>([]);

  private subscriptions: Subscription[] = [];
  private amountSubscription: Subscription | null = null;
  private ivaSubscription: Subscription | null = null;
  private currencySubscription: Subscription | null = null;

  public form: FormGroup = this.createForm();

  protected getFormOptions(): RequestFormOptions {
    return DEFAULT_OPTIONS;
  }

  ngOnInit(): void {
    this.loadInitialData();
    this.setupTotalAmountListener();
    this.setupCurrencyExchangeRateListener();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestTypeId'] && this.requestTypeId !== null) {
      this.loadInitialData();
    }

    if (changes['initialRequestData'] && this.initialRequestData) {
      this.applyInitialRequestData();
    }
  }

  private loadInitialData(): void {
    if (this.requestTypeId === null) {
      this.reasons.set([]);
      this.classifications.set([]);
      this.form.controls['requestNumber'].setValue('');
      return;
    }

    this.isLoadingInitialData.set(true);

    forkJoin({
      requestNumber: this._requestService.getNextRequestNumber(this.requestTypeId),
      reasons: this._requestService.getReasons(),
      classifications: this._requestService.getClassificationsByType(this.requestTypeId),
    }).subscribe({
      next: ({ requestNumber, reasons, classifications }) => {
        this.form.controls['requestNumber'].setValue(requestNumber.requestNumber);
        this.reasons.set(reasons);
        this.classifications.set(classifications);
        this.applyInitialRequestData();
        this.isLoadingInitialData.set(false);
      },
      error: (error) => {
        console.log(error);
        this.reasons.set([]);
        this.classifications.set([]);
        this.form.controls['requestNumber'].setValue('');
        this.applyInitialRequestData();
        this.isLoadingInitialData.set(false);
      }
    });
  }

  private applyInitialRequestData(): void {
    if (!this.initialRequestData) {
      return;
    }

    const patchValue: Record<string, unknown> = {};
    const requestDataEntries = Object.entries(this.initialRequestData as Record<string, unknown>);

    for (const [key, value] of requestDataEntries) {
      if (!(key in this.form.controls) || value === undefined) {
        continue;
      }

      if (key === 'requestDate' || key === 'invoiceDate') {
        patchValue[key] = this.formatDateForInput(value);
        continue;
      }

      if (key === 'customerId') {
        const customerName = this.initialRequestData.customer?.customerName ?? '';
        patchValue[key] = {
          id: value,
          label: `${value} - ${customerName}`,
          data: {
            idCliente: value,
            razonSocial: customerName,
          }
        };
        continue;
      }

      patchValue[key] = value;
    }

    if ('customerNumber' in this.form.controls && this.initialRequestData.customerId) {
      patchValue['customerNumber'] = String(this.initialRequestData.customerId);
    }

    this.form.patchValue(patchValue, { emitEvent: false });
  }

  private formatDateForInput(value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return '';
    }

    if (value.includes('T')) {
      return value.split('T')[0];
    }

    return value;
  }

  getExchangeRate() {
    this._requestService.getExchangeRate().subscribe({
      next: (response) => {
        console.log(response);
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  protected createForm(): FormGroup {
    const formOptions = this.getFormOptions();
    const controls: Record<string, FormControl> = {
      requestNumber: new FormControl<string>({ value: '', disabled: true }, []),
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
      exchangeRate: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
      amount: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
      hasIva: new FormControl<boolean>(false),
      totalAmount: new FormControl<string>({ value: '', disabled: true }, []),
      attachSupports: new FormControl<File[] | null>(null),
      comments: new FormControl<string>(''),
      reviewComments: new FormControl<string>({ value: '', disabled: true }, []),
    };

    if (formOptions.includeOrderNumber) {
      controls['orderNumber'] = new FormControl<string>('');
    }

    if (formOptions.includeCreditNumber) {
      controls['creditNumber'] = new FormControl<string>('');
    }

    if (formOptions.includeStatus) {
      controls['status'] = new FormControl<string>({ value: 'DRAFT', disabled: true }, []);
    }

    return new FormGroup(controls);
  }

  getNextRequestNumber() {
    this._requestService.getNextRequestNumber(this.requestTypeId || 0).subscribe({
      next: (response) => {
        console.log(response);
        this.form.controls['requestNumber'].setValue(response.requestNumber);
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  getReasons(): void {
    this._requestService.getReasons().subscribe({
      next: (response: Reason[]) => {
        this.reasons.set(response);
      },
      error: (error) => {
        console.log(error);
      }
    });
  }

  getClassifications(): void {
    if (this.requestTypeId === null) {
      this.classifications.set([]);
      return;
    }

    this._requestService.getClassificationsByType(this.requestTypeId).subscribe({
      next: (response: Classification[]) => {
        this.classifications.set(response);
      },
      error: (error) => {
        console.log(error);
      }
    });
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
    if (!errors) {
      return '';
    }

    if (errors['required']) {
      return 'Este campo es obligatorio';
    }
    if (errors['email']) {
      return 'Please enter a valid email';
    }
    if (errors['min']) {
      return `El valor minimo es ${errors['min'].min}`;
    }
    if (errors['max']) {
      return `El valor maximo es ${errors['max'].max}`;
    }
    if (errors['minlength']) {
      return `Minimo ${errors['minlength'].requiredLength} caracteres`;
    }
    if (errors['maxlength']) {
      return `Maximo ${errors['maxlength'].requiredLength} caracteres`;
    }
    if (errors['pattern']) {
      return 'El formato no es valido';
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

  saveRequest(): void {
    this.submitted.set(true);
    this.logFormValidationState();

    Object.values(this.form.controls).forEach(control => {
      control.markAllAsTouched();
    });

    if (this.form.invalid) {
      this._toastService.error('Debe llenar todos los campos del formulario', "Error")
      return;
    }

    if (this.requestTypeId === null) {
      this._toastService.error('No se pudo identificar el tipo de solicitud', 'Error');
      return;
    }

    const formValue = this.form.getRawValue();
    const selectedCustomer = formValue.customerId as
      | string
      | number
      | { id?: string | number; data?: { idCliente?: string | number } }
      | null;

    const customerId = typeof selectedCustomer === 'object' && selectedCustomer !== null
      ? selectedCustomer.id ?? selectedCustomer.data?.idCliente ?? ''
      : selectedCustomer;

    const payload = {
      requestTypeId: this.requestTypeId,
      ...formValue,
      customerId,
      reasonId: Number(formValue.reasonId),
      classificationId: Number(formValue.classificationId),
      exchangeRate: Number(formValue.exchangeRate),
      amount: Number(formValue.amount),
      totalAmount: Number(formValue.totalAmount),
      status: 'created',
    };

    delete payload.sapScreen;
    delete payload.attachSupports;
    delete payload.reviewComments;

    this._requestService.saveRequest(payload).subscribe({
      next: (response: any) => {
        if (response?.success) {
          this._toastService.success(response?.message ?? 'Solicitud guardada correctamente', 'Exito');
          this.submitted.set(false);
          return;
        }

        this._toastService.error(response?.message ?? 'No se pudo guardar la solicitud', 'Error');
      },
      error: (error: any) => {
        const message = error?.error?.message ?? error?.message ?? 'No se pudo guardar la solicitud';
        this._toastService.error(message, 'Error');
      }
    });
  }

  private logFormValidationState(): void {
    const controlState = Object.entries(this.form.controls).map(([name, control]) => ({
      field: name,
      valid: control.valid,
      invalid: control.invalid,
      disabled: control.disabled,
      touched: control.touched,
      errors: control.errors,
    }));

    const invalidFields = controlState.filter(control => control.invalid && !control.disabled);
    const validFields = controlState.filter(control => control.valid && !control.disabled);

    console.table(controlState);
    console.log('Campos invalidos:', invalidFields.map(field => ({
      field: field.field,
      errors: field.errors,
    })));
    console.log('Campos validos:', validFields.map(field => field.field));
  }

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
    if (!option) {
      return '';
    }
    return option.label || '';
  }

  onCustomerSelected(option: any): void {
    if (option) {
      this.form.controls['customerNumber'].setValue(option.id);
    }
  }

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

      this.updateTotalAmount();
    }
  }

  private setupCurrencyExchangeRateListener(): void {
    const currencyControl = this.form.get('currency');
    const exchangeRateControl = this.form.get('exchangeRate');

    if (!currencyControl || !exchangeRateControl) {
      return;
    }

    this.currencySubscription = currencyControl.valueChanges.pipe(
      switchMap((currency: string | null) => {
        if (!currency || currency === 'MXN') {
          return of(1);
        }

        return this._requestService.getExchangeRate().pipe(
          map((value: string) => {
            const parsedRate = parseFloat(value);
            return Number.isFinite(parsedRate) ? parsedRate : 1;
          })
        );
      })
    ).subscribe({
      next: (rate: number) => {
        exchangeRateControl.setValue(rate, { emitEvent: false });
      },
      error: (error) => {
        console.log(error);
        exchangeRateControl.setValue(1, { emitEvent: false });
      }
    });

    const currentCurrency = currencyControl.value as string | null;
    if (!currentCurrency || currentCurrency === 'MXN') {
      exchangeRateControl.setValue(1, { emitEvent: false });
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
    if (this.currencySubscription) {
      this.currencySubscription.unsubscribe();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
