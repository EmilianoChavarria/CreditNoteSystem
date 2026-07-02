import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ClientGroup, ClientGroupMember, ForecastClient, ForecastService } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-group-members-modal',
  imports: [TranslatePipe, Modal],
  templateUrl: './group-members-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupMembersModal {
  private readonly forecastService = inject(ForecastService);

  readonly open = input<boolean>(false);
  readonly group = input<ClientGroup | null>(null);

  readonly closed = output<void>();
  readonly membersChanged = output<void>();

  readonly members = signal<ClientGroupMember[]>([]);
  readonly membersLoading = signal(false);

  readonly searchTerm = signal('');
  readonly searchResults = signal<ForecastClient[]>([]);
  readonly searching = signal(false);
  readonly searchPage = signal(1);
  readonly searchPageSize = signal(10);
  readonly searchTotalPages = signal(1);
  readonly searchHasNext = signal(false);
  readonly searchHasPrev = signal(false);

  readonly pendingAddId = signal<string | null>(null);
  readonly pendingRemoveId = signal<string | null>(null);
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly addingSelected = signal(false);

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  private readonly loadEffect = effect(() => {
    const isOpen = this.open();
    const group = this.group();

    if (!isOpen || !group) {
      this.searchTerm.set('');
      this.searchResults.set([]);
      this.selectedIds.set(new Set());
      this.searchPage.set(1);
      this.searchTotalPages.set(1);
      this.searchHasNext.set(false);
      this.searchHasPrev.set(false);
      return;
    }

    this.loadMembers(group.id);
  });

  private loadMembers(groupId: number): void {
    this.membersLoading.set(true);
    this.forecastService.getGroupMembers(groupId).subscribe({
      next: (data) => {
        this.members.set(data.members);
        this.membersLoading.set(false);
      },
      error: () => this.membersLoading.set(false),
    });
  }

  onSearch(term: string): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      const normalized = term.trim();
      this.searchTerm.set(normalized);
      if (!normalized) {
        this.searchResults.set([]);
        this.searchPage.set(1);
        this.searchTotalPages.set(1);
        this.searchHasNext.set(false);
        this.searchHasPrev.set(false);
        return;
      }
      this.loadSearchPage(normalized, 1);
    }, 350);
  }

  searchNextPage(): void {
    if (this.searchHasNext()) this.loadSearchPage(this.searchTerm(), this.searchPage() + 1);
  }

  searchPrevPage(): void {
    if (this.searchHasPrev()) this.loadSearchPage(this.searchTerm(), this.searchPage() - 1);
  }

  onSearchPageSizeChange(size: number): void {
    this.searchPageSize.set(size);
    if (this.searchTerm()) this.loadSearchPage(this.searchTerm(), 1);
  }

  private loadSearchPage(term: string, page: number): void {
    this.searching.set(true);
    this.forecastService.getClientsPaginated(this.searchPageSize(), page, term).subscribe({
      next: (res) => {
        this.searchResults.set(res.data);
        this.searchPage.set(res.current_page ?? page);
        this.searchTotalPages.set(res.last_page ?? 1);
        this.searchHasNext.set(!!res.next_page_url);
        this.searchHasPrev.set(!!res.prev_page_url);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  isMember(idCliente: string): boolean {
    return this.members().some(m => String(m.clientId) === String(idCliente));
  }

  isSelected(idCliente: string): boolean {
    return this.selectedIds().has(idCliente);
  }

  toggleSelect(idCliente: string): void {
    if (this.isMember(idCliente)) return;
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(idCliente)) {
        next.delete(idCliente);
      } else {
        next.add(idCliente);
      }
      return next;
    });
  }

  isAllSelected(): boolean {
    const selectable = this.selectableResults();
    return selectable.length > 0 && selectable.every(id => this.isSelected(id));
  }

  toggleSelectAll(): void {
    const selectable = this.selectableResults();
    if (this.isAllSelected()) {
      this.selectedIds.update(current => {
        const next = new Set(current);
        selectable.forEach(id => next.delete(id));
        return next;
      });
    } else {
      this.selectedIds.update(current => new Set([...current, ...selectable]));
    }
  }

  private selectableResults(): string[] {
    return this.searchResults()
      .map(c => c.idCliente)
      .filter(idCliente => !this.isMember(idCliente));
  }

  addMember(client: ForecastClient): void {
    const group = this.group();
    if (!group || this.pendingAddId() !== null || this.isMember(client.idCliente)) return;

    this.pendingAddId.set(client.idCliente);
    this.forecastService.addGroupMember(group.id, client.idCliente).subscribe({
      next: () => {
        this.members.update(current => [...current, { clientId: client.idCliente, razonSocial: client.razonSocial }]);
        this.selectedIds.update(current => {
          const next = new Set(current);
          next.delete(client.idCliente);
          return next;
        });
        this.pendingAddId.set(null);
        this.membersChanged.emit();
      },
      error: () => this.pendingAddId.set(null),
    });
  }

  addSelectedMembers(): void {
    const group = this.group();
    const selectedIdCliente = Array.from(this.selectedIds());
    if (!group || selectedIdCliente.length === 0 || this.addingSelected()) return;

    const selectedClients = this.searchResults().filter(c => selectedIdCliente.includes(c.idCliente));

    this.addingSelected.set(true);
    this.forecastService.addGroupMembersBulk(group.id, selectedIdCliente).subscribe({
      next: () => {
        this.members.update(current => [
          ...current,
          ...selectedClients.map(c => ({ clientId: c.idCliente, razonSocial: c.razonSocial })),
        ]);
        this.selectedIds.set(new Set());
        this.addingSelected.set(false);
        this.membersChanged.emit();
      },
      error: () => this.addingSelected.set(false),
    });
  }

  removeMember(member: ClientGroupMember): void {
    const group = this.group();
    if (!group || this.pendingRemoveId() !== null) return;

    this.pendingRemoveId.set(member.clientId);
    this.forecastService.removeGroupMember(group.id, member.clientId).subscribe({
      next: () => {
        this.members.update(current => current.filter(m => m.clientId !== member.clientId));
        this.pendingRemoveId.set(null);
        this.membersChanged.emit();
      },
      error: () => this.pendingRemoveId.set(null),
    });
  }
}
