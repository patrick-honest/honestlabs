"use client";

import { useMemo } from "react";
import { Header } from "@/components/layout/header";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardAreaChart } from "@/components/charts/area-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { Newspaper, RefreshCw } from "lucide-react";
import { usePeriod } from "@/hooks/use-period";
import { useTheme } from "@/hooks/use-theme";
import { useFilters } from "@/hooks/use-filters";
import { useKpis } from "@/hooks/use-cached-fetch";
import { applyFilterToData, applyFilterToMetric, hasActiveFilters } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import type { KpiMetric } from "@/types/reports";
import type { Cycle } from "@/types/reports";

// ---------- Period-aware Mock Data ----------
// Data varies by period to give visual feedback when toggling

function generateMockKpis(period: Cycle): KpiMetric[] {
  const multipliers: Record<Cycle, number> = {
    weekly: 0.25,
    monthly: 1,
    quarterly: 3,
    yearly: 12,
  };
  const m = multipliers[period];

  // Rates don't scale with period, but absolute numbers do
  return [
    { metric: "eligible_to_spend", label: "Eligible to Spend", value: Math.round(60_240 * (0.85 + m * 0.05)), prevValue: Math.round(58_100 * (0.85 + m * 0.05)), unit: "count", changePercent: 3.7, direction: "up" },
    { metric: "transactors", label: "Transactors", value: Math.round(25_380 * (0.85 + m * 0.05)), prevValue: Math.round(24_200 * (0.85 + m * 0.05)), unit: "count", changePercent: 4.9, direction: "up" },
    { metric: "spend_active_rate", label: "Spend Active Rate", value: period === "weekly" ? 39.8 : period === "monthly" ? 42.1 : period === "quarterly" ? 40.5 : 38.9, prevValue: period === "weekly" ? 38.5 : period === "monthly" ? 41.6 : period === "quarterly" ? 39.2 : 36.1, unit: "percent", changePercent: period === "weekly" ? 3.4 : period === "monthly" ? 1.2 : period === "quarterly" ? 3.3 : 7.8, direction: "up" },
    { metric: "total_spend", label: "Total Spend", value: Math.round(78_500_000_000 * m), prevValue: Math.round(72_000_000_000 * m), unit: "idr", changePercent: 9.0, direction: "up" },
    { metric: "avg_spend_txn", label: "Avg Spend / Txn", value: period === "weekly" ? 155_200 : period === "monthly" ? 148_500 : period === "quarterly" ? 151_000 : 149_800, prevValue: period === "weekly" ? 158_000 : period === "monthly" ? 152_000 : period === "quarterly" ? 155_500 : 154_200, unit: "idr", changePercent: -2.3, direction: "down" },
    { metric: "activation_rate", label: "Activation (1st Txn ≤7d of Approval)", value: period === "weekly" ? 64.1 : period === "monthly" ? 67.3 : period === "quarterly" ? 65.8 : 63.2, prevValue: period === "weekly" ? 61.5 : period === "monthly" ? 63.8 : period === "quarterly" ? 62.1 : 58.6, unit: "percent", changePercent: 5.5, direction: "up" },
    { metric: "approval_rate", label: "Approval Rate", value: period === "weekly" ? 33.5 : period === "monthly" ? 34.2 : period === "quarterly" ? 33.9 : 34.8, prevValue: period === "weekly" ? 34.8 : period === "monthly" ? 35.1 : period === "quarterly" ? 35.5 : 36.2, unit: "percent", changePercent: -2.6, direction: "down" },
    { metric: "total_applications", label: "Total Applications", value: Math.round(12_450 * m), prevValue: Math.round(11_800 * m), unit: "count", changePercent: 5.5, direction: "up" },
  ];
}

function generateSparklines(period: Cycle): Record<string, { value: number }[]> {
  const base: Record<string, number[]> = {
    eligible_to_spend: [52000, 54000, 55200, 56800, 57500, 58100, 59400, 60240],
    transactors: [21000, 22100, 22800, 23400, 23900, 24200, 24800, 25380],
    spend_active_rate: [38.5, 39.2, 39.8, 40.1, 40.9, 41.6, 41.8, 42.1],
    total_spend: [58e9, 62e9, 65e9, 67e9, 70e9, 72e9, 75e9, 78.5e9],
    avg_spend_txn: [160000, 157000, 155000, 154000, 153000, 152000, 150000, 148500],
    activation_rate: [58.0, 59.5, 61.0, 62.3, 63.0, 63.8, 65.5, 67.3],
    approval_rate: [37.0, 36.5, 36.2, 35.8, 35.5, 35.1, 34.6, 34.2],
    total_applications: [9800, 10200, 10500, 10900, 11200, 11800, 12100, 12450],
  };

  const multipliers: Record<Cycle, number> = {
    weekly: 0.25,
    monthly: 1,
    quarterly: 3,
    yearly: 12,
  };
  const m = multipliers[period];

  const result: Record<string, { value: number }[]> = {};
  for (const [key, values] of Object.entries(base)) {
    const isRate = key.includes("rate");
    result[key] = values.map((v) => ({
      value: isRate ? v + (period === "quarterly" ? -1.5 : period === "yearly" ? -3 : 0) : Math.round(v * m),
    }));
  }
  return result;
}

function generateChartData(period: Cycle) {
  const periodLabels: Record<Cycle, string[]> = {
    weekly: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    monthly: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"],
    quarterly: ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026"],
    yearly: ["2022", "2023", "2024", "2025", "2026 YTD"],
  };

  const labels = periodLabels[period];
  const m: Record<Cycle, number> = { weekly: 0.25, monthly: 1, quarterly: 3, yearly: 12 };
  const scale = m[period];

  // Eligible vs Transactors (Spend Active Rate)
  const spendActiveRateData = labels.map((label, i) => ({
    date: label,
    eligible: Math.round((52000 + i * 1200) * scale),
    transactors: Math.round((21000 + i * 620) * scale),
    rate: 38.5 + i * (period === "weekly" ? 0.5 : period === "monthly" ? 0.5 : period === "quarterly" ? 0.8 : 1.2),
  }));

  const spendByCategoryData = labels.map((label, i) => ({
    date: label,
    online: Math.round((18e9 + i * 1.2e9) * scale),
    offline: Math.round((22e9 + i * 0.8e9) * scale),
    qris: Math.round((8e9 + i * 1e9) * scale),
  }));

  const funnelScale = scale;
  const decisionFunnelData = [
    { stage: "Applications", count: Math.round(12450 * funnelScale) },
    { stage: "KYC Passed", count: Math.round(8900 * funnelScale) },
    { stage: "Approved", count: Math.round(4260 * funnelScale) },
    { stage: "Card Issued", count: Math.round(3980 * funnelScale) },
    { stage: "Activated", count: Math.round(2680 * funnelScale) },
    { stage: "First Txn", count: Math.round(2150 * funnelScale) },
  ];

  const dpdDistributionData = [
    { bucket: "Current", count: Math.round(42500 * (0.9 + scale * 0.03)) },
    { bucket: "1-30 DPD", count: Math.round(8200 * (0.9 + scale * 0.03)) },
    { bucket: "31-60 DPD", count: Math.round(2100 * (0.9 + scale * 0.03)) },
    { bucket: "61-90 DPD", count: Math.round(850 * (0.9 + scale * 0.03)) },
    { bucket: "91-120 DPD", count: Math.round(420 * (0.9 + scale * 0.03)) },
    { bucket: "120+ DPD", count: Math.round(310 * (0.9 + scale * 0.03)) },
  ];

  // Previous period data (shifted down ~5-10%)
  const prevSpendActiveRateData = labels.map((label, i) => ({
    date: label,
    eligible: Math.round((49000 + i * 1000) * scale),
    transactors: Math.round((18500 + i * 520) * scale),
    rate: 36.8 + i * (period === "weekly" ? 0.4 : period === "monthly" ? 0.4 : period === "quarterly" ? 0.7 : 1.0),
  }));

  const prevSpendByCategoryData = labels.map((label, i) => ({
    date: label,
    online: Math.round((16e9 + i * 1e9) * scale),
    offline: Math.round((20e9 + i * 0.7e9) * scale),
    qris: Math.round((5e9 + i * 0.8e9) * scale),
  }));

  const prevDecisionFunnelData = [
    { stage: "Applications", count: Math.round(11200 * funnelScale) },
    { stage: "KYC Passed", count: Math.round(8100 * funnelScale) },
    { stage: "Approved", count: Math.round(3850 * funnelScale) },
    { stage: "Card Issued", count: Math.round(3600 * funnelScale) },
    { stage: "Activated", count: Math.round(2400 * funnelScale) },
    { stage: "First Txn", count: Math.round(1900 * funnelScale) },
  ];

  const prevDpdDistributionData = [
    { bucket: "Current", count: Math.round(40100 * (0.9 + scale * 0.03)) },
    { bucket: "1-30 DPD", count: Math.round(8800 * (0.9 + scale * 0.03)) },
    { bucket: "31-60 DPD", count: Math.round(2350 * (0.9 + scale * 0.03)) },
    { bucket: "61-90 DPD", count: Math.round(920 * (0.9 + scale * 0.03)) },
    { bucket: "91-120 DPD", count: Math.round(460 * (0.9 + scale * 0.03)) },
    { bucket: "120+ DPD", count: Math.round(340 * (0.9 + scale * 0.03)) },
  ];

  return {
    spendActiveRateData, spendByCategoryData, decisionFunnelData, dpdDistributionData,
    prevSpendActiveRateData, prevSpendByCategoryData, prevDecisionFunnelData, prevDpdDistributionData,
  };
}

const trendsByPeriod: Record<Cycle, { text: string; sentiment: "positive" | "negative" | "neutral" }[]> = {
  weekly: [
    { text: "Spend active rate holding steady at 39.8% this week, in line with monthly trend.", sentiment: "positive" },
    { text: "Daily QRIS transaction count hit record 1,200+ on Wednesday.", sentiment: "positive" },
    { text: "Avg spend per transaction stable at IDR 155K, no significant weekly change.", sentiment: "neutral" },
    { text: "3 new high-risk accounts flagged for review this week.", sentiment: "negative" },
  ],
  monthly: [
    { text: "Spend active rate reached an all-time high of 42.1%, up 1.2% MoM driven by QRIS adoption.", sentiment: "positive" },
    { text: "New customer activation rate improved to 67.3% following streamlined onboarding flow launch.", sentiment: "positive" },
    { text: "Average spend per transaction declined 2.3% MoM as micro-transactions via QRIS increased share.", sentiment: "neutral" },
    { text: "Approval rate slipped to 34.2%, reflecting tighter risk policy on higher-risk segments.", sentiment: "negative" },
    { text: "Total applications grew 5.5% MoM, with digital channels contributing 78% of volume.", sentiment: "positive" },
  ],
  quarterly: [
    { text: "Quarterly spend active rate averaged 40.5%, up from 39.2% last quarter.", sentiment: "positive" },
    { text: "QRIS now represents 21% of total transaction volume, up from 15% last quarter.", sentiment: "positive" },
    { text: "Portfolio DPD 30+ rate improved by 0.3pp QoQ due to enhanced collection strategies.", sentiment: "positive" },
    { text: "Approval rate tightened by 1.6pp QoQ as risk models recalibrated for macro conditions.", sentiment: "negative" },
  ],
  yearly: [
    { text: "Full-year transactors grew 32% YoY from 19,200 to 25,380.", sentiment: "positive" },
    { text: "Annual spend volume reached IDR 942B, up 28% from the prior year.", sentiment: "positive" },
    { text: "Spend active rate improved 3.2pp YoY from 35.7% to 38.9% on a trailing basis.", sentiment: "positive" },
    { text: "Approval rate has declined steadily from 38.1% to 34.8% as risk appetite tightened.", sentiment: "negative" },
    { text: "QRIS adoption exploded from 2% to 21% of transaction mix since launch.", sentiment: "positive" },
  ],
};

const newsHeadlines = [
  { title: "Bank Indonesia holds rates steady at 5.75%", date: "Mar 15, 2026", source: "Reuters", url: "https://www.reuters.com/markets/asia/bank-indonesia-rate-decision-march-2026" },
  { title: "Indonesian credit card spending up 12% YoY in Feb", date: "Mar 14, 2026", source: "CNBC Indonesia", url: "https://www.cnbcindonesia.com/market/credit-card-spending-feb-2026" },
  { title: "OJK announces new digital lending guidelines for 2026", date: "Mar 12, 2026", source: "Kontan", url: "https://www.kontan.co.id/ojk-digital-lending-guidelines-2026" },
];

// ---------- Page ----------

export default function DashboardPage() {
  const { period, periodLabel, dateRange } = usePeriod();
  const { isDark } = useTheme();
  const { filters } = useFilters();

  // SWR-based cached fetch — deduplicates requests, serves stale while revalidating
  const { data: apiData, isLoading: loading } = useKpis(period);

  // Use API data if available, otherwise period-aware mock data
  // Apply active filters to scale data proportionally
  const rawKpis = (apiData?.kpis as KpiMetric[]) ?? generateMockKpis(period);
  const kpis = useMemo(() => {
    if (!hasActiveFilters(filters)) return rawKpis;
    return rawKpis.map((k) => ({
      ...k,
      value: applyFilterToMetric(k.value, filters, k.unit === "percent"),
      prevValue: k.prevValue != null ? applyFilterToMetric(k.prevValue, filters, k.unit === "percent") : k.prevValue,
    }));
  }, [rawKpis, filters]);
  const sparklines = generateSparklines(period);
  const {
    spendActiveRateData, spendByCategoryData, decisionFunnelData, dpdDistributionData,
    prevSpendActiveRateData, prevSpendByCategoryData, prevDecisionFunnelData, prevDpdDistributionData,
  } = useMemo(() => {
    const raw = generateChartData(period);
    if (!hasActiveFilters(filters)) return raw;
    return {
      spendActiveRateData: applyFilterToData(raw.spendActiveRateData, filters),
      spendByCategoryData: applyFilterToData(raw.spendByCategoryData, filters),
      decisionFunnelData: applyFilterToData(raw.decisionFunnelData, filters),
      dpdDistributionData: applyFilterToData(raw.dpdDistributionData, filters),
      prevSpendActiveRateData: applyFilterToData(raw.prevSpendActiveRateData, filters),
      prevSpendByCategoryData: applyFilterToData(raw.prevSpendByCategoryData, filters),
      prevDecisionFunnelData: applyFilterToData(raw.prevDecisionFunnelData, filters),
      prevDpdDistributionData: applyFilterToData(raw.prevDpdDistributionData, filters),
    };
  }, [period, filters]);
  const trends = trendsByPeriod[period];

  // Data-driven insights per chart
  const spendRateInsights: ChartInsight[] = useMemo(() => {
    const latest = spendActiveRateData[spendActiveRateData.length - 1]?.rate as number;
    const prevLatest = prevSpendActiveRateData[prevSpendActiveRateData.length - 1]?.rate as number;
    const delta = +(latest - prevLatest).toFixed(1);
    return [
      { text: `Spend active rate is ${latest}%, ${delta > 0 ? "up" : "down"} ${Math.abs(delta)}pp vs previous period (${prevLatest}%).`, type: delta > 0 ? "positive" : "negative" },
      { text: "QRIS adoption continues to drive micro-transactions, boosting transactor count even as avg ticket size decreases.", type: "positive" },
      { text: "Weekly patterns show Fri-Sat peaks driven by retail and F&B spending, consistent with Indonesian consumer behavior.", type: "neutral" },
      { text: "Bank Indonesia's steady 5.75% rate may be supporting consumer confidence and credit card spending willingness.", type: "hypothesis" },
    ];
  }, [spendActiveRateData, prevSpendActiveRateData]);

  const spendChannelInsights: ChartInsight[] = [
    { text: "Online spend grew 12% vs previous period, outpacing offline (5%) and QRIS (8%).", type: "positive" },
    { text: "QRIS now accounts for ~18% of total spend volume, up from ~12% in the prior period.", type: "positive" },
    { text: "Offline spend growth is decelerating — possibly reflecting seasonal normalization post-Ramadan.", type: "neutral" },
    { text: "OJK's new digital lending guidelines could accelerate e-commerce card usage in upcoming quarters.", type: "hypothesis" },
  ];

  const funnelInsights: ChartInsight[] = [
    { text: "Application-to-approval conversion improved to 34.2%, up from 34.4% of previous cohort.", type: "positive" },
    { text: "KYC pass rate at 71.4% — document upload friction is the primary drop-off point (28.6% lost).", type: "negative" },
    { text: "Card activation rate (67.3% within 7 days of approval) is at its highest, reflecting onboarding improvements.", type: "positive" },
    { text: "First transaction rate post-activation is 80.2%, suggesting strong intent among activated customers.", type: "positive" },
    { text: "Competitors like Jenius and Jago are also seeing improved digital onboarding — market-wide UX maturity may be a factor.", type: "hypothesis" },
  ];

  const dpdInsights: ChartInsight[] = [
    { text: "Current accounts grew 5.6% while 1-30 DPD declined 7.3%, showing improved portfolio health.", type: "positive" },
    { text: "120+ DPD bucket decreased from 340 to 310 accounts, indicating effective late-stage collection efforts.", type: "positive" },
    { text: "61-90 DPD bucket saw a slight decrease — enhanced SMS/WhatsApp reminders may be contributing.", type: "neutral" },
    { text: "Rising Rupiah strength against USD may be reducing debt burden for customers with foreign-denominated spending.", type: "hypothesis" },
  ];

  // Theme-aware card styles
  const cardClass = isDark
    ? "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    : "rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm";
  const headingClass = "mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]";

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" />

      <div className="flex-1 space-y-6 p-6">
        {/* Hero */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              Honest {periodLabel} Business Review
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Executive summary for {dateRange.label}
            </p>
          </div>
          {loading && (
            <RefreshCw className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
          )}
        </div>

        <ActiveFiltersBanner />

        {/* KPI Grid */}
        <KpiGrid kpis={kpis} sparklines={sparklines} />

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <h3 className={headingClass}>Spend Active Rate</h3>
            <DashboardLineChart
              data={spendActiveRateData}
              lines={[
                { key: "eligible", color: isDark ? "#7C4DFF" : "#9333EA", label: "Eligible" },
                { key: "transactors", color: isDark ? "#06D6A0" : "#059669", label: "Transactors" },
              ]}
              prevPeriodData={prevSpendActiveRateData}
              prevPeriodLabel="Prev Period"
              height={220}
            />
            <ChartInsights insights={spendRateInsights} />
          </div>

          <div className={cardClass}>
            <h3 className={headingClass}>Spend by Channel</h3>
            <DashboardAreaChart
              data={spendByCategoryData}
              areas={[
                { key: "online", color: isDark ? "#5B22FF" : "#D00083", label: "Online" },
                { key: "offline", color: isDark ? "#7C4DFF" : "#EF4BDE", label: "Offline" },
                { key: "qris", color: isDark ? "#06D6A0" : "#059669", label: "QRIS" },
              ]}
              prevPeriodData={prevSpendByCategoryData}
              prevPeriodLabel="Prev Period"
              height={220}
            />
            <ChartInsights insights={spendChannelInsights} />
          </div>
        </div>

        {/* Trends */}
        <div className={cardClass}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Key Trends
          </h3>
          <ul className="flex flex-col gap-2.5">
            {trends.map((bullet, i) => {
              const colorMap = {
                positive: isDark ? "text-[#06D6A0]" : "text-[#059669]",
                negative: isDark ? "text-[#FF6B6B]" : "text-[#DC2626]",
                neutral: isDark ? "text-[#7C4DFF]" : "text-[#D00083]",
              };
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                    bullet.sentiment === "positive"
                      ? isDark ? "bg-[#06D6A0]" : "bg-[#059669]"
                      : bullet.sentiment === "negative"
                        ? isDark ? "bg-[#FF6B6B]" : "bg-[#DC2626]"
                        : isDark ? "bg-[#7C4DFF]" : "bg-[#D00083]"
                  }`} />
                  <span className="text-sm leading-relaxed text-[var(--text-primary)]">
                    {bullet.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Second Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className={cardClass}>
            <h3 className={headingClass}>Decision Funnel</h3>
            <DashboardBarChart
              data={decisionFunnelData}
              bars={[{ key: "count", color: isDark ? "#5B22FF" : "#D00083", label: "Count" }]}
              prevPeriodData={prevDecisionFunnelData}
              prevPeriodLabel="Prev Period"
              xAxisKey="stage"
              height={220}
            />
            <ChartInsights insights={funnelInsights} />
          </div>

          <div className={cardClass}>
            <h3 className={headingClass}>DPD Distribution</h3>
            <DashboardBarChart
              data={dpdDistributionData}
              bars={[{ key: "count", color: isDark ? "#FFD166" : "#F5A623", label: "Accounts" }]}
              prevPeriodData={prevDpdDistributionData}
              prevPeriodLabel="Prev Period"
              xAxisKey="bucket"
              height={220}
            />
            <ChartInsights insights={dpdInsights} />
          </div>
        </div>

        {/* Market News */}
        <div className={cardClass}>
          <div className="mb-3 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-[var(--text-muted)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Market News
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {newsHeadlines.map((headline, i) => (
              <a
                key={i}
                href={headline.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center justify-between rounded-lg px-4 py-3 transition-colors cursor-pointer group",
                  isDark
                    ? "bg-[var(--surface-elevated)] hover:bg-[#2D2955]"
                    : "bg-[var(--surface-elevated)] hover:bg-[#EDE5DA]"
                )}
              >
                <div>
                  <p className={cn(
                    "text-sm font-medium text-[var(--text-primary)] transition-colors",
                    isDark ? "group-hover:text-[#7C4DFF]" : "group-hover:text-[#D00083]"
                  )}>
                    {headline.title}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                    {headline.source}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--text-muted)]">
                  {headline.date}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function cn(...args: (string | boolean | undefined | null)[]) {
  return args.filter(Boolean).join(" ");
}
