import { isPlatformBrowser } from '@angular/common';
import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { ChartConfiguration, ChartData, ChartOptions, ChartType } from 'chart.js';
import { ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { StatCard } from '../../components/stat-card/stat-card';
import { BaseChartDirective } from 'ng2-charts';
import { Badge } from '../../../../shared/components/ui/badge/badge';
import { TranslatePipe } from '@ngx-translate/core';

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

@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css',
    imports: [
        ReactiveFormsModule,
        LucideAngularModule,
        StatCard,
        BaseChartDirective,
        Badge,
        TranslatePipe,
    ],
})
export class Dashboard {

  public lineChartType: ChartType = 'line';

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: ['Día 1', 'Día 2', 'Día 3', 'Día 4', 'Día 5', 'Día 6', 'Día 7', 'Día 8', 'Día 9', 'Día 10', 
             'Día 11', 'Día 12', 'Día 13', 'Día 14', 'Día 15', 'Día 16', 'Día 17', 'Día 18', 'Día 19', 'Día 20',
             'Día 21', 'Día 22', 'Día 23', 'Día 24', 'Día 25', 'Día 26', 'Día 27', 'Día 28', 'Día 29', 'Día 30'],
    datasets: [
      {
        data: [10, 25, 18, 30, 22, 35, 28, 42, 38, 45, 40, 50, 48, 55, 52, 60, 58, 65, 62, 70, 68, 75, 72, 80, 78, 85, 82, 90, 88, 95],
        label: 'Número de peticiones',
        fill: false,
        tension: 0.4
      }
    ]
  };

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
}
