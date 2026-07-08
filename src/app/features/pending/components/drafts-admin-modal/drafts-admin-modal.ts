import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize, map, startWith } from 'rxjs';
import { DestroyRef } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { RequestService } from '../../../../core/services/request-service';
import { Request, RequestType } from '../../../../data/interfaces/Request';

@Component({
  selector: 'app-drafts-admin-modal',
  imports: [Modal, Spinner, ReactiveFormsModule, TranslatePipe, DatePipe],
  templateUrl: './drafts-admin-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftsAdminModal {
  private readonly requestsService = inject(RequestService);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = input(false);
  readonly requestTypes = input<RequestType[]>([]);

  readonly openChange = output<boolean>();

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly requestTypeControl = new FormControl<string>('all', { nonNullable: true });

  protected readonly rows = signal<Request[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly currentPage = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly total = signal(0);

  constructor() {
    effect(() => {
      const isOpen = this.open();

      if (!isOpen) {
        this.rows.set([]);
        this.loadError.set(null);
        this.currentPage.set(1);
        this.lastPage.set(1);
        this.total.set(0);
        this.searchControl.setValue('', { emitEvent: false });
        this.requestTypeControl.setValue('all', { emitEvent: false });
        return;
      }

      this.loadPage(1);
    });

    this.searchControl.valueChanges.pipe(
      startWith(this.searchControl.value),
      debounceTime(350),
      map(value => value.trim()),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      if (this.open()) {
        this.loadPage(1);
      }
    });
  }

  protected onOpenChange(isOpen: boolean): void {
    this.openChange.emit(isOpen);
  }

  protected onRequestTypeChange(): void {
    this.loadPage(1);
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) {
      return;
    }
    this.loadPage(page);
  }

  protected userLabel(row: Request): string {
    return row.user?.fullName ?? '-';
  }

  protected reasonLabel(row: Request): string {
    return row.reason?.name ?? '-';
  }

  protected classificationLabel(row: Request): string {
    return row.classification?.name ?? '-';
  }

  protected customerLabel(row: Request): string {
    if (row.customerId == null) {
      return '-';
    }
    return row.razonSocial ? `${row.customerId} - ${row.razonSocial}` : String(row.customerId);
  }

  protected deletedByLabel(row: Request): string {
    return row.deletedAt ? String(row.deletedBy ?? '-') : '-';
  }

  private loadPage(page: number): void {
    const requestTypeId = this.requestTypeControl.value === 'all' ? null : Number(this.requestTypeControl.value);

    this.isLoading.set(true);
    this.loadError.set(null);

    this.requestsService.getAllDraftsPaginated(10, page, this.searchControl.value, requestTypeId).pipe(
      finalize(() => this.isLoading.set(false)),
    ).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.currentPage.set(response.current_page ?? 1);
        this.lastPage.set(response.last_page ?? 1);
        this.total.set(response.total ?? response.data.length);
      },
      error: (error: unknown) => {
        const apiMessage = (error as { error?: { message?: string } })?.error?.message;
        this.loadError.set(apiMessage?.trim() || 'No fue posible cargar los borradores.');
        this.rows.set([]);
      },
    });
  }
}
