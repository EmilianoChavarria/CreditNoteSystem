export interface DashboardChartPoint {
  dia: string;
  cantidad: number;
}

export interface DashboardChartSeries {
  key: string;
  label: string;
  data: DashboardChartPoint[];
}
export interface DashboardChartTotals {
  created?: string;
  approved?: string;
  declined?: string
}

export interface DashboardChartResponse {
  from: string;
  to: string;
  totals: DashboardChartTotals;
  series: DashboardChartSeries[];
}

export interface DashboardChartQueryParams {
  request_type_id?: string;
  days?: number;
  from?: string;
  to?: string;
}