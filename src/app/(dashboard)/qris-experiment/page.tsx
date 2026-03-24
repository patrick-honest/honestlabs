"use client";

import { useEffect, useMemo, useCallback } from "react";
import useSWR from "swr";
import { Header } from "@/components/layout/header";
import { useTranslations } from "next-intl";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { QrCode, CheckCircle2, TrendingUp, Users, CreditCard, ArrowUpRight, Star, Store, DollarSign, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { usePeriod } from "@/hooks/use-period";
import { useCurrency } from "@/hooks/use-currency";
import { formatAmountCompact } from "@/lib/currency";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { getPeriodRange } from "@/lib/period-data";
import { useDateParams } from "@/hooks/use-period";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

const AS_OF = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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
    detail: "Admin fees +4.3%, late/penalty fees +5.1%, interest +18.9%. Higher transaction activity generates more fee income. This partially offsets interchange losses but does not close the gap.",
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
  format?: "number" | "usd" | "percent" | "decimal" | "currency";
  higherIsBetter?: boolean;
  live?: boolean;
}) {
  const { currency } = useCurrency();
  const diff = controlValue !== 0 ? ((testValue - controlValue) / Math.abs(controlValue)) * 100 : 0;
  const isPositive = higherIsBetter ? diff > 0 : diff < 0;

  function fmt(v: number): string {
    switch (format) {
      case "currency":
        return formatAmountCompact(v, currency);
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

interface QrisMerchantCriteriaRow {
  merchant_criteria: string;
  merchant_count: number;
  total_txns: number;
  total_spend_idr: number;
  avg_txn_size_idr: number;
}

// MDR rates per merchant criteria (Bank Indonesia regulation PBI No. 24/8/PBI/2022)
const MDR_RATES: Record<string, { rate: number; issuerShare: number; label: string; color: string }> = {
  UMI: { rate: 0.003, issuerShare: 0.37, label: "Usaha Mikro (UMI)", color: "#10b981" },
  UKE: { rate: 0.005, issuerShare: 0.37, label: "Usaha Kecil (UKE)", color: "#3b82f6" },
  UKI: { rate: 0.007, issuerShare: 0.37, label: "Usaha Kecil Menengah (UKI)", color: "#f59e0b" },
  UBE: { rate: 0.007, issuerShare: 0.37, label: "Usaha Besar (UBE)", color: "#ef4444" },
};

interface MerchantClassRow {
  grp: string;
  merchant_type: string;
  qris_spend_idr: number;
  qris_txns: number;
  qris_users: number;
  card_spend_idr: number;
  card_txns: number;
  card_users: number;
  total_spend_idr: number;
  cohort_size: number;
  std_dev_spend: number;
}

interface ProfitabilityRow {
  grp: string;
  cohort_size: number;
  admin_fee_revenue: number;
  interest_revenue: number;
  late_penalty_fee_revenue: number;
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

interface RevenueTrajectoryRow {
  month: string;
  grp: string;
  cohort_size: number;
  revolvers: number;
  revolve_rate_pct: number;
  fee_rpu: number;
  txn_rpu: number;
  total_rpu: number;
  interest_idr: number;
  admin_fees_idr: number;
  late_penalty_fees_idr: number;
  card_interchange_idr: number;
  qris_revenue_idr: number;
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
  revenueTrajectory?: RevenueTrajectoryRow[];
  incrementality?: { grp: string; user_type: string; users: number; total_spend: number; qris_spend: number; card_spend: number; txns: number }[];
  // Legacy fields (backward compat with old dev-mode API)
  merchantBreakdown?: { qris_only_merchants: number; mixed_merchants: number; non_qris_only_merchants: number };
  merchantGrowth?: { month: string; cumulative_merchants: number; new_merchants: number }[];
  mixedMerchantStats?: { qris_txns_at_mixed: number; qris_spend_idr_at_mixed: number; qris_spend_usd_at_mixed: number; mixed_merchant_count: number };
  qrisOnlyMerchantSpend?: QrisOnlySpendRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cohortFinancials?: any[];
  topMerchantsByTxn?: { merchant: string; txn_count: number; total_spend_idr: number; total_spend_usd: number }[];
  topMerchantsBySpend?: { merchant: string; txn_count: number; total_spend_idr: number; total_spend_usd: number }[];
  qrisMerchantCriteria?: QrisMerchantCriteriaRow[];
}

export default function QrisExperimentPage() {
  const { periodLabel } = usePeriod();
  const { dateParams, startDate, endDate } = useDateParams();
  const { isDark } = useTheme();
  const tNav = useTranslations("nav");
  const t = useTranslations("qrisExperiment");
  const { currency } = useCurrency();
  const fmtCur = useCallback((v: number) => formatAmountCompact(v, currency), [currency]);

  const apiUrl = startDate && endDate
    ? `/api/qris-experiment?${dateParams}`
    : null;

  const { data: apiData, isLoading } = useSWR<ApiData>(
    apiUrl,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30_000 },
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

  // Revenue trajectory: monthly fee vs interchange RPU, with breakeven projection
  const trajectoryData = useMemo(() => {
    const rows = apiData?.revenueTrajectory;
    if (!rows || rows.length < 2) return null;

    const months = [...new Set(rows.map(r => r.month))].sort();
    const testRows = rows.filter(r => r.grp === 'Test');
    const ctrlRows = rows.filter(r => r.grp === 'Control');

    // Build monthly chart data (actual observed)
    const chartData = months.map(m => {
      const t = testRows.find(r => r.month === m);
      const c = ctrlRows.find(r => r.month === m);
      if (!t || !c) return null;
      const feeDelta = t.fee_rpu - c.fee_rpu;
      const txnDelta = t.txn_rpu - c.txn_rpu;
      const totalDelta = t.total_rpu - c.total_rpu;
      return {
        month: m,
        test_fee_rpu: Math.round(t.fee_rpu / 1000),
        ctrl_fee_rpu: Math.round(c.fee_rpu / 1000),
        test_txn_rpu: Math.round(t.txn_rpu / 1000),
        ctrl_txn_rpu: Math.round(c.txn_rpu / 1000),
        test_total_rpu: Math.round(t.total_rpu / 1000),
        ctrl_total_rpu: Math.round(c.total_rpu / 1000),
        fee_delta: Math.round(feeDelta / 1000),
        txn_delta: Math.round(txnDelta / 1000),
        total_delta: Math.round(totalDelta / 1000),
        fee_surplus: feeDelta,
        interchange_deficit: -txnDelta,
        test_revolvers: t.revolvers,
        ctrl_revolvers: c.revolvers,
      };
    }).filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.find>>[];

    // Project forward: calculate monthly growth rates from observed data
    if (chartData.length < 2) return { chartData, projectedData: [], breakeven: null };

    const lastTwo = chartData.slice(-2);
    const feeSurplusGrowth = lastTwo[1].fee_surplus - lastTwo[0].fee_surplus;
    const interchangeDeficitGrowth = lastTwo[1].interchange_deficit - lastTwo[0].interchange_deficit;

    // Project up to 12 months forward to find breakeven
    let currentFeeSurplus = lastTwo[1].fee_surplus;
    let currentInterchangeDeficit = lastTwo[1].interchange_deficit;
    const projectedData: { month: string; fee_surplus_k: number; interchange_deficit_k: number; net_delta_k: number }[] = [];
    let breakevenMonth: string | null = null;
    const lastMonth = months[months.length - 1];
    const [lastY, lastM] = lastMonth.split('-').map(Number);

    for (let i = 1; i <= 12; i++) {
      currentFeeSurplus += feeSurplusGrowth;
      currentInterchangeDeficit += interchangeDeficitGrowth;
      const projMonth = new Date(lastY, lastM - 1 + i, 1);
      const mLabel = `${projMonth.getFullYear()}-${String(projMonth.getMonth() + 1).padStart(2, '0')}`;
      const netDelta = currentFeeSurplus - currentInterchangeDeficit;
      projectedData.push({
        month: mLabel,
        fee_surplus_k: Math.round(currentFeeSurplus / 1000),
        interchange_deficit_k: Math.round(currentInterchangeDeficit / 1000),
        net_delta_k: Math.round(netDelta / 1000),
      });
      if (netDelta >= 0 && !breakevenMonth) {
        breakevenMonth = mLabel;
      }
    }

    return { chartData, projectedData, breakeven: breakevenMonth };
  }, [apiData]);

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
                  <h2 className="text-2xl font-bold text-white">{t("title")}</h2>
                  <p className="text-sm text-white/70">{t("subtitle")} &middot; {t("abTest")}</p>
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
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">{t("spendLift")}</p>
                    <p className="text-2xl font-bold text-white">+{spendLift.toFixed(1)}%</p>
                    {spendCI && (
                      <p className="text-[9px] text-white/40">
                        95% CI: {spendCI.pctLow >= 0 ? '+' : ''}{spendCI.pctLow.toFixed(1)}% to {spendCI.pctHigh >= 0 ? '+' : ''}{spendCI.pctHigh.toFixed(1)}%
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">{t("qrisAdoption")}</p>
                    <p className="text-2xl font-bold text-white">{qrisAdoptionRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">{t("sarLift")}</p>
                    <p className="text-2xl font-bold text-white">+{(test.sar - control.sar).toFixed(1)}pp</p>
                  </div>
                  {rpuTest && rpuControl && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">{t("rpuDelta")}</p>
                      <p className={cn("text-2xl font-bold", rpuDelta >= 0 ? "text-[#06D6A0]" : "text-[#FF6B6B]")}>
                        {rpuDelta >= 0 ? "+" : ""}{rpuDelta.toFixed(1)}%
                      </p>
                      <p className="text-[9px] text-white/40">
                        Test: {fmtCur(rpuTest)} · Ctrl: {fmtCur(rpuControl)}
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
                <span className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">{t("verdict")}</span>
                <span className="text-lg font-bold text-[#FFD166]">{t("needsReview")}</span>
                <span className="text-[11px] text-white/50 mt-1 text-center max-w-[150px]">
                  {t("verdictDetail")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-[var(--text-muted)]">{t("loading")}</p>
          </div>
        )}

        {/* KPI Cards */}
        {hasData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              icon={<Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              label={t("testCohort")}
              value={test.cohort_size.toLocaleString()}
              subtext={`${test.transactors.toLocaleString()} transactors`}
              live
            />
            <KpiCard
              icon={<Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />}
              label={t("controlCohort")}
              value={control.cohort_size.toLocaleString()}
              subtext={`${control.transactors.toLocaleString()} transactors`}
              accent="bg-slate-100 dark:bg-slate-800/30"
              live
            />
            <KpiCard
              icon={<QrCode className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
              label={t("qrisTransactors")}
              value={test.qris_users.toLocaleString()}
              subtext={`${qrisAdoptionRate.toFixed(1)}% of test transactors`}
              accent="bg-violet-100 dark:bg-violet-900/30"
              live
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              label={t("totalSpendLift")}
              value={fmtCur(getSpend(test) - getSpend(control))}
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
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{t("testVsControl")}</h3>
              <LiveBadge />
            </div>
            <ComparisonRow
              label={t("spendActiveRate")}
              testValue={test.sar}
              controlValue={control.sar}
              format="percent"
              live
            />
            <ComparisonRow
              label={t("avgSpendPerUser")}
              testValue={getAvgSpend(test)}
              controlValue={getAvgSpend(control)}
              format="currency"
              live
            />
            <ComparisonRow
              label={t("txnPerUser")}
              testValue={test.txn_per_user}
              controlValue={control.txn_per_user}
              format="decimal"
              live
            />
            <ComparisonRow
              label={t("totalTransactions")}
              testValue={test.total_txns}
              controlValue={control.total_txns}
              format="number"
              live
            />
            <ComparisonRow
              label={t("qrisAdoptionPct")}
              testValue={test.transactors > 0 ? test.qris_users / test.transactors * 100 : 0}
              controlValue={0}
              format="percent"
              live
            />
            <ComparisonRow
              label={t("qrisShareOfSpend")}
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
              {t("avgSpendTitle")}
              <LiveBadge />
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{t("control")}</p>
                <p className="text-2xl font-bold text-[var(--text-secondary)]">
                  {fmtCur(getAvgSpend(control))}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{control.cohort_size.toLocaleString()} {t("eligibleUsers")}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{t("test")}</p>
                <p className="text-2xl font-bold text-[var(--text-primary)]">
                  {fmtCur(getAvgSpend(test))}
                </p>
                <p className="text-[10px] text-[var(--text-muted)]">{test.cohort_size.toLocaleString()} {t("eligibleUsers")}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)]">{t("liftCI")}</p>
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
        {/* MERCHANT CLASSIFICATION & REACH — unified section               */}
        {/* ============================================================ */}
        {(() => {
          const bd = apiData?.qrisOnlyMerchantCount ?? apiData?.merchantBreakdown;
          const mc = merchantClass;
          if (!bd && !mc) return null;

          // Cannibalization analysis: compare card spend at Mixed/E-commerce merchants
          // QRIS-Only spend is truly incremental (no card alternative)
          // Mixed/E-commerce: Test QRIS spend partially cannibalizes card spend
          const types = ['QRIS-Only Merchants', 'Mixed Merchants', 'E-commerce Sites'];

          // Compute incremental spend = QRIS-Only total + (Test total - Control total at Mixed & E-com)
          let totalQrisOnlySpend = 0;
          let testMixedEcomTotal = 0;
          let ctrlMixedEcomTotal = 0;
          if (mc) {
            types.forEach(type => {
              const t = mc.byType(mc.testRows, type);
              const c = mc.byType(mc.controlRows, type);
              if (type === 'QRIS-Only Merchants') {
                totalQrisOnlySpend = t?.total_spend_idr ?? 0;
              } else {
                testMixedEcomTotal += t?.total_spend_idr ?? 0;
                ctrlMixedEcomTotal += c?.total_spend_idr ?? 0;
              }
            });
          }
          const cannibalized = ctrlMixedEcomTotal > 0
            ? Math.max(0, ctrlMixedEcomTotal - (testMixedEcomTotal - (mc?.testRows.filter(r => r.merchant_type !== 'QRIS-Only Merchants').reduce((s, r) => s + r.qris_spend_idr, 0) ?? 0)))
            : 0;
          // Net incremental = QRIS-Only spend (100% new) + net new spend at Mixed/Ecom
          const incrementalSpend = totalQrisOnlySpend +
            Math.max(0, (mc?.testRows.reduce((s, r) => s + r.total_spend_idr, 0) ?? 0)
              - (mc?.controlRows.reduce((s, r) => s + r.total_spend_idr, 0) ?? 0));

          // CI helper for per-user spend at segment
          const segCI = (t: MerchantClassRow | undefined, c: MerchantClassRow | undefined) => {
            if (!t || !c || !t.std_dev_spend || !c.std_dev_spend) return null;
            const tMean = t.total_spend_idr / t.cohort_size;
            const cMean = c.total_spend_idr / c.cohort_size;
            const diff = tMean - cMean;
            const se = Math.sqrt((t.std_dev_spend ** 2) / t.cohort_size + (c.std_dev_spend ** 2) / c.cohort_size);
            const pct = cMean > 0 ? (diff / cMean) * 100 : 0;
            const pctLo = cMean > 0 ? ((diff - 1.96 * se) / cMean) * 100 : 0;
            const pctHi = cMean > 0 ? ((diff + 1.96 * se) / cMean) * 100 : 0;
            return { pct, pctLo, pctHi };
          };

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Store className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("merchantReach")}</h2>
                <LiveBadge />
              </div>

              {/* Merchant count KPIs */}
              {bd && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <MetricCard metricKey="qris_only_merchants" label="QRIS-Only Merchants" value={bd.qris_only_merchants} unit="count" asOf="All Time" dataRange={{ start: "", end: "" }} liveData />
                  <MetricCard metricKey="mixed_merchants" label="Mixed (Card + QRIS)" value={bd.mixed_merchants} unit="count" asOf="All Time" dataRange={{ start: "", end: "" }} liveData />
                  <MetricCard metricKey="non_qris_merchants" label="Card-Only Merchants" value={bd.non_qris_only_merchants} unit="count" asOf="All Time" dataRange={{ start: "", end: "" }} liveData />
                </div>
              )}

              {/* Spend by merchant segment — with cannibalization */}
              {mc && (
                <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] overflow-hidden">
                  <div className="p-4 border-b border-[var(--border)]">
                    <p className="text-xs text-[var(--text-muted)]">
                      Spend at QRIS-accepting merchants classified by type. <strong>QRIS-Only</strong> = 100% incremental (no card alternative).
                      <strong> Mixed</strong> = accepts both card &amp; QRIS — QRIS may cannibalize card spend.
                      <strong> E-commerce</strong> = online-only merchants. Card spend shows non-QRIS transactions at the same merchants for cannibalization comparison.
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Segment</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Test QRIS</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Test Card</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Test Total</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Ctrl Total</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Δ vs Ctrl</th>
                        <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">95% CI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {types.map(type => {
                        const tR = mc.byType(mc.testRows, type);
                        const cR = mc.byType(mc.controlRows, type);
                        const tTotal = tR?.total_spend_idr ?? 0;
                        const cTotal = cR?.total_spend_idr ?? 0;
                        const delta = cTotal > 0 ? ((tTotal - cTotal) / cTotal) * 100 : (tTotal > 0 ? 100 : 0);
                        const isQrisOnly = type === 'QRIS-Only Merchants';
                        const ci = segCI(tR, cR);
                        return (
                          <tr key={type} className="border-b border-[var(--border)] last:border-b-0">
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-[var(--text-primary)]">{type}</span>
                              {isQrisOnly && <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">INCREMENTAL</span>}
                            </td>
                            <td className="text-right px-4 py-2.5 font-mono text-xs text-[var(--text-primary)]">
                              {tR ? fmtCur(tR.qris_spend_idr) : '-'}
                              <div className="text-[10px] text-[var(--text-muted)]">{tR?.qris_txns?.toLocaleString() ?? 0} txns</div>
                            </td>
                            <td className="text-right px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">
                              {isQrisOnly ? <span className="text-[var(--text-muted)]">N/A</span> : (tR?.card_spend_idr ?? 0) > 0 ? fmtCur(tR!.card_spend_idr) : '-'}
                              {!isQrisOnly && <div className="text-[10px] text-[var(--text-muted)]">{tR?.card_txns?.toLocaleString() ?? 0} txns</div>}
                            </td>
                            <td className="text-right px-4 py-2.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              {tTotal > 0 ? fmtCur(tTotal) : '-'}
                            </td>
                            <td className="text-right px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">
                              {isQrisOnly ? <span className="text-[var(--text-muted)]">N/A</span> : cTotal > 0 ? fmtCur(cTotal) : '-'}
                            </td>
                            <td className="text-right px-4 py-2.5">
                              {isQrisOnly ? (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">NEW</span>
                              ) : (
                                <span className={cn("text-xs font-semibold", delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                                </span>
                              )}
                            </td>
                            <td className="text-right px-4 py-2.5 text-[10px] text-[var(--text-muted)]">
                              {ci ? `${ci.pct >= 0 ? '+' : ''}${ci.pct.toFixed(1)}% (${ci.pctLo.toFixed(1)}% to ${ci.pctHi.toFixed(1)}%)` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      <tr className="bg-[var(--surface)] font-semibold border-t-2 border-[var(--border)]">
                        <td className="px-4 py-2.5 text-[var(--text-primary)]">Net Incremental Spend</td>
                        <td className="text-right px-4 py-2.5 font-mono text-xs text-emerald-600 dark:text-emerald-400" colSpan={6}>
                          {fmtCur(incrementalSpend)}
                          <span className="ml-2 text-[10px] text-[var(--text-muted)] font-normal">
                            = QRIS-Only + net lift at Mixed &amp; E-commerce
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Incrementality Analysis — dormant user reactivation */}
              {apiData?.incrementality && apiData.incrementality.length > 0 && (() => {
                const inc = apiData.incrementality;
                const testRows = inc.filter(r => r.grp === 'Test');
                const ctrlRows = inc.filter(r => r.grp === 'Control');
                const dormantQris = testRows.find(r => r.user_type === 'dormant_qris_reactivated');
                const activeFirstQris = testRows.find(r => r.user_type === 'active_first_qris');
                const activeFirstCard = testRows.find(r => r.user_type === 'active_first_card');
                const ctrlActive = ctrlRows.find(r => r.user_type === 'active_first_card');
                const ctrlDormant = ctrlRows.find(r => r.user_type === 'dormant_card_reactivated');

                // Truly incremental: dormant users reactivated by QRIS (all spend)
                // + active-first-QRIS users' subsequent card spend (QRIS brought them back)
                const trulyIncremental = (dormantQris?.total_spend ?? 0) + (activeFirstQris?.card_spend ?? 0);

                const userTypes = [
                  { key: 'dormant_qris_reactivated', label: 'Dormant → Reactivated by QRIS', tag: '100% INCREMENTAL', tagColor: 'emerald' },
                  { key: 'active_first_qris', label: 'Active → First Txn was QRIS', tag: 'CARD SPEND INCREMENTAL', tagColor: 'blue' },
                  { key: 'active_first_card', label: 'Active → First Txn was Card', tag: 'CANNIBALIZATION RISK', tagColor: 'amber' },
                  { key: 'dormant_card_reactivated', label: 'Dormant → Reactivated by Card', tag: null, tagColor: '' },
                ];

                return (
                  <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] overflow-hidden">
                    <div className="p-4 border-b border-[var(--border)]">
                      <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Spend Incrementality by User Journey</p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Dormant = no transactions in 60 days pre-experiment. If a dormant user&apos;s first transaction is QRIS, all their spend is incremental.
                        If an active user&apos;s first experiment transaction is QRIS, their subsequent card spend is also incremental (QRIS re-engaged them).
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--border)]">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">User Type</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Test Users</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Test Total Spend</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">QRIS Spend</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Card Spend</th>
                          <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase">Ctrl Users</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userTypes.map(ut => {
                          const tRow = testRows.find(r => r.user_type === ut.key);
                          const cRow = ctrlRows.find(r => r.user_type === ut.key);
                          if (!tRow && !cRow) return null;
                          return (
                            <tr key={ut.key} className="border-b border-[var(--border)] last:border-b-0">
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-[var(--text-primary)] text-xs">{ut.label}</span>
                                {ut.tag && (
                                  <span className={cn("ml-2 text-[9px] font-semibold",
                                    ut.tagColor === 'emerald' ? "text-emerald-600 dark:text-emerald-400" :
                                    ut.tagColor === 'blue' ? "text-blue-600 dark:text-blue-400" :
                                    "text-amber-600 dark:text-amber-400"
                                  )}>{ut.tag}</span>
                                )}
                              </td>
                              <td className="text-right px-4 py-2.5 font-mono text-xs text-[var(--text-primary)]">{tRow?.users?.toLocaleString() ?? '-'}</td>
                              <td className="text-right px-4 py-2.5 font-mono text-xs font-semibold text-[var(--text-primary)]">{tRow ? fmtCur(tRow.total_spend) : '-'}</td>
                              <td className="text-right px-4 py-2.5 font-mono text-xs text-violet-600 dark:text-violet-400">{tRow ? fmtCur(tRow.qris_spend) : '-'}</td>
                              <td className="text-right px-4 py-2.5 font-mono text-xs text-[var(--text-secondary)]">{tRow ? fmtCur(tRow.card_spend) : '-'}</td>
                              <td className="text-right px-4 py-2.5 font-mono text-xs text-[var(--text-muted)]">{cRow?.users?.toLocaleString() ?? '-'}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-[var(--surface)] font-semibold border-t-2 border-[var(--border)]">
                          <td className="px-4 py-2.5 text-[var(--text-primary)]">Truly Incremental Spend</td>
                          <td className="text-right px-4 py-2.5 font-mono text-xs text-emerald-600 dark:text-emerald-400" colSpan={5}>
                            {fmtCur(trulyIncremental)}
                            <span className="ml-2 text-[10px] text-[var(--text-muted)] font-normal">
                              = dormant QRIS all spend + active-first-QRIS card spend
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Cumulative QRIS-only merchant growth chart */}
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

          const fmtIdr = (v: number) => fmtCur(v);
          const delta = (t: number, c: number) => c !== 0 ? ((t - c) / Math.abs(c)) * 100 : (t > 0 ? 100 : 0);
          const deltaFmt = (t: number, c: number) => {
            const d = delta(t, c);
            return d > 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`;
          };

          type RowDef = { label: string; test: number; control: number; isNew?: boolean; higherIsBetter?: boolean };
          const rows: RowDef[] = [
            { label: "Card Spend", test: tCard, control: cCard, higherIsBetter: true },
            { label: "QRIS Spend", test: tQris, control: cQris, isNew: true },
            { label: "Total Spend", test: tTotal, control: cTotal, higherIsBetter: true },
            { label: "Card Interchange @ 1.6%", test: tCardIx, control: cCardIx, higherIsBetter: true },
            { label: "QRIS Revenue @ 0.2035%", test: tQrisRev, control: cQrisRev, isNew: true },
            { label: "Total Revenue", test: tTotalRev, control: cTotalRev, higherIsBetter: true },
            { label: "Revenue per User", test: tRevUser, control: cRevUser, higherIsBetter: true },
          ];

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("interchangeRevenue")}</h2>
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
                            {fmtIdr(row.control)}
                          </td>
                          <td className="text-right px-4 py-3 font-semibold text-[var(--text-primary)] font-mono text-xs">
                            {fmtIdr(row.test)}
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
                  { key: "cumulative_spend", color: "#06b6d4", label: `Cumulative Spend (${currency === "USD" ? "USD K" : "IDR M"})` },
                  { key: "monthly_spend", color: "#8b5cf6", label: `Monthly Spend (${currency === "USD" ? "USD K" : "IDR M"})` },
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
                  {fmtCur(qrisOnlySpendCumulative[qrisOnlySpendCumulative.length - 1]?.cumulative_spend_idr ?? 0)}
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
                  {fmtCur(qrisOnlySpendCumulative[qrisOnlySpendCumulative.length - 1]?.qris_spend_idr ?? 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* QRIS MERCHANT CRITERIA CLASSIFICATION (MDR BREAKDOWN)          */}
        {/* ============================================================ */}
        {apiData?.qrisMerchantCriteria && apiData.qrisMerchantCriteria.length > 0 && (
          <div className={cn("rounded-xl border p-5", isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]")}>
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
              QRIS Merchant Criteria Classification
              <span className={cn("ml-2 text-[9px]", isDark ? "text-[#FFD166]" : "text-amber-500")} title="Live BigQuery data">&#9733;</span>
            </h3>
            <p className="text-[10px] text-[var(--text-muted)] mb-4">
              Transaction count by BI-regulated merchant criteria code. MDR rates set by Bank Indonesia (PBI No. 24/8/PBI/2022).
            </p>

            {/* Bar chart */}
            <div className="h-[260px] mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={apiData.qrisMerchantCriteria.map((r: QrisMerchantCriteriaRow) => ({
                  name: r.merchant_criteria,
                  txns: r.total_txns,
                  merchants: r.merchant_count,
                  spend: r.total_spend_idr,
                  fill: MDR_RATES[r.merchant_criteria]?.color ?? "#6b7280",
                }))} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDark ? "#aaa" : "#666" }} />
                  <YAxis tick={{ fontSize: 10, fill: isDark ? "#aaa" : "#666" }} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} />
                  <Tooltip
                    contentStyle={{ backgroundColor: isDark ? "#1e1e2e" : "#fff", border: `1px solid ${isDark ? "#333" : "#ddd"}`, borderRadius: 8, fontSize: 11 }}
                    formatter={(value: unknown, name: unknown) => {
                      const v = Number(value);
                      if (name === "txns") return [v.toLocaleString(), "Transactions"];
                      return [v.toLocaleString(), String(name)];
                    }}
                    labelFormatter={(label: unknown) => {
                      const l = String(label);
                      const info = MDR_RATES[l];
                      return info ? `${info.label} — MDR: ${(info.rate * 100).toFixed(1)}%` : l;
                    }}
                  />
                  <Bar dataKey="txns" name="txns" radius={[6, 6, 0, 0]}>
                    {apiData.qrisMerchantCriteria.map((r: QrisMerchantCriteriaRow, i: number) => (
                      <Cell key={i} fill={MDR_RATES[r.merchant_criteria]?.color ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Legend with MDR rates */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {apiData.qrisMerchantCriteria.map((r: QrisMerchantCriteriaRow) => {
                const info = MDR_RATES[r.merchant_criteria];
                return (
                  <div key={r.merchant_criteria} className="rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)] p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: info?.color ?? "#6b7280" }} />
                      <span className="text-xs font-semibold text-[var(--text-primary)]">{r.merchant_criteria}</span>
                      <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${info?.color ?? "#6b7280"}20`, color: info?.color ?? "#6b7280" }}>
                        MDR {((info?.rate ?? 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mb-2">{info?.label ?? r.merchant_criteria}</p>
                    <div className="space-y-1 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Transactions</span>
                        <span className="font-medium text-[var(--text-primary)]">{r.total_txns.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Merchants</span>
                        <span className="font-medium text-[var(--text-primary)]">{r.merchant_count.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Spend</span>
                        <span className="font-medium text-[var(--text-primary)]">{fmtCur(r.total_spend_idr)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Issuer Share</span>
                        <span className="font-medium text-[var(--text-primary)]">{fmtCur(r.total_spend_idr * (info?.rate ?? 0) * (info?.issuerShare ?? 0))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[9px] text-[var(--text-muted)] italic">
              Classification based on merchant size heuristics (transaction volume, unique cards). Actual criteria codes assigned by acquirers.
              MDR: UMI 0.3%, UKE 0.5%, UKI/UBE 0.7%. Issuer share: 37% of MDR (PBI No. 24/8/PBI/2022, PT ALTO network).
            </p>
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
                        <th className="pb-1.5 text-right font-medium">Spend</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--text-secondary)]">
                      {apiData.topMerchantsByTxn.map((m: { merchant: string; txn_count: number; total_spend_idr: number }) => (
                        <tr key={m.merchant} className="border-b border-[var(--border)]/20">
                          <td className="py-1.5 font-medium truncate max-w-[180px]">{m.merchant}</td>
                          <td className="py-1.5 text-right font-mono">{m.txn_count.toLocaleString()}</td>
                          <td className="py-1.5 text-right font-mono">{fmtCur(m.total_spend_idr)}</td>
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
                        <th className="pb-1.5 text-right font-medium">Spend</th>
                        <th className="pb-1.5 text-right font-medium">Txns</th>
                      </tr>
                    </thead>
                    <tbody className="text-[var(--text-secondary)]">
                      {apiData.topMerchantsBySpend.map((m: { merchant: string; txn_count: number; total_spend_idr: number }) => (
                        <tr key={m.merchant} className="border-b border-[var(--border)]/20">
                          <td className="py-1.5 font-medium truncate max-w-[180px]">{m.merchant}</td>
                          <td className="py-1.5 text-right font-mono">{fmtCur(m.total_spend_idr)}</td>
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

          const fmtI = (v: number) => fmtCur(v);
          const normC = (v: number) => Math.round(v / ctrl.cohort_size * 1000);
          const normT = (v: number) => Math.round(v / tst.cohort_size * 1000);
          const dlt = (t: number, c: number) => { const d = ((t-c)/Math.abs(c||1))*100; return d > 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`; };

          const rows = [
            { label: "Utilization", c: `${ctrl.utilization_pct}%`, t: `${tst.utilization_pct}%`, d: `${(tst.utilization_pct-ctrl.utilization_pct).toFixed(1)}pp` },
            { label: "Revolve Rate", c: `${ctrl.revolve_rate_pct}%`, t: `${tst.revolve_rate_pct}%`, d: `${(tst.revolve_rate_pct-ctrl.revolve_rate_pct).toFixed(1)}pp` },
            { label: "Avg Balance", c: fmtI(ctrl.avg_balance_idr), t: fmtI(tst.avg_balance_idr), d: dlt(tst.avg_balance_idr, ctrl.avg_balance_idr) },
            { label: "Admin Fees / 1K Users", c: fmtI(normC(ctrl.total_fees_idr)), t: fmtI(normT(tst.total_fees_idr)), d: dlt(normT(tst.total_fees_idr), normC(ctrl.total_fees_idr)) },
            { label: "Late/Penalty Fees / 1K Users", c: fmtI(normC(ctrl.total_chrg_fee_idr)), t: fmtI(normT(tst.total_chrg_fee_idr)), d: dlt(normT(tst.total_chrg_fee_idr), normC(ctrl.total_chrg_fee_idr)) },
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
          const fmtR = (v: number) => fmtCur(v);
          const dlt = (t: number, c: number) => {
            if (c === 0) return t > 0 ? 'new' : '-';
            const d = ((t - c) / Math.abs(c)) * 100;
            return d > 0 ? `+${d.toFixed(1)}%` : `${d.toFixed(1)}%`;
          };

          const profRows = [
            { label: "Admin Fee Revenue", t: tst.admin_fee_revenue, c: ctrl.admin_fee_revenue },
            { label: "Interest Revenue", t: tst.interest_revenue, c: ctrl.interest_revenue },
            { label: "Late/Penalty Fee Revenue", t: tst.late_penalty_fee_revenue, c: ctrl.late_penalty_fee_revenue },
            { label: "Card Interchange @ 1.6%", t: tst.card_interchange_revenue, c: ctrl.card_interchange_revenue },
            { label: "QRIS MDR @ 0.2035%", t: tst.qris_mdr_revenue, c: ctrl.qris_mdr_revenue },
            { label: "Total Revenue", t: tst.total_revenue, c: ctrl.total_revenue },
            { label: "ARPU (per Eligible User)", t: tst.arpu, c: ctrl.arpu },
          ];

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("profitability")}</h2>
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
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{t("graduationProjection")}</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  If the Test group ARPU of {fmtCur(tst.arpu)} holds at scale,
                  {tst.arpu > ctrl.arpu
                    ? ` graduating QRIS to the full portfolio would increase per-user revenue by ${fmtCur(tst.arpu - ctrl.arpu)} (+${(((tst.arpu - ctrl.arpu) / ctrl.arpu) * 100).toFixed(1)}%).`
                    : ` graduating QRIS would reduce per-user revenue by ${fmtCur(ctrl.arpu - tst.arpu)} (${(((tst.arpu - ctrl.arpu) / ctrl.arpu) * 100).toFixed(1)}%).`
                  }
                  {' '}Consider LTV impact, churn reduction, and BI regulatory trajectory before decision.
                </p>
              </div>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* REVENUE TRAJECTORY & BREAKEVEN PROJECTION                      */}
        {/* ============================================================ */}
        {trajectoryData && trajectoryData.chartData.length > 0 && (() => {
          const { chartData, projectedData, breakeven } = trajectoryData;

          // Build combined chart for actual + projected
          const combinedForDelta = [
            ...chartData.map(d => ({
              month: d.month,
              fee_surplus: d.fee_delta,
              interchange_deficit: d.txn_delta,
              total_delta: d.total_delta,
              type: 'actual',
            })),
            ...projectedData.map(d => ({
              month: d.month,
              fee_surplus: d.fee_surplus_k,
              interchange_deficit: -d.interchange_deficit_k,
              total_delta: d.net_delta_k,
              type: 'projected',
            })),
          ];

          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">{t("revenueTrajectory")}</h2>
                <LiveBadge />
              </div>

              {/* Monthly RPU comparison chart */}
              <ChartCard
                title={`Monthly RPU: Test vs Control (${currency === "USD" ? "USD" : "Rp K"})`}
                subtitle="Per-user revenue by month. Fee RPU = admin fees + interest + late/penalty fees. Txn RPU = card interchange + QRIS MDR."
                asOf={AS_OF}
                dataRange={{ start: chartData[0]?.month ?? '', end: chartData[chartData.length - 1]?.month ?? '' }}
              >
                <DashboardLineChart
                  height={300}
                  data={chartData.map(d => ({
                    month: d.month,
                    'Test Fee RPU': d.test_fee_rpu,
                    'Ctrl Fee RPU': d.ctrl_fee_rpu,
                    'Test Txn RPU': d.test_txn_rpu,
                    'Ctrl Txn RPU': d.ctrl_txn_rpu,
                  }))}
                  lines={[
                    { key: 'Ctrl Fee RPU', color: '#94a3b8', label: 'Ctrl Fee RPU' },
                    { key: 'Ctrl Txn RPU', color: '#cbd5e1', label: 'Ctrl Txn RPU' },
                    { key: 'Test Fee RPU', color: '#10b981', label: 'Test Fee RPU' },
                    { key: 'Test Txn RPU', color: '#06b6d4', label: 'Test Txn RPU' },
                  ]}
                  xAxisKey="month"
                />
              </ChartCard>

              {/* Fee surplus vs interchange deficit delta chart */}
              <ChartCard
                title={`Test vs Control: Revenue Delta per User (${currency === "USD" ? "USD" : "Rp K"})`}
                subtitle="Positive = Test earns more. Fee surplus is growing as revolving balances compound; interchange deficit from QRIS cannibalization."
                asOf={AS_OF}
                dataRange={{ start: combinedForDelta[0]?.month ?? '', end: combinedForDelta[combinedForDelta.length - 1]?.month ?? '' }}
              >
                <DashboardLineChart
                  height={280}
                  data={combinedForDelta}
                  lines={[
                    { key: "fee_surplus", color: "#10b981", label: "Fee Revenue Delta" },
                    { key: "interchange_deficit", color: "#ef4444", label: "Interchange Delta" },
                    { key: "total_delta", color: "#8b5cf6", label: "Net Revenue Delta" },
                  ]}
                  xAxisKey="month"
                />
              </ChartCard>

              {/* Key metrics table */}
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] overflow-hidden">
                <div className="p-4 border-b border-[var(--border)]">
                  <p className="text-xs text-[var(--text-muted)]">
                    Monthly revenue per eligible user. Data sourced from actual DW004 billed amounts and DW007 transaction volumes.
                    Admin fee rates vary by card program (0%–6.49%) per{' '}
                    <a href="https://www.honest.co.id/en/faq/what-is-admin-fee" target="_blank" rel="noopener noreferrer" className="underline">honest.co.id</a>.
                    Interest at 21% p.a. per{' '}
                    <a href="https://www.honest.co.id/en/faq/bagaimana-bunga-dihitung" target="_blank" rel="noopener noreferrer" className="underline">honest.co.id</a>.
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Month</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Test Fee RPU</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Ctrl Fee RPU</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Fee Delta</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Test Txn RPU</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Ctrl Txn RPU</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase">Net RPU Delta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map(d => {
                      const netD = d.total_delta;
                      return (
                        <tr key={d.month} className="border-b border-[var(--border)] last:border-b-0">
                          <td className="px-4 py-2 font-medium text-[var(--text-primary)]">{d.month}</td>
                          <td className="text-right px-4 py-2 font-mono text-xs text-[var(--text-primary)]">{fmtCur(d.test_fee_rpu * 1000)}</td>
                          <td className="text-right px-4 py-2 font-mono text-xs text-[var(--text-secondary)]">{fmtCur(d.ctrl_fee_rpu * 1000)}</td>
                          <td className="text-right px-4 py-2">
                            <span className={cn("text-xs font-semibold", d.fee_delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                              {d.fee_delta >= 0 ? '+' : ''}{fmtCur(d.fee_delta * 1000)}
                            </span>
                          </td>
                          <td className="text-right px-4 py-2 font-mono text-xs text-[var(--text-primary)]">{fmtCur(d.test_txn_rpu * 1000)}</td>
                          <td className="text-right px-4 py-2 font-mono text-xs text-[var(--text-secondary)]">{fmtCur(d.ctrl_txn_rpu * 1000)}</td>
                          <td className="text-right px-4 py-2">
                            <span className={cn("inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2 py-0.5",
                              netD >= 0 ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30" : "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/30",
                            )}>
                              {netD >= 0 ? '+' : ''}{fmtCur(netD * 1000)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Breakeven callout */}
              <div className={cn(
                "rounded-xl border-l-4 p-4",
                breakeven
                  ? isDark ? "border-l-emerald-500 bg-emerald-950/20 border border-emerald-900/30" : "border-l-emerald-500 bg-emerald-50 border border-emerald-200"
                  : isDark ? "border-l-amber-500 bg-amber-950/20 border border-amber-900/30" : "border-l-amber-500 bg-amber-50 border border-amber-200",
              )}>
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  {breakeven ? `Projected Breakeven: ${breakeven}` : 'Breakeven Not Reached in 12-Month Projection'}
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {chartData.length >= 2 && (() => {
                    const last = chartData[chartData.length - 1];
                    const feeSurplusTrend = last.fee_delta >= 0 ? 'positive' : 'negative';
                    return breakeven
                      ? `Fee revenue surplus is growing at ${fmtCur(Math.abs(last.fee_delta) * 1000)}/user per month and is already ${feeSurplusTrend}. At this trajectory, the cumulative fee surplus will overcome the interchange deficit by ${breakeven}. Key driver: QRIS users carry higher revolving balances → more interest and admin fee income.`
                      : `Fee revenue delta is ${feeSurplusTrend} (${fmtCur(last.fee_delta * 1000)}/user) but the interchange deficit (${fmtCur(Math.abs(last.txn_delta) * 1000)}/user) is growing faster. At current rates, fee surplus does not overcome interchange loss within 12 months. However, interest compounds on revolving balances — accelerating fee growth over time may close the gap.`;
                  })()}
                </p>
              </div>
            </div>
          );
        })()}

        <ActionItems section="QRIS Experiment" items={actionItems} />

        {/* Footer: Definitions & Methodology */}
        <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] px-6 py-4 space-y-3">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Methodology:</span>{" "}
            A/B test with {hasData ? `${(test.cohort_size + control.cohort_size).toLocaleString()}` : "~10,000"} users from <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>sandbox_risk.sample_qris_rollout_test_10k_202601</code>.
            Contaminated Control users (with QRIS transactions) are excluded dynamically.
            QRIS transactions are identified by{" "}
            <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw007_rte_dest = &apos;L&apos;</code>.
            Confidence intervals use the two-sample z-test: CI = (μ₁−μ₂) ± 1.96 × √(σ₁²/n₁ + σ₂²/n₂). Data as of {AS_OF}.
          </p>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Admin Fee:</span>{" "}
            Personalized rate from 0% to 6.49% on statement balance, determined by card program (<code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw005_crd_pgm</code>).
            Refunded if paid in full by due date. No fee if no balance.
            Rates: 0% (pgm xx01/05/07/12/17), 1.49% (xx02/08/13/18), 3.99% (xx03/09/14/19), 4.99% (xx04/10/15/20), 6.49% (xx06/11/16/21–27).
            Source: <a href="https://www.honest.co.id/en/faq/what-is-admin-fee" target="_blank" rel="noopener noreferrer" className="underline">honest.co.id/faq/what-is-admin-fee</a>.
            Revenue from DW004 field <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>f9_dw004_bil_fee_chrg_1</code>.
          </p>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Interest:</span>{" "}
            21% p.a. (1.75%/month) calculated daily on unpaid balances. Formula: Unpaid Balance × (Days / 365) × 21%.
            No interest if statement paid in full on time.
            Source: <a href="https://www.honest.co.id/en/faq/bagaimana-bunga-dihitung" target="_blank" rel="noopener noreferrer" className="underline">honest.co.id/faq/bagaimana-bunga-dihitung</a>.
            Revenue from DW004 field <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>f9_dw004_tot_int</code>.
          </p>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Late/Penalty Fee:</span>{" "}
            Fee charged when minimum payment is not met by due date.
            Revenue from DW004 field <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>f9_dw004_bil_fee_chrg_2</code>.
            Note: <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>f9_dw004_bil_chrg_fee</code> = fee_chrg_1 + fee_chrg_2 (not used separately to avoid double-counting admin fees).
          </p>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Interchange &amp; QRIS MDR:</span>{" "}
            Card interchange at ~1.6% (blended Visa+MC domestic, Kansas City Fed Aug 2025).
            QRIS MDR weighted avg ~0.55% (UMI 0%/0.3%, UKE/UKI 0.7% — PBI No. 24/8/PBI/2022) with 37% issuer share via PT ALTO Network,
            effective issuer rate = 0.2035%.
          </p>

          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Incremental Spend:</span>{" "}
            QRIS-Only merchant spend is 100% incremental (no card alternative exists).
            At Mixed and E-commerce merchants, incremental spend = Test total spend − Control total spend at the same merchant segment.
            Card spend decline at Mixed merchants indicates cannibalization.
          </p>
        </div>
      </div>
    </div>
  );
}
