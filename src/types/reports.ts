export type Cycle = "weekly" | "monthly" | "quarterly" | "yearly";
export type Currency = "IDR" | "USD";

export interface KpiMetric {
  metric: string;
  label: string;
  value: number;
  prevValue: number | null;
  unit: "count" | "percent" | "idr" | "usd";
  changePercent: number | null;
  direction: "up" | "down" | "flat";
}

export interface ChartDataPoint {
  date: string;
  [key: string]: string | number;
}

export interface ReportSection {
  id: string;
  title: string;
  kpis: KpiMetric[];
  chartData: ChartDataPoint[];
  trends: string[];
}

export interface ReportSummary {
  id: string;
  cycle: Cycle;
  periodStart: string;
  periodEnd: string;
  section: string;
  title: string;
  generatedAt: string;
}
