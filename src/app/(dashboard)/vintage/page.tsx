"use client";

import { useCallback, useState } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { usePeriod } from "@/hooks/use-period";
import { cn } from "@/lib/utils";

const AS_OF = "Mar 15, 2026";
const DATA_RANGE = { start: "Jul 2025", end: "Mar 2026" };

type ViewMode = "delinquency" | "activation" | "loss";

// Mock vintage data: rows = cohort month, columns = MOB
const cohortMonths = ["Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26"];
const mobColumns = ["MOB 1", "MOB 2", "MOB 3", "MOB 4", "MOB 5", "MOB 6", "MOB 7", "MOB 8"];

const delinquencyHeatmap: (number | null)[][] = [
  [1.2, 2.1, 3.0, 3.8, 4.2, 4.5, 4.7, 4.8],
  [1.1, 1.9, 2.8, 3.5, 4.0, 4.3, 4.5, null],
  [1.3, 2.3, 3.2, 4.0, 4.5, 4.8, null, null],
  [1.0, 1.8, 2.6, 3.3, 3.8, null, null, null],
  [0.9, 1.7, 2.5, 3.1, null, null, null, null],
  [1.1, 2.0, 2.9, null, null, null, null, null],
  [0.8, 1.5, null, null, null, null, null, null],
  [0.7, null, null, null, null, null, null, null],
];

const activationHeatmap: (number | null)[][] = [
  [55.2, 68.1, 74.3, 78.5, 81.2, 83.0, 84.1, 85.0],
  [57.1, 69.5, 75.8, 79.2, 82.0, 83.8, 84.9, null],
  [54.8, 67.2, 73.5, 77.8, 80.5, 82.3, null, null],
  [58.2, 70.1, 76.2, 80.1, 82.8, null, null, null],
  [60.5, 72.3, 78.1, 81.5, null, null, null, null],
  [62.1, 73.8, 79.5, null, null, null, null, null],
  [59.8, 71.2, null, null, null, null, null, null],
  [65.2, null, null, null, null, null, null, null],
];

const lossHeatmap: (number | null)[][] = [
  [0.0, 0.1, 0.3, 0.5, 0.8, 1.0, 1.2, 1.4],
  [0.0, 0.1, 0.2, 0.4, 0.7, 0.9, 1.1, null],
  [0.0, 0.1, 0.3, 0.6, 0.9, 1.1, null, null],
  [0.0, 0.1, 0.2, 0.4, 0.6, null, null, null],
  [0.0, 0.1, 0.2, 0.3, null, null, null, null],
  [0.0, 0.1, 0.2, null, null, null, null, null],
  [0.0, 0.1, null, null, null, null, null, null],
  [0.0, null, null, null, null, null, null, null],
];

const heatmapData: Record<ViewMode, (number | null)[][]> = {
  delinquency: delinquencyHeatmap,
  activation: activationHeatmap,
  loss: lossHeatmap,
};

function getDelinquencyColor(value: number): string {
  if (value <= 1.0) return "bg-emerald-900/60 text-emerald-300";
  if (value <= 2.0) return "bg-emerald-800/40 text-emerald-300";
  if (value <= 3.0) return "bg-yellow-900/50 text-yellow-300";
  if (value <= 4.0) return "bg-orange-900/50 text-orange-300";
  return "bg-red-900/60 text-red-300";
}

function getActivationColor(value: number): string {
  if (value >= 80) return "bg-emerald-900/60 text-emerald-300";
  if (value >= 70) return "bg-emerald-800/40 text-emerald-300";
  if (value >= 60) return "bg-yellow-900/50 text-yellow-300";
  if (value >= 50) return "bg-orange-900/50 text-orange-300";
  return "bg-red-900/60 text-red-300";
}

function getLossColor(value: number): string {
  if (value <= 0.2) return "bg-emerald-900/60 text-emerald-300";
  if (value <= 0.5) return "bg-emerald-800/40 text-emerald-300";
  if (value <= 0.8) return "bg-yellow-900/50 text-yellow-300";
  if (value <= 1.0) return "bg-orange-900/50 text-orange-300";
  return "bg-red-900/60 text-red-300";
}

const colorFns: Record<ViewMode, (v: number) => string> = {
  delinquency: getDelinquencyColor,
  activation: getActivationColor,
  loss: getLossColor,
};

const viewLabels: Record<ViewMode, string> = {
  delinquency: "Delinquency Rate (%)",
  activation: "Activation Rate (%)",
  loss: "Loss Rate (%)",
};

// Vintage comparison line chart data
const vintageComparison: Record<string, string | number>[] = [
  { mob: "MOB 1", jul25: 1.2, oct25: 1.0, jan26: 0.8 },
  { mob: "MOB 2", jul25: 2.1, oct25: 1.8, jan26: 1.5 },
  { mob: "MOB 3", jul25: 3.0, oct25: 2.6 },
  { mob: "MOB 4", jul25: 3.8, oct25: 3.3 },
  { mob: "MOB 5", jul25: 4.2, oct25: 3.8 },
  { mob: "MOB 6", jul25: 4.5 },
];

const activationComparison: Record<string, string | number>[] = [
  { mob: "MOB 1", jul25: 55.2, oct25: 58.2, jan26: 59.8 },
  { mob: "MOB 2", jul25: 68.1, oct25: 70.1, jan26: 71.2 },
  { mob: "MOB 3", jul25: 74.3, oct25: 76.2 },
  { mob: "MOB 4", jul25: 78.5, oct25: 80.1 },
  { mob: "MOB 5", jul25: 81.2, oct25: 82.8 },
  { mob: "MOB 6", jul25: 83.0 },
];

const actionItems: ActionItem[] = [
  {
    id: "vin-1",
    priority: "positive",
    action: "Jan 2026 cohort showing best early performance.",
    detail: "MOB 1 delinquency at 0.8% vs 1.2% for Jul 2025 cohort. Scorecard improvements in Q4 appear effective.",
  },
  {
    id: "vin-2",
    priority: "monitor",
    action: "Sep 2025 cohort has highest delinquency curve.",
    detail: "4.8% at MOB 6, above the 4.5% average. Monitor for early write-off signals.",
  },
  {
    id: "vin-3",
    priority: "positive",
    action: "Activation curves improving for recent cohorts.",
    detail: "Feb 2026 cohort at 65.2% MOB 1 activation, best ever. Onboarding improvements paying off.",
  },
];

export default function VintagePage() {
  const { periodLabel } = usePeriod();
  const [viewMode, setViewMode] = useState<ViewMode>("delinquency");

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  const data = heatmapData[viewMode];
  const getColor = colorFns[viewMode];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-white">Vintage Analysis</h1>
        <p className="text-sm text-slate-400 mt-1">{periodLabel}</p>
      </div>

      {/* View toggle */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 w-fit">
        {(["delinquency", "activation", "loss"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              "px-4 py-1.5 text-sm rounded-md font-medium transition-colors",
              viewMode === mode
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            )}
          >
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {/* Cohort heatmap */}
      <ChartCard
        title={`Cohort Heatmap: ${viewLabels[viewMode]}`}
        subtitle="Rows = approval month, Columns = month on book"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium sticky left-0 bg-slate-900">
                  Cohort
                </th>
                {mobColumns.map((mob) => (
                  <th key={mob} className="text-center py-2 px-3 text-slate-400 font-medium min-w-[72px]">
                    {mob}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortMonths.map((cohort, rowIdx) => (
                <tr key={cohort} className="border-b border-slate-800">
                  <td className="py-2 px-3 text-slate-300 font-medium sticky left-0 bg-slate-900">
                    {cohort}
                  </td>
                  {data[rowIdx].map((val, colIdx) => (
                    <td key={colIdx} className="py-1 px-1 text-center">
                      {val !== null ? (
                        <span
                          className={cn(
                            "inline-block w-full rounded px-2 py-1 text-xs font-medium",
                            getColor(val)
                          )}
                        >
                          {val.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-700 text-xs">&mdash;</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      {/* Vintage comparison charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Delinquency by Vintage"
          subtitle="Comparing selected cohorts"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={vintageComparison}
            lines={[
              { key: "jul25", color: "#ef4444", label: "Jul 2025" },
              { key: "oct25", color: "#f59e0b", label: "Oct 2025" },
              { key: "jan26", color: "#22c55e", label: "Jan 2026" },
            ]}
            xAxisKey="mob"
            valueType="percent"
            height={280}
          />
        </ChartCard>

        <ChartCard
          title="Activation Rate by Cohort"
          subtitle="Comparing selected cohorts"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={activationComparison}
            lines={[
              { key: "jul25", color: "#ef4444", label: "Jul 2025" },
              { key: "oct25", color: "#f59e0b", label: "Oct 2025" },
              { key: "jan26", color: "#22c55e", label: "Jan 2026" },
            ]}
            xAxisKey="mob"
            valueType="percent"
            height={280}
          />
        </ChartCard>
      </div>

      <ActionItems section="Vintage Analysis" items={actionItems} />
    </div>
  );
}
