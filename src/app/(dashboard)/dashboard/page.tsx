"use client";

import { useMemo } from "react";
import { Header } from "@/components/layout/header";
import { MetricCard } from "@/components/dashboard/metric-card";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { Newspaper, TrendingUp, TrendingDown, AlertTriangle, Sparkles, ArrowRight } from "lucide-react";
import { usePeriod } from "@/hooks/use-period";
import { useTheme } from "@/hooks/use-theme";
import { useFilters } from "@/hooks/use-filters";
import { useCurrency } from "@/hooks/use-currency";
import { useKpis } from "@/hooks/use-cached-fetch";
import { applyFilterToData, applyFilterToMetric, hasActiveFilters } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, scaleMetricValue } from "@/lib/period-data";
import { formatAmountCompact } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type { KpiMetric, Cycle } from "@/types/reports";
import Link from "next/link";

// ── Mock data generators (period-aware) ─────────────────────────────────────

function generateMockKpis(period: Cycle): KpiMetric[] {
  const m: Record<Cycle, number> = { weekly: 0.25, monthly: 1, quarterly: 3, yearly: 12 };
  const scale = m[period];
  return [
    { metric: "eligible_to_spend", label: "Active Accounts", value: Math.round(60240 * (0.85 + scale * 0.05)), prevValue: Math.round(58100 * (0.85 + scale * 0.05)), unit: "count", changePercent: 3.7, direction: "up" },
    { metric: "spend_active_rate", label: "Spend Active Rate", value: period === "weekly" ? 39.8 : period === "monthly" ? 42.1 : period === "quarterly" ? 40.5 : 38.9, prevValue: period === "weekly" ? 38.5 : period === "monthly" ? 41.6 : period === "quarterly" ? 39.2 : 36.1, unit: "percent", changePercent: period === "weekly" ? 3.4 : 1.2, direction: "up" },
    { metric: "total_spend", label: "Total Spend", value: Math.round(78500000000 * scale), prevValue: Math.round(72000000000 * scale), unit: "idr", changePercent: 9.0, direction: "up" },
    { metric: "dpd_30_plus_rate", label: "30+ DPD Rate", value: period === "weekly" ? 4.8 : period === "monthly" ? 4.6 : period === "quarterly" ? 4.9 : 5.2, prevValue: period === "weekly" ? 5.0 : period === "monthly" ? 5.1 : period === "quarterly" ? 5.2 : 5.8, unit: "percent", changePercent: -4.0, direction: "down" },
  ];
}

function generateSparklines(period: Cycle) {
  const base: Record<string, number[]> = {
    eligible_to_spend: [52000, 54000, 55200, 56800, 57500, 58100, 59400, 60240],
    spend_active_rate: [38.5, 39.2, 39.8, 40.1, 40.9, 41.6, 41.8, 42.1],
    total_spend: [58e9, 62e9, 65e9, 67e9, 70e9, 72e9, 75e9, 78.5e9],
    dpd_30_plus_rate: [5.8, 5.6, 5.4, 5.2, 5.1, 5.0, 4.8, 4.6],
  };
  const m: Record<Cycle, number> = { weekly: 0.25, monthly: 1, quarterly: 3, yearly: 12 };
  const scale = m[period];
  const result: Record<string, number[]> = {};
  for (const [key, values] of Object.entries(base)) {
    const isRate = key.includes("rate");
    result[key] = values.map((v) => (isRate ? v : Math.round(v * scale)));
  }
  return result;
}

function generateChartData(period: Cycle) {
  const labels: Record<Cycle, string[]> = {
    weekly: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    monthly: ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"],
    quarterly: ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "Q1 2026"],
    yearly: ["2022", "2023", "2024", "2025", "2026 YTD"],
  };
  const dates = labels[period];

  const spendRateData = dates.map((d, i) => ({
    date: d,
    rate: 38.5 + i * (period === "weekly" ? 0.5 : period === "monthly" ? 0.5 : period === "quarterly" ? 0.8 : 1.2),
    target: 50,
  }));
  const prevSpendRateData = dates.map((d, i) => ({
    date: d,
    rate: 36.8 + i * (period === "weekly" ? 0.4 : period === "monthly" ? 0.4 : period === "quarterly" ? 0.7 : 1.0),
    target: 50,
  }));

  const m: Record<Cycle, number> = { weekly: 0.25, monthly: 1, quarterly: 3, yearly: 12 };
  const scale = m[period];
  const dpdData = [
    { bucket: "Current", count: Math.round(42500 * (0.9 + scale * 0.03)), prev: Math.round(40100 * (0.9 + scale * 0.03)) },
    { bucket: "1-30 DPD", count: Math.round(8200 * (0.9 + scale * 0.03)), prev: Math.round(8800 * (0.9 + scale * 0.03)) },
    { bucket: "31-60", count: Math.round(2100 * (0.9 + scale * 0.03)), prev: Math.round(2350 * (0.9 + scale * 0.03)) },
    { bucket: "61-90", count: Math.round(850 * (0.9 + scale * 0.03)), prev: Math.round(920 * (0.9 + scale * 0.03)) },
    { bucket: "90+", count: Math.round(730 * (0.9 + scale * 0.03)), prev: Math.round(800 * (0.9 + scale * 0.03)) },
  ];

  return { spendRateData, prevSpendRateData, dpdData };
}

// ── Health score computation ────────────────────────────────────────────────

interface HealthScore {
  score: number;
  color: string;
  label: string;
  verdict: string;
  bestMetric: string;
  worstMetric: string;
  keyAlert: string;
}

function computeHealth(kpis: KpiMetric[], isDark: boolean): HealthScore {
  const find = (key: string) => kpis.find((k) => k.metric === key);
  const sar = find("spend_active_rate");
  const dpd = find("dpd_30_plus_rate");
  const spend = find("total_spend");
  const accounts = find("eligible_to_spend");

  // Weighted score: SAR vs 50% target (30%), DPD inverse (25%), spend growth (25%), account growth (20%)
  const sarScore = sar ? Math.min(100, (sar.value / 50) * 100) : 50;
  const dpdScore = dpd ? Math.min(100, Math.max(0, (10 - dpd.value) / 10 * 100)) : 50;
  const spendGrowth = spend?.changePercent ?? 0;
  const spendScore = Math.min(100, Math.max(0, 50 + spendGrowth * 3));
  const acctGrowth = accounts?.changePercent ?? 0;
  const acctScore = Math.min(100, Math.max(0, 50 + acctGrowth * 5));

  const score = Math.round(sarScore * 0.3 + dpdScore * 0.25 + spendScore * 0.25 + acctScore * 0.2);

  const color = score >= 70
    ? isDark ? "text-[#06D6A0]" : "text-emerald-600"
    : score >= 45
      ? isDark ? "text-[#FFD166]" : "text-amber-600"
      : isDark ? "text-[#FF6B6B]" : "text-red-600";

  const bgColor = score >= 70
    ? isDark ? "from-[#06D6A0]/10 to-transparent" : "from-emerald-50 to-transparent"
    : score >= 45
      ? isDark ? "from-[#FFD166]/10 to-transparent" : "from-amber-50 to-transparent"
      : isDark ? "from-[#FF6B6B]/10 to-transparent" : "from-red-50 to-transparent";

  const label = score >= 70 ? "Healthy" : score >= 45 ? "Monitor" : "At Risk";

  // Build verdict
  const parts: string[] = [];
  if (accounts && accounts.changePercent && accounts.changePercent > 0) parts.push("Portfolio growing");
  if (sar && sar.changePercent && sar.changePercent > 0) parts.push("engagement improving");
  if (dpd && dpd.changePercent && dpd.changePercent < 0) parts.push("credit quality strengthening");
  if (spend && spend.changePercent && spend.changePercent > 0) parts.push(`spend +${spend.changePercent.toFixed(1)}%`);

  // Alerts
  const alerts: string[] = [];
  if (sar && sar.value < 40) alerts.push("spend engagement below 40%");
  if (dpd && dpd.value > 5) alerts.push("DPD 30+ above 5% threshold");

  const verdict = parts.length > 0
    ? parts.slice(0, 3).join(", ") + "." + (alerts.length > 0 ? ` Watch: ${alerts.join(", ")}.` : "")
    : "Insufficient data for assessment.";

  // Best / worst
  const metrics = [sar, dpd, spend, accounts].filter(Boolean) as KpiMetric[];
  const best = metrics.reduce((a, b) => {
    const aChange = Math.abs(a.changePercent ?? 0) * (a.direction === "up" && a.metric !== "dpd_30_plus_rate" || a.direction === "down" && a.metric === "dpd_30_plus_rate" ? 1 : -1);
    const bChange = Math.abs(b.changePercent ?? 0) * (b.direction === "up" && b.metric !== "dpd_30_plus_rate" || b.direction === "down" && b.metric === "dpd_30_plus_rate" ? 1 : -1);
    return bChange > aChange ? b : a;
  });
  const worst = metrics.reduce((a, b) => {
    const aChange = Math.abs(a.changePercent ?? 0) * (a.direction === "up" && a.metric !== "dpd_30_plus_rate" || a.direction === "down" && a.metric === "dpd_30_plus_rate" ? 1 : -1);
    const bChange = Math.abs(b.changePercent ?? 0) * (b.direction === "up" && b.metric !== "dpd_30_plus_rate" || b.direction === "down" && b.metric === "dpd_30_plus_rate" ? 1 : -1);
    return bChange < aChange ? b : a;
  });

  return {
    score,
    color,
    label,
    verdict,
    bestMetric: `${best.label} ${best.direction === "up" ? "↑" : "↓"} ${Math.abs(best.changePercent ?? 0).toFixed(1)}%`,
    worstMetric: `${worst.label} ${worst.direction === "up" ? "↑" : "↓"} ${Math.abs(worst.changePercent ?? 0).toFixed(1)}%`,
    keyAlert: alerts.length > 0 ? alerts[0] : "No critical alerts",
  };
}

// ── Prescriptive alerts ─────────────────────────────────────────────────────

interface Alert {
  severity: "act" | "watch" | "highlight";
  title: string;
  detail: string;
  action: string;
  link?: string;
}

function generateAlerts(kpis: KpiMetric[], period: Cycle): Alert[] {
  const alerts: Alert[] = [];
  const sar = kpis.find((k) => k.metric === "spend_active_rate");
  const dpd = kpis.find((k) => k.metric === "dpd_30_plus_rate");
  const spend = kpis.find((k) => k.metric === "total_spend");
  const accounts = kpis.find((k) => k.metric === "eligible_to_spend");

  // Highlights (green)
  if (spend && spend.changePercent && spend.changePercent > 5) {
    alerts.push({
      severity: "highlight",
      title: `Total spend grew ${spend.changePercent.toFixed(1)}% vs prior period`,
      detail: "Strong top-line momentum. Investor-ready headline.",
      action: "Include in next investor update as key growth metric.",
    });
  }
  if (sar && sar.value > 40) {
    alerts.push({
      severity: "highlight",
      title: `Spend active rate at ${sar.value.toFixed(1)}% — strong engagement`,
      detail: "Above 40% threshold indicates healthy card usage.",
      action: "Highlight in board deck as engagement proof point.",
      link: "/deep-dive/spend",
    });
  }

  // Watch (amber)
  if (sar && sar.changePercent && sar.changePercent < 1 && sar.changePercent > -2) {
    alerts.push({
      severity: "watch",
      title: "Spend active rate growth slowing",
      detail: `Only ${sar.changePercent.toFixed(1)}% change. Monitor for another period before acting.`,
      action: "Review spend activation campaigns with marketing.",
      link: "/deep-dive/spend",
    });
  }

  // Act now (red)
  if (dpd && dpd.value > 5) {
    alerts.push({
      severity: "act",
      title: `30+ DPD rate at ${dpd.value.toFixed(1)}% — above 5% threshold`,
      detail: "Collections strategy may need recalibration.",
      action: "Schedule risk review with Atanu this week.",
      link: "/deep-dive/risk",
    });
  }

  // Additional context alerts
  alerts.push({
    severity: "highlight",
    title: "QRIS adoption reached 27.4%",
    detail: "Up from 3% six months ago. Feature story for investors.",
    action: "Prepare QRIS case study for next board meeting.",
    link: "/qris-experiment",
  });

  return alerts.sort((a, b) => {
    const order: Record<string, number> = { act: 0, watch: 1, highlight: 2 };
    return order[a.severity] - order[b.severity];
  }).slice(0, 5);
}

// ── Investor highlights ─────────────────────────────────────────────────────

const INVESTOR_HIGHLIGHTS = [
  { stat: "32%", context: "YoY transactor growth", detail: "19.2K → 25.4K active spenders" },
  { stat: "IDR 942B", context: "Total annual spend (+28% YoY)", detail: "Driven by QRIS & e-commerce" },
  { stat: "3% → 27%", context: "QRIS adoption in 6 months", detail: "Fastest-growing payment channel" },
  { stat: "4.6%", context: "30+ DPD rate (improved)", detail: "Down from 5.8% — tighter collections" },
];

// ── News ────────────────────────────────────────────────────────────────────

const NEWS = [
  { title: "Bank Indonesia holds rates steady at 5.75%", date: "Mar 15", source: "Reuters" },
  { title: "Indonesian credit card spending up 12% YoY in Feb", date: "Mar 14", source: "CNBC ID" },
  { title: "OJK announces new digital lending guidelines for 2026", date: "Mar 12", source: "Kontan" },
];

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { period, periodLabel, dateRange, prevDateRange, comparisonMode } = usePeriod();
  const { isDark } = useTheme();
  const { filters } = useFilters();
  const { currency } = useCurrency();
  const { data: apiData, isLoading: loading } = useKpis(period);

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  // KPIs with filter scaling
  const kpis = useMemo(() => {
    const raw = (apiData?.kpis as KpiMetric[]) ?? generateMockKpis(period);
    if (!hasActiveFilters(filters)) return raw;
    return raw.map((k) => ({
      ...k,
      value: applyFilterToMetric(k.value, filters, k.unit === "percent"),
      prevValue: k.prevValue != null ? applyFilterToMetric(k.prevValue, filters, k.unit === "percent") : k.prevValue,
    }));
  }, [apiData, period, filters]);

  const sparklines = useMemo(() => generateSparklines(period), [period]);
  const { spendRateData, prevSpendRateData, dpdData } = useMemo(() => {
    const raw = generateChartData(period);
    if (!hasActiveFilters(filters)) return raw;
    return {
      spendRateData: applyFilterToData(raw.spendRateData, filters),
      prevSpendRateData: applyFilterToData(raw.prevSpendRateData, filters),
      dpdData: applyFilterToData(raw.dpdData, filters),
    };
  }, [period, filters]);

  const health = useMemo(() => computeHealth(kpis, isDark), [kpis, isDark]);
  const alerts = useMemo(() => generateAlerts(kpis, period), [kpis, period]);

  const severityConfig = {
    act: { icon: AlertTriangle, label: "Act Now", bg: isDark ? "bg-red-500/10 border-red-500/30" : "bg-red-50 border-red-200", text: isDark ? "text-[#FF6B6B]" : "text-red-700" },
    watch: { icon: AlertTriangle, label: "Watch", bg: isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-amber-50 border-amber-200", text: isDark ? "text-[#FFD166]" : "text-amber-700" },
    highlight: { icon: Sparkles, label: "Highlight", bg: isDark ? "bg-emerald-500/10 border-emerald-500/30" : "bg-emerald-50 border-emerald-200", text: isDark ? "text-[#06D6A0]" : "text-emerald-700" },
  };

  return (
    <div className="flex flex-col">
      <Header title="Dashboard" />

      <div className="flex-1 space-y-5 p-6">
        <ActiveFiltersBanner />

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 1. HEALTH SCORE BANNER                                         */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className={cn(
          "rounded-2xl border p-6 bg-gradient-to-r",
          isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)] shadow-sm",
          health.score >= 70
            ? isDark ? "from-[#06D6A0]/5 to-transparent" : "from-emerald-50/80 to-white"
            : health.score >= 45
              ? isDark ? "from-[#FFD166]/5 to-transparent" : "from-amber-50/80 to-white"
              : isDark ? "from-[#FF6B6B]/5 to-transparent" : "from-red-50/80 to-white"
        )}>
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className={cn("text-4xl font-bold tabular-nums", health.color)}>{health.score}</span>
                <div>
                  <span className={cn("text-xs font-bold uppercase tracking-widest", health.color)}>{health.label}</span>
                  <p className="text-xs text-[var(--text-muted)]">{periodLabel} · {dateRange.label}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed max-w-2xl">
                {health.verdict}
              </p>
            </div>

            {/* Signal pills */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold", isDark ? "bg-emerald-500/15 text-[#06D6A0]" : "bg-emerald-100 text-emerald-700")}>
                <TrendingUp className="h-3 w-3" />
                {health.bestMetric}
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold", isDark ? "bg-red-500/15 text-[#FF6B6B]" : "bg-red-100 text-red-700")}>
                <TrendingDown className="h-3 w-3" />
                {health.worstMetric}
              </div>
              <div className={cn("flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold", isDark ? "bg-amber-500/15 text-[#FFD166]" : "bg-amber-100 text-amber-700")}>
                <AlertTriangle className="h-3 w-3" />
                {health.keyAlert}
              </div>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 2. THE BIG 4 KPIs                                              */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi) => (
            <MetricCard
              key={kpi.metric}
              metricKey={kpi.metric}
              label={kpi.label}
              value={kpi.value}
              prevValue={kpi.prevValue}
              unit={kpi.unit as "count" | "percent" | "idr" | "usd"}
              asOf={DATA_RANGE.end}
              dataRange={DATA_RANGE}
              sparklineData={sparklines[kpi.metric]}
              target={kpi.metric === "spend_active_rate" ? 50 : kpi.metric === "dpd_30_plus_rate" ? 3 : undefined}
              higherIsBetter={kpi.metric !== "dpd_30_plus_rate"}
            />
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 3. ALERTS & ACTIONS                                            */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className={cn(
          "rounded-xl border p-5",
          isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
        )}>
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
            Actions & Alerts
          </h3>
          <div className="space-y-2.5">
            {alerts.map((alert, i) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              return (
                <div key={i} className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", config.bg)}>
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.text)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[9px] font-bold uppercase tracking-widest", config.text)}>{config.label}</span>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">{alert.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{alert.detail}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-medium text-[var(--text-secondary)]">→ {alert.action}</span>
                      {alert.link && (
                        <Link href={alert.link} className={cn("text-[10px] font-medium flex items-center gap-0.5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>
                          View details <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 4. TWO KEY CHARTS                                              */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Growth Story */}
          <div className={cn(
            "rounded-xl border p-5",
            isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
          )}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Growth Story</h3>
              <Link href="/deep-dive/spend" className={cn("text-[10px] font-medium flex items-center gap-0.5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>
                Deep dive <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mb-3">Spend Active Rate — % of eligible accounts transacting</p>
            <DashboardLineChart
              data={spendRateData}
              lines={[
                { key: "rate", color: isDark ? "#06D6A0" : "#059669", label: "Spend Active Rate %" },
                { key: "target", color: isDark ? "#ffffff20" : "#00000015", label: "Target (50%)" },
              ]}
              prevPeriodData={comparisonMode !== "none" ? prevSpendRateData : undefined}
              prevPeriodLabel="Prior"
              valueType="percent"
              height={200}
            />
          </div>

          {/* Risk Story */}
          <div className={cn(
            "rounded-xl border p-5",
            isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
          )}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Risk Story</h3>
              <Link href="/deep-dive/risk" className={cn("text-[10px] font-medium flex items-center gap-0.5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>
                Deep dive <ArrowRight className="h-2.5 w-2.5" />
              </Link>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mb-3">DPD Distribution — current vs prior period</p>
            <DashboardBarChart
              data={dpdData}
              bars={[
                { key: "count", color: isDark ? "#FFD166" : "#F5A623", label: "Current" },
                { key: "prev", color: isDark ? "#ffffff20" : "#00000015", label: "Prior" },
              ]}
              xAxisKey="bucket"
              height={200}
            />
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 5. INVESTOR SNAPSHOT                                            */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">Investor Highlights</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {INVESTOR_HIGHLIGHTS.map((h, i) => (
              <div key={i} className={cn(
                "rounded-xl border px-4 py-3",
                isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
              )}>
                <p className={cn("text-2xl font-bold", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>{h.stat}</p>
                <p className="text-xs font-medium text-[var(--text-primary)] mt-0.5">{h.context}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{h.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* 6. MARKET CONTEXT (slim footer)                                 */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className={cn(
          "flex items-center gap-4 rounded-lg border px-4 py-2.5 overflow-x-auto",
          isDark ? "border-[var(--border)] bg-[var(--surface-elevated)]" : "border-[var(--border)] bg-[var(--surface-elevated)]"
        )}>
          <Newspaper className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
          {NEWS.map((n, i) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              {i > 0 && <div className="h-3 w-px bg-[var(--border)]" />}
              <span className="text-xs text-[var(--text-primary)]">{n.title}</span>
              <span className="text-[10px] text-[var(--text-muted)]">{n.source} · {n.date}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
