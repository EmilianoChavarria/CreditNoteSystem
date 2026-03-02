import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ChartConfiguration, ChartData, ChartOptions, ChartType } from 'chart.js';
import { ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BaseChartDirective } from 'ng2-charts';
import { Badge } from '../../../../shared/components/ui/badge/badge';
import { TranslatePipe } from '@ngx-translate/core';
import { DashboardService } from '../../../../core/services/dashboard-service';
import { Spinner } from "../../../../shared/components/ui/spinner/spinner";

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

export interface ChartDataS {
  dia: string;
  cantidad: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    BaseChartDirective,
    Badge,
    TranslatePipe,
    Spinner
],
})
export class Dashboard {

  public selectedDateOption = signal('1');
  public startDate = signal('');
  public endDate = signal('');

  public lineChartType: ChartType = 'line';

  public chartData: ChartDataS[] = [];

  public lineChartData = signal<ChartConfiguration<'line'>['data']>({
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Número de peticiones',
        fill: false,
        tension: 0.4
      }
    ]
  });

  public lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true
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

  public title = signal<string>('')


  constructor(
    private _dashboardService: DashboardService
  ) {
    this.getDays();
  }

  getDays(): void {
    this._dashboardService.getDaysChart().subscribe({
      next: (response) => {
        console.log(response);
        this.chartData = response;
        const days: string[] = [];
        const count: number[] = [];
        this.chartData.map((day) => {
          days.push(day.dia);
          count.push(day.cantidad);
        });
        this.lineChartData.set({
          labels: days,
          datasets: [
            {
              ...this.lineChartData().datasets[0],
              data: count,
            },
          ],
        });
        this.isLoadingChart.set(false);
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  public onDateOptionChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedDateOption.set(target.value);

    if (target.value !== 'custom') {
      this.startDate.set('');
      this.endDate.set('');
    }
  }

  public onStartDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.startDate.set(target.value);
  }

  public onEndDateChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.endDate.set(target.value);
  }
}
