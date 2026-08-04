import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth-service';
import { ToastService } from '../../core/services/toast-service';
import {
  ChargeTypeOption,
  CreateReturnOrderRequest,
  CustomerInvoiceProduct,
  CustomerInvoiceSummary,
  CustomerService,
  ProductReturnHistoryData,
  ProductReturnHistoryEntry,
  ReturnOrderCreated,
} from '../../core/services/customer-service';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, map, of, startWith, switchMap, take } from 'rxjs';
import { LucideAngularModule } from "lucide-angular";
import { UiProductHistoryModal } from './components/product-history-modal/product-history-modal';
import { ClientInvoiceFilters } from './components/client-invoice-filters/client-invoice-filters';
import { ClientInvoiceCard } from './components/client-invoice-card/client-invoice-card';
import { ClientInvoicePagination } from './components/client-invoice-pagination/client-invoice-pagination';
import {
  CustomerInvoice,
  DraftQuantityAdjust,
  DraftQuantityChange,
  GeneratedReturnOrder,
  GroupedReturnItems,
  InvoiceProduct,
  ProductHistorySummaryView,
  ReturnOrderItem,
} from './clients.types';

@Component({
  selector: 'app-clients',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    TranslatePipe,
    UiProductHistoryModal,
    ClientInvoiceFilters,
    ClientInvoiceCard,
    ClientInvoicePagination,
  ],
  templateUrl: './clients.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clients {
  private readonly authService = inject(AuthService);
  private readonly customerService = inject(CustomerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);
  private readonly toastService = inject(ToastService);

  readonly clientIdOverride = input<string>('');

  private readonly clientId$ = toObservable(this.clientIdOverride).pipe(
    switchMap(override => {
      if (override.trim()) return of(override.trim());
      return this.authService.user$.pipe(
        map(user => (typeof user?.clientId === 'string' ? user.clientId.trim() : '')),
      );
    }),
    distinctUntilChanged(),
  );

  // protected readonly taxRate = 0.16;
  protected readonly invoiceChargeType = new FormControl<number | null>(null, { nonNullable: true });
  protected readonly invoiceSearch = new FormControl<string>('', { nonNullable: true });
  protected readonly invoiceCurrency = new FormControl<string>('', { nonNullable: true });
  protected readonly invoiceChargeTypeOptions = signal<ChargeTypeOption[]>([]);
  protected readonly collapsedInvoiceKeys = signal<Set<string>>(new Set());
  protected readonly draftQuantities = signal<Record<string, number>>({});
  protected readonly isLoadingInvoices = signal<boolean>(false);
  protected readonly invoicesLoadError = signal<string | null>(null);
  protected readonly invoiceProductsLoading = signal<Record<string, boolean>>({});
  protected readonly invoiceProductsError = signal<Record<string, string | null>>({});
  private readonly loadedInvoiceKeys = signal<Set<string>>(new Set());
  private readonly currentClientId = signal<string>('');
  private readonly currentClientIdNumber = signal<number | null>(null);
  protected readonly returnOrderNotes = new FormControl<string>('', { nonNullable: true });
  protected readonly isCreatingReturnOrder = signal<boolean>(false);
  protected readonly returnOrderError = signal<string | null>(null);
  protected readonly isHistoryModalOpen = signal<boolean>(false);
  protected readonly isLoadingProductHistory = signal<boolean>(false);
  protected readonly productHistoryError = signal<string | null>(null);
  protected readonly historyModalTitle = signal<string>('');
  protected readonly historyModalSubtitle = signal<string>('');
  protected readonly productHistorySummary = signal<ProductHistorySummaryView | null>(null);
  protected readonly productHistoryRows = signal<ProductReturnHistoryEntry[]>([]);
  protected readonly invoicePage = signal<number>(1);
  protected readonly invoiceLastPage = signal<number>(1);
  protected readonly invoicePerPage = signal<number>(15);
  protected readonly invoiceTotal = signal<number>(0);
  protected readonly invoiceFrom = signal<number | null>(null);
  protected readonly invoiceTo = signal<number | null>(null);
  private lastInvoiceScope = '';

  protected readonly filtersForm = new FormGroup({
    from: new FormControl<string>('', { nonNullable: true }),
    to: new FormControl<string>('', { nonNullable: true }),
  });

  private readonly filters = toSignal(
    this.filtersForm.valueChanges.pipe(startWith(this.filtersForm.getRawValue())),
    { initialValue: this.filtersForm.getRawValue() },
  );

  protected readonly invoices = signal<CustomerInvoice[]>([]);

  protected readonly returnItems = signal<ReturnOrderItem[]>([]);
  protected readonly generatedOrder = signal<GeneratedReturnOrder | null>(null);

  protected readonly filteredInvoices = computed(() => {
    const invoices = this.invoices();
    const filters = this.filters();
    const from = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
    const to = filters.to ? new Date(`${filters.to}T23:59:59`) : null;

    return invoices.filter(invoice => {
      const invoiceDate = new Date(`${invoice.date}T12:00:00`);

      if (from && invoiceDate < from) {
        return false;
      }

      if (to && invoiceDate > to) {
        return false;
      }

      return true;
    });
  });

  protected readonly filteredInvoiceIds = computed(
    () => new Set(this.filteredInvoices().map(invoice => invoice.id)),
  );


  private readonly chargeTypeIdSignal = toSignal(
    this.invoiceChargeType.valueChanges.pipe(startWith(this.invoiceChargeType.getRawValue())),
    { initialValue: this.invoiceChargeType.getRawValue() },
  );

  protected readonly selectedCurrency = toSignal(
    this.invoiceCurrency.valueChanges.pipe(startWith(this.invoiceCurrency.getRawValue())),
    { initialValue: this.invoiceCurrency.getRawValue() || 'MXN' },
  );

  private readonly invoicePage$ = toObservable(this.invoicePage).pipe(distinctUntilChanged());

  protected readonly invoicePageNumbers = computed(() => {
    const currentPage = this.invoicePage();
    const lastPage = this.invoiceLastPage();
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(lastPage, currentPage + 2);

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  });

  protected readonly selectedChargeOption = computed(() =>
    this.invoiceChargeTypeOptions().find(o => o.id == this.chargeTypeIdSignal()) ?? null,
  );

  protected readonly chargeRate = computed(() =>
    Number(this.selectedChargeOption()?.percentage ?? 0) / 100,
  );

  protected readonly canGenerateOrder = computed(() => this.returnItems().length > 0);

  protected readonly returnOrderSubtotal = computed(() => {
    return this.returnItems().reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  });

  protected readonly returnOrderCharge = computed(() => this.returnOrderSubtotal() * this.chargeRate());

  // protected readonly returnOrderTax = computed(() => this.returnOrderSubtotal() * this.taxRate);

  protected readonly returnOrderTotal = computed(() =>
    // this.returnOrderSubtotal() + this.returnOrderTax() + this.returnOrderCharge(),
    this.returnOrderSubtotal() + this.returnOrderCharge(),
  );

  protected readonly groupedReturnItems = computed<GroupedReturnItems[]>(() => {
    return this.groupReturnItems(this.returnItems());
  });

  protected readonly generatedOrderGroups = computed<GroupedReturnItems[]>(() => {
    return this.groupReturnItems(this.generatedOrder()?.items ?? []);
  });

  constructor() {
    this.customerService.getChargeTypes().pipe(take(1)).subscribe({
      next: options => {
        const roleName = this.authService.getCurrentUser()?.roleName?.trim().toUpperCase();
        const filteredOptions = roleName === 'CUSTOMER'
          ? options.filter(o => o.name !== 'exception')
          : options;
        this.invoiceChargeTypeOptions.set(filteredOptions);
        if (filteredOptions.length > 0) {
          this.invoiceChargeType.setValue(filteredOptions[0].id);
        }
      },
    });
    this.invoiceChargeType.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.invoicePage.set(1);
    });
    this.invoiceCurrency.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.invoicePage.set(1);
    });
    this.invoiceSearch.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.invoicePage.set(1);
    });
    this.syncInvoicesFromAuthenticatedClient();
  }


  protected addToReturnOrder(invoice: CustomerInvoice, product: InvoiceProduct): void {
    const result = this.upsertReturnItem(invoice, product, this.getDraftQuantity(invoice, product));

    if (result.status === 'skipped') {
      return;
    }

    if (result.status === 'updated') {
      this.toastService.success(
        this.translateService.instant('CLIENT_INVOICES.INVOICE.UPDATE_SUCCESS'),
        this.translateService.instant('CLIENT_INVOICES.INVOICE.ADD_SUCCESS_TITLE'),
      );
      return;
    }

    this.toastService.success(
      this.translateService.instant('CLIENT_INVOICES.INVOICE.ADD_SUCCESS', {
        quantity: result.quantity,
        part: product.partNumber,
      }),
      this.translateService.instant('CLIENT_INVOICES.INVOICE.ADD_SUCCESS_TITLE'),
    );
  }

  protected addAllToReturnOrder(invoice: CustomerInvoice): void {
    const products = invoice.products.filter(product => product.qtyShipped > 0);

    if (products.length === 0) {
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const product of products) {
      const result = this.upsertReturnItem(invoice, product, product.qtyShipped);
      if (result.status === 'added') {
        addedCount++;
      } else if (result.status === 'updated') {
        updatedCount++;
      }
    }

    if (addedCount === 0 && updatedCount === 0) {
      return;
    }

    const messages: string[] = [];
    if (addedCount > 0) {
      messages.push(
        this.translateService.instant('CLIENT_INVOICES.INVOICE.ADD_ALL_ADDED_COUNT', { count: addedCount }),
      );
    }
    if (updatedCount > 0) {
      messages.push(
        this.translateService.instant('CLIENT_INVOICES.INVOICE.ADD_ALL_UPDATED_COUNT', { count: updatedCount }),
      );
    }

    this.toastService.success(
      messages.join(' '),
      this.translateService.instant('CLIENT_INVOICES.INVOICE.ADD_SUCCESS_TITLE'),
    );
  }

  private upsertReturnItem(
    invoice: CustomerInvoice,
    product: InvoiceProduct,
    quantity: number,
  ): { status: 'added' | 'updated' | 'skipped'; quantity: number } {
    if (product.qtyShipped <= 0) {
      return { status: 'skipped', quantity: 0 };
    }

    const key = this.returnItemKey(invoice, product);
    const selectedQuantity = Math.min(product.qtyShipped, Math.max(1, quantity));
    const existing = this.returnItems().find(item => item.key === key);

    if (existing) {
      this.returnItems.update(items =>
        items.map(item =>
          item.key === key
            ? { ...item, quantity: Math.min(item.maxQuantity, selectedQuantity) }
            : item,
        ),
      );
      this.generatedOrder.set(null);
      return { status: 'updated', quantity: selectedQuantity };
    }

    const item: ReturnOrderItem = {
      key,
      invoiceId: invoice.id,
      invoiceFolio: invoice.folio,
      invoiceClientId: this.currentClientIdNumber() ?? 0,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.date,
      conceptoIndex: product.conceptoIndex,
      deliveryNote: product.deliveryNote,
      partNumber: product.partNumber,
      customerPart: product.customerPart,
      satCode: product.satCode,
      unit: product.unit,
      unitPrice: product.unitPrice,
      maxQuantity: product.qtyShipped,
      quantity: selectedQuantity,
    };

    this.returnItems.update(items => [...items, item]);
    this.generatedOrder.set(null);
    return { status: 'added', quantity: selectedQuantity };
  }

  protected invoiceKey(invoice: CustomerInvoice, index: number): string {
    return `${invoice.id}-${index}`;
  }

  protected isInvoiceExpanded(key: string): boolean {
    return !this.collapsedInvoiceKeys().has(key);
  }

  protected toggleInvoice(invoice: CustomerInvoice, key: string): void {
    const isCollapsed = this.collapsedInvoiceKeys().has(key);

    if (isCollapsed) {
      this.loadInvoiceProducts(invoice, key);
    }

    this.collapsedInvoiceKeys.update(current => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  protected isInvoiceProductsLoading(key: string): boolean {
    return this.invoiceProductsLoading()[key] ?? false;
  }

  protected invoiceProductsErrorMessage(key: string): string | null {
    return this.invoiceProductsError()[key] ?? null;
  }

  protected getDraftQuantity(invoice: CustomerInvoice, product: InvoiceProduct): number {
    const key = this.returnItemKey(invoice, product);
    return this.draftQuantities()[key] ?? 1;
  }

  protected setDraftQuantity(invoice: CustomerInvoice, product: InvoiceProduct, rawValue: string | number): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      return;
    }

    const quantity = Math.max(1, Math.min(product.qtyShipped, Math.floor(parsed)));
    const key = this.returnItemKey(invoice, product);
    this.draftQuantities.update(current => ({
      ...current,
      [key]: quantity,
    }));
  }

  protected adjustDraftQuantity(invoice: CustomerInvoice, product: InvoiceProduct, delta: number): void {
    const next = this.getDraftQuantity(invoice, product) + delta;
    this.setDraftQuantity(invoice, product, next);
  }

  protected onDraftQuantityChange(change: DraftQuantityChange): void {
    this.setDraftQuantity(change.invoice, change.product, change.value);
  }

  protected onDraftQuantityAdjust(change: DraftQuantityAdjust): void {
    this.adjustDraftQuantity(change.invoice, change.product, change.delta);
  }

  protected openProductHistory(invoice: CustomerInvoice, product: InvoiceProduct): void {
    const clientId = this.currentClientId();

    if (!clientId || !invoice.folio) {
      return;
    }

    this.isHistoryModalOpen.set(true);
    this.isLoadingProductHistory.set(true);
    this.productHistoryError.set(null);
    this.productHistorySummary.set(null);
    this.productHistoryRows.set([]);

    this.historyModalTitle.set(this.translate('CLIENT_INVOICES.HISTORY.TITLE'));
    this.historyModalSubtitle.set(`${product.partNumber} - ${this.translate('CLIENT_INVOICES.INVOICE.INVOICE')} ${invoice.folio}`);

    this.customerService
      .getInvoiceProductHistory(invoice.folio, clientId, product.conceptoIndex)
      .pipe(take(1))
      .subscribe({
        next: (historyData: ProductReturnHistoryData | null) => {
          if (!historyData) {
            this.productHistoryError.set(this.translate('CLIENT_INVOICES.HISTORY.NOT_FOUND'));
            this.isLoadingProductHistory.set(false);
            return;
          }

          this.productHistorySummary.set({
            totalSent: Number(historyData.summary?.totalSent) || 0,
            totalReturned: Number(historyData.summary?.totalReturned) || 0,
            available: Number(historyData.summary?.available) || 0,
            unit: historyData.summary?.unidad || product.unit || 'PC',
          });
          this.productHistoryRows.set(historyData.history ?? []);
          this.isLoadingProductHistory.set(false);
        },
        error: (error: unknown) => {
          const apiMessage = (error as { error?: { message?: string } })?.error?.message;
          this.productHistoryError.set(apiMessage?.trim() || this.translate('CLIENT_INVOICES.HISTORY.LOAD_ERROR'));
          this.isLoadingProductHistory.set(false);
        },
      });
  }

  protected closeProductHistoryModal(): void {
    this.isHistoryModalOpen.set(false);
  }

  protected updateItemQuantity(key: string, rawQuantity: string): void {
    const parsed = Number(rawQuantity);

    this.returnItems.update(items =>
      items.map(item => {
        if (item.key !== key) {
          return item;
        }

        if (!Number.isFinite(parsed)) {
          return item;
        }

        return {
          ...item,
          quantity: Math.max(1, Math.min(item.maxQuantity, Math.floor(parsed))),
        };
      }),
    );

    this.generatedOrder.set(null);
  }

  protected removeReturnItem(key: string): void {
    this.returnItems.update(items => items.filter(item => item.key !== key));
    this.generatedOrder.set(null);
  }

  protected clearReturnOrder(): void {
    this.returnItems.set([]);
    this.generatedOrder.set(null);
    this.returnOrderError.set(null);
    this.returnOrderNotes.setValue('');
  }

  protected goToInvoicePage(page: number): void {
    const nextPage = Math.max(1, Math.min(this.invoiceLastPage(), page));

    if (nextPage === this.invoicePage() || this.isLoadingInvoices()) {
      return;
    }

    this.invoicePage.set(nextPage);
  }

  protected clearInvoiceSearch(): void {
    if (!this.invoiceSearch.value) {
      return;
    }

    this.invoiceSearch.setValue('');
  }

  protected generateReturnOrder(): void {
    if (!this.canGenerateOrder() || this.isCreatingReturnOrder()) {
      return;
    }

    const clientId = this.currentClientIdNumber();

    if (!clientId) {
      this.returnOrderError.set(this.translate('CLIENT_INVOICES.ERRORS.CLIENT_ID'));
      return;
    }

    const chargeTypeId = this.invoiceChargeType.value;

    if (!clientId || !chargeTypeId) {
      this.returnOrderError.set(this.translate('CLIENT_INVOICES.ERRORS.CHARGE_TYPE'));
      return;
    }

    const items = this.returnItems().map(item => ({
      invoiceFolio: item.invoiceFolio,
      invoiceClientId: item.invoiceClientId || clientId,
      conceptoIndex: item.conceptoIndex,
      requestedQuantity: item.quantity,
    }));

    const payload: CreateReturnOrderRequest = {
      clientId,
      chargeTypeId,
      currency: this.invoiceCurrency.value || 'MXN',
      items,
    };

    const notes = this.returnOrderNotes.value.trim();

    if (notes) {
      payload.notes = notes;
    }

    this.isCreatingReturnOrder.set(true);
    this.returnOrderError.set(null);

    this.customerService.createReturnOrder(payload).pipe(take(1)).subscribe({
      next: response => {
        const generatedItems = this.returnItems();
        this.generatedOrder.set({
          id: response.id,
          clientId: response.clientId,
          status: response.status,
          notes: response.notes ?? null,
          createdAt: response.createdAt,
          items: generatedItems,
        });
        this.applyGeneratedReturnOrder(generatedItems);
        this.returnItems.set([]);
        this.draftQuantities.set({});
        this.returnOrderNotes.setValue('');
        this.isCreatingReturnOrder.set(false);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.returnOrderError.set(apiMessage?.trim() || this.translate('CLIENT_INVOICES.ERRORS.CREATE_ORDER'));
        this.isCreatingReturnOrder.set(false);
      },
    });
  }

  private returnItemKey(invoice: CustomerInvoice, product: InvoiceProduct): string {
    return `${invoice.id}-${invoice.invoiceNumber}-${product.id}`;
  }

  private groupReturnItems(items: ReturnOrderItem[]): GroupedReturnItems[] {
    const groups = new Map<string, GroupedReturnItems>();

    items.forEach(item => {
      const current = groups.get(item.invoiceId);
      if (current) {
        current.items.push(item);
      } else {
        groups.set(item.invoiceId, {
          invoiceId: item.invoiceId,
          invoiceFolio: item.invoiceFolio,
          invoiceNumber: item.invoiceNumber,
          invoiceDate: item.invoiceDate,
          deliveryNote: item.deliveryNote,
          items: [item],
        });
      }
    });

    return Array.from(groups.values()).map(group => ({
      ...group,
      items: [...group.items],
    }));
  }

  private applyGeneratedReturnOrder(items: ReturnOrderItem[]): void {
    if (items.length === 0) {
      return;
    }

    const quantitiesByProductKey = new Map<string, number>();
    items.forEach(item => {
      quantitiesByProductKey.set(item.key, (quantitiesByProductKey.get(item.key) ?? 0) + item.quantity);
    });

    this.invoices.update(invoices =>
      invoices.map(invoice => ({
        ...invoice,
        products: invoice.products.map(product => {
          const returnedQuantity = quantitiesByProductKey.get(this.returnItemKey(invoice, product)) ?? 0;
          if (returnedQuantity <= 0) {
            return product;
          }

          return {
            ...product,
            qtyShipped: Math.max(0, product.qtyShipped - returnedQuantity),
            qtyBackorder: product.qtyBackorder + returnedQuantity,
          };
        }),
      })),
    );
  }

  private syncInvoicesFromAuthenticatedClient(): void {
    combineLatest([
      this.clientId$,
      this.invoiceChargeType.valueChanges.pipe(
        startWith(this.invoiceChargeType.getRawValue()),
        distinctUntilChanged(),
      ),
      this.invoiceSearch.valueChanges.pipe(
        startWith(this.invoiceSearch.getRawValue()),
        debounceTime(300),
        distinctUntilChanged(),
        map(value => value.trim()),
      ),
      this.invoicePage$,
      this.invoiceCurrency.valueChanges.pipe(
        startWith(this.invoiceCurrency.getRawValue()),
        distinctUntilChanged(),
      ),
    ])
      .pipe(
        switchMap(([clientId, chargeTypeId, search, page, currency]) => {
          const chargeTypeName = this.invoiceChargeTypeOptions().find(o => {
            return o.id == chargeTypeId;
          })?.name;
          const invoiceScope = `${clientId}|${chargeTypeName ?? ''}|${currency}`;
          const invoiceScopeChanged = invoiceScope !== this.lastInvoiceScope;
          this.lastInvoiceScope = invoiceScope;

          this.currentClientId.set(clientId);
          this.currentClientIdNumber.set(Number(clientId) || null);
          this.collapsedInvoiceKeys.set(new Set());
          this.loadedInvoiceKeys.set(new Set());
          this.invoiceProductsLoading.set({});
          this.invoiceProductsError.set({});
          if (invoiceScopeChanged) {
            this.returnItems.set([]);
            this.generatedOrder.set(null);
            this.returnOrderError.set(null);
            this.returnOrderNotes.setValue('');
          }
          this.invoices.set([]);
          this.invoicesLoadError.set(null);
          this.isLoadingInvoices.set(false);

          if (!clientId || !chargeTypeName || !currency) {
            this.resetInvoicePagination();
            return of<CustomerInvoice[]>([]);
          }

          this.isLoadingInvoices.set(true);

          return this.customerService.getInvoicesByClientId(clientId, chargeTypeName, page, this.invoicePerPage(), search, currency).pipe(
            map(pagination => {
              this.invoicePage.set(pagination.current_page);
              this.invoiceLastPage.set(pagination.last_page);
              this.invoicePerPage.set(pagination.per_page ?? this.invoicePerPage());
              this.invoiceTotal.set(pagination.total ?? pagination.data.length);
              this.invoiceFrom.set(pagination.from ?? null);
              this.invoiceTo.set(pagination.to ?? null);

              return pagination.data.map(invoice => this.toCustomerInvoice(invoice));
            }),
            catchError(() => {
              this.invoicesLoadError.set(this.translate('CLIENT_INVOICES.ERRORS.LOAD_INVOICES'));
              this.resetInvoicePagination();
              return of<CustomerInvoice[]>([]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(invoices => {
        this.invoices.set(invoices);
        this.collapsedInvoiceKeys.set(new Set(invoices.map((invoice, index) => this.invoiceKey(invoice, index))));
        this.isLoadingInvoices.set(false);
      });
  }

  private resetInvoicePagination(): void {
    this.invoiceLastPage.set(1);
    this.invoicePerPage.set(15);
    this.invoiceTotal.set(0);
    this.invoiceFrom.set(null);
    this.invoiceTo.set(null);
  }

  private toCustomerInvoice(invoice: CustomerInvoiceSummary): CustomerInvoice {
    const serie = (invoice.serie ?? '').trim();
    const folio = (invoice.folio ?? '').trim();
    const emissionDate = (invoice.fechaEmision ?? '').trim();

    return {
      id: invoice.id,
      folio,
      invoiceNumber: [serie, folio].filter(Boolean).join('-') || invoice.id,
      date: emissionDate ? emissionDate.slice(0, 10) : '',
      products: [],
      productsCount: this.resolveInvoiceProductsCount(invoice),
    };
  }

  private resolveInvoiceProductsCount(invoice: CustomerInvoiceSummary): number | null {
    const invoiceRecord = invoice as CustomerInvoiceSummary & Record<string, unknown>;
    const candidates = [
      invoiceRecord['productsCount'],
      invoiceRecord['products_count'],
      invoiceRecord['productCount'],
      invoiceRecord['product_count'],
      invoiceRecord['conceptosCount'],
      invoiceRecord['conceptos_count'],
      invoiceRecord['itemsCount'],
      invoiceRecord['items_count'],
    ];

    for (const candidate of candidates) {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }

    return null;
  }

  private loadInvoiceProducts(invoice: CustomerInvoice, invoiceKey: string): void {
    const clientId = this.currentClientId();

    if (!clientId || !invoice.folio) {
      return;
    }

    if (this.loadedInvoiceKeys().has(invoiceKey) || this.isInvoiceProductsLoading(invoiceKey)) {
      return;
    }

    this.invoiceProductsLoading.update(current => ({
      ...current,
      [invoiceKey]: true,
    }));

    this.invoiceProductsError.update(current => ({
      ...current,
      [invoiceKey]: null,
    }));

    this.customerService
      .getInvoiceProductsByFolio(invoice.folio, clientId)
      .pipe(
        map(products => products.map((product, index) => this.toInvoiceProduct(invoice, product, index))),
        catchError((error: unknown) => {
          const apiMessage = (error as { error?: { message?: string } })?.error?.message;
          this.invoiceProductsError.update(current => ({
            ...current,
            [invoiceKey]: apiMessage?.trim() || this.translate('CLIENT_INVOICES.ERRORS.LOAD_PRODUCTS'),
          }));
          return of<InvoiceProduct[]>([]);
        }),
        take(1),
      )
      .subscribe(products => {
        this.invoices.update(currentInvoices =>
          currentInvoices.map(item => {
            if (item.id !== invoice.id || item.folio !== invoice.folio) {
              return item;
            }

            return {
              ...item,
              products,
              productsCount: products.length,
            };
          }),
        );

        this.loadedInvoiceKeys.update(current => {
          const next = new Set(current);
          next.add(invoiceKey);
          return next;
        });

        this.invoiceProductsLoading.update(current => ({
          ...current,
          [invoiceKey]: false,
        }));
      });
  }

  private toInvoiceProduct(invoice: CustomerInvoice, product: CustomerInvoiceProduct, index: number): InvoiceProduct {
    const descriptionParts = this.parseDescriptionParts(product.descripcion);
    const quantityOrdered = Number(product.cantidad) || 0;
    const quantityAvailable = Number(product.availableQuantity) || 0;
    const returnedQuantity = Number(product.returnedQuantity) || 0;

    return {
      id: `${invoice.id}-${product.conceptoIndex}-${index}`,
      conceptoIndex: product.conceptoIndex,
      invoiceFolio: invoice.folio,
      invoiceClientId: this.currentClientIdNumber() ?? 0,
      orderNumber: descriptionParts.orderNumber,
      customerPoNumber: descriptionParts.customerPoNumber,
      deliveryNote: descriptionParts.deliveryNote,
      qtyOrdered: quantityOrdered,
      qtyShipped: quantityAvailable,
      qtyBackorder: Math.max(0, returnedQuantity),
      partNumber: descriptionParts.partNumber,
      customerPart: descriptionParts.customerPart,
      satCode: product.claveProdServ || '',
      unit: product.unidad || product.claveUnidad || '',
      origin: '-',
      unitPrice: Number(product.valorUnitario) || 0,
    };
  }

  private parseDescriptionParts(rawDescription: string): {
    partNumber: string;
    customerPart: string;
    orderNumber: string;
    customerPoNumber: string;
    deliveryNote: string;
  } {
    const normalized = (rawDescription ?? '').trim();

    if (!normalized) {
      return {
        partNumber: '-',
        customerPart: '-',
        orderNumber: '-',
        customerPoNumber: '-',
        deliveryNote: '-',
      };
    }

    const tokens = normalized
      .split('^')
      .map(token => token.trim());

    const partNumber = tokens[1];
    const orderNumber = tokens[2] ?? '-';
    const deliveryNote = tokens[3] ?? '-';

    return {
      partNumber: partNumber || '-',
      customerPart: partNumber || '-',
      orderNumber,
      customerPoNumber: orderNumber,
      deliveryNote,
    };
  }

  private translate(key: string): string {
    return this.translateService.instant(key);
  }
}
