"use client";

import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, getPeriodInsightLabels } from "@/lib/period-data";

const AS_OF = "Mar 15, 2026";

const stageToSqlValue: Record<string, string> = {
  "OTP Started": "OTP login started",
  "Mobile Verified": "Mobile verified",
  "Agreements Accepted": "Application agreements accepted",
  "KYC Complete": "KYC complete",
  "Personal Details": "Personal details entered",
  "Personal Info Pt2": "Personal info details part 2 complete",
  "App Submitted": "Application submitted",
  "Decision Complete": "Decision complete",
  "CMA Viewed": "Cardholder agreement viewed",
  "CMA Accepted": "Cardholder agreement accepted",
  "Tutorial Complete": "Tutorial complete",
  "Delivery Address": "Delivery Address Entered",
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
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  // Fetch real acquisition data from BigQuery
  const { data: apiData } = useSWR(
    `/api/acquisition?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const funnelIsLive = !!apiData?.funnel?.length;

  // Use real funnel data
  const periodFunnel = useMemo(() => {
    if (!apiData?.funnel?.length) return null;
    return apiData.funnel.map((s: { stage: string; label: string; count: number; conversion_from_prev_pct: number | null }) => ({
      stage: s.label,
      count: s.count,
      rate: s.conversion_from_prev_pct,
    }));
  }, [apiData]);

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
    { text: "RP1 accounts represent 21.43% of the mix — a healthy entry-level segment that can be upsold to full credit over time.", type: "neutral" },
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
      <ActiveFiltersBanner />

      {/* KPI row — requires real data */}
      <SampleDataBanner
        dataset="refined_rudderstack + mart_finexus"
        reason="Decision and product mix data requires decision_completed and financial_account_updates"
      />

      {/* Funnel visualization */}
      {!periodFunnel ? (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="Acquisition funnel requires milestone_complete and decision_completed tables"
        />
      ) : (
      <ChartCard
        title="Application Funnel"
        subtitle="Conversion rates between stages"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
        liveData={funnelIsLive}
      >
        <div className="space-y-0.5 relative">
          {(() => {
            // Use max count across all stages as the 100% reference
            const maxCount = Math.max(...periodFunnel.map((s: { count: number }) => s.count));
            return periodFunnel.map((stage: { stage: string; count: number; rate: number | null }, i: number) => {
              const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
              const convColor =
                stage.rate === null
                  ? ""
                  : stage.rate >= 90
                    ? "text-emerald-400"
                    : stage.rate >= 75
                      ? "text-blue-400"
                      : "text-red-400";
              // Gradient intensity decreases down the funnel
              const opacity = 0.9 - (i / periodFunnel.length) * 0.4;

              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <span className="w-36 text-xs text-[var(--text-secondary)] text-right shrink-0">
                    {stage.stage}
                  </span>
                  <div className="flex-1 h-7 relative flex justify-center">
                    {/* Centered funnel bar */}
                    <div
                      className="h-full rounded flex items-center justify-center px-2 cursor-context-menu"
                      style={{
                        width: `${widthPct}%`,
                        background: `linear-gradient(90deg, rgba(99,102,241,${opacity}) 0%, rgba(139,92,246,${opacity * 0.7}) 100%)`,
                      }}
                      onContextMenu={(e) => handleBarContextMenu(e, stage.stage, i, false)}
                    >
                      <span className="text-xs font-semibold text-white whitespace-nowrap drop-shadow-sm">
                        {stage.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {stage.rate !== null ? (
                    <span className={`w-14 text-xs font-medium text-right shrink-0 ${convColor}`}>
                      {stage.rate.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="w-14 shrink-0" />
                  )}
                </div>
              );
            });
          })()}

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
                    const prevStage = periodFunnel[ctxMenu.stageIndex - 1]?.stage ?? "";
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
      )}

      {/* Charts row — Decision, Product Mix, Approval Rate, Credit Limit, Vintage */}
      <SampleDataBanner
        dataset="refined_rudderstack + mart_finexus"
        reason="Decision and product mix data requires decision_completed and financial_account_updates"
      />

      {/* === SAMPLE DATA SECTIONS: Metrics from Orico spreadsheets not yet automated === */}

      {/* CAC Metrics — blocked by mart_finance + Ad Platform APIs */}
      <SampleDataBanner
        dataset="mart_finance + Ad Platform APIs"
        reason="CAC and marketing cost data requires access to mart_finance and Google/Meta/TikTok ad APIs"
      />

      {/* Organic Traffic — blocked by Mixpanel */}
      <SampleDataBanner
        dataset="Mixpanel"
        reason="Traffic source attribution requires Mixpanel integration"
      />

      {/* First or Second Credit Card — blocked by Credit Bureau */}
      <SampleDataBanner
        dataset="Credit Bureau"
        reason="Credit history data requires bureau API integration"
      />

      {/* Action items */}
      <ActionItems section="Acquisition" items={actionItems} />
    </div>
  );
}
