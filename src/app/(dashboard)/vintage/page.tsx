"use client";

import { useCallback, useMemo, useState } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { cn } from "@/lib/utils";
import { getPeriodRange } from "@/lib/period-data";
import { getFilterMultiplier, hasActiveFilters } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

type ViewMode = "delinquency" | "activation" | "loss" | "spend";
type TimeFrame = "monthly" | "weekly";

// Mock vintage data: rows = cohort month, columns = MOB
const cohortMonths = ["Jul 25", "Aug 25", "Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26"];
const mobColumns = ["MOB 1", "MOB 2", "MOB 3", "MOB 4", "MOB 5", "MOB 6", "MOB 7", "MOB 8"];

// Weekly cohorts (Monday start) — last 12 weeks
const cohortWeeks = [
  "Dec 22", "Dec 29", "Jan 05", "Jan 12", "Jan 19", "Jan 26",
  "Feb 02", "Feb 09", "Feb 16", "Feb 23", "Mar 02", "Mar 09",
];
const wobColumns = ["WOB 1", "WOB 2", "WOB 3", "WOB 4", "WOB 5", "WOB 6", "WOB 7", "WOB 8", "WOB 9", "WOB 10", "WOB 11", "WOB 12"];

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

// Spend heatmap: avg monthly spend per user in millions IDR by cohort/MOB
const spendHeatmap: (number | null)[][] = [
  [0.8, 1.2, 1.5, 1.7, 1.9, 2.0, 2.1, 2.1],
  [0.9, 1.3, 1.6, 1.8, 2.0, 2.1, 2.2, null],
  [0.7, 1.1, 1.4, 1.6, 1.8, 1.9, null, null],
  [1.0, 1.4, 1.7, 1.9, 2.1, null, null, null],
  [1.1, 1.5, 1.8, 2.1, null, null, null, null],
  [1.2, 1.6, 2.0, null, null, null, null, null],
  [1.0, 1.4, null, null, null, null, null, null],
  [1.3, null, null, null, null, null, null, null],
];

const heatmapData: Record<ViewMode, (number | null)[][]> = {
  delinquency: delinquencyHeatmap,
  activation: activationHeatmap,
  loss: lossHeatmap,
  spend: spendHeatmap,
};

// Weekly heatmaps (12 cohort weeks × 12 WOBs)
const weeklyDelinquencyHeatmap: (number | null)[][] = [
  [0.3, 0.6, 0.9, 1.1, 1.3, 1.5, 1.7, 1.8, 1.9, 2.0, 2.1, 2.1],
  [0.3, 0.5, 0.8, 1.0, 1.2, 1.4, 1.5, 1.7, 1.8, 1.9, 2.0, null],
  [0.2, 0.5, 0.7, 0.9, 1.1, 1.3, 1.5, 1.6, 1.7, 1.8, null, null],
  [0.3, 0.5, 0.8, 1.0, 1.2, 1.4, 1.5, 1.6, 1.7, null, null, null],
  [0.2, 0.4, 0.7, 0.9, 1.1, 1.3, 1.4, 1.5, null, null, null, null],
  [0.2, 0.5, 0.7, 0.9, 1.1, 1.2, 1.4, null, null, null, null, null],
  [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, null, null, null, null, null, null],
  [0.2, 0.4, 0.6, 0.8, 1.0, null, null, null, null, null, null, null],
  [0.2, 0.4, 0.6, 0.8, null, null, null, null, null, null, null, null],
  [0.2, 0.3, 0.5, null, null, null, null, null, null, null, null, null],
  [0.1, 0.3, null, null, null, null, null, null, null, null, null, null],
  [0.1, null, null, null, null, null, null, null, null, null, null, null],
];

const weeklyActivationHeatmap: (number | null)[][] = [
  [22.1, 38.5, 48.2, 55.1, 60.2, 64.1, 67.3, 69.8, 71.5, 73.0, 74.2, 75.0],
  [23.5, 39.8, 49.5, 56.2, 61.0, 65.0, 68.1, 70.5, 72.3, 73.8, 74.9, null],
  [24.2, 40.5, 50.1, 57.0, 62.1, 66.0, 69.0, 71.2, 73.0, 74.5, null, null],
  [23.8, 40.1, 49.8, 56.5, 61.5, 65.5, 68.5, 70.8, 72.5, null, null, null],
  [25.1, 41.2, 51.0, 57.8, 63.0, 66.8, 69.8, 72.0, null, null, null, null],
  [24.5, 40.8, 50.5, 57.2, 62.5, 66.2, 69.2, null, null, null, null, null],
  [25.8, 42.0, 52.0, 58.5, 63.8, 67.5, null, null, null, null, null, null],
  [26.2, 42.5, 52.5, 59.0, 64.2, null, null, null, null, null, null, null],
  [27.0, 43.2, 53.1, 59.8, null, null, null, null, null, null, null, null],
  [27.5, 43.8, 53.8, null, null, null, null, null, null, null, null, null],
  [28.2, 44.5, null, null, null, null, null, null, null, null, null, null],
  [29.0, null, null, null, null, null, null, null, null, null, null, null],
];

const weeklyLossHeatmap: (number | null)[][] = [
  [0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.3, 0.3, 0.3],
  [0.0, 0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.2, 0.2, 0.2, 0.3, null],
  [0.0, 0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.2, 0.2, 0.2, null, null],
  [0.0, 0.0, 0.0, 0.0, 0.1, 0.1, 0.1, 0.1, 0.2, null, null, null],
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.1, 0.1, null, null, null, null],
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.1, null, null, null, null, null],
  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null, null, null, null, null],
  [0.0, 0.0, 0.0, 0.0, 0.0, null, null, null, null, null, null, null],
  [0.0, 0.0, 0.0, 0.0, null, null, null, null, null, null, null, null],
  [0.0, 0.0, 0.0, null, null, null, null, null, null, null, null, null],
  [0.0, 0.0, null, null, null, null, null, null, null, null, null, null],
  [0.0, null, null, null, null, null, null, null, null, null, null, null],
];

const weeklySpendHeatmap: (number | null)[][] = [
  [0.2, 0.3, 0.4, 0.4, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
  [0.2, 0.3, 0.4, 0.4, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, null],
  [0.2, 0.3, 0.4, 0.4, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, null, null],
  [0.2, 0.3, 0.4, 0.4, 0.5, 0.5, 0.5, 0.5, 0.5, null, null, null],
  [0.2, 0.3, 0.4, 0.5, 0.5, 0.5, 0.5, 0.5, null, null, null, null],
  [0.2, 0.3, 0.4, 0.5, 0.5, 0.5, 0.5, null, null, null, null, null],
  [0.3, 0.4, 0.4, 0.5, 0.5, 0.5, null, null, null, null, null, null],
  [0.3, 0.4, 0.5, 0.5, 0.5, null, null, null, null, null, null, null],
  [0.3, 0.4, 0.5, 0.5, null, null, null, null, null, null, null, null],
  [0.3, 0.4, 0.5, null, null, null, null, null, null, null, null, null],
  [0.3, 0.4, null, null, null, null, null, null, null, null, null, null],
  [0.3, null, null, null, null, null, null, null, null, null, null, null],
];

const weeklyHeatmapData: Record<ViewMode, (number | null)[][]> = {
  delinquency: weeklyDelinquencyHeatmap,
  activation: weeklyActivationHeatmap,
  loss: weeklyLossHeatmap,
  spend: weeklySpendHeatmap,
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

function getSpendColor(value: number): string {
  if (value >= 2.0) return "bg-emerald-900/60 text-emerald-300";
  if (value >= 1.5) return "bg-emerald-800/40 text-emerald-300";
  if (value >= 1.0) return "bg-yellow-900/50 text-yellow-300";
  if (value >= 0.5) return "bg-orange-900/50 text-orange-300";
  return "bg-red-900/60 text-red-300";
}

const colorFns: Record<ViewMode, (v: number) => string> = {
  delinquency: getDelinquencyColor,
  activation: getActivationColor,
  loss: getLossColor,
  spend: getSpendColor,
};

const viewLabels: Record<ViewMode, string> = {
  delinquency: "Delinquency Rate (%)",
  activation: "Activation Rate (%)",
  loss: "Loss Rate (%)",
  spend: "Avg Spend per User (M IDR)",
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

// Spend by vintage comparison
const spendComparison: Record<string, string | number>[] = [
  { mob: "MOB 1", jul25: 0.8, oct25: 1.0, jan26: 1.0 },
  { mob: "MOB 2", jul25: 1.2, oct25: 1.4, jan26: 1.4 },
  { mob: "MOB 3", jul25: 1.5, oct25: 1.7 },
  { mob: "MOB 4", jul25: 1.7, oct25: 1.9 },
  { mob: "MOB 5", jul25: 1.9, oct25: 2.1 },
  { mob: "MOB 6", jul25: 2.0 },
];

const spendByVintageInsights: ChartInsight[] = [
  { text: "Oct 2025 cohort leads spend at every MOB, reaching IDR 2.1M per user at MOB 5 vs IDR 1.9M for Jul 2025.", type: "positive" },
  { text: "Jan 2026 cohort tracking in line with Oct 2025 at MOB 1-2, suggesting sustained improvement in early spend engagement.", type: "positive" },
  { text: "Spend growth typically decelerates after MOB 4, flattening near IDR 2.0-2.1M — indicates natural engagement ceiling.", type: "neutral" },
  { text: "QRIS adoption in newer cohorts may be contributing to higher early spend through low-friction micro-transactions.", type: "hypothesis" },
];

const spendHeatmapInsights: ChartInsight[] = [
  { text: "Feb 2026 cohort has the highest MOB 1 spend at IDR 1.3M, up 62% from Jul 2025 (IDR 0.8M).", type: "positive" },
  { text: "Spend ramp-up from MOB 1 to MOB 3 averages +87%, with most growth frontloaded in the first 2 months.", type: "neutral" },
  { text: "Nov 2025 cohort underperforms at MOB 1 (IDR 1.1M) despite strong activation — possibly higher proportion of low-limit cards.", type: "negative" },
  { text: "Credit limit increases at MOB 3 (per current policy) may explain the consistent spend acceleration at MOB 3-4.", type: "hypothesis" },
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

const heatmapInsights: ChartInsight[] = [
  { text: "Jan 2026 cohort shows the lowest MOB 1 delinquency at 0.8%, a 33% improvement over Jul 2025 (1.2%).", type: "positive" },
  { text: "Sep 2025 cohort is the worst performer, reaching 4.8% at MOB 6 — 0.3pp above the Jul 2025 benchmark at the same MOB.", type: "negative" },
  { text: "MOB 3 is a consistent inflection point where delinquency acceleration slows across all vintages.", type: "neutral" },
  { text: "Cohorts from Oct 2025 onward benefit from the Q4 scorecard recalibration, which tightened approval bands for thin-file applicants.", type: "hypothesis" },
];

const delinquencyByVintageInsights: ChartInsight[] = [
  { text: "Jan 2026 vintage tracks 0.6pp below Jul 2025 at MOB 2 (1.5% vs 2.1%), the widest early gap observed.", type: "positive" },
  { text: "Oct 2025 vintage curve sits between Jul 2025 and Jan 2026, consistent with incremental scorecard tuning in Q3.", type: "neutral" },
  { text: "Jul 2025 cohort delinquency plateaus near 4.5% at MOB 6, suggesting a natural ceiling for that risk band.", type: "neutral" },
  { text: "Improved early performance in newer cohorts may partly reflect tighter credit limits rather than better borrower quality.", type: "hypothesis" },
];

const activationByVintageInsights: ChartInsight[] = [
  { text: "Feb 2026 cohort reached 65.2% activation at MOB 1 — the highest ever, up 10pp from Jul 2025 (55.2%).", type: "positive" },
  { text: "Oct 2025 onward shows a step-change in MOB 1 activation (58%+), aligning with the revamped onboarding flow launched in Sep 2025.", type: "positive" },
  { text: "All cohorts converge toward 83-85% activation by MOB 7-8, indicating faster time-to-first-use rather than higher ultimate activation.", type: "neutral" },
  { text: "The onboarding redesign (push-notification reminders + instant virtual card) likely drove the MOB 1 activation lift in recent cohorts.", type: "hypothesis" },
];

export default function VintagePage() {
  const { period, periodLabel } = usePeriod();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const [viewMode, setViewMode] = useState<ViewMode>("delinquency");
  const [timeFrame, setTimeFrame] = useState<TimeFrame>("monthly");
  const filterMultiplier = useMemo(() => getFilterMultiplier(filters), [filters]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  const isWeekly = timeFrame === "weekly";
  const data = isWeekly ? weeklyHeatmapData[viewMode] : heatmapData[viewMode];
  const cohortLabels = isWeekly ? cohortWeeks : cohortMonths;
  const periodColumns = isWeekly ? wobColumns : mobColumns;
  const getColor = colorFns[viewMode];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Vintage Analysis</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      <ActiveFiltersBanner />

      {/* View toggle + time frame toggle */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1 bg-[var(--surface-elevated)] rounded-lg p-1 w-fit">
          {(["delinquency", "activation", "loss", "spend"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-4 py-1.5 text-sm rounded-md font-medium transition-colors",
                viewMode === mode
                  ? "bg-[var(--accent,#5B22FF)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-[var(--surface-elevated)] rounded-lg p-1 w-fit">
          {(["monthly", "weekly"] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md font-medium transition-colors",
                timeFrame === tf
                  ? "bg-[var(--accent,#5B22FF)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>
        {isWeekly && (
          <span className="text-xs text-[var(--text-muted)]">Week starts on Monday</span>
        )}
      </div>

      {/* Cohort heatmap */}
      <ChartCard
        title={`Cohort Heatmap: ${viewLabels[viewMode]}`}
        subtitle={isWeekly ? "Rows = approval week (Mon start), Columns = week on book" : "Rows = approval month, Columns = month on book"}
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium sticky left-0 bg-[var(--surface)]">
                  Cohort
                </th>
                {periodColumns.map((col) => (
                  <th key={col} className="text-center py-2 px-3 text-[var(--text-secondary)] font-medium min-w-[72px]">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortLabels.map((cohort, rowIdx) => (
                <tr key={cohort} className="border-b border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--text-primary)] font-medium sticky left-0 bg-[var(--surface)] whitespace-nowrap">
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
                          {val.toFixed(1)}{viewMode === "spend" ? "M" : "%"}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">&mdash;</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ChartInsights insights={viewMode === "spend" ? spendHeatmapInsights : heatmapInsights} />
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
          <ChartInsights insights={delinquencyByVintageInsights} />
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
          <ChartInsights insights={activationByVintageInsights} />
        </ChartCard>
      </div>

      {/* Spend by vintage */}
      <ChartCard
        title="Spend per User by Vintage"
        subtitle="Avg monthly spend (M IDR) by cohort month-on-book"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={spendComparison}
          lines={[
            { key: "jul25", color: "#ef4444", label: "Jul 2025" },
            { key: "oct25", color: "#f59e0b", label: "Oct 2025" },
            { key: "jan26", color: "#22c55e", label: "Jan 2026" },
          ]}
          xAxisKey="mob"
          valueType="currency"
          height={300}
        />
        <ChartInsights insights={spendByVintageInsights} />
      </ChartCard>

      <ActionItems section="Vintage Analysis" items={actionItems} />
    </div>
  );
}
