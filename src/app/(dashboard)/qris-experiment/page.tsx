"use client";

import { useCallback, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardAreaChart } from "@/components/charts/area-chart";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { useTheme } from "@/hooks/use-theme";
import { getPeriodRange, scaleTrendData, scaleMetricValue } from "@/lib/period-data";
import { applyFilterToData } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import {
  QrCode, TrendingUp, TrendingDown, Users, Zap, ArrowUpRight, ArrowDownRight,
  ShoppingCart, CreditCard, BarChart3, Target, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ==========================================================================
// Mock Data — tells the story: QRIS users are significantly more engaged
// ==========================================================================

const AS_OF = "2026-03-15";

// -- Adoption trend (weekly) --
const adoptionData = [
  { week: "Nov 1", adoption_rate: 3.2, new_users: 220 },
  { week: "Nov 15", adoption_rate: 5.8, new_users: 380 },
  { week: "Dec 1", adoption_rate: 8.5, new_users: 520 },
  { week: "Dec 15", adoption_rate: 11.2, new_users: 640 },
  { week: "Jan 1", adoption_rate: 14.1, new_users: 680 },
  { week: "Jan 15", adoption_rate: 17.0, new_users: 750 },
  { week: "Feb 1", adoption_rate: 19.8, new_users: 790 },
  { week: "Feb 15", adoption_rate: 22.5, new_users: 820 },
  { week: "Mar 1", adoption_rate: 25.1, new_users: 850 },
  { week: "Mar 15", adoption_rate: 27.4, new_users: 870 },
];

// -- QRIS vs Non-QRIS comparison --
const comparisonData = {
  qris: {
    segment: "QRIS Users",
    avg_txn_count: 18.4,
    avg_total_spend_idr: 4_650_000,
    avg_spend_per_txn: 253_000,
    avg_days_active: 12.8,
    pct_multi_channel: 78.3,
    user_count: 6_840,
  },
  nonQris: {
    segment: "Non-QRIS Users",
    avg_txn_count: 8.7,
    avg_total_spend_idr: 3_210_000,
    avg_spend_per_txn: 369_000,
    avg_days_active: 7.2,
    pct_multi_channel: 34.5,
    user_count: 18_160,
  },
};

// -- Profitability (monthly) --
const profitabilityData = [
  { month: "Nov", qris_interchange: 42_000_000, card_interchange: 945_000_000, qris_user_spend: 28_500_000_000, non_qris_user_spend: 49_500_000_000, qris_volume: 6_000_000_000, card_volume: 63_000_000_000 },
  { month: "Dec", qris_interchange: 72_000_000, card_interchange: 1_010_000_000, qris_user_spend: 37_200_000_000, non_qris_user_spend: 51_200_000_000, qris_volume: 10_300_000_000, card_volume: 67_300_000_000 },
  { month: "Jan", qris_interchange: 95_000_000, card_interchange: 985_000_000, qris_user_spend: 44_100_000_000, non_qris_user_spend: 50_800_000_000, qris_volume: 13_600_000_000, card_volume: 65_700_000_000 },
  { month: "Feb", qris_interchange: 122_000_000, card_interchange: 1_020_000_000, qris_user_spend: 52_300_000_000, non_qris_user_spend: 51_400_000_000, qris_volume: 17_400_000_000, card_volume: 68_000_000_000 },
  { month: "Mar*", qris_interchange: 68_000_000, card_interchange: 540_000_000, qris_user_spend: 28_800_000_000, non_qris_user_spend: 26_200_000_000, qris_volume: 9_700_000_000, card_volume: 36_000_000_000 },
];

// -- Revenue per user (monthly) --
const revenuePerUserData = [
  { month: "Nov", qris_rev_per_user: 15_200, non_qris_rev_per_user: 9_700 },
  { month: "Dec", qris_rev_per_user: 19_500, non_qris_rev_per_user: 10_100 },
  { month: "Jan", qris_rev_per_user: 22_100, non_qris_rev_per_user: 9_900 },
  { month: "Feb", qris_rev_per_user: 24_800, non_qris_rev_per_user: 10_200 },
  { month: "Mar*", qris_rev_per_user: 25_300, non_qris_rev_per_user: 10_300 },
];

// -- Merchant categories --
const merchantCategoryData = [
  { category: "Grocery/Supermarket", txn_count: 28_450, spend: 3_710_000_000, users: 4_120 },
  { category: "Fast Food", txn_count: 22_300, spend: 1_340_000_000, users: 3_890 },
  { category: "Restaurants", txn_count: 18_600, spend: 2_420_000_000, users: 3_450 },
  { category: "Gas Stations", txn_count: 12_800, spend: 1_920_000_000, users: 2_780 },
  { category: "Taxi/Rideshare", txn_count: 11_200, spend: 670_000_000, users: 2_340 },
  { category: "Pharmacies", txn_count: 8_900, spend: 580_000_000, users: 2_100 },
  { category: "Retail Stores", txn_count: 7_400, spend: 890_000_000, users: 1_800 },
  { category: "Electronics", txn_count: 4_200, spend: 1_260_000_000, users: 1_200 },
  { category: "Cosmetics", txn_count: 3_800, spend: 420_000_000, users: 980 },
  { category: "Other", txn_count: 15_600, spend: 2_100_000_000, users: 3_200 },
];

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
// Utility functions
// ==========================================================================

function fmtIDR(value: number): string {
  if (value >= 1_000_000_000_000) return `IDR ${(value / 1_000_000_000_000).toFixed(1)}T`;
  if (value >= 1_000_000_000) return `IDR ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `IDR ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `IDR ${(value / 1_000).toFixed(1)}K`;
  return `IDR ${value.toLocaleString()}`;
}

function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function pctDiff(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round(((a - b) / b) * 100);
}

// ==========================================================================
// Sub-components
// ==========================================================================

function StatBox({
  label,
  value,
  subtext,
  large,
}: {
  label: string;
  value: string;
  subtext?: string;
  large?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
      <p className={cn("font-bold text-[var(--text-primary)]", large ? "text-3xl mt-1" : "text-xl mt-0.5")}>{value}</p>
      {subtext && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtext}</p>}
    </div>
  );
}

function ComparisonRow({
  label,
  qrisValue,
  nonQrisValue,
  format = "number",
  higherIsBetter = true,
}: {
  label: string;
  qrisValue: number;
  nonQrisValue: number;
  format?: "number" | "idr" | "percent" | "decimal";
  higherIsBetter?: boolean;
}) {
  const diff = pctDiff(qrisValue, nonQrisValue);
  const qrisWins = higherIsBetter ? qrisValue > nonQrisValue : qrisValue < nonQrisValue;

  function fmt(v: number) {
    switch (format) {
      case "idr": return fmtIDR(v);
      case "percent": return `${v}%`;
      case "decimal": return v.toFixed(1);
      default: return fmtNum(v);
    }
  }

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3 border-b border-[var(--border)]/50 last:border-0">
      {/* QRIS side */}
      <div className="text-right">
        <span className={cn(
          "text-lg font-bold",
          qrisWins ? "text-[#06D6A0]" : "text-[var(--text-primary)]"
        )}>
          {fmt(qrisValue)}
        </span>
      </div>

      {/* Label center */}
      <div className="flex flex-col items-center min-w-[140px]">
        <span className="text-[11px] font-medium text-[var(--text-secondary)] text-center">{label}</span>
        {diff !== 0 && (
          <span className={cn(
            "text-[10px] font-semibold mt-0.5 flex items-center gap-0.5",
            qrisWins ? "text-[#06D6A0]" : "text-[#FF6B6B]"
          )}>
            {qrisWins ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(diff)}% {qrisWins ? "higher" : "lower"}
          </span>
        )}
      </div>

      {/* Non-QRIS side */}
      <div className="text-left">
        <span className={cn(
          "text-lg font-bold",
          !qrisWins ? "text-[#06D6A0]" : "text-[var(--text-primary)]"
        )}>
          {fmt(nonQrisValue)}
        </span>
      </div>
    </div>
  );
}

function HorizontalBar({
  label,
  value,
  maxValue,
  subLabel,
}: {
  label: string;
  value: number;
  maxValue: number;
  subLabel: string;
}) {
  const pct = Math.max((value / maxValue) * 100, 2);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-[160px] shrink-0 text-right">
        <span className="text-xs text-[var(--text-primary)] font-medium">{label}</span>
      </div>
      <div className="flex-1 relative h-7 rounded-md bg-[var(--surface-elevated)] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-md"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-light) 100%)",
          }}
        />
        <div className="absolute inset-0 flex items-center px-2">
          <span className="text-[11px] font-semibold text-white drop-shadow-sm">
            {fmtNum(value)}
          </span>
        </div>
      </div>
      <div className="w-[100px] shrink-0">
        <span className="text-[11px] text-[var(--text-muted)]">{subLabel}</span>
      </div>
    </div>
  );
}

// ==========================================================================
// Main Page
// ==========================================================================

export default function QrisExperimentPage() {
  const { period, periodLabel } = usePeriod();
  const { filters } = useFilters();
  const { isDark } = useTheme();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  // Scale trend data arrays for the selected period, then apply active filters
  const pAdoptionData = useMemo(() => applyFilterToData(scaleTrendData(adoptionData, period, "week"), filters), [period, filters]);
  const pProfitabilityData = useMemo(() => applyFilterToData(scaleTrendData(profitabilityData, period, "month"), filters), [period, filters]);
  const pRevenuePerUserData = useMemo(() => applyFilterToData(scaleTrendData(revenuePerUserData, period, "month"), filters), [period, filters]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  const q = comparisonData.qris;
  const nq = comparisonData.nonQris;

  const totalQrisUsers = q.user_count;
  const totalUsers = q.user_count + nq.user_count;
  const currentAdoptionRate = adoptionData[adoptionData.length - 1].adoption_rate;
  const totalNewUsers = adoptionData.reduce((sum, d) => sum + d.new_users, 0);
  const totalQrisTxns = merchantCategoryData.reduce((sum, d) => sum + d.txn_count, 0);
  const latestProfit = profitabilityData[profitabilityData.length - 2]; // Feb (full month)
  const qrisShareOfVolume = ((latestProfit.qris_volume / (latestProfit.qris_volume + latestProfit.card_volume)) * 100).toFixed(1);

  const maxCategoryTxn = merchantCategoryData[0].txn_count;

  return (
    <div className="flex flex-col">
      <Header title="QRIS Experiment" />

      <div className="flex-1 space-y-6 p-6">

        <ActiveFiltersBanner />

        {/* ============================================================ */}
        {/* SECTION A: Hero Banner */}
        {/* ============================================================ */}
        <div
          className="relative overflow-hidden rounded-2xl p-6"
          style={{
            background: isDark
              ? "linear-gradient(135deg, #5B22FF 0%, #7C4DFF 40%, #3D1299 100%)"
              : "linear-gradient(135deg, #059669 0%, #10B981 40%, #047857 100%)",
          }}
        >
          {/* Background decorative elements */}
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
                  <p className="text-sm text-white/70">Quick Response Code Indonesian Standard &middot; {periodLabel}</p>
                </div>
              </div>

              <p className="text-sm text-white/80 max-w-2xl leading-relaxed mt-2">
                QRIS has been running as an experiment since November 2025. This report analyzes whether
                enabling QR payments on Honest credit cards increases overall engagement and spend enough
                to justify the lower interchange revenue per transaction.
              </p>

              <div className="flex flex-wrap gap-4 mt-4 text-xs text-white/60">
                <span>Launch: Nov 2025</span>
                <span className="text-white/30">|</span>
                <span>Test Period: 4.5 months</span>
                <span className="text-white/30">|</span>
                <span>Sample: {fmtNum(totalUsers)} transacting users</span>
                <span className="text-white/30">|</span>
                <span>Filter: txn_typ=RA, rte_dest=L</span>
              </div>
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

        {/* ============================================================ */}
        {/* SECTION B: KPI Cards */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Adoption Rate */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg", isDark ? "bg-[#5B22FF]/20" : "bg-[#D00083]/20")}>
                <Users className={cn("h-4 w-4", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">Adoption Rate</span>
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{scaleMetricValue(currentAdoptionRate, period, true)}%</p>
            <div className="flex items-center gap-1 mt-1 text-[#06D6A0]">
              <TrendingUp className="h-3 w-3" />
              <span className="text-xs font-medium">+19.2pp since launch</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-2">{fmtNum(scaleMetricValue(totalQrisUsers, period, false))} of {fmtNum(scaleMetricValue(totalUsers, period, false))} users</p>
          </div>

          {/* Card 2: New QRIS Users */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#06D6A0]/20">
                <Zap className="h-4 w-4 text-[#06D6A0]" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">New QRIS Users</span>
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{fmtNum(scaleMetricValue(totalNewUsers, period, false))}</p>
            <div className="flex items-center gap-1 mt-1 text-[#06D6A0]">
              <TrendingUp className="h-3 w-3" />
              <span className="text-xs font-medium">870 this week</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-2">Cumulative over experiment period</p>
          </div>

          {/* Card 3: Total QRIS Transactions */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#FFD166]/20">
                <ShoppingCart className="h-4 w-4 text-[#FFD166]" />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">QRIS Transactions</span>
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{fmtNum(scaleMetricValue(totalQrisTxns, period, false))}</p>
            <div className="flex items-center gap-1 mt-1 text-[#06D6A0]">
              <TrendingUp className="h-3 w-3" />
              <span className="text-xs font-medium">+18% MoM</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-2">Avg {fmtIDR(130_000)} per transaction</p>
          </div>

          {/* Card 4: QRIS Share of Volume */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg", isDark ? "bg-[#7C4DFF]/20" : "bg-[#D00083]/20")}>
                <BarChart3 className={cn("h-4 w-4", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">QRIS % of Volume</span>
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)]">{scaleMetricValue(parseFloat(qrisShareOfVolume), period, true)}%</p>
            <div className="flex items-center gap-1 mt-1 text-[#06D6A0]">
              <TrendingUp className="h-3 w-3" />
              <span className="text-xs font-medium">+12.4pp since launch</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)] mt-2">{fmtIDR(latestProfit.qris_volume)} in Feb 2026</p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION C: QRIS vs Non-QRIS Comparison */}
        {/* ============================================================ */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="bg-[var(--surface-elevated)] px-6 py-4 border-b border-[var(--border)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">User Behavior Comparison</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              QRIS adopters vs non-adopters across key engagement metrics (last 6 months)
            </p>
          </div>

          <div className="p-6">
            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 mb-4">
              <div className="text-right">
                <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5", isDark ? "bg-[#5B22FF]/20" : "bg-[#D00083]/20")}>
                  <QrCode className={cn("h-3.5 w-3.5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
                  <span className={cn("text-sm font-semibold", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>QRIS Users</span>
                  <span className="text-[10px] text-[var(--text-muted)]">({fmtNum(q.user_count)})</span>
                </div>
              </div>
              <div className="min-w-[140px]" />
              <div className="text-left">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--text-secondary)]/10 px-4 py-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">Non-QRIS Users</span>
                  <span className="text-[10px] text-[var(--text-muted)]">({fmtNum(nq.user_count)})</span>
                </div>
              </div>
            </div>

            {/* Comparison rows */}
            <ComparisonRow label="Avg Transactions / Month" qrisValue={q.avg_txn_count} nonQrisValue={nq.avg_txn_count} format="decimal" />
            <ComparisonRow label="Avg Total Spend" qrisValue={q.avg_total_spend_idr} nonQrisValue={nq.avg_total_spend_idr} format="idr" />
            <ComparisonRow label="Avg Spend per Txn" qrisValue={q.avg_spend_per_txn} nonQrisValue={nq.avg_spend_per_txn} format="idr" higherIsBetter={false} />
            <ComparisonRow label="Avg Days Active" qrisValue={q.avg_days_active} nonQrisValue={nq.avg_days_active} format="decimal" />
            <ComparisonRow label="Multi-Channel Usage" qrisValue={q.pct_multi_channel} nonQrisValue={nq.pct_multi_channel} format="percent" />

            {/* Key insight callout */}
            <div className="mt-6 rounded-xl bg-[#06D6A0]/10 border border-[#06D6A0]/20 p-4">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-[#06D6A0] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[#06D6A0]">Key Finding</p>
                  <p className="text-sm text-[var(--text-primary)]/80 mt-1 leading-relaxed">
                    While QRIS transactions have a lower average ticket size (IDR 253K vs IDR 369K),
                    QRIS users transact <span className="font-bold text-[#06D6A0]">2.1x more frequently</span> and
                    spend <span className="font-bold text-[#06D6A0]">45% more in total</span> across all channels.
                    78% of QRIS users also use their card for online and offline purchases, indicating that
                    QRIS acts as a gateway to broader card engagement.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION D: Adoption Trend */}
        {/* ============================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="QRIS Adoption Rate"
            subtitle="Percentage of active users who have used QRIS"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={pAdoptionData}
              lines={[
                { key: "adoption_rate", color: isDark ? "#7C4DFF" : "#D00083", label: "Adoption Rate %" },
              ]}
              xAxisKey="week"
              height={280}
              valueType="percent"
            />
          </ChartCard>

          <ChartCard
            title="New QRIS Users per Week"
            subtitle="First-time QRIS transactions by week"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardBarChart
              data={pAdoptionData}
              bars={[
                { key: "new_users", color: "#06D6A0", label: "New Users" },
              ]}
              xAxisKey="week"
              height={280}
            />
          </ChartCard>
        </div>

        {/* ============================================================ */}
        {/* SECTION E: Profitability Analysis */}
        {/* ============================================================ */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="bg-[var(--surface-elevated)] px-6 py-4 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-6 w-6 rounded-md bg-[#FFD166]/20">
                <CreditCard className="h-3.5 w-3.5 text-[#FFD166]" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--text-primary)]">Profitability Analysis</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  QRIS MDR 0.7% vs Card Interchange ~1.5% &mdash; does higher engagement offset lower per-txn revenue?
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Summary stat boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
                <StatBox label="QRIS Interchange (Feb)" value={fmtIDR(122_000_000)} subtext="0.7% MDR" />
              </div>
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
                <StatBox label="Card Interchange (Feb)" value={fmtIDR(1_020_000_000)} subtext="~1.5% rate" />
              </div>
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
                <StatBox label="QRIS User Total Spend" value={fmtIDR(52_300_000_000)} subtext="All channels" />
              </div>
              <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] p-4">
                <StatBox label="Non-QRIS User Spend" value={fmtIDR(51_400_000_000)} subtext="All channels" />
              </div>
            </div>

            {/* Revenue comparison chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Interchange Revenue (Monthly)</h4>
                <DashboardBarChart
                  data={pProfitabilityData}
                  bars={[
                    { key: "qris_interchange", color: isDark ? "#7C4DFF" : "#D00083", label: "QRIS Interchange" },
                    { key: "card_interchange", color: "#06D6A0", label: "Card Interchange" },
                  ]}
                  xAxisKey="month"
                  height={260}
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Revenue per User (Monthly)</h4>
                <DashboardLineChart
                  data={pRevenuePerUserData}
                  lines={[
                    { key: "qris_rev_per_user", color: isDark ? "#7C4DFF" : "#D00083", label: "QRIS Users" },
                    { key: "non_qris_rev_per_user", color: isDark ? "#9B94C4" : "#888888", label: "Non-QRIS Users" },
                  ]}
                  xAxisKey="month"
                  height={260}
                  valueType="currency"
                />
              </div>
            </div>

            {/* Total spend by user segment */}
            <div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Total Spend by User Segment (Monthly)</h4>
              <DashboardAreaChart
                data={pProfitabilityData}
                areas={[
                  { key: "qris_user_spend", color: isDark ? "#7C4DFF" : "#D00083", label: "QRIS User Spend (all channels)" },
                  { key: "non_qris_user_spend", color: isDark ? "#2D2955" : "#E0D6F2", label: "Non-QRIS User Spend" },
                ]}
                xAxisKey="month"
                height={280}
                valueType="currency"
              />
            </div>

            {/* Profitability insight callout */}
            <div className={cn("rounded-xl border p-4", isDark ? "bg-[#5B22FF]/10 border-[#5B22FF]/20" : "bg-[#D00083]/10 border-[#D00083]/20")}>
              <div className="flex items-start gap-3">
                <TrendingUp className={cn("h-5 w-5 shrink-0 mt-0.5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
                <div>
                  <p className={cn("text-sm font-semibold", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>Profitability Verdict</p>
                  <p className="text-sm text-[var(--text-primary)]/80 mt-1 leading-relaxed">
                    Although QRIS interchange per transaction is less than half the card rate (0.7% vs 1.5%),
                    the <span className={cn("font-bold", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>total revenue generated per QRIS user is 2.5x higher</span> (IDR 24.8K vs IDR 10.2K per month).
                    This is because QRIS users are significantly more active across all channels.
                    By February 2026, QRIS user total spend has surpassed non-QRIS user spend despite representing only 27% of users,
                    demonstrating that QRIS adoption is a strong predictor of high-value customer behavior.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION F: QRIS Merchant Categories */}
        {/* ============================================================ */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="bg-[var(--surface-elevated)] px-6 py-4 border-b border-[var(--border)]">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">QRIS Merchant Categories</h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Top categories by transaction count where QRIS is used</p>
          </div>

          <div className="p-6">
            <div className="space-y-1">
              {merchantCategoryData.map((cat) => (
                <HorizontalBar
                  key={cat.category}
                  label={cat.category}
                  value={cat.txn_count}
                  maxValue={maxCategoryTxn}
                  subLabel={fmtIDR(cat.spend)}
                />
              ))}
            </div>

            <div className="mt-4 flex items-center gap-6 text-[11px] text-[var(--text-muted)]">
              <span>Bar width = transaction count</span>
              <span>Right column = total spend</span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* SECTION G: Conclusion & Recommendations */}
        {/* ============================================================ */}
        <ActionItems section="QRIS Experiment" items={actionItems} />

        {/* Footer note */}
        <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] px-6 py-4">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Methodology:</span>{" "}
            QRIS transactions are identified by <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw007_txn_typ = &apos;RA&apos;</code> and{" "}
            <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw007_rte_dest = &apos;L&apos;</code>.
            Spend data is based on <strong>authorized transactions</strong>. Interchange estimates use 0.7% MDR for QRIS and ~1.5% weighted average for card transactions.
            &quot;QRIS Users&quot; are customers who have made at least one QRIS transaction during the experiment period.
            All spend figures include both QRIS and non-QRIS transactions for each user segment.
            Mar* data is partial (through {AS_OF}).
          </p>
        </div>
      </div>
    </div>
  );
}
