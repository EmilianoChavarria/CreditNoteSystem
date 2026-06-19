import { Component, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { Table, type Column } from '../../../../shared/components/ui/table/table';
import { ForecastClient, ForecastService } from '../../../../core/services/forecast.service';

@Component({
  selector: 'app-distributors-manage',
  imports: [Table],
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

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  readonly columns: Column<ForecastClient>[] = [
    { key: 'idCliente', label: 'ID Cliente', sortable: true, customTemplate: true },
    { key: 'razonSocial', label: 'Razón Social', sortable: true, customTemplate: true },
    { key: 'rfc', label: 'RFC', sortable: true, customTemplate: true },
    { key: 'direccion', label: 'Dirección', sortable: true, customTemplate: true },
    { key: 'correosForecast', label: 'Correos Forecast', sortable: false, customTemplate: true },
  ];

  constructor(private readonly forecastService: ForecastService) {
    this.loadData();
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
