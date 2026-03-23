"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { Header } from "@/components/layout/header";
import { useTranslations } from "next-intl";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { QrCode, CheckCircle2, TrendingUp, Users, CreditCard, ArrowUpRight, Star, Store, DollarSign, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { usePeriod } from "@/hooks/use-period";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { getPeriodRange } from "@/lib/period-data";
import { useDateParams } from "@/hooks/use-period";

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
    action: "QRIS drives +16.9% total spend and +18.2% more transactions.",
    detail: "Test group shows significantly higher engagement: more transactors (+5.8%), more transactions per user (+12.3%), and higher total spend. QRIS adoption at 55% of Test transactors.",
  },
  {
    id: "qris-2",
    priority: "urgent",
    action: "Total revenue per user is 13.6% LOWER for Test group.",
    detail: "Card interchange cannibalization (-28.9%) far outweighs the QRIS MDR revenue gain. QRIS issuer share (0.2035%) is ~8x lower than card interchange (1.6%). Net revenue loss of ~IDR 154K per user.",
  },
  {
    id: "qris-3",
    priority: "positive",
    action: "Fee and interest revenue is +5.4% higher for Test group.",
    detail: "Admin fees +4.3%, charge fees +5.1%, interest +18.9%. Higher transaction activity generates more fee income. This partially offsets interchange losses but does not close the gap.",
  },
  {
    id: "qris-4",
    priority: "monitor",
    action: "Card interchange cannibalization is the key concern.",
    detail: "Test group lost IDR 1.07B in card interchange but gained only IDR 200M in QRIS revenue + IDR 103M in extra fees. The question: does higher engagement and LTV justify the ~IDR 770M net revenue gap?",
  },
  {
    id: "qris-5",
    priority: "monitor",
    action: "80K+ QRIS-only merchants expand card acceptance reach.",
    detail: "These merchants only process QRIS — they represent new transaction opportunities that would not exist without QRIS. However, the low MDR (0.2035% issuer share) limits revenue from this expanded reach.",
  },
  {
    id: "qris-6",
    priority: "monitor",
    action: "Decision requires LTV modeling and strategic assessment.",
    detail: "QRIS clearly drives engagement and customer stickiness. Before graduating: (1) model long-term LTV including churn reduction, (2) assess BI regulatory trajectory on QRIS mandates, (3) evaluate competitive positioning if Honest does NOT offer QRIS.",
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
  total_spend_idr: number;
  qris_spend_idr: number;
  total_txns: number;
  qris_txns: number;
  avg_spend_per_eligible_user: number;
  txn_per_user: number;
  sar: number;
  std_dev_spend: number;
  std_dev_txns: number;
  // Legacy USD fields (kept for backward compat if old API still used)
  total_spend_usd?: number;
  qris_spend_usd?: number;
  avg_spend_per_user?: number;
}

interface MerchantClassRow {
  grp: string;
  merchant_type: string;
  qris_spend_idr: number;
  qris_txns: number;
  qris_users: number;
}

interface ProfitabilityRow {
  grp: string;
  cohort_size: number;
  admin_fee_revenue: number;
  interest_revenue: number;
  charge_fee_revenue: number;
  card_interchange_revenue: number;
  qris_mdr_revenue: number;
  total_revenue: number;
  arpu: number;
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
  merchantClassification?: MerchantClassRow[];
  qrisOnlyMerchantCount?: { qris_only_merchants: number; mixed_merchants: number; non_qris_only_merchants: number };
  qrisOnlyMerchantGrowth?: { month: string; cumulative_merchants: number; new_merchants: number }[];
  interchangeProjection?: InterchangeRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cohortRpu?: any[];
  profitability?: ProfitabilityRow[];
  // Legacy fields (backward compat with old dev-mode API)
  merchantBreakdown?: { qris_only_merchants: number; mixed_merchants: number; non_qris_only_merchants: number };
  merchantGrowth?: { month: string; cumulative_merchants: number; new_merchants: number }[];
  mixedMerchantStats?: { qris_txns_at_mixed: number; qris_spend_idr_at_mixed: number; qris_spend_usd_at_mixed: number; mixed_merchant_count: number };
  qrisOnlyMerchantSpend?: QrisOnlySpendRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cohortFinancials?: any[];
  topMerchantsByTxn?: { merchant: string; txn_count: number; total_spend_idr: number; total_spend_usd: number }[];
  topMerchantsBySpend?: { merchant: string; txn_count: number; total_spend_idr: number; total_spend_usd: number }[];
}

export default function QrisExperimentPage() {
  const { periodLabel } = usePeriod();
  const { dateParams, startDate, endDate } = useDateParams();
  const { isDark } = useTheme();
  const tNav = useTranslations("nav");

  const apiUrl = startDate && endDate
    ? `/api/qris-experiment?${dateParams}`
    : null;

  const { data: apiData, isLoading } = useSWR<ApiData>(
    apiUrl,
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

  // Helper: get spend value (support both IDR and legacy USD fields)
  const getSpend = (row: CohortRow) => row.total_spend_idr ?? ((row.total_spend_usd ?? 0) * 16000);
  const getQrisSpend = (row: CohortRow) => row.qris_spend_idr ?? ((row.qris_spend_usd ?? 0) * 16000);
  const getAvgSpend = (row: CohortRow) => row.avg_spend_per_eligible_user ?? (row.avg_spend_per_user ?? 0);

  // Derived metrics
  const spendLift = hasData && getSpend(control) > 0
    ? ((getSpend(test) - getSpend(control)) / getSpend(control) * 100)
    : 0;
  const qrisAdoptionRate = hasData && test.transactors > 0
    ? (test.qris_users / test.transactors * 100)
    : 0;
  const qrisSpendShare = hasData && getSpend(test) > 0
    ? (getQrisSpend(test) / getSpend(test) * 100)
    : 0;

  // Confidence interval for avg spend per eligible user
  const spendCI = useMemo(() => {
    if (!hasData || !test.std_dev_spend || !control.std_dev_spend) return null;
    const testMean = getAvgSpend(test);
    const controlMean = getAvgSpend(control);
    const testVar = (test.std_dev_spend ?? 0) ** 2;
    const controlVar = (control.std_dev_spend ?? 0) ** 2;
    const testN = test.cohort_size;
    const controlN = control.cohort_size;
    if (testN === 0 || controlN === 0 || controlMean === 0) return null;
    const diff = testMean - controlMean;
    const se = Math.sqrt(testVar / testN + controlVar / controlN);
    const ciLow = diff - 1.96 * se;
    const ciHigh = diff + 1.96 * se;
    const pctDiff = (diff / controlMean) * 100;
    const pctLow = (ciLow / controlMean) * 100;
    const pctHigh = (ciHigh / controlMean) * 100;
    return { pctDiff, pctLow, pctHigh, diff, ciLow, ciHigh };
  }, [hasData, test, control]);

  // Merchant classification data
  const merchantClass = useMemo(() => {
    if (!apiData?.merchantClassification?.length) return null;
    const rows = apiData.merchantClassification;
    const testRows = rows.filter(r => r.grp === 'Test');
    const controlRows = rows.filter(r => r.grp === 'Control');
    const types = ['Mixed Merchants', 'QRIS-Only Merchants', 'E-commerce Sites'];
    const byType = (arr: MerchantClassRow[], type: string) => arr.find(r => r.merchant_type === type);
    return { testRows, controlRows, types, byType };
  }, [apiData]);

  // Profitability data
  const profData = useMemo(() => {
    if (!apiData?.profitability?.length) return null;
    const rows = apiData.profitability;
    const ctrl = rows.find(r => r.grp === 'Control');
    const tst = rows.find(r => r.grp === 'Test');
    if (!ctrl || !tst) return null;
    return { ctrl, tst };
  }, [apiData]);

  // RPU computed after interchangeTest/Control are defined (see below)

  // Interchange projection data
  const { interchangeTest, interchangeControl } = useMemo(() => {
    const rows = apiData?.interchangeProjection;
    if (!rows || rows.length === 0) return { interchangeTest: null, interchangeControl: null };
    return {
      interchangeTest: rows.find((r) => r.grp === "Test") || null,
      interchangeControl: rows.find((r) => r.grp === "Control") || null,
    };
  }, [apiData]);

  // Authoritative RPU from dedicated BigQuery query
  // Uses: 1.6% card interchange, 0.2035% QRIS issuer share, actual DW004 fees/interest
  // DW004 snapshot on last day of period, DW007 transactions within period
  const rpuData = useMemo(() => {
    if (!apiData?.cohortRpu?.length) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = apiData.cohortRpu as any[];
    const c = rows.find((r: { grp: string }) => r.grp === 'Control');
    const t = rows.find((r: { grp: string }) => r.grp === 'Test');
    if (!c || !t) return null;
    return { ctrl: c, tst: t };
  }, [apiData]);

  const rpuTest = rpuData?.tst?.rpu_idr ?? null;
  const rpuControl = rpuData?.ctrl?.rpu_idr ?? null;
  const rpuDelta = rpuTest && rpuControl ? ((rpuTest - rpuControl) / rpuControl * 100) : 0;

  // Cumulative QRIS-only merchant growth
  const qrisOnlyMerchantGrowthData = useMemo(() => {
    return apiData?.qrisOnlyMerchantGrowth ?? apiData?.merchantGrowth ?? [];
  }, [apiData]);

  // Cumulative QRIS spend at QRIS-only merchants (legacy support)
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
                    {spendCI && (
                      <p className="text-[9px] text-white/40">
                        95% CI: {spendCI.pctLow >= 0 ? '+' : ''}{spendCI.pctLow.toFixed(1)}% to {spendCI.pctHigh >= 0 ? '+' : ''}{spendCI.pctHigh.toFixed(1)}%
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">QRIS Adoption</p>
                    <p className="text-2xl font-bold text-white">{qrisAdoptionRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">SAR Lift</p>
                    <p className="text-2xl font-bold text-white">+{(test.sar - control.sar).toFixed(1)}pp</p>
                  </div>
                  {rpuTest && rpuControl && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">RPU Delta</p>
                      <p className={cn("text-2xl font-bold", rpuDelta >= 0 ? "text-[#06D6A0]" : "text-[#FF6B6B]")}>
                        {rpuDelta >= 0 ? "+" : ""}{rpuDelta.toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-white/40">
                        Test: Rp {(rpuTest / 1000).toFixed(0)}K · Ctrl: Rp {(rpuControl / 1000).toFixed(0)}K
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Verdict Badge */}
            <div className="shrink-0">
              <div className="flex flex-col items-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-5">
                <AlertTriangle className="h-8 w-8 text-[#FFD166] mb-2" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Verdict</span>
                <span className="text-lg font-bold text-[#FFD166]">NEEDS REVIEW</span>
                <span className="text-[11px] text-white/50 mt-1 text-center max-w-[150px]">
                  Higher engagement but lower RPU
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
              value={`Rp ${((getSpend(test) - getSpend(control)) / 1e6).toFixed(0)}M`}
              subtext={`+${spendLift.toFixed(1)}% vs Control${spendCI ? ` (CI: ${spendCI.pctLow >= 0 ? '+' : ''}${spendCI.pctLow.toFixed(1)}% to ${spendCI.pctHigh >= 0 ? '+' : ''}${spendCI.pctHigh.toFixed(1)}%)` : ''}`}
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
              label="Avg Spend per Eligible User (IDR)"
              testValue={getAvgSpend(test)}
              controlValue={getAvgSpend(control)}
              format="number"
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
              testValue={getSpend(test) > 0 ? getQrisSpend(test) / getSpend(test) * 100 : 0}
              controlValue={0}
              format="percent"
              live
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* HEADLINE: Avg Spend per Eligible User with CI                  */}
        {/* ============================================================ */}
        {hasData && spendCI && (
          <div className={cn(
            "rounded-xl border p-5",
            isDark ? "border-emerald-800/30 bg-emerald-950/20" : "border-emerald-200 bg-emerald-50",
          )}>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Average Spend per Eligible User
              <LiveBadge />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Control</p>
                <p className="text-2xl font-bold text-[var(--text-secondary)]">
                  Rp {(getAvgSpend(control) / 1000).toFixed(0)}K
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{control.cohort_size.toLocaleString()} eligible users</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Test</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  Rp {(getAvgSpend(test) / 1000).toFixed(0)}K
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{test.cohort_size.toLocaleString()} eligible users</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Lift (95% CI)</p>
                <p className={cn("text-2xl font-bold", spendCI.pctDiff >= 0 ? "text-emerald-600" : "text-red-600")}>
                  {spendCI.pctDiff >= 0 ? '+' : ''}{spendCI.pctDiff.toFixed(1)}%
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  ({spendCI.pctLow >= 0 ? '+' : ''}{spendCI.pctLow.toFixed(1)}% to {spendCI.pctHigh >= 0 ? '+' : ''}{spendCI.pctHigh.toFixed(1)}%)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MERCHANT CLASSIFICATION by QRIS merchant type                  */}
        {/* ============================================================ */}
        {merchantClass && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Store className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">QRIS Merchant Classification</h2>
              <LiveBadge />
            </div>

            <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] overflow-hidden">
              <div className="p-4 border-b border-[var(--border)]">
                <p className="text-xs text-[var(--text-muted)]">
                  QRIS spend classified by merchant type. Mixed = accepts both card and QRIS.
                  QRIS-Only = only ever processed QRIS. E-commerce = online-only merchants.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Merchant Type</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Test Spend (IDR)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Test Txns</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Control Spend (IDR)</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Control Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {merchantClass.types.map(type => {
                    const t = merchantClass.byType(merchantClass.testRows, type);
                    const c = merchantClass.byType(merchantClass.controlRows, type);
                    return (
                      <tr key={type} className="border-b border-[var(--border)] last:border-b-0">
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{type}</td>
                        <td className="text-right px-4 py-3 font-mono text-xs text-[var(--text-primary)]">
                          {t ? `Rp ${(t.qris_spend_idr / 1e6).toFixed(1)}M` : '-'}
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                          {t?.qris_txns?.toLocaleString() ?? '-'}
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                          {c ? `Rp ${(c.qris_spend_idr / 1e6).toFixed(1)}M` : '-'}
                        </td>
                        <td className="text-right px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">
                          {c?.qris_txns?.toLocaleString() ?? '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* MERCHANT REACH ANALYSIS                                       */}
        {/* ============================================================ */}
        {(apiData?.qrisOnlyMerchantCount || apiData?.merchantBreakdown) && (() => {
          const bd = apiData?.qrisOnlyMerchantCount ?? apiData?.merchantBreakdown;
          if (!bd) return null;
          return (
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
                  value={bd.qris_only_merchants}
                  unit="count"
                  asOf="All Time"
                  dataRange={{ start: "", end: "" }}
                  liveData
                />
                <MetricCard
                  metricKey="mixed_merchants"
                  label="Mixed (Card + QRIS)"
                  value={bd.mixed_merchants}
                  unit="count"
                  asOf="All Time"
                  dataRange={{ start: "", end: "" }}
                  liveData
                />
                <MetricCard
                  metricKey="non_qris_merchants"
                  label="Card-Only Merchants"
                  value={bd.non_qris_only_merchants}
                  unit="count"
                  asOf="All Time"
                  dataRange={{ start: "", end: "" }}
                  liveData
                />
              </div>

              {/* Cumulative QRIS-only merchant growth */}
              {qrisOnlyMerchantGrowthData.length > 0 && (
                <ChartCard
                  title="Cumulative QRIS-Only Merchants"
                  subtitle="Running total of merchants that have only ever processed QRIS transactions"
                  asOf="All Time"
                  dataRange={{ start: "", end: "" }}
                  liveData
                >
                  <DashboardLineChart
                    data={qrisOnlyMerchantGrowthData.map(r => ({
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
            </div>
          );
        })()}

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
        {/* TOP QRIS-ONLY MERCHANTS                                        */}
        {/* ============================================================ */}
        {(apiData?.topMerchantsByTxn?.length || apiData?.topMerchantsBySpend?.length) ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {apiData.topMerchantsByTxn && apiData.topMerchantsByTxn.length > 0 && (
              <div className={cn("rounded-xl border p-5", isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]")}>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Top QRIS-Only Merchants by Transaction Count
                  <span className={cn("ml-2 text-[9px]", isDark ? "text-[#FFD166]" : "text-amber-500")} title="Live BigQuery data">&#9733;</span>
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] mb-3">All time — merchants that have only ever processed QRIS</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border)]">
                        <th className="pb-1.5 text-left font-medium">Merchant</th>
                        <th className="pb-1.5 text-right font-medium">Txns</th>
                        <th className="pb-1.5 text-right font-medium">Spend (IDR)</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--text-secondary)]">
                      {apiData.topMerchantsByTxn.map((m: { merchant: string; txn_count: number; total_spend_idr: number }) => (
                        <tr key={m.merchant} className="border-b border-[var(--border)]/20">
                          <td className="py-1.5 font-medium truncate max-w-[180px]">{m.merchant}</td>
                          <td className="py-1.5 text-right font-mono">{m.txn_count.toLocaleString()}</td>
                          <td className="py-1.5 text-right font-mono">{m.total_spend_idr >= 1e9 ? `Rp ${(m.total_spend_idr/1e9).toFixed(1)}B` : m.total_spend_idr >= 1e6 ? `Rp ${(m.total_spend_idr/1e6).toFixed(0)}M` : `Rp ${m.total_spend_idr.toLocaleString()}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {apiData.topMerchantsBySpend && apiData.topMerchantsBySpend.length > 0 && (
              <div className={cn("rounded-xl border p-5", isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]")}>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  Top QRIS-Only Merchants by Spend
                  <span className={cn("ml-2 text-[9px]", isDark ? "text-[#FFD166]" : "text-amber-500")} title="Live BigQuery data">&#9733;</span>
                </h3>
                <p className="text-[10px] text-[var(--text-muted)] mb-3">Current period — ordered by total spend</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[10px] text-[var(--text-muted)] border-b border-[var(--border)]">
                        <th className="pb-1.5 text-left font-medium">Merchant</th>
                        <th className="pb-1.5 text-right font-medium">Spend (IDR)</th>
                        <th className="pb-1.5 text-right font-medium">Txns</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--text-secondary)]">
                      {apiData.topMerchantsBySpend.map((m: { merchant: string; txn_count: number; total_spend_idr: number }) => (
                        <tr key={m.merchant} className="border-b border-[var(--border)]/20">
                          <td className="py-1.5 font-medium truncate max-w-[180px]">{m.merchant}</td>
                          <td className="py-1.5 text-right font-mono">{m.total_spend_idr >= 1e9 ? `Rp ${(m.total_spend_idr/1e9).toFixed(1)}B` : m.total_spend_idr >= 1e6 ? `Rp ${(m.total_spend_idr/1e6).toFixed(0)}M` : `Rp ${m.total_spend_idr.toLocaleString()}`}</td>
                          <td className="py-1.5 text-right font-mono">{m.txn_count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}

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

        {/* ============================================================ */}
        {/* PROFITABILITY ANALYSIS                                         */}
        {/* ============================================================ */}
        {profData && (() => {
          const { ctrl, tst } = profData;
          const fmtR = (v: number) => v >= 1e9 ? `Rp ${(v/1e9).toFixed(2)}B` : v >= 1e6 ? `Rp ${(v/1e6).toFixed(1)}M` : `Rp ${v.toLocaleString()}`;
          const dlt = (t: number, c: number) => {
            if (c === 0) return t > 0 ? 'new' : '-';
            const d = ((t - c) / Math.abs(c)) * 100;
            return d > 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`;
          };

          const profRows = [
            { label: "Admin Fee Revenue", t: tst.admin_fee_revenue, c: ctrl.admin_fee_revenue },
            { label: "Interest Revenue", t: tst.interest_revenue, c: ctrl.interest_revenue },
            { label: "Charge Fee Revenue", t: tst.charge_fee_revenue, c: ctrl.charge_fee_revenue },
            { label: "Card Interchange @ 1.6%", t: tst.card_interchange_revenue, c: ctrl.card_interchange_revenue },
            { label: "QRIS MDR @ 0.2035%", t: tst.qris_mdr_revenue, c: ctrl.qris_mdr_revenue },
            { label: "Total Revenue", t: tst.total_revenue, c: ctrl.total_revenue },
            { label: "ARPU (per Eligible User)", t: tst.arpu, c: ctrl.arpu },
          ];

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Profitability Analysis</h2>
                <LiveBadge />
              </div>

              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border)]">
                  <p className="text-xs text-[var(--text-muted)]">
                    Revenue per cohort. Fees and interest from actual DW004 billed amounts.
                    Card interchange at 1.6% (Kansas City Fed Aug 2025).
                    QRIS issuer revenue at 0.2035% (0.55% MDR x 37% share via PT ALTO).
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Revenue Line</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Control ({ctrl.cohort_size.toLocaleString()})</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Test ({tst.cohort_size.toLocaleString()})</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profRows.map(row => {
                      const d = dlt(row.t, row.c);
                      const isPos = d.startsWith('+');
                      const isNeg = d.startsWith('-');
                      const isTotal = row.label.startsWith('Total') || row.label.startsWith('ARPU');
                      return (
                        <tr key={row.label} className={cn(
                          "border-b border-[var(--border)] last:border-b-0",
                          isTotal && "bg-[var(--surface)] font-semibold",
                        )}>
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.label}</td>
                          <td className="text-right px-4 py-3 font-mono text-xs text-[var(--text-secondary)]">{fmtR(row.c)}</td>
                          <td className="text-right px-4 py-3 font-mono text-xs text-[var(--text-primary)]">{fmtR(row.t)}</td>
                          <td className="text-right px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5",
                              d === 'new' ? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30"
                                : isPos ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30"
                                : isNeg ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30"
                                : "text-[var(--text-muted)]",
                            )}>
                              {d !== 'new' && d !== '-' && <ArrowUpRight className={cn("h-3 w-3", isNeg && "rotate-90")} />}
                              {d}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Projected ARPU if QRIS graduates to full portfolio */}
              <div className={cn(
                "rounded-xl border-l-4 p-4",
                isDark
                  ? "border-l-violet-500 bg-violet-950/20 border border-violet-900/30"
                  : "border-l-violet-500 bg-violet-50 border border-violet-200",
              )}>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Graduation Projection</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  If the Test group ARPU of Rp {(tst.arpu / 1000).toFixed(0)}K holds at scale,
                  {tst.arpu > ctrl.arpu
                    ? ` graduating QRIS to the full portfolio would increase per-user revenue by Rp ${((tst.arpu - ctrl.arpu) / 1000).toFixed(0)}K (+${(((tst.arpu - ctrl.arpu) / ctrl.arpu) * 100).toFixed(1)}%).`
                    : ` graduating QRIS would reduce per-user revenue by Rp ${((ctrl.arpu - tst.arpu) / 1000).toFixed(0)}K (${(((tst.arpu - ctrl.arpu) / ctrl.arpu) * 100).toFixed(1)}%).`
                  }
                  {' '}Consider LTV impact, churn reduction, and BI regulatory trajectory before decision.
                </p>
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
            QRIS transactions are identified by{" "}
            <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw007_rte_dest = &apos;L&apos;</code>.
            Currency conversion: cents / 100 for IDR, / 16,000 for USD.
            Interchange estimates: card ~1.6% (blended Visa+MC domestic, Kansas City Fed Aug 2025), QRIS MDR ~0.55% weighted avg (PBI No. 24/8/PBI/2022) with 37% issuer share via PT ALTO Network.
            Fee and interest revenue sourced from actual billed amounts in DW004 (f9_dw004_tot_int, f9_dw004_bil_fee_chrg_1, f9_dw004_bil_chrg_fee).
            Spend data from authorized transactions (DW007). Data as of {AS_OF}.
          </p>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-2">
            <span className="font-semibold text-amber-600">Revenue Note:</span>{" "}
            While QRIS drives higher engagement (+16.9% total spend, +18.2% transactions) and modestly higher fee/interest revenue (+5.4%),
            the card interchange cannibalization (-28.9%) results in <strong>lower total revenue per user</strong> for the Test group.
            The QRIS issuer share (0.2035% effective rate) is ~8x lower than card interchange (1.6%).
            Decision to graduate QRIS should weigh customer engagement benefits and long-term LTV against short-term revenue impact.
          </p>
        </div>
      </div>
    </div>
  );
}
