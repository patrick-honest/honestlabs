"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { getPeriodRange, scaleTrendData, scaleMetricValue, getPeriodLabels, getPeriodInsightLabels } from "@/lib/period-data";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

// --- Mock data ---
const AS_OF = "Mar 15, 2026";

const funnelStages = [
  { stage: "Waitlisted", count: 12400, rate: null },
  { stage: "Apply Started", count: 8900, rate: 71.8 },
  { stage: "KYC Submitted", count: 7200, rate: 80.9 },
  { stage: "Documents Verified", count: 6100, rate: 84.7 },
  { stage: "Decision Made", count: 5800, rate: 95.1 },
  { stage: "Approved", count: 4200, rate: 72.4 },
  { stage: "Card Shipped", count: 3900, rate: 92.9 },
  { stage: "Card Activated", count: 3400, rate: 87.2 },
  { stage: "PIN Set", count: 3200, rate: 94.1 },
];

const stageToSqlValue: Record<string, string> = {
  "Waitlisted": "Waitlisted",
  "Apply Started": "Apply started",
  "KYC Submitted": "KYC submitted",
  "Documents Verified": "Documents verified",
  "Decision Made": "Decision made",
  "Approved": "Approved",
  "Card Shipped": "Card shipped",
  "Card Activated": "Card activated",
  "PIN Set": "PIN set",
};

function getUsersSql(stageName: string): string {
  const val = stageToSqlValue[stageName] ?? stageName;
  return `SELECT DISTINCT user_id\nFROM \`storage-58f5a02c.refined_rudderstack.milestone_complete\`\nWHERE application_status = '${val}'`;
}

function getDropoffSql(prevStageName: string, currentStageName: string): string {
  const prevVal = stageToSqlValue[prevStageName] ?? prevStageName;
  const curVal = stageToSqlValue[currentStageName] ?? currentStageName;
  return `SELECT DISTINCT a.user_id\nFROM \`storage-58f5a02c.refined_rudderstack.milestone_complete\` a\nLEFT JOIN \`storage-58f5a02c.refined_rudderstack.milestone_complete\` b\n  ON a.user_id = b.user_id AND b.application_status = '${curVal}'\nWHERE a.application_status = '${prevVal}'\n  AND b.user_id IS NULL`;
}

const decisionBreakdown = [
  { date: "W1 Feb", approved: 980, declined: 320, waitlisted: 150 },
  { date: "W2 Feb", approved: 1050, declined: 290, waitlisted: 180 },
  { date: "W3 Feb", approved: 1100, declined: 310, waitlisted: 160 },
  { date: "W4 Feb", approved: 1020, declined: 350, waitlisted: 200 },
  { date: "W1 Mar", approved: 1150, declined: 280, waitlisted: 170 },
  { date: "W2 Mar", approved: 1200, declined: 260, waitlisted: 140 },
];

const productMix = [
  { name: "Standard CC", value: 2800, color: "#3b82f6" },
  { name: "Prepaid", value: 900, color: "#8b5cf6" },
  { name: "Opening Fee", value: 500, color: "#06b6d4" },
];

const approvalRateTrend = [
  { date: "Oct", rate: 68.2 },
  { date: "Nov", rate: 70.1 },
  { date: "Dec", rate: 69.5 },
  { date: "Jan", rate: 71.8 },
  { date: "Feb", rate: 72.4 },
  { date: "Mar", rate: 73.1 },
];

const avgCreditLineTrend = [
  { date: "Oct", avgLimit: 8500000 },
  { date: "Nov", avgLimit: 8700000 },
  { date: "Dec", avgLimit: 8600000 },
  { date: "Jan", avgLimit: 9100000 },
  { date: "Feb", avgLimit: 9300000 },
  { date: "Mar", avgLimit: 9500000 },
];

const vintageCounts = [
  { month: "Oct 2025", count: 3200 },
  { month: "Nov 2025", count: 3450 },
  { month: "Dec 2025", count: 2900 },
  { month: "Jan 2026", count: 3800 },
  { month: "Feb 2026", count: 4100 },
  { month: "Mar 2026", count: 4200 },
];


// --- Sample data: CAC Metrics (blocked by mart_finance + Ad Platform APIs) ---
const cacTrend = [
  { date: "Apr 25", cacApproved: 9.20, cacAll: 42.50, google: 21.80, meta: 58.40, tiktok: 36.50 },
  { date: "May 25", cacApproved: 8.90, cacAll: 40.10, google: 20.50, meta: 55.20, tiktok: 33.80 },
  { date: "Jun 25", cacApproved: 8.50, cacAll: 38.70, google: 19.80, meta: 52.10, tiktok: 30.20 },
  { date: "Jul 25", cacApproved: 8.80, cacAll: 39.40, google: 18.90, meta: 48.70, tiktok: 28.50 },
  { date: "Aug 25", cacApproved: 8.30, cacAll: 37.20, google: 17.60, meta: 45.30, tiktok: 25.90 },
  { date: "Sep 25", cacApproved: 8.10, cacAll: 35.80, google: 16.40, meta: 42.80, tiktok: 22.10 },
  { date: "Oct 25", cacApproved: 7.90, cacAll: 34.50, google: 15.80, meta: 39.50, tiktok: 19.80 },
  { date: "Nov 25", cacApproved: 7.75, cacAll: 33.20, google: 15.20, meta: 36.10, tiktok: 17.40 },
  { date: "Dec 25", cacApproved: 8.10, cacAll: 36.80, google: 16.90, meta: 41.20, tiktok: 21.50 },
  { date: "Jan 26", cacApproved: 8.40, cacAll: 38.50, google: 18.10, meta: 44.60, tiktok: 24.30 },
  { date: "Feb 26", cacApproved: 8.80, cacAll: 41.20, google: 19.40, meta: 49.80, tiktok: 28.70 },
  { date: "Mar 26", cacApproved: 9.10, cacAll: 43.80, google: 20.90, meta: 53.50, tiktok: 32.10 },
];

const cacChannelTrend = [
  { date: "Apr 25", google: 21.80, meta: 58.40, tiktok: 36.50 },
  { date: "May 25", google: 20.50, meta: 55.20, tiktok: 33.80 },
  { date: "Jun 25", google: 19.80, meta: 52.10, tiktok: 30.20 },
  { date: "Jul 25", google: 18.90, meta: 48.70, tiktok: 28.50 },
  { date: "Aug 25", google: 17.60, meta: 45.30, tiktok: 25.90 },
  { date: "Sep 25", google: 16.40, meta: 42.80, tiktok: 22.10 },
  { date: "Oct 25", google: 15.80, meta: 39.50, tiktok: 19.80 },
  { date: "Nov 25", google: 15.20, meta: 36.10, tiktok: 17.40 },
  { date: "Dec 25", google: 16.90, meta: 41.20, tiktok: 21.50 },
  { date: "Jan 26", google: 18.10, meta: 44.60, tiktok: 24.30 },
  { date: "Feb 26", google: 19.40, meta: 49.80, tiktok: 28.70 },
  { date: "Mar 26", google: 20.90, meta: 53.50, tiktok: 32.10 },
];

// --- Sample data: Organic Traffic (blocked by Mixpanel) ---
const organicTrafficTrend = [
  { date: "Apr 25", organicPct: 26.2, paidPct: 73.8 },
  { date: "May 25", organicPct: 27.1, paidPct: 72.9 },
  { date: "Jun 25", organicPct: 28.5, paidPct: 71.5 },
  { date: "Jul 25", organicPct: 29.3, paidPct: 70.7 },
  { date: "Aug 25", organicPct: 30.8, paidPct: 69.2 },
  { date: "Sep 25", organicPct: 31.2, paidPct: 68.8 },
  { date: "Oct 25", organicPct: 30.5, paidPct: 69.5 },
  { date: "Nov 25", organicPct: 32.1, paidPct: 67.9 },
  { date: "Dec 25", organicPct: 28.9, paidPct: 71.1 },
  { date: "Jan 26", organicPct: 31.7, paidPct: 68.3 },
  { date: "Feb 26", organicPct: 33.4, paidPct: 66.6 },
  { date: "Mar 26", organicPct: 34.8, paidPct: 65.2 },
];

// --- Sample data: First or Second Credit Card (blocked by Credit Bureau) ---
const firstCcTrend = [
  { date: "Apr 25", firstOrSecondPct: 78.2 },
  { date: "May 25", firstOrSecondPct: 76.5 },
  { date: "Jun 25", firstOrSecondPct: 74.1 },
  { date: "Jul 25", firstOrSecondPct: 72.8 },
  { date: "Aug 25", firstOrSecondPct: 70.3 },
  { date: "Sep 25", firstOrSecondPct: 68.9 },
  { date: "Oct 25", firstOrSecondPct: 65.4 },
  { date: "Nov 25", firstOrSecondPct: 62.1 },
  { date: "Dec 25", firstOrSecondPct: 60.7 },
  { date: "Jan 26", firstOrSecondPct: 58.3 },
  { date: "Feb 26", firstOrSecondPct: 57.1 },
  { date: "Mar 26", firstOrSecondPct: 56.2 },
];

const actionItems: ActionItem[] = [
  {
    id: "acq-1",
    priority: "urgent",
    action: "KYC drop-off is high at 19.1%.",
    detail: "Investigate friction in document upload flow. Consider simplifying ID verification steps.",
  },
  {
    id: "acq-2",
    priority: "monitor",
    action: "Decline rate trending down to 18.3%.",
    detail: "Scorecard recalibration in Jan appears effective. Continue monitoring false-negative rates.",
  },
  {
    id: "acq-3",
    priority: "positive",
    action: "Approval rate improved to 73.1%.",
    detail: "Highest in 6 months. Average credit line also trending up to Rp 9.5M.",
  },
];

// --- Component ---
type ContextMenuState = {
  x: number;
  y: number;
  stageName: string;
  stageIndex: number;
  isDropoff: boolean;
} | null;

export default function AcquisitionPage() {
  const { period, periodLabel } = usePeriod();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const periodFunnel = useMemo(() => funnelStages.map(s => ({
    ...s,
    count: scaleMetricValue(s.count, period, false),
  })), [period]);

  const periodDecisionBreakdown = useMemo(() => scaleTrendData(decisionBreakdown, period), [period]);
  const periodApprovalRateTrend = useMemo(() => scaleTrendData(approvalRateTrend, period), [period]);
  const periodAvgCreditLineTrend = useMemo(() => scaleTrendData(avgCreditLineTrend, period), [period]);
  const periodVintageCounts = useMemo(() => scaleTrendData(vintageCounts, period, "month"), [period]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const funnelInsights = useMemo<ChartInsight[]>(() => [
    { text: "Biggest drop-off is Waitlisted to Apply Started at 71.8% — nearly 1 in 3 waitlisted users never start an application.", type: "negative" },
    { text: "KYC Submitted to Documents Verified converts at 84.7%, but the preceding step (Apply Started to KYC) is only 80.9% — document upload friction is the second-largest leak.", type: "negative" },
    { text: "Post-decision stages (Card Shipped to Activated to PIN Set) convert above 87%, indicating strong fulfillment execution.", type: "positive" },
    { text: "End-to-end yield from Waitlisted to PIN Set is 25.81% — improving the top-of-funnel waitlist conversion by even 5pp would add ~620 activated cards.", type: "neutral" },
    { text: "The waitlist-to-apply gap may reflect users who registered interest during marketing campaigns but lack immediate intent — a drip nurture sequence could recover 10-15% of these.", type: "hypothesis" },
  ], [p]);

  const decisionInsights = useMemo<ChartInsight[]>(() => [
    { text: `Approvals climbed from 980 (${p.firstLabel}) to 1,200 (${p.lastLabel}), a 22.45% increase over ${p.span}.`, type: "positive" },
    { text: "Declines dropped from 320 to 260 over the same period, bringing the decline share from 22.07% down to 16.25%.", type: "positive" },
    { text: `A mid-period spike in declines (350) and waitlisted (200) is worth checking — a scoring model update or data-source outage may have occurred that ${p.unit}.`, type: "neutral" },
    { text: `The January scorecard recalibration appears to be the primary driver — the decline-rate reduction accelerated in the latter half of the ${p.trailingWindow}, consistent with the rollout timeline.`, type: "hypothesis" },
  ], [p]);

  const productMixInsights = useMemo<ChartInsight[]>(() => [
    { text: "Standard Credit Cards dominate at 66.67% of approved accounts (2,800 of 4,200), reflecting strong core product demand.", type: "positive" },
    { text: "Prepaid accounts represent 21.43% of the mix — a healthy entry-level segment that can be upsold to full credit over time.", type: "neutral" },
    { text: "Opening Fee products are the smallest segment at 11.9%. Low share may indicate limited marketing or niche appeal.", type: "neutral" },
    { text: "A heavily Standard CC-skewed mix concentrates credit risk. If macro conditions tighten, the portfolio has limited diversification buffer.", type: "hypothesis" },
  ], [p]);

  const approvalRateInsights = useMemo<ChartInsight[]>(() => [
    { text: `Approval rate has risen from 68.2% (${p.firstLabel}) to 73.1% (${p.lastLabel}), a steady 4.9pp improvement over ${p.span}.`, type: "positive" },
    { text: "Still 1.9pp below the 75% target — at the current trajectory, the target could be reached by May 2026.", type: "neutral" },
    { text: "The only dip was mid-period (69.5%), likely seasonal due to higher-risk holiday applicants.", type: "neutral" },
    { text: `Continued ${p.changeFull} improvement without loosening credit policy suggests better applicant quality or more effective pre-screening rather than risk appetite drift.`, type: "hypothesis" },
  ], [p]);

  const avgCreditLimitInsights = useMemo<ChartInsight[]>(() => [
    { text: `Average approved credit limit increased from Rp 8.5M (${p.firstLabel}) to Rp 9.5M (${p.lastLabel}), up 11.76% in ${p.span}.`, type: "positive" },
    { text: "The steepest jump was mid-period (+Rp 500K), coinciding with the scorecard recalibration that may have shifted the approved population upward.", type: "neutral" },
    { text: "Higher average limits increase per-account exposure. Monitor early-stage delinquency on recent vintages to ensure credit quality holds.", type: "negative" },
    { text: `Indonesian digital-bank peers typically range Rp 5M-10M for new-to-credit segments — Honest sits at the upper end, which could be a competitive advantage or a risk signal depending on portfolio performance.`, type: "hypothesis" },
  ], [p]);

  const vintageInsights = useMemo<ChartInsight[]>(() => [
    { text: `${p.lastLabel} cohort (4,200) is the largest on record, representing 31.25% growth over the ${p.firstLabel} baseline (3,200).`, type: "positive" },
    { text: "A mid-period dip to 2,900 accounts represents a seasonal trough consistent with reduced marketing spend and holiday processing delays.", type: "neutral" },
    { text: `Three consecutive periods of growth suggest sustainable acquisition momentum, not a one-off spike.`, type: "positive" },
    { text: "Rapid cohort growth means newer vintages will dominate portfolio composition within 2-3 months. If these vintages underperform on credit metrics, the impact will be outsized — early-warning monitoring is critical.", type: "hypothesis" },
  ], [p]);

  const [ctxMenu, setCtxMenu] = useState<ContextMenuState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCtxMenu(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ctxMenu]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setToast("Copied!");
    }).catch(() => {
      setToast("Copy failed");
    });
    setCtxMenu(null);
  }, []);

  const handleBarContextMenu = useCallback((
    e: React.MouseEvent,
    stageName: string,
    stageIndex: number,
    isDropoff: boolean
  ) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, stageName, stageIndex, isDropoff });
  }, []);

  const handleRefresh = useCallback(async () => {
    // TODO: SWR mutate for specific metric
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Acquisition Deep Dive</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="acq_total_applications"
          label="Total Applications"
          value={scaleMetricValue(8900, period, false)}
          prevValue={scaleMetricValue(8200, period, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="acq_approval_rate"
          label="Approval Rate"
          value={scaleMetricValue(73.1, period, true)}
          prevValue={scaleMetricValue(72.4, period, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={75}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="acq_avg_credit_line"
          label="Avg Credit Line"
          value={9500000}
          prevValue={9300000}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="acq_cards_activated"
          label="Cards Activated"
          value={scaleMetricValue(3400, period, false)}
          prevValue={scaleMetricValue(3100, period, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Funnel visualization */}
      <ChartCard
        title="Application Funnel"
        subtitle="Conversion rates between stages"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="space-y-1 relative">
          {periodFunnel.map((stage, i) => {
            const maxCount = periodFunnel[0].count;
            const widthPct = (stage.count / maxCount) * 100;
            const dropoff = i > 0 ? periodFunnel[i - 1].count - stage.count : 0;
            const dropoffPct = i > 0 ? (dropoff / maxCount) * 100 : 0;
            const convColor =
              stage.rate === null
                ? ""
                : stage.rate >= 90
                  ? "text-emerald-400"
                  : stage.rate >= 75
                    ? "text-blue-400"
                    : "text-red-400";

            return (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="w-36 text-xs text-[var(--text-secondary)] text-right shrink-0">
                  {stage.stage}
                </span>
                <div className="flex-1 h-7 relative flex">
                  {/* Main funnel bar */}
                  <div
                    className="h-full rounded-l bg-gradient-to-r from-blue-600/80 to-blue-500/40 flex items-center px-2 cursor-context-menu"
                    style={{ width: `${widthPct}%` }}
                    onContextMenu={(e) => handleBarContextMenu(e, stage.stage, i, false)}
                  >
                    <span className="text-xs font-semibold text-[var(--text-primary)] whitespace-nowrap">
                      {stage.count.toLocaleString()}
                    </span>
                  </div>
                  {/* Drop-off bar */}
                  {i > 0 && dropoff > 0 && (
                    <div
                      className="h-full rounded-r bg-gradient-to-r from-red-500/30 to-red-400/15 flex items-center justify-end px-2 cursor-context-menu border-l border-red-400/20"
                      style={{ width: `${dropoffPct}%` }}
                      onContextMenu={(e) => handleBarContextMenu(e, stage.stage, i, true)}
                      title={`Drop-off: ${dropoff.toLocaleString()}`}
                    >
                      {dropoffPct > 6 && (
                        <span className="text-[10px] font-medium text-red-400/80 whitespace-nowrap">
                          -{dropoff.toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {stage.rate !== null && (
                  <span className={`w-14 text-xs font-medium text-right shrink-0 ${convColor}`}>
                    {stage.rate}%
                  </span>
                )}
              </div>
            );
          })}

          {/* Context menu */}
          {ctxMenu && (
            <div
              ref={ctxMenuRef}
              className="fixed z-50 min-w-[240px] rounded-lg shadow-xl border border-[var(--border)] overflow-hidden"
              style={{
                top: ctxMenu.y,
                left: ctxMenu.x,
                backgroundColor: "var(--card-bg, #1e293b)",
              }}
            >
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border)]">
                {ctxMenu.stageName}
              </div>
              <button
                className="w-full text-left px-3 py-2.5 text-xs text-[var(--text-primary)] hover:bg-[var(--hover-bg,rgba(59,130,246,0.1))] transition-colors flex items-center gap-2"
                onClick={() => copyToClipboard(getUsersSql(ctxMenu.stageName))}
              >
                <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy SQL: Users at this stage
              </button>
              {ctxMenu.stageIndex > 0 && (
                <button
                  className="w-full text-left px-3 py-2.5 text-xs text-[var(--text-primary)] hover:bg-[var(--hover-bg,rgba(59,130,246,0.1))] transition-colors flex items-center gap-2 border-t border-[var(--border)]"
                  onClick={() => {
                    const prevStage = funnelStages[ctxMenu.stageIndex - 1].stage;
                    copyToClipboard(getDropoffSql(prevStage, ctxMenu.stageName));
                  }}
                >
                  <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  </svg>
                  Copy SQL: Drop-offs at this stage
                </button>
              )}
            </div>
          )}

          {/* Toast notification */}
          {toast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-lg text-xs font-medium shadow-lg border border-[var(--border)] animate-in fade-in slide-in-from-bottom-2"
              style={{ backgroundColor: "var(--card-bg, #1e293b)", color: "var(--text-primary, #f1f5f9)" }}
            >
              {toast}
            </div>
          )}
        </div>
        <ChartInsights insights={funnelInsights} />
      </ChartCard>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Decision Breakdown */}
        <ChartCard
          title="Decision Breakdown"
          subtitle={`Approved / Declined / Waitlisted by ${p.unit}`}
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={periodDecisionBreakdown}
            bars={[
              { key: "approved", color: "#22c55e", label: "Approved" },
              { key: "declined", color: "#ef4444", label: "Declined" },
              { key: "waitlisted", color: "#f59e0b", label: "Waitlisted" },
            ]}
            stacked
            height={280}
          />
          <ChartInsights insights={decisionInsights} />
        </ChartCard>

        {/* Product Mix */}
        <ChartCard
          title="Product Mix"
          subtitle="Approved accounts by product type"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {productMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#f1f5f9",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ChartInsights insights={productMixInsights} />
        </ChartCard>
      </div>

      {/* Line charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Approval Rate Trend"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={periodApprovalRateTrend}
            lines={[{ key: "rate", color: "#3b82f6", label: "Approval Rate %" }]}
            valueType="percent"
            height={260}
          />
          <ChartInsights insights={approvalRateInsights} />
        </ChartCard>

        <ChartCard
          title="Avg Approved Credit Limit"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={periodAvgCreditLineTrend}
            lines={[{ key: "avgLimit", color: "#8b5cf6", label: "Avg Limit" }]}
            valueType="currency"
            height={260}
          />
          <ChartInsights insights={avgCreditLimitInsights} />
        </ChartCard>
      </div>

      {/* Vintage table */}
      <ChartCard
        title="Vintage Acquisition Counts"
        subtitle="Monthly cohort new accounts"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Cohort Month</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">New Accounts</th>
              </tr>
            </thead>
            <tbody>
              {periodVintageCounts.map((row) => (
                <tr key={row.month} className="border-b border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--text-primary)]">{row.month}</td>
                  <td className="py-2 px-3 text-[var(--text-primary)] text-right font-medium">
                    {row.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ChartInsights insights={vintageInsights} />
      </ChartCard>

      {/* === SAMPLE DATA SECTIONS: Metrics from Orico spreadsheets not yet automated === */}

      {/* CAC Metrics — blocked by mart_finance + Ad Platform APIs */}
      <SampleDataBanner
        dataset="mart_finance + Ad Platform APIs"
        reason="CAC and marketing cost data requires access to mart_finance and Google/Meta/TikTok ad APIs"
      >
        <div className="space-y-4 p-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Customer Acquisition Cost (CAC)</h2>

          {/* CAC KPI row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              metricKey="sample_cac_approved"
              label="CAC (Approved)"
              value={9.10}
              prevValue={8.80}
              unit="usd"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            />
            <MetricCard
              metricKey="sample_cac_all"
              label="CAC (All Applicants)"
              value={43.80}
              prevValue={41.20}
              unit="usd"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            />
            <MetricCard
              metricKey="sample_mktg_google"
              label="Mktg/Customer - Google"
              value={20.90}
              prevValue={19.40}
              unit="usd"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            />
            <MetricCard
              metricKey="sample_mktg_meta"
              label="Mktg/Customer - Meta"
              value={53.50}
              prevValue={49.80}
              unit="usd"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            />
          </div>

          {/* CAC trend chart */}
          <ChartCard
            title="CAC Trend (Approved vs All)"
            subtitle="Monthly customer acquisition cost"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
          >
            <DashboardLineChart
              data={cacTrend}
              lines={[
                { key: "cacApproved", color: "#22c55e", label: "CAC Approved ($)" },
                { key: "cacAll", color: "#ef4444", label: "CAC All ($)" },
              ]}
              height={280}
            />
          </ChartCard>

          {/* Marketing cost per customer by channel */}
          <ChartCard
            title="Marketing Cost per Customer by Channel"
            subtitle="Google / Meta / TikTok spend per acquired customer"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
          >
            <DashboardLineChart
              data={cacChannelTrend}
              lines={[
                { key: "google", color: "#4285F4", label: "Google ($)" },
                { key: "meta", color: "#1877F2", label: "Meta ($)" },
                { key: "tiktok", color: "#000000", label: "TikTok ($)" },
              ]}
              height={280}
            />
          </ChartCard>
        </div>
      </SampleDataBanner>

      {/* Organic Traffic — blocked by Mixpanel */}
      <SampleDataBanner
        dataset="Mixpanel"
        reason="Traffic source attribution requires Mixpanel integration"
      >
        <div className="space-y-4 p-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Organic vs Paid Traffic</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard
              metricKey="sample_organic_pct"
              label="Organic Traffic %"
              value={34.8}
              prevValue={33.4}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            />
            <MetricCard
              metricKey="sample_paid_pct"
              label="Paid Traffic %"
              value={65.2}
              prevValue={66.6}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            />
          </div>

          <ChartCard
            title="Organic vs Paid Traffic Split"
            subtitle="Monthly traffic source breakdown (%)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
          >
            <DashboardBarChart
              data={organicTrafficTrend}
              bars={[
                { key: "organicPct", color: "#22c55e", label: "Organic %" },
                { key: "paidPct", color: "#3b82f6", label: "Paid %" },
              ]}
              stacked
              height={280}
            />
          </ChartCard>
        </div>
      </SampleDataBanner>

      {/* First or Second Credit Card — blocked by Credit Bureau */}
      <SampleDataBanner
        dataset="Credit Bureau"
        reason="Credit history data requires bureau API integration"
      >
        <div className="space-y-4 p-3">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">First or Second Credit Card</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard
              metricKey="sample_first_cc_pct"
              label="1st/2nd Credit Card %"
              value={56.2}
              prevValue={57.1}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            />
          </div>

          <ChartCard
            title="First or Second Credit Card Rate"
            subtitle="% of applicants for whom this is their 1st or 2nd credit card"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
          >
            <DashboardLineChart
              data={firstCcTrend}
              lines={[{ key: "firstOrSecondPct", color: "#8b5cf6", label: "1st/2nd CC %" }]}
              valueType="percent"
              height={260}
            />
          </ChartCard>
        </div>
      </SampleDataBanner>

      {/* Action items */}
      <ActionItems section="Acquisition" items={actionItems} />
    </div>
  );
}
