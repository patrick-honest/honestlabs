"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useDateParams } from "@/hooks/use-period";
import { useTranslations } from "next-intl";
import { CohortBuilder, EMPTY_COHORT, type CohortFilters } from "@/components/analysis/cohort-builder";
import { KpiSelector, AVAILABLE_KPIS } from "@/components/analysis/kpi-selector";
import { ChartDateRange, type DateRangeOverride } from "@/components/charts/chart-date-range";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { BarChart3, GitCompareArrows, CalendarRange, TrendingUp, Info, FileSpreadsheet, X } from "lucide-react";

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

// ── Color palette ───────────────────────────────────────────────────

const GROUP_A_COLOR = "#3b82f6";
const GROUP_B_COLOR = "#f97316";

// ── Page Component ──────────────────────────────────────────────────

export default function QuickAnalysisPage() {
  const { isDark } = useTheme();
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

      {/* Charts replaced with banner */}
      <SampleDataBanner
        dataset="Various"
        reason="Quick analysis requires real-time BigQuery access to generate custom time series"
      />

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
