import { Directive, inject, Input, OnChanges, OnDestroy, OnInit, signal, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, forkJoin, map, Observable, of, Subscription, switchMap, take } from 'rxjs';
import { Classification, Customer, Reason, Request, RequestAttachment } from '../../../../data/interfaces/Request';
import { ApiResponse } from '../../../../data/interfaces/ApiResponse-interface';
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

type SaveRequestResponse = ApiResponse<Request | null> & {
  id?: number;
  requestId?: number;
};

@Directive()
export abstract class BaseRequestForm implements OnInit, OnDestroy, OnChanges {
  private readonly _router = inject(Router);

  constructor(
    protected readonly _requestService: RequestService,
    protected readonly _customerService: CustomerService,
    protected readonly _toastService: ToastService,
  ) { }

  protected readonly maxSupportFiles = 10;
  @Input() requestTypeId: number | null = null;
  @Input() initialRequestData: Partial<Request> | null = null;

  get isEditing(): boolean {
    const id = Number(this.initialRequestData?.id);
    return Number.isFinite(id) && id > 0;
  }
  public submitted = signal<boolean>(false);
  public reasons = signal<Reason[]>([]);
  public classifications = signal<Classification[]>([]);
  public isLoadingInitialData = signal<boolean>(false);
  public selectedCustomer = signal<Customer | null>(null);
  public selectedSupportFiles = signal<File[]>([]);
  public selectedSapScreenFiles = signal<File[]>([]);
  public existingSapScreenFiles = signal<RequestAttachment[]>([]);
  public existingUploadSupportFiles = signal<RequestAttachment[]>([]);
  public openingFileId = signal<number | null>(null);

  private subscriptions: Subscription[] = [];
  private amountSubscription: Subscription | null = null;
  private ivaSubscription: Subscription | null = null;
  private currencySubscription: Subscription | null = null;
  private initialLoadTriggered = false;

  public form: FormGroup = this.createForm();

  protected getFormOptions(): RequestFormOptions {
    return DEFAULT_OPTIONS;
  }

  ngOnInit(): void {
    if (!this.initialLoadTriggered) {
      this.loadInitialData();
    }
    this.setupTotalAmountListener();
    this.setupCurrencyExchangeRateListener();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestTypeId'] && this.requestTypeId !== null) {
      this.initialLoadTriggered = true;
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
      reasons: this._requestService.getReasons(this.requestTypeId),
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

    const attachments = (this.initialRequestData as any)?.attachments;
    this.existingSapScreenFiles.set(attachments?.sapScreen ?? []);
    this.existingUploadSupportFiles.set(attachments?.uploadSupport ?? []);

    const patchValue: Record<string, unknown> = {};
    const requestDataEntries = Object.entries(this.initialRequestData as Record<string, unknown>);
    let hasPatchedCustomer = false;

    for (const [key, value] of requestDataEntries) {
      if (!(key in this.form.controls) || value === undefined) {
        continue;
      }

      if (key === 'requestDate' || key === 'invoiceDate') {
        patchValue[key] = this.formatDateForInput(value);
        continue;
      }

      if (key === 'customerId') {
        const customerId = this.normalizeCustomerId(value);
        const customerName = this.resolveCustomerName(this.initialRequestData);
        const hasCustomerName = customerName.trim().length > 0;

        patchValue[key] = {
          id: customerId,
          label: hasCustomerName ? `${customerId} - ${customerName}` : String(customerId),
          data: {
            idCliente: customerId,
            razonSocial: customerName,
          }
        };

        if (!hasCustomerName) {
          this.populateCustomerNameFromService(customerId);
        }
        hasPatchedCustomer = true;
        continue;
      }

      patchValue[key] = value;
    }

    if (!hasPatchedCustomer && 'customerId' in this.form.controls) {
      const inferredCustomerId = this.resolveCustomerIdFromRequestData(this.initialRequestData);
      if (String(inferredCustomerId ?? '').trim().length > 0) {
        const customerName = this.resolveCustomerName(this.initialRequestData);
        const hasCustomerName = customerName.trim().length > 0;

        patchValue['customerId'] = {
          id: inferredCustomerId,
          label: hasCustomerName ? `${inferredCustomerId} - ${customerName}` : String(inferredCustomerId),
          data: {
            idCliente: inferredCustomerId,
            razonSocial: customerName,
          }
        };

        if (!hasCustomerName) {
          this.populateCustomerNameFromService(inferredCustomerId);
        }
      }
    }

    if ('customerNumber' in this.form.controls) {
      const inferredCustomerNumber = this.resolveCustomerNumberFromRequestData(this.initialRequestData);
      if (String(inferredCustomerNumber ?? '').trim().length > 0) {
        patchValue['customerNumber'] = String(inferredCustomerNumber);
      } else {
        const rawCustomerId = this.resolveInternalCustomerIdFromRequestData(this.initialRequestData);
        if (rawCustomerId !== null) {
          this.populateCustomerNumberFromService(rawCustomerId);
        }
      }
    }

    this.form.patchValue(patchValue, { emitEvent: false });
  }

  private resolveCustomerName(requestData: Partial<Request>): string {
    const customer = requestData.customer as Record<string, unknown> | undefined;
    const requestDataRecord = requestData as Record<string, unknown>;

    const candidates = [
      customer?.['customerName'],
      customer?.['razonSocial'],
      customer?.['name'],
      customer?.['customer_name'],
      requestDataRecord['customerName'],
      requestDataRecord['razonSocial'],
      requestDataRecord['customer_name'],
      requestDataRecord['customer_name_full'],
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }

    return '';
  }

  private normalizeCustomerId(value: unknown): string | number {
    if (typeof value === 'string' || typeof value === 'number') {
      return this.normalizeCustomerCodeCandidate(value);
    }

    if (value && typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      const nestedId = objectValue['id'] ?? objectValue['idCliente'];
      if (typeof nestedId === 'string' || typeof nestedId === 'number') {
        return this.normalizeCustomerCodeCandidate(nestedId);
      }
    }

    return '';
  }

  private normalizeCustomerCodeCandidate(value: string | number): string | number {
    if (typeof value === 'number') {
      return value;
    }

    const rawValue = value.trim();
    if (!rawValue) {
      return '';
    }

    const leadingCodeMatch = rawValue.match(/^(\d+)\s*-/);
    if (leadingCodeMatch?.[1]) {
      return leadingCodeMatch[1];
    }

    return rawValue;
  }

  private resolveCustomerIdFromRequestData(requestData: Partial<Request>): string | number {
    const requestDataRecord = requestData as Record<string, unknown>;
    const customer = requestDataRecord['customer'] as Record<string, unknown> | undefined;

    const candidates = [
      customer?.['customerNumber'],
      customer?.['idCliente'],
      requestDataRecord['customerNumber'],
      requestDataRecord['customerId'],
      requestDataRecord['customer_id'],
      customer?.['id'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeCustomerId(candidate);
      if (String(normalized).trim().length > 0) {
        return normalized;
      }
    }

    return '';
  }

  private resolveCustomerNumberFromRequestData(requestData: Partial<Request>): string | number {
    const requestDataRecord = requestData as Record<string, unknown>;
    const customer = requestDataRecord['customer'] as Record<string, unknown> | undefined;

    const candidates = [
      customer?.['customerNumber'],
      customer?.['idCliente'],
      requestDataRecord['customerNumber'],
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeCustomerId(candidate);
      if (String(normalized).trim().length > 0) {
        return normalized;
      }
    }

    return '';
  }

  private resolveInternalCustomerIdFromRequestData(requestData: Partial<Request>): number | null {
    const requestDataRecord = requestData as Record<string, unknown>;
    const rawCustomerId = requestDataRecord['customerId'];

    if (typeof rawCustomerId === 'number' && Number.isFinite(rawCustomerId) && rawCustomerId > 0) {
      return rawCustomerId;
    }

    if (typeof rawCustomerId === 'string') {
      const parsedCustomerId = Number(rawCustomerId.trim());
      if (Number.isFinite(parsedCustomerId) && parsedCustomerId > 0) {
        return parsedCustomerId;
      }
    }

    return null;
  }

  private populateCustomerNumberFromService(customerId: number): void {
    const subscription = this._customerService.getCustomerById(customerId).subscribe({
      next: (response: any) => {
        const customerData = response?.data ?? response;
        const resolvedCustomerNumber = customerData?.customerNumber ?? customerData?.idCliente;
        if (resolvedCustomerNumber === null || resolvedCustomerNumber === undefined) {
          return;
        }

        const normalizedCustomerNumber = String(resolvedCustomerNumber).trim();
        if (!normalizedCustomerNumber) {
          return;
        }

        this.form.get('customerNumber')?.setValue(normalizedCustomerNumber, { emitEvent: false });
      },
      error: () => {
        // Keep the field empty if the customer lookup fails.
      }
    });

    this.subscriptions.push(subscription);
  }

  private resolveCustomerNumberFromSelection(option: any): string {
    if (!option) {
      return '';
    }

    const data = option.data as Record<string, unknown> | undefined;
    const candidates = [
      data?.['customerNumber'],
      data?.['idCliente'],
      option.customerNumber,
      option.label,
      option.id,
    ];

    for (const candidate of candidates) {
      if (candidate === null || candidate === undefined) {
        continue;
      }

      const normalized = this.normalizeCustomerId(candidate);
      if (String(normalized).trim().length > 0) {
        return String(normalized).trim();
      }
    }

    return '';
  }

  private populateCustomerNameFromService(customerId: string | number): void {
    const searchValue = String(customerId ?? '').trim();
    if (!searchValue) {
      return;
    }

    const subscription = this._customerService.getCustomersByName(searchValue).subscribe({
      next: (customers: any[]) => {
        if (!Array.isArray(customers) || customers.length === 0) {
          return;
        }

        const exactMatch = customers.find((customer) =>
          String(customer?.idCliente ?? '').trim() === searchValue
        );

        const selectedCustomer = exactMatch ?? customers[0];
        const resolvedCustomerId = selectedCustomer?.idCliente ?? customerId;
        const customerName = selectedCustomer?.razonSocial
          ?? selectedCustomer?.customerName
          ?? selectedCustomer?.name
          ?? '';

        if (typeof customerName !== 'string' || customerName.trim().length === 0) {
          return;
        }

        this.form.get('customerId')?.setValue({
          id: resolvedCustomerId,
          label: `${resolvedCustomerId} - ${customerName}`,
          data: {
            idCliente: resolvedCustomerId,
            razonSocial: customerName,
          }
        }, { emitEvent: true });
      },
      error: () => {
        // Keep customer ID as fallback if customer name cannot be resolved.
      }
    });

    this.subscriptions.push(subscription);
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
      classificationId: new FormControl<string>(''),
      deliveryNote: new FormControl<string>(''),
      invoiceNumber: new FormControl<string>(''),
      invoiceDate: new FormControl<string>(''),
      newInvoice: new FormControl<string>(''),
      warehouseCode: new FormControl<string>(''),
      sapScreen: new FormControl<File | null>(null),
      currency: new FormControl<string>('', [Validators.required]),
      exchangeRate: new FormControl<number | null>({ value: null, disabled: true }, []),
      amount: new FormControl<number | null>(null, [Validators.min(0)]),
      hasIva: new FormControl<boolean>(false),
      hasRga: new FormControl<boolean>(false),
      totalAmount: new FormControl<string>({ value: '', disabled: true }, []),
      attachSupports: new FormControl<File[] | null>(null),
      comments: new FormControl<string>(''),
      replenishmentAmount: new FormControl<string>(''),
      hasReplenishmentIva: new FormControl<boolean>(false),
      warehouseAmount: new FormControl<string>(''),
      warehouseTotal: new FormControl<string>(''),
      replenishmentTotal: new FormControl<string>(''),
      hasWarehouseIva: new FormControl<boolean>(false),
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
    if (this.requestTypeId === null) {
      this.reasons.set([]);
      return;
    }

    this._requestService.getReasons(this.requestTypeId).subscribe({
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

  onSapScreenChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.selectedSapScreenFiles.set(files);
    this.form.get('sapScreen')?.setValue(files[0] ?? null);
    this.form.get('sapScreen')?.markAsTouched();
  }

  onAttachSupportsChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newFiles = Array.from(input.files ?? []);
    const attachSupportsControl = this.form.get('attachSupports');

    if (!attachSupportsControl) {
      return;
    }

    const existingFiles = this.selectedSupportFiles();
    const mergedFiles = [...existingFiles, ...newFiles];
    input.value = '';

    if (mergedFiles.length > this.maxSupportFiles) {
      this._toastService.error(`Solo puedes subir hasta ${this.maxSupportFiles} archivos`, 'Carga de archivos');
      const limitedFiles = mergedFiles.slice(0, this.maxSupportFiles);
      this.selectedSupportFiles.set(limitedFiles);
      attachSupportsControl.setValue(limitedFiles);
      attachSupportsControl.setErrors({ maxFiles: true });
      attachSupportsControl.markAsTouched();
      return;
    }

    this.selectedSupportFiles.set(mergedFiles);
    attachSupportsControl.setValue(mergedFiles.length ? mergedFiles : null);
    attachSupportsControl.setErrors(null);
    attachSupportsControl.markAsTouched();
  }

  openExistingFile(file: RequestAttachment): void {
    this.openingFileId.set(file.id);
    this._requestService.getRequestAttachmentFileUrl(file.id).pipe(
      finalize(() => this.openingFileId.set(null))
    ).subscribe({
      next: (fileUrl) => {
        if (!fileUrl) {
          this._toastService.error('No se pudo obtener la URL del archivo', 'Error');
          return;
        }
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
      },
      error: () => {
        this._toastService.error('No se pudo abrir el archivo', 'Error');
      }
    });
  }

  openLocalFile(file: File): void {
    const url = URL.createObjectURL(file);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  removeSapScreenFile(): void {
    this.selectedSapScreenFiles.set([]);
    this.form.get('sapScreen')?.setValue(null);
    this.form.get('sapScreen')?.markAsTouched();
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

  private buildFormData(payload: Record<string, any>): FormData {
    const formData = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value === null || value === undefined) {
        continue;
      }
      formData.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
    return formData;
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

    const formData = this.buildFormData(payload);
    this.selectedSapScreenFiles().forEach(file => formData.append('sapScreen[]', file));
    this.selectedSupportFiles().forEach(file => formData.append('uploadSupport[]', file));

    const editingRequestId = this.resolveEditingRequestId();
    const request$ = editingRequestId !== null
      ? this._requestService.updateRequest(editingRequestId, formData)
      : this._requestService.saveRequest(formData);

    request$.pipe(
      take(1),
      switchMap((response: SaveRequestResponse) => {
        if (!response?.success) {
          throw new Error(response?.message ?? 'No se pudo guardar la solicitud');
        }

        if (editingRequestId !== null) {
          return this.onRequestUpdated(editingRequestId, response).pipe(
            map(() => response)
          );
        }

        const createdRequestId = this.resolveRequestIdFromResponse(response);
        if (!createdRequestId) {
          throw new Error('La solicitud se creó, pero no se pudo obtener su id.');
        }

        return this.onRequestCreated(createdRequestId, response).pipe(
          map(() => response)
        );
      })
    ).subscribe({
      next: (response: SaveRequestResponse) => {
        const successMessage = editingRequestId !== null
          ? 'Solicitud actualizada correctamente'
          : 'Solicitud guardada correctamente';

        this._toastService.success(response?.message ?? successMessage, 'Exito');
        this.submitted.set(false);
        const returnTo = (history.state as { returnTo?: string })?.returnTo;
        this._router.navigate([returnTo ?? '/app/pending']);
      },
      error: (error: unknown) => {
        const message = (error as { error?: { message?: string }; message?: string })?.error?.message
          ?? (error as { message?: string })?.message
          ?? 'No se pudo guardar la solicitud';
        this._toastService.error(message, 'Error');
      }
    });
  }

  protected onRequestCreated(_requestId: number, _response: SaveRequestResponse): Observable<unknown> {
    return of(null);
  }

  protected onRequestUpdated(_requestId: number, _response: SaveRequestResponse): Observable<unknown> {
    return of(null);
  }

  private resolveEditingRequestId(): number | null {
    const requestId = Number(this.initialRequestData?.id);
    return Number.isFinite(requestId) && requestId > 0 ? requestId : null;
  }

  private resolveRequestIdFromResponse(response: SaveRequestResponse): number | null {
    const candidateId = response?.data?.id ?? response?.id ?? response?.requestId;
    const requestId = Number(candidateId);

    return Number.isFinite(requestId) && requestId > 0 ? requestId : null;
  }

  saveDraft(): void {
    // No validar campos obligatorios - guardar como borrador
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
      ? selectedCustomer.id ?? selectedCustomer.data?.idCliente ?? null
      : selectedCustomer ?? null;

    const payload = {
      requestTypeId: this.requestTypeId,
      ...formValue,
      customerId,
      reasonId: formValue.reasonId ? Number(formValue.reasonId) : null,
      classificationId: formValue.classificationId ? Number(formValue.classificationId) : null,
      exchangeRate: formValue.exchangeRate ? Number(formValue.exchangeRate) : null,
      amount: formValue.amount ? Number(formValue.amount) : 0,
      totalAmount: formValue.totalAmount ? Number(formValue.totalAmount) : 0,
      status: 'draft',
    };

    delete payload.sapScreen;
    delete payload.attachSupports;
    delete payload.reviewComments;

    this._requestService.saveDraft(payload).subscribe({
      next: (response: ApiResponse<Request | null>) => {
        if (response?.success) {
          this._toastService.success(response?.message ?? 'Borrador guardado correctamente', 'Exito');
          this.submitted.set(false);
          return;
        }

        this._toastService.error(response?.message ?? 'No se pudo guardar el borrador', 'Error');
      },
      error: (error: unknown) => {
        const message = (error as { error?: { message?: string }; message?: string })?.error?.message
          ?? (error as { message?: string })?.message
          ?? 'No se pudo guardar el borrador';
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
    console.log(option);
    if (option) {
      this.form.controls['customerNumber'].setValue(this.resolveCustomerNumberFromSelection(option));
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
