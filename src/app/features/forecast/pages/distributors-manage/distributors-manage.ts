import { Component, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, type AccionPersonalizada, type Column } from '../../../../shared/components/ui/table/table';
import { TabsContainer } from '../../../../shared/components/ui/tab/tab-container/tab-container';
import { Tab } from '../../../../shared/components/ui/tab/tab';
import { Popover } from '../../../../shared/components/ui/popover/popover';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ClientGroup, DistributorRecord, ForecastClient, ForecastService } from '../../../../core/services/forecast.service';
import { AuthService } from '../../../../core/services/auth-service';
import { BatchFinishedMessage, ReverbSocketService } from '../../../../core/services/reverb-socket-service';
import { EditDistributorModal } from './edit-distributor-modal';
import { GroupForecastModal } from '../../components/group-forecast-modal/group-forecast-modal';
import { CreateGroupModal } from '../../components/create-group-modal/create-group-modal';
import { GroupMembersModal } from '../../components/group-members-modal/group-members-modal';
import { EditGroupModal } from '../../components/edit-group-modal/edit-group-modal';
import { DistributorForecastModal } from '../../components/distributor-forecast-modal/distributor-forecast-modal';
import { BulkDistributorUploadModal } from '../../components/bulk-distributor-upload-modal/bulk-distributor-upload-modal';
import { BulkDistributorHistoryModal } from './components/bulk-distributor-history-modal/bulk-distributor-history-modal';
import { BulkNationalCustomersUploadModal } from '../../components/bulk-national-customers-upload-modal/bulk-national-customers-upload-modal';
import { BulkNationalCustomersHistoryModal } from './components/bulk-national-customers-history-modal/bulk-national-customers-history-modal';
import { EditNationalCustomerModal } from './components/edit-national-customer-modal/edit-national-customer-modal';
import { AddNationalCustomerModal } from './components/add-national-customer-modal/add-national-customer-modal';

@Component({
  selector: 'app-distributors-manage',
  imports: [TranslatePipe, DecimalPipe, Table, TabsContainer, Tab, Popover, Modal, LucideAngularModule, DatePipe, EditDistributorModal, GroupForecastModal, CreateGroupModal, GroupMembersModal, EditGroupModal, DistributorForecastModal, BulkDistributorUploadModal, BulkDistributorHistoryModal, BulkNationalCustomersUploadModal, BulkNationalCustomersHistoryModal, EditNationalCustomerModal, AddNationalCustomerModal],
  templateUrl: './distributors-manage.html',
  styleUrl: './distributors-manage.css',
})
export class DistributorsManage implements OnInit {
  private readonly socketService = inject(ReverbSocketService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly bulkHistoryModal = viewChild(BulkDistributorHistoryModal);
  private readonly nationalBulkHistoryModal = viewChild(BulkNationalCustomersHistoryModal);
  readonly clients = signal<ForecastClient[]>([]);
  readonly loading = signal(true);
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);
  readonly hasNextPage = signal(false);
  readonly hasPrevPage = signal(false);
  readonly pageSize = signal(15);
  readonly searchTerm = signal('');

  readonly editNationalCustomerModalOpen = signal(false);
  readonly selectedNationalCustomer = signal<ForecastClient | null>(null);
  readonly nationalBulkUploadModalOpen = signal(false);
  readonly nationalBulkHistoryModalOpen = signal(false);
  readonly addNationalCustomerModalOpen = signal(false);
  readonly deleteNationalCustomerModalOpen = signal(false);
  readonly deleteNationalCustomerTarget = signal<ForecastClient | null>(null);
  readonly deletingNationalCustomer = signal(false);

  readonly foreignClients = signal<DistributorRecord[]>([]);
  readonly foreignLoading = signal(true);
  readonly foreignCurrentPage = signal(1);
  readonly foreignTotalPages = signal(1);
  readonly foreignHasNextPage = signal(false);
  readonly foreignHasPrevPage = signal(false);
  readonly foreignPageSize = signal(15);
  readonly foreignSearchTerm = signal('');
  readonly foreignZone = signal('all');
  readonly zoneFilterOptions = [
    { label: 'FORECAST.DISTRIBUTORS.ZONE_CENTROAMERICA', value: 'centroamerica' },
    { label: 'FORECAST.DISTRIBUTORS.ZONE_ARGENTINA', value: 'argentina' },
  ];
  readonly foreignModalOpen = signal(false);
  readonly selectedForeignClient = signal<ForecastClient | null>(null);
  readonly foreignBulkUploadModalOpen = signal(false);
  readonly bulkHistoryModalOpen = signal(false);

  readonly forecastModalOpen = signal(false);
  readonly selectedForecastDistributor = signal<DistributorRecord | null>(null);

  readonly groups = signal<ClientGroup[]>([]);
  readonly groupsLoading = signal(true);
  readonly groupForecastModalOpen = signal(false);
  readonly selectedGroup = signal<ClientGroup | null>(null);

  readonly createGroupModalOpen = signal(false);
  readonly membersModalOpen = signal(false);
  readonly membersModalGroup = signal<ClientGroup | null>(null);
  readonly editGroupModalOpen = signal(false);
  readonly editGroupTarget = signal<ClientGroup | null>(null);
  readonly deleteGroupModalOpen = signal(false);
  readonly deleteGroupTarget = signal<ClientGroup | null>(null);
  readonly deletingGroup = signal(false);

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;
  private foreignSearchDebounce: ReturnType<typeof setTimeout> | null = null;

  readonly columns: Column<ForecastClient>[];
  readonly acciones: AccionPersonalizada<ForecastClient>[];
  readonly foreignColumns: Column<DistributorRecord>[];
  readonly foreignAcciones: AccionPersonalizada<DistributorRecord>[];

  constructor(
    private readonly forecastService: ForecastService,
    private readonly translate: TranslateService,
    private readonly toastr: ToastrService,
  ) {
    this.columns = [
      { key: 'idCliente', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_ID'), sortable: true, customTemplate: true },
      { key: 'razonSocial', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_RAZON_SOCIAL'), sortable: true, customTemplate: true },
      { key: 'rfc', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_RFC'), sortable: true, customTemplate: true },
      { key: 'direccion', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_ADDRESS'), sortable: true, customTemplate: true },
      { key: 'emails', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_EMAILS'), sortable: false, customTemplate: true },
      { key: 'returnPercentage', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_RETURN'), sortable: false, customTemplate: true },
      { key: 'currency', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_CURRENCY'), sortable: false, customTemplate: true },
    ];
    this.acciones = [
      {
        label: this.translate.instant('FORECAST.DISTRIBUTORS.ACTION_EDIT_EMAILS_RETURN'),
        icon: 'pencil',
        className: 'text-left text-gray-700',
        accion: (item) => this.openEditNationalCustomerModal(item),
      },
      {
        label: this.translate.instant('FORECAST.DISTRIBUTORS.ACTION_REMOVE_NATIONAL'),
        icon: 'trash',
        className: 'text-left text-red-600',
        accion: (item) => this.askDeleteNationalCustomer(item),
      },
    ];
    this.foreignColumns = [
      { key: 'clientNumber', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_ID'), sortable: true, customTemplate: true },
      { key: 'businessName', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_RAZON_SOCIAL'), sortable: true, customTemplate: true },
      { key: 'taxId', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_RFC'), sortable: true, customTemplate: true },
      { key: 'address', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_ADDRESS'), sortable: true, customTemplate: true },
      { key: 'emails', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_EMAILS'), sortable: false, customTemplate: true },
      { key: 'salesEngineerName', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_SALES_ENGINEER'), sortable: false, customTemplate: true },
      { key: 'salesManagerName', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_SALES_MANAGER'), sortable: false, customTemplate: true },
    ];
    this.foreignAcciones = [
      {
        label: this.translate.instant('FORECAST.DISTRIBUTORS.ACTION_EDIT'),
        icon: 'pencil',
        className: 'text-left text-gray-700',
        accion: (item) => this.openEditForeignModal(item),
      },
      {
        label: this.translate.instant('FORECAST.DISTRIBUTORS.ACTION_VIEW_FORECAST'),
        icon: 'bar-chart-2',
        className: 'text-left text-gray-700',
        accion: (item) => this.openForecastModal(item),
      },
    ];
    this.loadData();
    this.loadGroups();
    this.loadForeignData();
  }

  ngOnInit(): void {
    this.socketService.connectToGlobalNotifications();

    this.socketService.batchFinished$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message) => this.handleBatchFinishedEvent(message));
  }

  private handleBatchFinishedEvent(message: BatchFinishedMessage): void {
    if (this.resolveEventName(message) !== 'batch.finished') return;

    const batchType = this.resolveBatchType(message);
    if (batchType !== 'distributors' && batchType !== 'nationalCustomers') return;

    const currentUserId = this.authService.getCurrentUser()?.id;
    if (!this.isTargetedToCurrentUser(message, currentUserId)) return;

    if (batchType === 'nationalCustomers') {
      this.toastr.info(this.translate.instant('FORECAST.DISTRIBUTORS.NATIONAL_BULK_UPLOAD_FINISHED_REFRESH'));
      this.loadData(this.currentPage());
      this.nationalBulkHistoryModal()?.refresh();
      return;
    }

    this.toastr.info(this.translate.instant('FORECAST.DISTRIBUTORS.BULK_UPLOAD_FINISHED_REFRESH'));
    this.loadForeignData(this.foreignCurrentPage());
    this.bulkHistoryModal()?.refresh();
  }

  openBulkHistoryModal(): void {
    this.bulkHistoryModalOpen.set(true);
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

  openEditNationalCustomerModal(client: ForecastClient): void {
    this.selectedNationalCustomer.set(client);
    this.editNationalCustomerModalOpen.set(true);
  }

  onNationalCustomerSaved(): void {
    this.loadData(this.currentPage());
  }

  openAddNationalCustomerModal(): void {
    this.addNationalCustomerModalOpen.set(true);
  }

  onNationalCustomerAdded(): void {
    this.loadData(1);
  }

  askDeleteNationalCustomer(client: ForecastClient): void {
    this.deleteNationalCustomerTarget.set(client);
    this.deleteNationalCustomerModalOpen.set(true);
  }

  cancelDeleteNationalCustomer(): void {
    this.deleteNationalCustomerModalOpen.set(false);
    this.deleteNationalCustomerTarget.set(null);
  }

  confirmDeleteNationalCustomer(): void {
    const target = this.deleteNationalCustomerTarget();
    if (!target || this.deletingNationalCustomer()) return;

    this.deletingNationalCustomer.set(true);
    this.forecastService
      .deleteNationalCustomer(target.idCliente)
      .pipe(finalize(() => this.deletingNationalCustomer.set(false)))
      .subscribe({
        next: () => {
          this.cancelDeleteNationalCustomer();
          this.loadData(this.currentPage());
          this.toastr.success(this.translate.instant('FORECAST.DISTRIBUTORS.REMOVE_NATIONAL_SUCCESS'));
        },
        error: (err) => this.toastr.error(
          err?.error?.message ?? this.translate.instant('FORECAST.DISTRIBUTORS.REMOVE_NATIONAL_ERROR')
        ),
      });
  }

  openNationalBulkUploadModal(): void {
    this.nationalBulkUploadModalOpen.set(true);
  }

  openNationalBulkHistoryModal(): void {
    this.nationalBulkHistoryModalOpen.set(true);
  }

  onNationalBulkUploaded(): void {
    this.loadData(this.currentPage());
    this.nationalBulkHistoryModal()?.refresh();
  }

  openCreateForeignClient(): void {
    this.selectedForeignClient.set(null);
    this.foreignModalOpen.set(true);
  }

  openEditForeignModal(record: DistributorRecord): void {
    this.selectedForeignClient.set({
      idCliente: record.clientNumber,
      razonSocial: record.businessName,
      rfc: record.taxId,
      direccion: record.address,
      correosForecast: record.emails,
      countrycode: record.countrycode,
      salesEngineerId: record.salesEngineerId,
      salesManagerId: record.salesManagerId,
    });
    this.foreignModalOpen.set(true);
  }

  openForeignBulkUpload(): void {
    this.foreignBulkUploadModalOpen.set(true);
  }

  onForeignBulkUploaded(): void {
    this.loadForeignData(this.foreignCurrentPage());
    this.bulkHistoryModal()?.refresh();
  }

  openForecastModal(record: DistributorRecord): void {
    this.selectedForecastDistributor.set(record);
    this.forecastModalOpen.set(true);
  }

  loadGroups(): void {
    this.groupsLoading.set(true);
    this.forecastService.getClientGroups()
      .pipe(finalize(() => this.groupsLoading.set(false)))
      .subscribe({
        next: (groups) => this.groups.set(groups),
        error: (err) => console.error('Error loading client groups', err),
      });
  }

  openGroupForecast(group: ClientGroup): void {
    this.selectedGroup.set(group);
    this.groupForecastModalOpen.set(true);
  }

  closeGroupForecast(): void {
    this.groupForecastModalOpen.set(false);
  }

  groupInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }

  openCreateGroup(): void {
    this.createGroupModalOpen.set(true);
  }

  onGroupCreated(group: ClientGroup): void {
    this.groups.update(current => [group, ...current]);
    this.membersModalGroup.set(group);
    this.membersModalOpen.set(true);
  }

  openManageMembers(group: ClientGroup): void {
    this.membersModalGroup.set(group);
    this.membersModalOpen.set(true);
  }

  closeMembersModal(): void {
    this.membersModalOpen.set(false);
  }

  onMembersChanged(): void {
    this.loadGroups();
  }

  openEditGroup(group: ClientGroup): void {
    this.editGroupTarget.set(group);
    this.editGroupModalOpen.set(true);
  }

  onGroupUpdated(updated: ClientGroup): void {
    this.groups.update(current => current.map(g => g.id === updated.id ? { ...g, ...updated } : g));
  }

  openDeleteGroup(group: ClientGroup): void {
    this.deleteGroupTarget.set(group);
    this.deleteGroupModalOpen.set(true);
  }

  cancelDeleteGroup(): void {
    this.deleteGroupModalOpen.set(false);
    this.deleteGroupTarget.set(null);
  }

  confirmDeleteGroup(): void {
    const group = this.deleteGroupTarget();
    if (!group || this.deletingGroup()) return;

    this.deletingGroup.set(true);
    this.forecastService.deleteClientGroup(group.id)
      .pipe(finalize(() => this.deletingGroup.set(false)))
      .subscribe({
        next: () => {
          this.groups.update(current => current.filter(g => g.id !== group.id));
          this.deleteGroupModalOpen.set(false);
          this.deleteGroupTarget.set(null);
          this.toastr.success(this.translate.instant('FORECAST.DISTRIBUTORS.DELETE_GROUP_SUCCESS'));
        },
        error: (err) => this.toastr.error(err?.error?.message ?? this.translate.instant('FORECAST.DISTRIBUTORS.DELETE_GROUP_ERROR')),
      });
  }

  loadData(page = 1): void {
    this.loading.set(true);
    this.forecastService
      .getClientsPaginated(this.pageSize(), page, this.searchTerm())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.clients.set(res.data);
          this.currentPage.set(res.current_page ?? page);
          this.totalPages.set(res.last_page ?? 1);
          this.hasNextPage.set(!!res.next_page_url);
          this.hasPrevPage.set(!!res.prev_page_url);
        },
        error: (err) => console.error('Error loading forecast clients', err),
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

  splitEmails(value: string | null): string[] {
    if (!value) return [];
    return value.split(/[;,]/).map(e => e.trim()).filter(Boolean);
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

  onForeignZoneChange(value: string): void {
    this.foreignZone.set(value);
    this.loadForeignData(1);
  }

  loadForeignData(page = 1): void {
    this.foreignLoading.set(true);
    const zone = this.foreignZone();
    this.forecastService
      .getDistributorsPaginated(this.foreignPageSize(), page, this.foreignSearchTerm(), zone !== 'all' ? zone : undefined)
      .pipe(finalize(() => this.foreignLoading.set(false)))
      .subscribe({
        next: (res) => {
          this.foreignClients.set(res.data);
          this.foreignCurrentPage.set(res.current_page ?? page);
          this.foreignTotalPages.set(res.last_page ?? 1);
          this.foreignHasNextPage.set(!!res.next_page_url);
          this.foreignHasPrevPage.set(!!res.prev_page_url);
        },
        error: (err) => console.error('Error loading distributors', err),
      });
  }

  onForeignNextPage(): void {
    const page = this.foreignCurrentPage();
    if (page < this.foreignTotalPages()) this.loadForeignData(page + 1);
  }

  onForeignPrevPage(): void {
    const page = this.foreignCurrentPage();
    if (page > 1) this.loadForeignData(page - 1);
  }

  onForeignFirstPage(): void {
    if (this.foreignCurrentPage() !== 1) this.loadForeignData(1);
  }

  onForeignLastPage(): void {
    const last = this.foreignTotalPages();
    if (this.foreignCurrentPage() !== last) this.loadForeignData(last);
  }

  onForeignPageSizeChange(size: number): void {
    this.foreignPageSize.set(size);
    this.loadForeignData(1);
  }

  onForeignSearch(term: string): void {
    if (this.foreignSearchDebounce) clearTimeout(this.foreignSearchDebounce);
    this.foreignSearchDebounce = setTimeout(() => {
      const normalized = term.trim();
      if (normalized === this.foreignSearchTerm()) return;
      this.foreignSearchTerm.set(normalized);
      this.loadForeignData(1);
    }, 350);
  }
}
