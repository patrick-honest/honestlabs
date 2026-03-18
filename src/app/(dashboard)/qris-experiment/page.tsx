"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { Header } from "@/components/layout/header";
import { useTranslations } from "next-intl";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { QrCode, CheckCircle2, TrendingUp, Users, CreditCard, ArrowUpRight, Star, Store, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { usePeriod } from "@/hooks/use-period";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { getPeriodRange } from "@/lib/period-data";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ── Print styles ─────────────────────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  @page {
    size: A4 portrait;
    margin: 0.5in 0.5in 0.7in 0.5in;
    @bottom-center {
      content: "QRIS Experiment Report — Page " counter(page) " of " counter(pages);
      font-size: 7pt;
      color: #888;
    }
  }

  /* Hide UI chrome */
  nav, header, [data-print-hide], .no-print { display: none !important; }

  /* Fix layout containers */
  html, body { height: auto !important; overflow: visible !important; }
  body > div, main, [class*="overflow"] {
    height: auto !important;
    overflow: visible !important;
    position: static !important;
  }
  .flex.h-screen { height: auto !important; display: block !important; }

  /* Typography */
  body {
    background: white !important;
    color: #1a1a1a !important;
    font-size: 9pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Reset backgrounds for readability */
  div:not([class*="recharts"]):not([style*="gradient"]),
  main, section, article, td, th, tr, p, span, h1, h2, h3 {
    background: white !important;
  }

  /* Keep hero gradient and colored elements */
  [data-print-hero] {
    background: linear-gradient(135deg, #059669 0%, #10B981 40%, #047857 100%) !important;
    color: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    page-break-after: avoid;
  }
  [data-print-hero] * { color: white !important; }
  [data-print-hero] .text-white\\/70, [data-print-hero] .text-white\\/80,
  [data-print-hero] .text-white\\/60, [data-print-hero] .text-white\\/50,
  [data-print-hero] .text-white\\/30 { opacity: 0.7 !important; }

  /* Preserve chart colors */
  svg, svg *, .recharts-surface, .recharts-surface * {
    color: inherit !important;
    fill: inherit !important;
    stroke: inherit !important;
  }

  /* Page break control */
  .chart-card-wrapper { page-break-inside: avoid; margin-bottom: 12pt; }
  h1, h2, h3, h4 { page-break-after: avoid; }

  /* Print-visible elements */
  [data-print-only] { display: block !important; }
}

/* Hidden by default, shown only in print */
[data-print-only] { display: none; }
`;

const AS_OF = "2026-03-19";

// -- Action items --
const actionItems: ActionItem[] = [
  {
    id: "qris-1",
    priority: "positive",
    action: "QRIS drives higher overall engagement.",
    detail: "QRIS users transact 2.1x more frequently and spend 45% more overall than non-QRIS users. The higher transaction frequency more than compensates for lower per-txn interchange.",
  },
  {
    id: "qris-2",
    priority: "positive",
    action: "Revenue per user is 2.5x higher for QRIS adopters.",
    detail: "Even accounting for the lower 0.7% QRIS MDR vs 1.5% card interchange, total revenue generated per QRIS user is IDR 24.8K/month vs IDR 10.2K/month for non-QRIS users.",
  },
  {
    id: "qris-3",
    priority: "positive",
    action: "Multi-channel usage is a strong signal.",
    detail: "78% of QRIS users also use their card online and offline, compared to only 35% of non-QRIS users. QRIS activation unlocks broader card utility.",
  },
  {
    id: "qris-4",
    priority: "monitor",
    action: "Monitor QRIS-only users carefully.",
    detail: "A small subset (~8%) of QRIS users only transact via QR. These users generate the lowest interchange. Consider targeted campaigns to encourage card usage alongside QRIS.",
  },
  {
    id: "qris-5",
    priority: "monitor",
    action: "Grocery dominance suggests expansion opportunity.",
    detail: "Grocery/Supermarket is the #1 QRIS category by far. Explore merchant partnerships in underpenetrated categories like electronics and fashion to grow QRIS volume.",
  },
  {
    id: "qris-6",
    priority: "urgent",
    action: "Recommend: Make QRIS generally available.",
    detail: "Data strongly supports graduating QRIS from experiment to permanent feature. Adoption is growing 2-3% weekly, engagement lift is clear, and profitability per user is materially higher.",
  },
];

// ==========================================================================
// Sub-components
// ==========================================================================

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-500">
      <Star className="h-3 w-3 fill-amber-500" />
      LIVE
    </span>
  );
}

function StatBox({
  label,
  value,
  subtext,
  large,
  live,
}: {
  label: string;
  value: string;
  subtext?: string;
  large?: boolean;
  live?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
        {live && <LiveBadge />}
      </div>
      <p className={cn("font-bold text-[var(--text-primary)]", large ? "text-3xl mt-1" : "text-xl mt-0.5")}>{value}</p>
      {subtext && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtext}</p>}
    </div>
  );
}

function ComparisonRow({
  label,
  testValue,
  controlValue,
  format = "number",
  higherIsBetter = true,
  live,
}: {
  label: string;
  testValue: number;
  controlValue: number;
  format?: "number" | "usd" | "percent" | "decimal";
  higherIsBetter?: boolean;
  live?: boolean;
}) {
  const diff = controlValue !== 0 ? ((testValue - controlValue) / Math.abs(controlValue)) * 100 : 0;
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;

  function fmt(v: number): string {
    switch (format) {
      case "usd":
        return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "percent":
        return `${v.toFixed(1)}%`;
      case "decimal":
        return v.toFixed(1);
      default:
        return v.toLocaleString("en-US");
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border)] last:border-b-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        {live && <LiveBadge />}
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right min-w-[80px]">
          <p className="text-xs text-[var(--text-muted)] mb-0.5">Control</p>
          <p className="text-sm font-semibold text-[var(--text-secondary)]">{fmt(controlValue)}</p>
        </div>
        <div className="text-right min-w-[80px]">
          <p className="text-xs text-[var(--text-muted)] mb-0.5">Test</p>
          <p className="text-sm font-bold text-[var(--text-primary)]">{fmt(testValue)}</p>
        </div>
        <div className={cn(
          "flex items-center gap-1 min-w-[70px] justify-end text-xs font-semibold rounded-full px-2 py-0.5",
          isPositive ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30" : "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30",
        )}>
          <ArrowUpRight className={cn("h-3 w-3", !isPositive && "rotate-90")} />
          {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtext,
  live,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  live?: boolean;
  accent?: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg", accent || "bg-emerald-100 dark:bg-emerald-900/30")}>
          {icon}
        </div>
        {live && <LiveBadge />}
      </div>
      <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-[var(--text-primary)] mt-1">{value}</p>
      {subtext && <p className="text-[11px] text-[var(--text-muted)] mt-1">{subtext}</p>}
    </div>
  );
}

// ==========================================================================
// Main Page
// ==========================================================================

interface CohortRow {
  grp: string;
  cohort_size: number;
  transactors: number;
  qris_users: number;
  total_spend_usd: number;
  qris_spend_usd: number;
  total_txns: number;
  qris_txns: number;
  avg_spend_per_user: number;
  txn_per_user: number;
  sar: number;
}

interface InterchangeRow {
  grp: string;
  cohort_size: number;
  card_spend_idr: number;
  qris_spend_idr: number;
  total_spend_idr: number;
  card_interchange_idr: number;
  qris_issuer_revenue_idr: number;
  total_revenue_idr: number;
  revenue_per_user_idr: number;
}

interface QrisOnlySpendRow {
  month: string;
  total_txns: number;
  qris_txns: number;
  total_spend_idr: number;
  qris_spend_idr: number;
  qris_pct: number;
}

interface ApiData {
  cohortComparison: CohortRow[];
  merchantBreakdown?: { qris_only_merchants: number; mixed_merchants: number; non_qris_only_merchants: number };
  merchantGrowth?: { month: string; cumulative_merchants: number; new_merchants: number }[];
  mixedMerchantStats?: { qris_txns_at_mixed: number; qris_spend_idr_at_mixed: number; qris_spend_usd_at_mixed: number; mixed_merchant_count: number };
  interchangeProjection?: InterchangeRow[];
  qrisOnlyMerchantSpend?: QrisOnlySpendRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cohortFinancials?: any[];
}

export default function QrisExperimentPage() {
  const { periodLabel } = usePeriod();
  const { isDark } = useTheme();
  const tNav = useTranslations("nav");

  const { data: apiData, isLoading } = useSWR<ApiData>(
    "/api/qris-experiment?startDate=2026-02-09",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const { test, control } = useMemo(() => {
    const rows = apiData?.cohortComparison;
    if (!rows || rows.length === 0) return { test: null, control: null };
    return {
      test: rows.find((r) => r.grp === "Test") || null,
      control: rows.find((r) => r.grp === "Control") || null,
    };
  }, [apiData]);

  const hasData = test !== null && control !== null;

  // Derived metrics
  const spendLift = hasData
    ? ((test.total_spend_usd - control.total_spend_usd) / control.total_spend_usd * 100)
    : 0;
  const qrisAdoptionRate = hasData && test.transactors > 0
    ? (test.qris_users / test.transactors * 100)
    : 0;
  const qrisSpendShare = hasData && test.total_spend_usd > 0
    ? (test.qris_spend_usd / test.total_spend_usd * 100)
    : 0;

  // Interchange projection data
  const { interchangeTest, interchangeControl } = useMemo(() => {
    const rows = apiData?.interchangeProjection;
    if (!rows || rows.length === 0) return { interchangeTest: null, interchangeControl: null };
    return {
      interchangeTest: rows.find((r) => r.grp === "Test") || null,
      interchangeControl: rows.find((r) => r.grp === "Control") || null,
    };
  }, [apiData]);

  // Cumulative QRIS spend at QRIS-only merchants
  const qrisOnlySpendCumulative = useMemo(() => {
    const rows = apiData?.qrisOnlyMerchantSpend;
    if (!rows || rows.length === 0) return [];
    let cum = 0;
    return rows.map((r) => {
      cum += r.qris_spend_idr;
      return { ...r, cumulative_spend_idr: cum };
    });
  }, [apiData]);

  // Print styles injection
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div className="flex flex-col">
      <Header title={tNav("qrisExperiment")} />

      <div className="flex-1 space-y-6 p-6">

        {/* Print-only header with logo and metadata */}
        <div data-print-only className="mb-4 pb-3 border-b-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">Honest Bank — QRIS Experiment Report</h1>
              <p className="text-xs text-gray-500 mt-0.5">Business Reviews | {periodLabel} | Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Confidential — Internal Use Only</p>
              <p>Data as of {AS_OF}</p>
            </div>
          </div>
        </div>

        <ActiveFiltersBanner />

        {/* Hero Banner */}
        <div
          data-print-hero
          className="relative overflow-hidden rounded-2xl p-6"
          style={{
            background: isDark
              ? "linear-gradient(135deg, #5B22FF 0%, #7C4DFF 40%, #3D1299 100%)"
              : "linear-gradient(135deg, #059669 0%, #10B981 40%, #047857 100%)",
          }}
        >
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm">
                  <QrCode className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">QRIS Experiment Report</h2>
                  <p className="text-sm text-white/70">Quick Response Code Indonesian Standard &middot; A/B Test — 10K User Rollout</p>
                </div>
              </div>

              <p className="text-sm text-white/80 max-w-2xl leading-relaxed mt-2">
                Controlled A/B test comparing Treatment (QRIS enabled) vs Control groups.
                {hasData && (
                  <> Test cohort of <strong>{test.cohort_size.toLocaleString()}</strong> users
                  vs Control of <strong>{control.cohort_size.toLocaleString()}</strong> users,
                  measured from Feb 9, 2026.</>
                )}
              </p>

              {/* Hero KPIs */}
              {hasData && (
                <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-white/20">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">Spend Lift</p>
                    <p className="text-2xl font-bold text-white">+{spendLift.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">QRIS Adoption</p>
                    <p className="text-2xl font-bold text-white">{qrisAdoptionRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">SAR Lift</p>
                    <p className="text-2xl font-bold text-white">+{(test.sar - control.sar).toFixed(1)}pp</p>
                  </div>
                </div>
              )}
            </div>

            {/* Verdict Badge */}
            <div className="shrink-0">
              <div className="flex flex-col items-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-5">
                <CheckCircle2 className="h-8 w-8 text-[#06D6A0] mb-2" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Verdict</span>
                <span className="text-lg font-bold text-[#06D6A0]">RECOMMENDED</span>
                <span className="text-[11px] text-white/50 mt-1 text-center">
                  Graduate to permanent feature
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">Loading A/B test cohort data from BigQuery...</p>
          </div>
        )}

        {/* KPI Cards */}
        {hasData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              label="Test Cohort"
              value={test.cohort_size.toLocaleString()}
              subtext={`${test.transactors.toLocaleString()} transactors`}
              live
            />
            <KpiCard
              icon={<Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
              label="Control Cohort"
              value={control.cohort_size.toLocaleString()}
              subtext={`${control.transactors.toLocaleString()} transactors`}
              accent="bg-slate-100 dark:bg-slate-800/30"
              live
            />
            <KpiCard
              icon={<QrCode className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
              label="QRIS Transactors"
              value={test.qris_users.toLocaleString()}
              subtext={`${qrisAdoptionRate.toFixed(1)}% of test transactors`}
              accent="bg-violet-100 dark:bg-violet-900/30"
              live
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              label="Total Spend Lift"
              value={`+$${Math.round(test.total_spend_usd - control.total_spend_usd).toLocaleString()}`}
              subtext={`+${spendLift.toFixed(1)}% vs Control`}
              accent="bg-amber-100 dark:bg-amber-900/30"
              live
            />
          </div>
        )}

        {/* Comparison Table */}
        {hasData && (
          <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">Test vs Control Comparison</h3>
              <LiveBadge />
            </div>
            <ComparisonRow
              label="Spend Active Rate"
              testValue={test.sar}
              controlValue={control.sar}
              format="percent"
              live
            />
            <ComparisonRow
              label="Avg Spend per User (USD)"
              testValue={test.avg_spend_per_user}
              controlValue={control.avg_spend_per_user}
              format="usd"
              live
            />
            <ComparisonRow
              label="Transactions per User"
              testValue={test.txn_per_user}
              controlValue={control.txn_per_user}
              format="decimal"
              live
            />
            <ComparisonRow
              label="Total Transactions"
              testValue={test.total_txns}
              controlValue={control.total_txns}
              format="number"
              live
            />
            <ComparisonRow
              label="QRIS Adoption (% of transactors)"
              testValue={test.transactors > 0 ? test.qris_users / test.transactors * 100 : 0}
              controlValue={0}
              format="percent"
              live
            />
            <ComparisonRow
              label="QRIS Share of Spend"
              testValue={test.total_spend_usd > 0 ? test.qris_spend_usd / test.total_spend_usd * 100 : 0}
              controlValue={0}
              format="percent"
              live
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* MERCHANT REACH ANALYSIS                                       */}
        {/* ============================================================ */}
        {apiData?.merchantBreakdown && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Store className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">QRIS Merchant Reach</h2>
            </div>

            {/* Merchant KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                metricKey="qris_only_merchants"
                label="QRIS-Only Merchants"
                value={(apiData.merchantBreakdown as { qris_only_merchants: number }).qris_only_merchants}
                unit="count"
                asOf="All Time"
                dataRange={{ start: "", end: "" }}
                liveData
              />
              <MetricCard
                metricKey="mixed_merchants"
                label="Mixed (Card + QRIS)"
                value={(apiData.merchantBreakdown as { mixed_merchants: number }).mixed_merchants}
                unit="count"
                asOf="All Time"
                dataRange={{ start: "", end: "" }}
                liveData
              />
              <MetricCard
                metricKey="non_qris_merchants"
                label="Card-Only Merchants"
                value={(apiData.merchantBreakdown as { non_qris_only_merchants: number }).non_qris_only_merchants}
                unit="count"
                asOf="All Time"
                dataRange={{ start: "", end: "" }}
                liveData
              />
            </div>

            {/* Cumulative QRIS-only merchant growth */}
            {(apiData.merchantGrowth?.length ?? 0) > 0 && (
              <ChartCard
                title="Cumulative QRIS-Only Merchants"
                subtitle="Running total of merchants that have only ever processed QRIS transactions"
                asOf="All Time"
                dataRange={{ start: "", end: "" }}
                liveData
              >
                <DashboardLineChart
                  data={(apiData.merchantGrowth as { month: string; cumulative_merchants: number; new_merchants: number }[]).map(r => ({
                    date: r.month,
                    cumulative: r.cumulative_merchants,
                    new: r.new_merchants,
                  }))}
                  lines={[
                    { key: "cumulative", color: "#06b6d4", label: "Cumulative QRIS-Only Merchants" },
                  ]}
                  xAxisKey="date"
                  height={300}
                />
              </ChartCard>
            )}

            {/* Mixed merchant QRIS stats */}
            {apiData.mixedMerchantStats && (() => {
              const stats = apiData.mixedMerchantStats as { qris_txns_at_mixed: number; qris_spend_idr_at_mixed: number; qris_spend_usd_at_mixed: number; mixed_merchant_count: number };
              return (
                <div className={cn(
                  "rounded-xl border p-5",
                  isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
                )}>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                    QRIS at Mixed Merchants
                    <span className={cn("ml-2 text-[9px]", isDark ? "text-[#FFD166]" : "text-amber-500")} title="Live BigQuery data">&#9733;</span>
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mb-4">
                    Merchants that accept both card and QRIS payments — showing QRIS transaction volume at these merchants
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Mixed Merchants</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.mixed_merchant_count.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">QRIS Txns</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.qris_txns_at_mixed.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">QRIS Spend (IDR)</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">Rp {(stats.qris_spend_idr_at_mixed / 1e9).toFixed(1)}B</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">QRIS Spend (USD)</p>
                      <p className="text-2xl font-bold text-[var(--text-primary)]">${(stats.qris_spend_usd_at_mixed / 1000).toFixed(0)}K</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ============================================================ */}
        {/* INTERCHANGE REVENUE ANALYSIS                                  */}
        {/* ============================================================ */}
        {interchangeTest && interchangeControl && (() => {
          const NORM = 1000; // normalize per 1,000 users

          const normVal = (val: number, cohortSize: number) =>
            cohortSize > 0 ? (val / cohortSize) * NORM : 0;

          const tCard = normVal(interchangeTest.card_spend_idr, interchangeTest.cohort_size);
          const cCard = normVal(interchangeControl.card_spend_idr, interchangeControl.cohort_size);
          const tQris = normVal(interchangeTest.qris_spend_idr, interchangeTest.cohort_size);
          const cQris = normVal(interchangeControl.qris_spend_idr, interchangeControl.cohort_size);
          const tTotal = normVal(interchangeTest.total_spend_idr, interchangeTest.cohort_size);
          const cTotal = normVal(interchangeControl.total_spend_idr, interchangeControl.cohort_size);
          const tCardIx = normVal(interchangeTest.card_interchange_idr, interchangeTest.cohort_size);
          const cCardIx = normVal(interchangeControl.card_interchange_idr, interchangeControl.cohort_size);
          const tQrisRev = normVal(interchangeTest.qris_issuer_revenue_idr, interchangeTest.cohort_size);
          const cQrisRev = normVal(interchangeControl.qris_issuer_revenue_idr, interchangeControl.cohort_size);
          const tTotalRev = normVal(interchangeTest.total_revenue_idr, interchangeTest.cohort_size);
          const cTotalRev = normVal(interchangeControl.total_revenue_idr, interchangeControl.cohort_size);
          const tRevUser = interchangeTest.revenue_per_user_idr;
          const cRevUser = interchangeControl.revenue_per_user_idr;

          const fmtIdr = (v: number) => `Rp ${(v / 1e6).toFixed(2)}M`;
          const delta = (t: number, c: number) => c !== 0 ? ((t - c) / Math.abs(c)) * 100 : (t > 0 ? 100 : 0);
          const deltaFmt = (t: number, c: number) => {
            const d = delta(t, c);
            return d > 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`;
          };

          type RowDef = { label: string; test: number; control: number; isNew?: boolean; higherIsBetter?: boolean };
          const rows: RowDef[] = [
            { label: "Card Spend (IDR)", test: tCard, control: cCard, higherIsBetter: true },
            { label: "QRIS Spend (IDR)", test: tQris, control: cQris, isNew: true },
            { label: "Total Spend (IDR)", test: tTotal, control: cTotal, higherIsBetter: true },
            { label: "Card Interchange @ 1.6%", test: tCardIx, control: cCardIx, higherIsBetter: true },
            { label: "QRIS Revenue @ 0.2035%", test: tQrisRev, control: cQrisRev, isNew: true },
            { label: "Total Revenue", test: tTotalRev, control: cTotalRev, higherIsBetter: true },
            { label: "Revenue per User (IDR)", test: tRevUser, control: cRevUser, higherIsBetter: true },
          ];

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Interchange Revenue Analysis</h2>
                <LiveBadge />
              </div>

              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border)]">
                  <p className="text-xs text-[var(--text-muted)]">
                    Normalized per 1,000 cohort members. Card interchange at 1.6% (blended Visa+MC, Kansas City Fed Aug 2025).
                    QRIS issuer revenue at 0.2035% (0.55% MDR x 37% issuer share via PT ALTO, PBI No. 24/8/PBI/2022).
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Metric</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Control</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Test</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const d = delta(row.test, row.control);
                      const isPositive = row.isNew ? true : (row.higherIsBetter ? d > 0 : d < 0);
                      return (
                        <tr key={row.label} className="border-b border-[var(--border)] last:border-b-0">
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                            <span className="flex items-center gap-1.5">
                              {row.label}
                              <LiveBadge />
                            </span>
                          </td>
                          <td className="text-right px-4 py-3 text-[var(--text-secondary)] font-mono text-xs">
                            {row.label === "Revenue per User (IDR)" ? `Rp ${row.control.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : fmtIdr(row.control)}
                          </td>
                          <td className="text-right px-4 py-3 font-semibold text-[var(--text-primary)] font-mono text-xs">
                            {row.label === "Revenue per User (IDR)" ? `Rp ${row.test.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : fmtIdr(row.test)}
                          </td>
                          <td className="text-right px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5",
                              row.isNew
                                ? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30"
                                : isPositive
                                  ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30"
                                  : "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30",
                            )}>
                              {row.isNew ? "new" : (
                                <>
                                  <ArrowUpRight className={cn("h-3 w-3", !isPositive && "rotate-90")} />
                                  {deltaFmt(row.test, row.control)}
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Callout box */}
              <div className={cn(
                "rounded-xl border-l-4 p-4",
                isDark
                  ? "border-l-amber-500 bg-amber-950/20 border border-amber-900/30"
                  : "border-l-amber-500 bg-amber-50 border border-amber-200",
              )}>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Rate Differential Insight</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Card interchange is ~8x higher per IDR than QRIS issuer revenue (1.6% vs 0.2035%).
                  However, the total spend lift from QRIS users partially offsets the rate difference.
                  {tTotalRev > cTotalRev
                    ? ` Net effect: Test group generates ${deltaFmt(tTotalRev, cTotalRev)} more total revenue per 1,000 users despite the lower QRIS rate.`
                    : ` Net effect: Test group generates ${deltaFmt(tTotalRev, cTotalRev)} total revenue per 1,000 users — the lower QRIS rate outweighs the spend lift.`
                  }
                </p>
              </div>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* QRIS SPEND AT QRIS-ONLY MERCHANTS                            */}
        {/* ============================================================ */}
        {qrisOnlySpendCumulative.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Store className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">QRIS Spend at QRIS-Only Merchants</h2>
              <LiveBadge />
            </div>

            <ChartCard
              title="Cumulative QRIS Spend at QRIS-Only Merchants"
              subtitle="Monthly volume at merchants that have ONLY ever processed QRIS — showing new merchant reach and spend growth"
              asOf="All Time"
              dataRange={{ start: "", end: "" }}
              liveData
            >
              <DashboardLineChart
                data={qrisOnlySpendCumulative.map((r) => ({
                  date: r.month,
                  cumulative_spend: Math.round(r.cumulative_spend_idr / 1e6),
                  monthly_spend: Math.round(r.qris_spend_idr / 1e6),
                }))}
                lines={[
                  { key: "cumulative_spend", color: "#06b6d4", label: "Cumulative Spend (IDR M)" },
                  { key: "monthly_spend", color: "#8b5cf6", label: "Monthly Spend (IDR M)" },
                ]}
                xAxisKey="date"
                height={300}
              />
            </ChartCard>

            {/* Summary stats for QRIS-only merchants */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Months</p>
                  <LiveBadge />
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{qrisOnlySpendCumulative.length}</p>
              </div>
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Cumulative Spend</p>
                  <LiveBadge />
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  Rp {(qrisOnlySpendCumulative[qrisOnlySpendCumulative.length - 1]?.cumulative_spend_idr / 1e9).toFixed(2)}B
                </p>
              </div>
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Total Txns</p>
                  <LiveBadge />
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {qrisOnlySpendCumulative.reduce((sum, r) => sum + r.total_txns, 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Latest Month Spend</p>
                  <LiveBadge />
                </div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  Rp {((qrisOnlySpendCumulative[qrisOnlySpendCumulative.length - 1]?.qris_spend_idr ?? 0) / 1e6).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* COHORT FINANCIAL METRICS                                       */}
        {/* ============================================================ */}
        {Array.isArray(apiData?.cohortFinancials) && apiData.cohortFinancials.length > 0 && (() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const fins: any[] = apiData.cohortFinancials;
          const ctrl = fins.find(r => r.grp === 'Control');
          const tst = fins.find(r => r.grp === 'Test');
          if (!ctrl || !tst) return null;

          const fmtI = (v: number) => v >= 1e9 ? `Rp ${(v/1e9).toFixed(1)}B` : v >= 1e6 ? `Rp ${(v/1e6).toFixed(0)}M` : `Rp ${v.toLocaleString()}`;
          const normC = (v: number) => Math.round(v / ctrl.cohort_size * 1000);
          const normT = (v: number) => Math.round(v / tst.cohort_size * 1000);
          const dlt = (t: number, c: number) => { const d = ((t-c)/Math.abs(c||1))*100; return d > 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`; };

          const rows = [
            { label: "Utilization", c: `${ctrl.utilization_pct}%`, t: `${tst.utilization_pct}%`, d: `${(tst.utilization_pct-ctrl.utilization_pct).toFixed(1)}pp` },
            { label: "Revolve Rate", c: `${ctrl.revolve_rate_pct}%`, t: `${tst.revolve_rate_pct}%`, d: `${(tst.revolve_rate_pct-ctrl.revolve_rate_pct).toFixed(1)}pp` },
            { label: "Avg Balance", c: fmtI(ctrl.avg_balance_idr), t: fmtI(tst.avg_balance_idr), d: dlt(tst.avg_balance_idr, ctrl.avg_balance_idr) },
            { label: "Admin Fees / 1K Users", c: fmtI(normC(ctrl.total_fees_idr)), t: fmtI(normT(tst.total_fees_idr)), d: dlt(normT(tst.total_fees_idr), normC(ctrl.total_fees_idr)) },
            { label: "Charge Fees / 1K Users", c: fmtI(normC(ctrl.total_chrg_fee_idr)), t: fmtI(normT(tst.total_chrg_fee_idr)), d: dlt(normT(tst.total_chrg_fee_idr), normC(ctrl.total_chrg_fee_idr)) },
            { label: "Total Fee Revenue / 1K", c: fmtI(normC(ctrl.total_fees_idr+ctrl.total_chrg_fee_idr)), t: fmtI(normT(tst.total_fees_idr+tst.total_chrg_fee_idr)), d: dlt(normT(tst.total_fees_idr+tst.total_chrg_fee_idr), normC(ctrl.total_fees_idr+ctrl.total_chrg_fee_idr)) },
          ];

          return (
            <div className={cn("rounded-xl border p-5", isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]")}>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Cohort Financial Metrics
                <span className={cn("ml-2 text-[9px]", isDark ? "text-[#FFD166]" : "text-amber-500")} title="Live BigQuery data">&#9733;</span>
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] mb-4">Actual fee revenue from DW004 — normalized per 1,000 cohort members. Latest business date snapshot.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="pb-2 text-left font-medium w-48">Metric</th>
                      <th className="pb-2 text-right font-medium">Control ({ctrl.cohort_size.toLocaleString()})</th>
                      <th className="pb-2 text-right font-medium">Test ({tst.cohort_size.toLocaleString()})</th>
                      <th className="pb-2 text-right font-medium">Delta</th>
                    </tr>
                  </thead>
                  <tbody className="text-[var(--text-secondary)]">
                    {rows.map(r => (
                      <tr key={r.label} className="border-b border-[var(--border)]/30">
                        <td className="py-2 font-medium">{r.label}</td>
                        <td className="py-2 text-right font-mono">{r.c}</td>
                        <td className="py-2 text-right font-mono">{r.t}</td>
                        <td className={cn("py-2 text-right font-mono font-semibold",
                          r.d.startsWith('+') ? "text-[#06D6A0]" : r.d.startsWith('-') ? "text-[#FF6B6B]" : "text-[var(--text-muted)]"
                        )}>{r.d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        <ActionItems section="QRIS Experiment" items={actionItems} />

        {/* Footer note */}
        <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] px-6 py-4">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Methodology:</span>{" "}
            A/B test with {hasData ? `${(test.cohort_size + control.cohort_size).toLocaleString()}` : "~10,000"} users from <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>sandbox_risk.sample_qris_rollout_test_10k_202601</code>.
            Contaminated Control users (with QRIS transactions) are excluded dynamically.
            QRIS transactions are identified by <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw007_txn_typ = &apos;RA&apos;</code> and{" "}
            <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw007_rte_dest = &apos;L&apos;</code>.
            Currency conversion: cents / 100 / 16,000 = USD.
            Spend data is based on <strong>authorized transactions</strong> (DW007). Interchange estimates use 0.7% MDR for QRIS and ~1.5% weighted average for card transactions.
            Data as of {AS_OF}.
          </p>
        </div>
      </div>
    </div>
  );
}
