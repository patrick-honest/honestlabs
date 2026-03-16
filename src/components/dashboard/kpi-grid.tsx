import type { KpiMetric } from "@/types/reports";
import { KpiCard } from "./kpi-card";

interface KpiGridProps {
  kpis: KpiMetric[];
  sparklines?: Record<string, { value: number }[]>;
}

export function KpiGrid({ kpis, sparklines }: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <KpiCard
          key={kpi.metric}
          kpi={kpi}
          sparklineData={sparklines?.[kpi.metric]}
        />
      ))}
    </div>
  );
}
