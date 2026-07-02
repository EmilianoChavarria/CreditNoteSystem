import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { finalize } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { ToastrService } from 'ngx-toastr';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Table, type AccionPersonalizada, type Column } from '../../../../shared/components/ui/table/table';
import { TabsContainer } from '../../../../shared/components/ui/tab/tab-container/tab-container';
import { Tab } from '../../../../shared/components/ui/tab/tab';
import { Popover } from '../../../../shared/components/ui/popover/popover';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ClientGroup, ForecastClient, ForecastService } from '../../../../core/services/forecast.service';
import { EditDistributorModal } from './edit-distributor-modal';
import { GroupForecastModal } from '../../components/group-forecast-modal/group-forecast-modal';
import { CreateGroupModal } from '../../components/create-group-modal/create-group-modal';
import { GroupMembersModal } from '../../components/group-members-modal/group-members-modal';
import { EditGroupModal } from '../../components/edit-group-modal/edit-group-modal';

@Component({
  selector: 'app-distributors-manage',
  imports: [TranslatePipe, Table, TabsContainer, Tab, Popover, Modal, LucideAngularModule, DatePipe, EditDistributorModal, GroupForecastModal, CreateGroupModal, GroupMembersModal, EditGroupModal],
  templateUrl: './distributors-manage.html',
  styleUrl: './distributors-manage.css',
})
export class DistributorsManage {
  readonly clients = signal<ForecastClient[]>([]);
  readonly loading = signal(true);
  readonly currentPage = signal(1);
  readonly totalPages = signal(1);
  readonly hasNextPage = signal(false);
  readonly hasPrevPage = signal(false);
  readonly pageSize = signal(15);
  readonly searchTerm = signal('');

  readonly editModalOpen = signal(false);
  readonly selectedClient = signal<ForecastClient | null>(null);

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

  readonly columns: Column<ForecastClient>[];
  readonly acciones: AccionPersonalizada<ForecastClient>[];

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
      { key: 'correosForecast', label: this.translate.instant('FORECAST.DISTRIBUTORS.COL_EMAILS'), sortable: false, customTemplate: true },
    ];
    this.acciones = [
      {
        label: this.translate.instant('FORECAST.DISTRIBUTORS.ACTION_EDIT'),
        icon: 'pencil',
        className: 'text-left text-gray-700',
        accion: (item) => this.openEditModal(item),
      },
    ];
    this.loadData();
    this.loadGroups();
  }

  openEditModal(client: ForecastClient): void {
    this.selectedClient.set(client);
    this.editModalOpen.set(true);
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
    return value.split(';').map(e => e.trim()).filter(Boolean);
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
