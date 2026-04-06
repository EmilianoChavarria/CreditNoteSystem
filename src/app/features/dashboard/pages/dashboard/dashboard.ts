import { Component, computed, inject, signal } from '@angular/core';
import { ChartData, ChartDataset, ChartOptions, ChartType } from 'chart.js';
import { LucideAngularModule } from 'lucide-angular';
import { BaseChartDirective } from 'ng2-charts';
import { Badge } from '../../../../shared/components/ui/badge/badge';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DashboardService } from '../../../../core/services/dashboard-service';
import { ToastService } from '../../../../core/services/toast-service';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { finalize } from 'rxjs';
import { DashboardChartQueryParams, DashboardChartSeries } from '../../../../data/interfaces/DashboardChart';

interface RequestItem {
  id: string;
  title: string;
  amount: string;
  client: string;
  additionalInfo?: string;
  badgeColor: 'purple' | 'blue' | 'red' | 'green' | 'orange' | 'yellow';
  badgeText: string;
}

interface DashboardSection {
  title: string;
  requests: RequestItem[];
}

type LineChartDataset = ChartDataset<'line', Array<number | null>>;
type LineChartData = ChartData<'line', Array<number | null>, string>;

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  imports: [
    LucideAngularModule,
    BaseChartDirective,
    Badge,
    TranslatePipe,
    Spinner
  ],
})
export class Dashboard {

  private _translate = inject(TranslateService);
  private _dashboardService = inject(DashboardService);
  private _toastService = inject(ToastService);
  private readonly chartColors = ['#ff8200', '#2563eb', '#dc2626', '#16a34a', '#7c3aed'];

  public selectedRequestType = signal<string>('todas');
  public selectedDateOption = signal<'1' | '2' | 'custom'>('1');
  public startDate = signal('');
  public endDate = signal('');

  public lineChartType: ChartType = 'line';

  public lineChartData = signal<LineChartData>({
    labels: [],
    datasets: []
  });

  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      }
    }
  };

  public recentRequests: DashboardSection[] = [
    {
      title: 'Recent Requests',
      requests: [
        {
          id: 'LL-2026-0156',
          title: 'Credit Note #LL-2026-0156',
          amount: '$2,458,325',
          client: 'Acme Corporation',
          badgeColor: 'green',
          badgeText: 'Approved'
        }
      ]
    },
    {
      title: 'Pending Approvals',
      requests: [
        {
          id: 'LL-2026-0157',
          title: 'Credit Note #LL-2026-0156',
          amount: '$2,458,325',
          client: 'Acme Corporation',
          additionalInfo: 'Juanito Perez | 22/02/2026',
          badgeColor: 'green',
          badgeText: 'Credit'
        },
        {
          id: 'LL-2026-0158',
          title: 'Credit Note #LL-2026-0156',
          amount: '$2,458,325',
          client: 'Acme Corporation',
          badgeColor: 'blue',
          badgeText: 'Debit'
        }
      ]
    }
  ];

  public isLoadingChart = signal<boolean>(true)

  public chartHeader = computed(() => {
    const requestTypeKey = this.getRequestTypeTranslationKey(this.selectedRequestType());
    const requestTypeLabel = this._translate.instant(requestTypeKey);
    const selectedDateOption = this.selectedDateOption();

    if (selectedDateOption === 'custom' && this.startDate() && this.endDate()) {
      return `Orders (${requestTypeLabel}) ${this.startDate()} - ${this.endDate()}`;
    }

    const periodLabel = selectedDateOption === '1'
      ? this._translate.instant('DASHBOARD.DATE_OPTION1')
      : this._translate.instant('DASHBOARD.DATE_OPTION2');

    return `Orders (${requestTypeLabel}) - ${periodLabel}`;
  });


  constructor() {
    this.getDays();
  }

  getDays(): void {
    this.isLoadingChart.set(true);
    const params = this.buildChartQueryParams();

    this._dashboardService.getDaysChart(params).pipe(
      finalize(() => this.isLoadingChart.set(false))
    ).subscribe({
      next: (response) => {
        const series = response?.series ?? [];
        const days = this.getOrderedDays(series);
        const datasets = this.buildDatasets(series, days);

        this.lineChartData.set({
          labels: days,
          datasets,
        });
      },
      error: (error) => {
        console.log(error);
        this.lineChartData.set({ labels: [], datasets: [] });
      }
    })
  }

  private buildChartQueryParams(): DashboardChartQueryParams {
    const params: DashboardChartQueryParams = {};
    const requestType = this.selectedRequestType();
    const selectedDateOption = this.selectedDateOption();

    if (requestType !== 'todas') {
      params.request_type_id = requestType;
    }

    if (selectedDateOption === '1') {
      params.days = 30;
      return params;
    }

    if (selectedDateOption === '2') {
      params.days = 60;
      return params;
    }

    const startDate = this.startDate();
    const endDate = this.endDate();

    if (startDate && endDate) {
      params.from = startDate;
      params.to = endDate;
    }

    return params;
  }

  private getOrderedDays(series: DashboardChartSeries[]): string[] {
    const uniqueDays = new Set<string>();

    for (const serie of series) {
      for (const point of serie.data) {
        uniqueDays.add(point.dia);
      }
    }

    return Array.from(uniqueDays).sort((firstDay, secondDay) => firstDay.localeCompare(secondDay));
  }

  private buildDatasets(series: DashboardChartSeries[], days: string[]): LineChartDataset[] {
    return series.map((serie, index) => {
      const color = this.chartColors[index % this.chartColors.length];
      const valuesByDay = new Map(serie.data.map((point) => [point.dia, point.cantidad]));

      return {
        label: serie.label || this._translate.instant('DASHBOARD.LABEL'),
        data: days.map((day) => valuesByDay.get(day) ?? null),
        fill: false,
        tension: 0.4,
        spanGaps: true,
        borderColor: color,
        backgroundColor: color,
        pointBackgroundColor: color,
        pointBorderColor: color,
      };
    });
  }

  private getRequestTypeTranslationKey(requestTypeId: string): string {
    const translationMap: Record<string, string> = {
      '1': 'REQUEST_TYPES.CREDIT',
      '2': 'REQUEST_TYPES.DEBIT',
      '3': 'REQUEST_TYPES.AUDITOR_CREDIT',
      '4': 'REQUEST_TYPES.AUDITOR_DEBIT',
      '5': 'REQUEST_TYPES.RE_INVOICING',
      '6': 'REQUEST_TYPES.MATERIAL_RETURN',
      todas: 'REQUEST_TYPES.ALL_TYPES',
    };

    return translationMap[requestTypeId] ?? 'REQUEST_TYPES.ALL_TYPES';
  }

  public onDateOptionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target.value === '1' || target.value === '2' || target.value === 'custom') {
      this.selectedDateOption.set(target.value);
    }

    if (target.value !== 'custom') {
      this.startDate.set('');
      this.endDate.set('');
      this.getDays();
    }
  }

  public onRequestTypeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedRequestType.set(target.value);
    this.getDays();
  }

  public onStartDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;

    if (this.isDateGreaterThanToday(target.value)) {
      this._toastService.warning('La fecha inicial no puede ser mayor que hoy.', 'Advertencia');
      target.value = '';
      this.startDate.set('');
      return;
    }

    this.startDate.set(target.value);
    this.fetchWhenCustomRangeIsComplete();
  }

  public onEndDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;

    if (this.isDateGreaterThanToday(target.value)) {
      this._toastService.warning('La fecha final no puede ser mayor que hoy.', 'Advertencia');
      target.value = '';
      this.endDate.set('');
      return;
    }

    this.endDate.set(target.value);
    this.fetchWhenCustomRangeIsComplete();
  }

  private isDateGreaterThanToday(dateValue: string): boolean {
    if (!dateValue) {
      return false;
    }

    const today = this.getTodayDateString();
    return dateValue > today;
  }

  private getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private fetchWhenCustomRangeIsComplete(): void {
    if (this.selectedDateOption() !== 'custom') {
      return;
    }

    if (!this.startDate() || !this.endDate()) {
      return;
    }

    this.getDays();
  }
}
