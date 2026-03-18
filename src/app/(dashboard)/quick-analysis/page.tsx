"use client";

import { useState, useMemo, useCallback } from "react";
import useSWR from "swr";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, formatCurrency } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useCurrency } from "@/hooks/use-currency";
import { useDateParams } from "@/hooks/use-period";
import { useTranslations } from "next-intl";
import { CohortBuilder, EMPTY_COHORT, type CohortFilters } from "@/components/analysis/cohort-builder";
import { KpiSelector, AVAILABLE_KPIS, type KpiDefinition } from "@/components/analysis/kpi-selector";
import { ChartDateRange, type DateRangeOverride } from "@/components/charts/chart-date-range";
import { BarChart3, Users, GitCompareArrows, CalendarRange, TrendingUp, Info, Upload, FileSpreadsheet, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Map KPI IDs from the selector to supported BQ metric keys
const KPI_TO_METRIC_KEY: Record<string, string> = {
  eligible_to_spend: "eligible_count",
  spend_activation_rate: "spend_active_rate",
  active_purchase_rate: "spend_active_rate",
  total_purchase_volume: "total_spend",
  dpd_30_rate: "dpd_30_rate",
  avg_txn_per_user: "transactor_count",
};

// ── Time range types ─────────────────────────────────────────────────

type AnalysisTimeframe = "weekly" | "monthly" | "quarterly";
type SpecialRange = "ytd" | "mtd" | null;

interface TimeConfig {
  timeframe: AnalysisTimeframe;
  specialRange: SpecialRange;
}

const TIMEFRAME_OPTIONS: { value: AnalysisTimeframe; label: string; points: string }[] = [
  { value: "weekly", label: "Weekly", points: "Past 6 weeks" },
  { value: "monthly", label: "Monthly", points: "Past 6 months" },
  { value: "quarterly", label: "Quarterly", points: "Past 12 quarters" },
];

// ── Mock data generation ────────────────────────────────────────────

function generateMockTimeSeries(
  kpiId: string,
  kpi: KpiDefinition,
  timeframe: AnalysisTimeframe,
  specialRange: SpecialRange,
  isGroupB: boolean,
): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  const today = new Date(2026, 2, 16);

  let numPoints: number;
  let getLabel: (i: number) => string;

  if (specialRange === "ytd") {
    // YTD: show monthly from Jan to current month
    numPoints = today.getMonth() + 1;
    getLabel = (i) => {
      const d = new Date(today.getFullYear(), i, 1);
      return d.toLocaleDateString("en-US", { month: "short" });
    };
  } else if (specialRange === "mtd") {
    // MTD: show weekly within current month
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    numPoints = Math.ceil(today.getDate() / 7);
    getLabel = (i) => {
      const d = new Date(firstDay);
      d.setDate(d.getDate() + i * 7);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };
  } else {
    switch (timeframe) {
      case "weekly":
        numPoints = 6;
        getLabel = (i) => {
          const d = new Date(today);
          d.setDate(d.getDate() - (numPoints - 1 - i) * 7);
          return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        };
        break;
      case "monthly":
        numPoints = 6;
        getLabel = (i) => {
          const d = new Date(today.getFullYear(), today.getMonth() - (numPoints - 1 - i), 1);
          return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        };
        break;
      case "quarterly":
        numPoints = 12;
        getLabel = (i) => {
          const q = Math.floor(today.getMonth() / 3);
          const qOffset = numPoints - 1 - i;
          const targetQ = q - qOffset;
          const targetYear = today.getFullYear() + Math.floor(targetQ / 4);
          const qNum = ((targetQ % 4) + 4) % 4 + 1;
          return `Q${qNum} ${String(targetYear).slice(2)}`;
        };
        break;
    }
  }

  // Seed a base value based on KPI
  let base: number;
  let variance: number;
  const growth = isGroupB ? 0.015 : 0.025;

  switch (kpi.unit) {
    case "percent":
      base = 30 + Math.random() * 40; // 30-70%
      variance = 3;
      break;
    case "idr":
      base = 5000000 + Math.random() * 20000000;
      variance = base * 0.08;
      break;
    case "usd":
      base = 300 + Math.random() * 1200;
      variance = base * 0.08;
      break;
    case "ratio":
      base = 2 + Math.random() * 6;
      variance = 0.5;
      break;
    default:
      base = 500 + Math.random() * 5000;
      variance = base * 0.1;
  }

  // Deterministic seed from kpiId
  let seed = 0;
  for (let c = 0; c < kpiId.length; c++) seed += kpiId.charCodeAt(c);
  if (isGroupB) seed += 1000;

  const pseudoRandom = (i: number) => {
    const x = Math.sin(seed + i * 13.37) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < numPoints; i++) {
    const trendFactor = 1 + growth * i;
    const noise = (pseudoRandom(i) - 0.5) * variance * 2;
    let value = base * trendFactor + noise;

    if (kpi.unit === "percent") {
      value = Math.max(0, Math.min(100, value));
    }
    value = Math.round(value * 100) / 100;

    points.push({ date: getLabel(i), value });
  }

  return points;
}

// ── Color palette ───────────────────────────────────────────────────

const GROUP_A_COLOR = "#3b82f6";
const GROUP_B_COLOR = "#f97316";

const GROUP_A_COLORS = ["#3b82f6", "#60a5fa", "#2563eb", "#93c5fd"];
const GROUP_B_COLORS = ["#f97316", "#fb923c", "#ea580c", "#fdba74"];

// ── Page Component ──────────────────────────────────────────────────

export default function QuickAnalysisPage() {
  const { isDark } = useTheme();
  const { currency } = useCurrency();
  const { dateParams, startDate, endDate } = useDateParams();
  const tNav = useTranslations("nav");

  // Cohort state
  const [groupA, setGroupA] = useState<CohortFilters>({ ...EMPTY_COHORT });
  const [groupB, setGroupB] = useState<CohortFilters>({ ...EMPTY_COHORT });

  // KPI state
  const [selectedKpis, setSelectedKpis] = useState<string[]>([
    "spend_activation_rate",
    "active_purchase_rate",
    "avg_txn_per_user",
  ]);

  // Time config
  const [timeConfig, setTimeConfig] = useState<TimeConfig>({
    timeframe: "weekly",
    specialRange: null,
  });

  // Custom date range override for analysis
  const [dateOverride, setDateOverride] = useState<DateRangeOverride | null>(null);

  // Spreadsheet links for group definitions
  const [spreadsheetA, setSpreadsheetA] = useState<string>("");
  const [spreadsheetB, setSpreadsheetB] = useState<string>("");
  const [showSpreadsheetA, setShowSpreadsheetA] = useState(false);
  const [showSpreadsheetB, setShowSpreadsheetB] = useState(false);

  // ── Fetch real data for the first selected KPI that has a BQ mapping ──
  const firstMappedKpi = selectedKpis.find((id) => KPI_TO_METRIC_KEY[id]);
  const firstMetricKey = firstMappedKpi ? KPI_TO_METRIC_KEY[firstMappedKpi] : null;

  const { data: apiMetricData } = useSWR(
    firstMetricKey ? `/api/quick-analysis?${dateParams}&metricKey=${firstMetricKey}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  // Chart data — use API data for the mapped KPI, mock for everything else
  const chartData = useMemo(() => {
    return selectedKpis.map((kpiId) => {
      const kpi = AVAILABLE_KPIS.find((k) => k.id === kpiId)!;

      // If this KPI has API data and matches the fetched metric
      const metricKey = KPI_TO_METRIC_KEY[kpiId];
      if (metricKey && metricKey === firstMetricKey && apiMetricData?.timeSeries?.length) {
        const apiSeries = apiMetricData.timeSeries as { date: string; value: number }[];
        const seriesB = generateMockTimeSeries(kpiId, kpi, timeConfig.timeframe, timeConfig.specialRange, true);
        const merged = apiSeries.map((pt, i) => ({
          date: pt.date,
          groupA: pt.value,
          groupB: seriesB[i]?.value ?? 0,
        }));
        return { kpi, data: merged };
      }

      // Fallback to mock
      const seriesA = generateMockTimeSeries(kpiId, kpi, timeConfig.timeframe, timeConfig.specialRange, false);
      const seriesB = generateMockTimeSeries(kpiId, kpi, timeConfig.timeframe, timeConfig.specialRange, true);

      const merged = seriesA.map((pt, i) => ({
        date: pt.date,
        groupA: pt.value,
        groupB: seriesB[i]?.value ?? 0,
      }));

      return { kpi, data: merged };
    });
  }, [selectedKpis, timeConfig, firstMetricKey, apiMetricData]);

  const formatValue = useCallback(
    (value: number, unit: string) => {
      switch (unit) {
        case "percent":
          return formatPercent(value);
        case "idr":
          return formatCurrency(value, "IDR");
        case "usd":
          return formatCurrency(value, "USD");
        case "ratio":
          return value.toFixed(2);
        default:
          return formatNumber(value, { compact: true });
      }
    },
    []
  );

  const activeACount = Object.values(groupA).reduce((s, a) => s + a.length, 0);
  const activeBCount = Object.values(groupB).reduce((s, a) => s + a.length, 0);

  const grid = isDark ? "#2D2955" : "#E8D5F0";
  const axis = isDark ? "#6B6394" : "#9B87A8";
  const tooltipBg = isDark ? "#1E1B3A" : "#FFFFFF";
  const tooltipBorder = isDark ? "#2D2955" : "#E8D5F0";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <div className="flex items-center gap-2">
          <GitCompareArrows
            className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}
          />
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{tNav("quickAnalysis")}</h1>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Compare any two customer segments across your most important KPIs
        </p>
      </div>

      {/* Cohort builders — side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <CohortBuilder
            label="Group A"
            color={GROUP_A_COLOR}
            bgColor="bg-blue-500/10"
            textColor="text-blue-400"
            cohort={groupA}
            onChange={setGroupA}
          />
          {/* Spreadsheet link for Group A */}
          <div className={cn(
            "rounded-lg border px-3 py-2 transition-colors",
            isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
          )}>
            {!showSpreadsheetA && !spreadsheetA ? (
              <button
                onClick={() => setShowSpreadsheetA(true)}
                className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Or define group from spreadsheet (user_id / loc_acct list)</span>
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                  <span className="text-[10px] font-medium text-[var(--text-muted)]">Spreadsheet URL or file path</span>
                  <button
                    onClick={() => { setShowSpreadsheetA(false); setSpreadsheetA(""); }}
                    className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <input
                  type="text"
                  value={spreadsheetA}
                  onChange={(e) => setSpreadsheetA(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/... or /path/to/file.csv"
                  className={cn(
                    "w-full rounded-md border px-2 py-1.5 text-xs outline-none transition-colors",
                    isDark
                      ? "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-blue-500"
                      : "border-[var(--border)] bg-white text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-blue-500"
                  )}
                />
                <p className="text-[10px] text-[var(--text-muted)]">
                  Expects a column named <code className="font-mono">user_id</code> or <code className="font-mono">loc_acct</code>
                </p>
                {spreadsheetA && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400" />
                    <span className="text-blue-400 font-medium">Linked</span>
                    <span className="text-[var(--text-muted)]">— will override Group A filters when connected to BigQuery</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <CohortBuilder
            label="Group B"
            color={GROUP_B_COLOR}
            bgColor="bg-orange-500/10"
            textColor="text-orange-400"
            cohort={groupB}
            onChange={setGroupB}
          />
          {/* Spreadsheet link for Group B */}
          <div className={cn(
            "rounded-lg border px-3 py-2 transition-colors",
            isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
          )}>
            {!showSpreadsheetB && !spreadsheetB ? (
              <button
                onClick={() => setShowSpreadsheetB(true)}
                className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Or define group from spreadsheet (user_id / loc_acct list)</span>
              </button>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                  <span className="text-[10px] font-medium text-[var(--text-muted)]">Spreadsheet URL or file path</span>
                  <button
                    onClick={() => { setShowSpreadsheetB(false); setSpreadsheetB(""); }}
                    className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <input
                  type="text"
                  value={spreadsheetB}
                  onChange={(e) => setSpreadsheetB(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/... or /path/to/file.csv"
                  className={cn(
                    "w-full rounded-md border px-2 py-1.5 text-xs outline-none transition-colors",
                    isDark
                      ? "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-orange-500"
                      : "border-[var(--border)] bg-white text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-orange-500"
                  )}
                />
                <p className="text-[10px] text-[var(--text-muted)]">
                  Expects a column named <code className="font-mono">user_id</code> or <code className="font-mono">loc_acct</code>
                </p>
                {spreadsheetB && (
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400" />
                    <span className="text-orange-400 font-medium">Linked</span>
                    <span className="text-[var(--text-muted)]">— will override Group B filters when connected to BigQuery</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Selector */}
      <div
        className={cn(
          "rounded-xl border p-4 transition-colors",
          isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className={cn("h-4 w-4", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Select KPIs to Compare</h3>
          <span className="text-[10px] text-[var(--text-muted)]">
            Choose up to 8 metrics
          </span>
        </div>
        <KpiSelector selected={selectedKpis} onChange={setSelectedKpis} maxSelections={8} />
      </div>

      {/* Time range controls */}
      <div
        className={cn(
          "rounded-xl border p-4 transition-colors",
          isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <CalendarRange className={cn("h-4 w-4", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Time Range</h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe toggle */}
          <div className="flex rounded-lg bg-[var(--surface-elevated)] p-0.5">
            {TIMEFRAME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() =>
                  setTimeConfig({ timeframe: opt.value, specialRange: null })
                }
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  timeConfig.timeframe === opt.value && !timeConfig.specialRange
                    ? isDark
                      ? "bg-[#5B22FF] text-white"
                      : "bg-[#D00083] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className={cn("h-5 w-px", isDark ? "bg-[var(--border)]" : "bg-[var(--border)]")} />

          {/* Special ranges */}
          <div className="flex gap-1.5">
            <button
              onClick={() =>
                setTimeConfig((prev) => ({
                  timeframe: "monthly",
                  specialRange: prev.specialRange === "ytd" ? null : "ytd",
                }))
              }
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors",
                timeConfig.specialRange === "ytd"
                  ? isDark
                    ? "border-[#5B22FF] bg-[#5B22FF]/15 text-[#7C4DFF]"
                    : "border-[#D00083] bg-[#D00083]/10 text-[#D00083]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              YTD
            </button>
            <button
              onClick={() =>
                setTimeConfig((prev) => ({
                  timeframe: "weekly",
                  specialRange: prev.specialRange === "mtd" ? null : "mtd",
                }))
              }
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors",
                timeConfig.specialRange === "mtd"
                  ? isDark
                    ? "border-[#5B22FF] bg-[#5B22FF]/15 text-[#7C4DFF]"
                    : "border-[#D00083] bg-[#D00083]/10 text-[#D00083]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              MTD
            </button>
          </div>

          <div className={cn("h-5 w-px", isDark ? "bg-[var(--border)]" : "bg-[var(--border)]")} />

          {/* Custom date range */}
          <ChartDateRange override={dateOverride} onOverride={setDateOverride} />

          <span className="text-[11px] text-[var(--text-muted)]">
            {dateOverride
              ? `${dateOverride.start} – ${dateOverride.end}`
              : timeConfig.specialRange === "ytd"
                ? "Jan 1 – Mar 16, 2026"
                : timeConfig.specialRange === "mtd"
                  ? "Mar 1 – Mar 16, 2026"
                  : TIMEFRAME_OPTIONS.find((o) => o.value === timeConfig.timeframe)?.points}
          </span>
        </div>
      </div>

      {/* Charts */}
      {selectedKpis.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border p-12 text-center transition-colors",
            isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
          )}
        >
          <BarChart3 className="h-10 w-10 mx-auto text-[var(--text-muted)] mb-3" />
          <p className="text-sm text-[var(--text-muted)]">Select KPIs above to start comparing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {chartData.map(({ kpi, data }) => {
            const latestA = data[data.length - 1]?.groupA ?? 0;
            const latestB = data[data.length - 1]?.groupB ?? 0;
            const diff = latestA - latestB;
            const diffPct =
              latestB !== 0 ? ((diff / latestB) * 100).toFixed(1) : "—";

            return (
              <div
                key={kpi.id}
                className={cn(
                  "rounded-xl border overflow-hidden transition-colors",
                  isDark
                    ? "border-[var(--border)] bg-[var(--surface)]"
                    : "border-[var(--border)] bg-[var(--surface)]"
                )}
              >
                {/* Chart header */}
                <div className="flex items-start justify-between px-4 py-3 bg-[var(--surface-elevated)]/50">
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                      {kpi.label}
                    </h4>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {kpi.category} &middot;{" "}
                      {kpi.unit === "percent"
                        ? "Percentage"
                        : kpi.unit === "idr"
                          ? "IDR"
                          : kpi.unit === "usd"
                            ? "USD"
                            : kpi.unit === "ratio"
                              ? "Ratio"
                              : "Count"}
                    </p>
                  </div>
                  {/* Summary stats */}
                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)]">Group A</p>
                      <p className="text-sm font-bold" style={{ color: GROUP_A_COLOR }}>
                        {formatValue(latestA, kpi.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)]">Group B</p>
                      <p className="text-sm font-bold" style={{ color: GROUP_B_COLOR }}>
                        {formatValue(latestB, kpi.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)]">Diff</p>
                      <p
                        className={cn(
                          "text-sm font-bold",
                          diff > 0
                            ? "text-emerald-400"
                            : diff < 0
                              ? "text-red-400"
                              : "text-[var(--text-muted)]"
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {diffPct}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chart */}
                <div className="p-4">
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={data}
                        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: axis, fontSize: 10 }}
                          axisLine={{ stroke: grid }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fill: axis, fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => formatValue(v as number, kpi.unit)}
                          width={65}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: tooltipBg,
                            border: `1px solid ${tooltipBorder}`,
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(value, name) => [
                            formatValue(Number(value), kpi.unit),
                            String(name) === "groupA" ? "Group A" : "Group B",
                          ]}
                        />
                        <Legend
                          formatter={(value) =>
                            value === "groupA" ? "Group A" : "Group B"
                          }
                          wrapperStyle={{ fontSize: 11 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="groupA"
                          stroke={GROUP_A_COLOR}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: GROUP_A_COLOR }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="groupB"
                          stroke={GROUP_B_COLOR}
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: GROUP_B_COLOR }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info callout */}
      <div
        className={cn(
          "rounded-xl border p-4 flex items-start gap-3",
          isDark
            ? "border-[#5B22FF]/20 bg-[#5B22FF]/5"
            : "border-[#D00083]/20 bg-[#D00083]/5"
        )}
      >
        <Info className={cn("h-4 w-4 shrink-0 mt-0.5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
        <div className="text-xs text-[var(--text-secondary)] space-y-1">
          <p>
            <strong className="text-[var(--text-primary)]">How it works:</strong> Define Group A and
            Group B using any combination of filters on the left. Select the KPIs you want to
            compare, choose a timeframe, and the charts will update with side-by-side trend lines.
          </p>
          <p>
            Currently showing simulated data. When connected to BigQuery, filters will query
            real customer segments for precise cohort comparison.
          </p>
        </div>
      </div>
    </div>
  );
}
