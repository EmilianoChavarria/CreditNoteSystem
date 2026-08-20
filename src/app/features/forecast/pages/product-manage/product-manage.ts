import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LucideAngularModule } from 'lucide-angular';
import { finalize } from 'rxjs';
import { Table, type AccionPersonalizada, type Column } from '../../../../shared/components/ui/table/table';
import { ProductCatalogItem, ProductClasificacionFilter, ProductClassificationResult, ProductService } from '../../../../core/services/product.service';
import { ClassifyProductModal } from './components/classify-product-modal/classify-product-modal';
import { BulkClassifyProductsModal } from './components/bulk-classify-products-modal/bulk-classify-products-modal';
import { BulkClassifyHistoryModal } from './components/bulk-classify-history-modal/bulk-classify-history-modal';
import { ToastService } from '../../../../core/services/toast-service';
import { AuthService } from '../../../../core/services/auth-service';
import { BatchFinishedMessage, ReverbSocketService } from '../../../../core/services/reverb-socket-service';

@Component({
  selector: 'app-product-manage',
  imports: [TranslatePipe, Table, DecimalPipe, ClassifyProductModal, BulkClassifyProductsModal, BulkClassifyHistoryModal, LucideAngularModule],
  templateUrl: './product-manage.html',
  styleUrl: './product-manage.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductManage implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly translate = inject(TranslateService);
  private readonly toastService = inject(ToastService);
  private readonly socketService = inject(ReverbSocketService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly bulkHistoryModal = viewChild(BulkClassifyHistoryModal);

  readonly products = signal<ProductCatalogItem[]>([]);
  readonly loading = signal(true);
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);
  readonly hasNextPage = signal(false);
  readonly hasPrevPage = signal(false);
  readonly pageSize = signal(100);

  readonly classifyModalOpen = signal(false);
  readonly selectedProduct = signal<ProductCatalogItem | null>(null);

  readonly bulkClassifyModalOpen = signal(false);
  readonly bulkHistoryModalOpen = signal(false);

  readonly searchTerm = signal('');
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  readonly clasificacionFilter = signal<ProductClasificacionFilter>('all');

  readonly excelExportParams = computed(() => {
    const params: Record<string, string> = {};
    const search = this.searchTerm();
    const clasificacion = this.clasificacionFilter();

    if (search.length > 0) params['search'] = search;
    if (clasificacion !== 'all') params['clasificacion'] = clasificacion;

    return params;
  });

  readonly columns: Column<ProductCatalogItem>[];
  readonly acciones: AccionPersonalizada<ProductCatalogItem>[];
  readonly clasificacionOptions: { label: string; value: ProductClasificacionFilter }[];

  constructor() {
    this.columns = [
      { key: 'idProducto', label: this.translate.instant('FORECAST.PRODUCTS.COL_ID_PRODUCTO'), sortable: false, customTemplate: true },
      { key: 'descripcion', label: this.translate.instant('FORECAST.PRODUCTS.COL_DESCRIPCION'), sortable: false, customTemplate: true },
      { key: 'claveProdServ', label: this.translate.instant('FORECAST.PRODUCTS.COL_CLAVE_PROD_SERV'), sortable: false, customTemplate: true },
      { key: 'claveUnidad', label: this.translate.instant('FORECAST.PRODUCTS.COL_CLAVE_UNIDAD'), sortable: false, customTemplate: true },
      { key: 'unidadMedida', label: this.translate.instant('FORECAST.PRODUCTS.COL_UNIDAD_MEDIDA'), sortable: false, customTemplate: true },
      { key: 'valorUnitario', label: this.translate.instant('FORECAST.PRODUCTS.COL_VALOR_UNITARIO'), sortable: false, customTemplate: true },
      { key: 'rfc', label: this.translate.instant('FORECAST.PRODUCTS.COL_RFC'), sortable: false, customTemplate: true },
      { key: 'estatus', label: this.translate.instant('FORECAST.PRODUCTS.COL_ESTATUS'), sortable: false, customTemplate: true },
      { key: 'clasificacion', label: this.translate.instant('FORECAST.PRODUCTS.COL_CLASIFICACION'), sortable: false, customTemplate: true },
    ];
    this.clasificacionOptions = [
      { label: 'Rodamientos', value: 'Rodamientos' },
      { label: 'No Rodamientos', value: 'No Rodamientos' },
      { label: this.translate.instant('FORECAST.PRODUCTS.CLASIFICACION_PENDIENTE'), value: 'unclassified' },
    ];
    this.acciones = [
      {
        label: this.translate.instant('FORECAST.PRODUCTS.ACTION_CLASSIFY'),
        icon: 'tag',
        className: 'text-left text-gray-700',
        accion: (item) => this.openClassifyModal(item),
      },
    ];
    this.loadData();
  }

  ngOnInit(): void {
    this.socketService.connectToGlobalNotifications();

    this.socketService.batchFinished$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => this.handleBatchFinishedEvent(message));
  }

  openClassifyModal(product: ProductCatalogItem): void {
    this.selectedProduct.set(product);
    this.classifyModalOpen.set(true);
  }

  onClassified(result: ProductClassificationResult): void {
    this.toastService.success(result.message);
    this.loadData(this.currentPage());
  }

  openBulkClassifyModal(): void {
    this.bulkClassifyModalOpen.set(true);
  }

  onBulkBatchCreated(): void {
    this.loadData(this.currentPage());
  }

  openBulkHistoryModal(): void {
    this.bulkHistoryModalOpen.set(true);
  }

  private handleBatchFinishedEvent(message: BatchFinishedMessage): void {
    if (this.resolveEventName(message) !== 'batch.finished') return;
    if (this.resolveBatchType(message) !== 'productClassification') return;

    const currentUserId = this.authService.getCurrentUser()?.id;
    if (!this.isTargetedToCurrentUser(message, currentUserId)) return;

    this.toastService.info(this.translate.instant('FORECAST.BULK_CLASSIFY.BATCH_FINISHED_REFRESH'));
    this.loadData(this.currentPage());
    this.bulkHistoryModal()?.refresh();
  }

  private resolveEventName(message: BatchFinishedMessage): string {
    const rootEvent = String(message.event ?? '');
    if (rootEvent.length > 0) return rootEvent;

    const recordMessage = message as Record<string, unknown>;
    const data = (recordMessage['data'] ?? null) as Record<string, unknown> | null;
    return String(data?.['event'] ?? '');
  }

  private resolveBatchType(message: BatchFinishedMessage): string | undefined {
    const recordMessage = message as Record<string, unknown>;
    const data = (recordMessage['data'] ?? null) as Record<string, unknown> | null;
    const nestedBatch = (data?.['batch'] ?? null) as Record<string, unknown> | null;

    return (message.batch?.['batchType'] as string | undefined)
      ?? (nestedBatch?.['batchType'] as string | undefined);
  }

  private isTargetedToCurrentUser(message: BatchFinishedMessage, currentUserId?: number): boolean {
    const payloadTarget = this.extractTargetUserId(message);

    if (payloadTarget === undefined || payloadTarget === null || payloadTarget === '') {
      return true;
    }

    if (typeof currentUserId !== 'number') {
      return true;
    }

    return String(payloadTarget) === String(currentUserId);
  }

  private extractTargetUserId(message: BatchFinishedMessage): unknown {
    const recordMessage = message as Record<string, unknown>;
    const data = (recordMessage['data'] ?? null) as Record<string, unknown> | null;
    const batch = (recordMessage['batch'] ?? null) as Record<string, unknown> | null;

    return message.targetUserId
      ?? message.target_user_id
      ?? data?.['targetUserId']
      ?? data?.['target_user_id']
      ?? batch?.['targetUserId']
      ?? batch?.['target_user_id'];
  }

  loadData(page = 1): void {
    this.loading.set(true);
    this.productService.getProductsCatalog(this.pageSize(), page, this.searchTerm(), this.clasificacionFilter())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.products.set(res.data);
          this.currentPage.set(res.current_page ?? page);
          this.totalPages.set(res.last_page ?? 1);
          this.hasNextPage.set(!!res.next_page_url);
          this.hasPrevPage.set(!!res.prev_page_url);
        },
        error: (err) => console.error('Error loading products catalog', err),
      });
  }

  onNextPage(): void {
    const page = this.currentPage();
    if (page < this.totalPages()) this.loadData(page + 1);
  }

  onPrevPage(): void {
    const page = this.currentPage();
    if (page > 1) this.loadData(page - 1);
  }

  onFirstPage(): void {
    if (this.currentPage() !== 1) this.loadData(1);
  }

  onLastPage(): void {
    const last = this.totalPages();
    if (this.currentPage() !== last) this.loadData(last);
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.loadData(1);
  }

  onClasificacionFilterChange(value: string): void {
    const normalized = (value ?? 'all') as ProductClasificacionFilter;
    if (normalized === this.clasificacionFilter()) return;

    this.clasificacionFilter.set(normalized);
    this.loadData(1);
  }

  onSearch(term: string): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      const normalized = term.trim();
      if (normalized === this.searchTerm()) return;
      this.searchTerm.set(normalized);
      this.loadData(1);
    }, 350);
  }
}
