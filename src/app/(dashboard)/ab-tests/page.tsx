"use client";

import { useMemo } from "react";
import { Header } from "@/components/layout/header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange, scaleTrendData, scaleMetricValue, getPeriodInsightLabels } from "@/lib/period-data";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

// ==========================================================================
// Mock Data — A/B Test Monitor
// ==========================================================================

const AS_OF = "2026-03-17";

interface ExperimentRow {
  experiment_id: string;
  variants: { variant_id: string; user_count: number }[];
  total_users: number;
  total_exposures: number;
}

const mockExperiments: ExperimentRow[] = [
  {
    experiment_id: "onboarding_flow_v3",
    variants: [
      { variant_id: "control", user_count: 125000 },
      { variant_id: "variant_a", user_count: 125000 },
    ],
    total_users: 250000,
    total_exposures: 312000,
  },
  {
    experiment_id: "credit_line_display",
    variants: [
      { variant_id: "control", user_count: 90000 },
      { variant_id: "variant_a", user_count: 90000 },
    ],
    total_users: 180000,
    total_exposures: 225000,
  },
  {
    experiment_id: "qris_promo_banner",
    variants: [
      { variant_id: "control", user_count: 50000 },
      { variant_id: "variant_a", user_count: 50000 },
      { variant_id: "variant_b", user_count: 50000 },
    ],
    total_users: 150000,
    total_exposures: 198000,
  },
  {
    experiment_id: "repayment_reminder_v2",
    variants: [
      { variant_id: "control", user_count: 60000 },
      { variant_id: "variant_a", user_count: 60000 },
    ],
    total_users: 120000,
    total_exposures: 156000,
  },
  {
    experiment_id: "referral_incentive",
    variants: [
      { variant_id: "control", user_count: 47500 },
      { variant_id: "variant_a", user_count: 47500 },
    ],
    total_users: 95000,
    total_exposures: 118000,
  },
  {
    experiment_id: "app_rating_prompt",
    variants: [
      { variant_id: "control", user_count: 42000 },
      { variant_id: "variant_a", user_count: 42000 },
    ],
    total_users: 84000,
    total_exposures: 105000,
  },
  {
    experiment_id: "card_delivery_eta",
    variants: [
      { variant_id: "control", user_count: 38000 },
      { variant_id: "variant_a", user_count: 38000 },
    ],
    total_users: 76000,
    total_exposures: 92000,
  },
  {
    experiment_id: "limit_increase_cta",
    variants: [
      { variant_id: "control", user_count: 35000 },
      { variant_id: "variant_a", user_count: 35000 },
    ],
    total_users: 70000,
    total_exposures: 88000,
  },
  {
    experiment_id: "savings_cross_sell",
    variants: [
      { variant_id: "control", user_count: 33000 },
      { variant_id: "variant_a", user_count: 33000 },
    ],
    total_users: 66000,
    total_exposures: 82000,
  },
  {
    experiment_id: "biometric_auth_test",
    variants: [
      { variant_id: "control", user_count: 30000 },
      { variant_id: "variant_a", user_count: 30000 },
    ],
    total_users: 60000,
    total_exposures: 75000,
  },
  {
    experiment_id: "push_notification_v2",
    variants: [
      { variant_id: "control", user_count: 28000 },
      { variant_id: "variant_a", user_count: 28000 },
    ],
    total_users: 56000,
    total_exposures: 69000,
  },
  {
    experiment_id: "in_app_chat_support",
    variants: [
      { variant_id: "control", user_count: 25000 },
      { variant_id: "variant_a", user_count: 25000 },
    ],
    total_users: 50000,
    total_exposures: 62000,
  },
];

const baseDailyExposureTrend = [
  { date: "Mar 3", exposures: 52000 },
  { date: "Mar 4", exposures: 58000 },
  { date: "Mar 5", exposures: 55000 },
  { date: "Mar 6", exposures: 61000 },
  { date: "Mar 7", exposures: 63000 },
  { date: "Mar 8", exposures: 48000 },
  { date: "Mar 9", exposures: 45000 },
  { date: "Mar 10", exposures: 59000 },
  { date: "Mar 11", exposures: 64000 },
  { date: "Mar 12", exposures: 62000 },
  { date: "Mar 13", exposures: 67000 },
  { date: "Mar 14", exposures: 70000 },
  { date: "Mar 15", exposures: 54000 },
  { date: "Mar 16", exposures: 51000 },
];

const prevDailyExposureTrend = [
  { date: "Mar 3", exposures: 46000 },
  { date: "Mar 4", exposures: 50000 },
  { date: "Mar 5", exposures: 48000 },
  { date: "Mar 6", exposures: 53000 },
  { date: "Mar 7", exposures: 55000 },
  { date: "Mar 8", exposures: 42000 },
  { date: "Mar 9", exposures: 39000 },
  { date: "Mar 10", exposures: 51000 },
  { date: "Mar 11", exposures: 56000 },
  { date: "Mar 12", exposures: 54000 },
  { date: "Mar 13", exposures: 58000 },
  { date: "Mar 14", exposures: 60000 },
  { date: "Mar 15", exposures: 47000 },
  { date: "Mar 16", exposures: 44000 },
];

// Build stacked bar data from experiments
function buildExperimentBarData(experiments: ExperimentRow[]) {
  return experiments.map((exp) => {
    const row: Record<string, string | number> = { experiment: exp.experiment_id };
    for (const v of exp.variants) {
      row[v.variant_id] = v.user_count;
    }
    return row;
  });
}

function getAllVariantIds(experiments: ExperimentRow[]): string[] {
  const set = new Set<string>();
  for (const exp of experiments) {
    for (const v of exp.variants) {
      set.add(v.variant_id);
    }
  }
  return Array.from(set);
}

const VARIANT_COLORS_DARK = ["#5B22FF", "#06D6A0", "#FFD166", "#FF6B6B", "#7C4DFF"];
const VARIANT_COLORS_LIGHT = ["#D00083", "#059669", "#F5A623", "#DC2626", "#9333EA"];

// ==========================================================================
// Action items
// ==========================================================================

const actionItems: ActionItem[] = [
  {
    id: "ab-1",
    priority: "urgent",
    action: "Review onboarding_flow_v3 results — largest experiment by exposure.",
    detail: "Check conversion lift before scaling to 100% of users.",
  },
  {
    id: "ab-2",
    priority: "monitor",
    action: "Sunset low-traffic experiments with < 50K users.",
    detail: "May not reach statistical significance this quarter — consider consolidating.",
  },
  {
    id: "ab-3",
    priority: "monitor",
    action: "Add experiment_id to decision_completed join.",
    detail: "Enable approval rate breakdown by experiment variant for causal analysis.",
  },
];

// ==========================================================================
// Page
// ==========================================================================

export default function ABTestMonitorPage() {
  const { period } = usePeriod();
  const { isDark } = useTheme();
  const { filters } = useFilters();
  const range = getPeriodRange(period);
  const { changeAbbrev } = getPeriodInsightLabels(period);

  // Compute KPI values
  const totalExposures = useMemo(() => {
    const base = mockExperiments.reduce((sum, e) => sum + e.total_exposures, 0);
    return applyFilterToMetric(scaleMetricValue(base, period, false), filters, false);
  }, [period, filters]);

  const activeExperimentCount = mockExperiments.length;

  const avgUsersPerExperiment = useMemo(() => {
    const base = mockExperiments.reduce((sum, e) => sum + e.total_users, 0) / mockExperiments.length;
    return Math.round(applyFilterToMetric(scaleMetricValue(base, period, false), filters, false));
  }, [period, filters]);

  const newExperimentsThisPeriod = useMemo(() => {
    // Mock: 3 new experiments this period, 2 in previous
    return scaleMetricValue(3, period, false);
  }, [period]);

  // Chart data
  const exposureTrend = useMemo(
    () => applyFilterToData(scaleTrendData(baseDailyExposureTrend, period, "date"), filters),
    [period, filters],
  );

  const prevExposureTrend = useMemo(
    () => applyFilterToData(scaleTrendData(prevDailyExposureTrend, period, "date"), filters),
    [period, filters],
  );

  const experimentBarData = useMemo(() => {
    const data = buildExperimentBarData(mockExperiments);
    return applyFilterToData(data, filters);
  }, [filters]);

  const allVariants = useMemo(() => getAllVariantIds(mockExperiments), []);

  const variantBars = useMemo(() => {
    const colors = isDark ? VARIANT_COLORS_DARK : VARIANT_COLORS_LIGHT;
    return allVariants.map((v, i) => ({
      key: v,
      color: colors[i % colors.length],
      label: v,
      stackId: "variants",
    }));
  }, [allVariants, isDark]);

  // Insights
  const exposureInsights: ChartInsight[] = useMemo(() => {
    const latest = exposureTrend[exposureTrend.length - 1]?.exposures as number | undefined;
    const prevLatest = prevExposureTrend[prevExposureTrend.length - 1]?.exposures as number | undefined;
    const delta = latest && prevLatest ? (((latest - prevLatest) / prevLatest) * 100).toFixed(1) : "N/A";
    return [
      { text: `Daily exposures trending at ~${latest?.toLocaleString() ?? "N/A"}, ${Number(delta) > 0 ? "up" : "down"} ${Math.abs(Number(delta))}% ${changeAbbrev}.`, type: Number(delta) > 0 ? "positive" : "negative" },
      { text: "Weekend dip is consistent — most experiments target in-app sessions which drop Sat/Sun.", type: "neutral" },
      { text: "onboarding_flow_v3 alone accounts for ~18% of total daily exposures.", type: "neutral" },
    ];
  }, [exposureTrend, prevExposureTrend, changeAbbrev]);

  const experimentInsights: ChartInsight[] = [
    { text: "onboarding_flow_v3 is the largest experiment with 250K users across 2 variants.", type: "neutral" },
    { text: "qris_promo_banner is the only 3-variant experiment — consider monitoring for interaction effects.", type: "neutral" },
    { text: "5 experiments have < 70K users and may need extended runtime for significance.", type: "negative" },
    { text: "New experiment launches have slowed — only 3 new this period vs 5 last period.", type: "negative" },
  ];

  return (
    <div className="flex flex-col">
      <Header title="A/B Test Monitor" />

      <div className="flex-1 space-y-6 p-6">
        <ActiveFiltersBanner />

        <SampleDataBanner
          dataset="refined_rudderstack.experiment_viewed"
          reason="Experiment data uses sample mock — connect BigQuery for live results"
        />

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            metricKey="active_experiments"
            label="Active Experiments"
            value={activeExperimentCount}
            prevValue={10}
            unit="count"
            asOf={AS_OF}
            dataRange={range}
            higherIsBetter={true}
          />
          <MetricCard
            metricKey="total_exposures"
            label="Total Exposures"
            value={totalExposures}
            prevValue={Math.round(totalExposures * 0.87)}
            unit="count"
            asOf={AS_OF}
            dataRange={range}
            higherIsBetter={true}
          />
          <MetricCard
            metricKey="avg_users_per_experiment"
            label="Avg Users / Experiment"
            value={avgUsersPerExperiment}
            prevValue={Math.round(avgUsersPerExperiment * 0.92)}
            unit="count"
            asOf={AS_OF}
            dataRange={range}
            higherIsBetter={true}
          />
          <MetricCard
            metricKey="new_experiments"
            label="New Experiments This Period"
            value={newExperimentsThisPeriod}
            prevValue={Math.round(scaleMetricValue(5, period, false))}
            unit="count"
            asOf={AS_OF}
            dataRange={range}
            higherIsBetter={true}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Experiment breakdown - stacked bar */}
          <ChartCard
            title="Users per Experiment by Variant"
            subtitle="Stacked by variant assignment"
            asOf={AS_OF}
            dataRange={range}
          >
            <DashboardBarChart
              data={experimentBarData}
              bars={variantBars}
              xAxisKey="experiment"
              height={320}
            />
            <ChartInsights insights={experimentInsights} />
          </ChartCard>

          {/* Daily exposure trend */}
          <ChartCard
            title="Daily Exposure Trend"
            subtitle="Total experiment impressions per day"
            asOf={AS_OF}
            dataRange={range}
          >
            <DashboardLineChart
              data={exposureTrend}
              lines={[
                { key: "exposures", color: isDark ? "#5B22FF" : "#D00083", label: "Exposures" },
              ]}
              prevPeriodData={prevExposureTrend}
              prevPeriodLabel="Prev Period"
              height={320}
            />
            <ChartInsights insights={exposureInsights} />
          </ChartCard>
        </div>

        {/* Experiment Table */}
        <div className={cn(
          "rounded-xl border p-5",
          isDark
            ? "border-[var(--border)] bg-[var(--surface)]"
            : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
        )}>
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Experiment Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="pb-2 text-left font-medium text-[var(--text-secondary)]">Experiment</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">Variants</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">Total Users</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">Exposures</th>
                  <th className="pb-2 text-right font-medium text-[var(--text-secondary)]">Exposure / User</th>
                </tr>
              </thead>
              <tbody>
                {mockExperiments.map((exp) => (
                  <tr key={exp.experiment_id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 font-mono text-xs text-[var(--text-primary)]">
                      {exp.experiment_id}
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-primary)]">
                      {exp.variants.length}
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-primary)]">
                      {exp.total_users.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-primary)]">
                      {exp.total_exposures.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-[var(--text-muted)]">
                      {(exp.total_exposures / exp.total_users).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Items */}
        <ActionItems section="A/B Tests" items={actionItems} />
      </div>
    </div>
  );
}
