"use client";

import { useCallback, useMemo } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { getPeriodRange, getPeriodInsightLabels, scaleTrendData, scaleMetricValue } from "@/lib/period-data";

const AS_OF = "Mar 15, 2026";

// Mock data
const contactRateTrend = [
  { date: "Oct", rate: 82.1 },
  { date: "Nov", rate: 83.5 },
  { date: "Dec", rate: 80.2 },
  { date: "Jan", rate: 85.0 },
  { date: "Feb", rate: 86.3 },
  { date: "Mar", rate: 87.1 },
];

const ptpRateTrend = [
  { date: "Oct", rate: 45.2 },
  { date: "Nov", rate: 46.8 },
  { date: "Dec", rate: 43.5 },
  { date: "Jan", rate: 48.1 },
  { date: "Feb", rate: 49.5 },
  { date: "Mar", rate: 50.2 },
];

const cureRateTrend = [
  { date: "Oct", rate: 58.5 },
  { date: "Nov", rate: 56.0 },
  { date: "Dec", rate: 55.6 },
  { date: "Jan", rate: 57.1 },
  { date: "Feb", rate: 58.7 },
  { date: "Mar", rate: 62.9 },
];

const recoveryAmounts = [
  { date: "Oct", amount: 2800000000 },
  { date: "Nov", amount: 3100000000 },
  { date: "Dec", amount: 2900000000 },
  { date: "Jan", amount: 3300000000 },
  { date: "Feb", amount: 3500000000 },
  { date: "Mar", amount: 3800000000 },
];

const agentPerformance = [
  { agent: "Agent A", contacted: 320, ptp: 160, cured: 105, cureRate: 65.6 },
  { agent: "Agent B", contacted: 290, ptp: 140, cured: 88, cureRate: 62.9 },
  { agent: "Agent C", contacted: 310, ptp: 155, cured: 95, cureRate: 61.3 },
  { agent: "Agent D", contacted: 275, ptp: 125, cured: 72, cureRate: 57.6 },
  { agent: "Agent E", contacted: 260, ptp: 118, cured: 65, cureRate: 55.1 },
];

// Sample data — Collection Cost Efficiency (blocked by mart_finance)
const collectionCostTrend = [
  { date: "Oct", costPerAttempt: 12500, costPerRecovery: 185000, ratio: 6.6 },
  { date: "Nov", costPerAttempt: 12200, costPerRecovery: 178000, ratio: 5.7 },
  { date: "Dec", costPerAttempt: 13100, costPerRecovery: 195000, ratio: 6.7 },
  { date: "Jan", costPerAttempt: 11800, costPerRecovery: 170000, ratio: 5.2 },
  { date: "Feb", costPerAttempt: 11500, costPerRecovery: 162000, ratio: 4.6 },
  { date: "Mar", costPerAttempt: 11200, costPerRecovery: 155000, ratio: 4.1 },
];

// Sample data — Write-Off & Recovery (blocked by mart_finance)
const writeOffTrend = [
  { date: "Oct", writeOff: 942000000, recoveryRate: 8.2 },
  { date: "Nov", writeOff: 948000000, recoveryRate: 8.5 },
  { date: "Dec", writeOff: 958000000, recoveryRate: 7.9 },
  { date: "Jan", writeOff: 951000000, recoveryRate: 9.1 },
  { date: "Feb", writeOff: 945000000, recoveryRate: 9.8 },
  { date: "Mar", writeOff: 940000000, recoveryRate: 10.3 },
];

export default function CollectionsPage() {
  const { period, periodLabel } = usePeriod();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const pContactRate = useMemo(() => scaleTrendData(contactRateTrend, period), [period]);
  const pPtpRate = useMemo(() => scaleTrendData(ptpRateTrend, period), [period]);
  const pCureRate = useMemo(() => scaleTrendData(cureRateTrend, period), [period]);
  const pRecoveryAmounts = useMemo(() => scaleTrendData(recoveryAmounts, period), [period]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const contactRateInsights: ChartInsight[] = useMemo(() => [
    { text: `Contact rate up 5pp from Dec low of 80.2% to 87.1%, driven by improved dialer scheduling and updated phone numbers.`, type: "positive" },
    { text: `Still 2.9pp below the 90% target — remaining gap likely from inactive numbers in older vintage accounts.`, type: "negative" },
    { text: `${p.changeFull} improvement has been consistent at ~1pp since Jan, suggesting sustainable process gains.`, type: "neutral" },
    { text: `Integrating WhatsApp as a secondary contact channel could close the remaining gap to 90%.`, type: "hypothesis" },
  ], [p]);

  const ptpRateInsights: ChartInsight[] = useMemo(() => [
    { text: `PTP rate recovered from 43.5% Dec trough to 50.2% in ${p.lastLabel}, a 6.7pp improvement over ${p.span}.`, type: "positive" },
    { text: `Still 4.8pp short of the 55% target — conversion bottleneck persists at the commitment stage.`, type: "negative" },
    { text: `PTP-to-cure conversion sits at ~62%, meaning 38% of promises are broken before payment clears.`, type: "neutral" },
    { text: `Revised scripts with specific payment date anchoring and smaller instalment options may lift PTP above 55%.`, type: "hypothesis" },
  ], [p]);

  const cureRateInsights: ChartInsight[] = useMemo(() => [
    { text: `Cure rate hit 62.9% in ${p.lastLabel}, the highest in the ${p.span} window — up 7.3pp from the Dec low of 55.6%.`, type: "positive" },
    { text: `Dec-Jan dip coincided with holiday season spending; recovery since suggests collections strategy adjustments are working.`, type: "neutral" },
    { text: `Gap to 65% target narrowed to 2.1pp — on current trajectory, target could be reached by May.`, type: "neutral" },
    { text: `Early-bucket intervention (Bucket 1 outreach within 3 days of delinquency) may be the single largest driver of the recent uplift.`, type: "hypothesis" },
  ], [p]);

  const recoveryInsights: ChartInsight[] = useMemo(() => [
    { text: `Recovery volume grew 35.7% from IDR 2.8B in ${p.firstLabel} to IDR 3.8B in ${p.lastLabel}, outpacing delinquent portfolio growth.`, type: "positive" },
    { text: `${p.lastLabel} collections represent the highest single-month recovery in the ${p.trailingWindow}.`, type: "positive" },
    { text: `Recovery efficiency (collected / total delinquent balance) improving, but absolute delinquent balance is also rising.`, type: "neutral" },
    { text: `Scaling the top-performing agent playbook across the team could push monthly recoveries above IDR 4B.`, type: "hypothesis" },
  ], [p]);

  const agentPerformanceInsights: ChartInsight[] = useMemo(() => [
    { text: `Agent A leads with a 65.6% cure rate — 10.5pp above the weakest performer (Agent E at 55.1%).`, type: "positive" },
    { text: `Agents D and E both fall below 60% cure rate, creating a measurable drag on overall team performance.`, type: "negative" },
    { text: `Top 3 agents average 63.27% cure rate vs bottom 2 at 56.35% — a 6.92pp gap that represents ~30 additional cures per month if closed.`, type: "neutral" },
    { text: `Call recording analysis of Agent A's approach (empathy-first opening, specific payment date ask) could form the basis of a coaching playbook.`, type: "hypothesis" },
    { text: `Volume allocation is relatively even (260-320 contacts), so cure rate differences reflect skill, not workload imbalance.`, type: "neutral" },
  ], [p]);

  const collectionCostInsights: ChartInsight[] = useMemo(() => [
    { text: `Cost per recovery dropped from IDR 195K in Dec to IDR 155K in ${p.lastLabel}, a 20.5% efficiency gain as cure rates improved.`, type: "positive" },
    { text: `Cost per attempt declined modestly from IDR 13.1K to IDR 11.2K, reflecting better dialer utilization and fewer wasted calls.`, type: "positive" },
    { text: `Collection cost-to-recovery ratio improved from 6.7% to 4.1%, meaning each rupiah spent on collections now yields more recovered revenue.`, type: "positive" },
    { text: `Dec spike in cost per recovery correlates with holiday-season delinquency surge, when harder-to-cure accounts dominate the queue.`, type: "hypothesis" },
  ], [p]);

  const writeOffInsights: ChartInsight[] = useMemo(() => [
    { text: `Net write-offs remained in a narrow IDR 940M–958M band, indicating stable credit loss levels without material deterioration.`, type: "neutral" },
    { text: `Recovery rate on written-off accounts climbed from 7.9% to 10.3% over four months, adding ~IDR 22M incremental monthly recovery.`, type: "positive" },
    { text: `Dec peak write-off of IDR 958M aligns with holiday vintage delinquency flowing through the 180-day charge-off cycle.`, type: "neutral" },
    { text: `If recovery rate sustains above 10%, outsourced collection agency costs may become NPV-positive for accounts previously deemed unrecoverable.`, type: "hypothesis" },
  ], [p]);

  const actionItems: ActionItem[] = useMemo(() => [
    {
      id: "coll-1",
      priority: "positive" as const,
      action: `Cure rate improved to 62.9%, highest in ${p.span}.`,
      detail: `Contact rate also trending up to 87.1%. Recovery amounts growing ${p.changeAbbrev}.`,
    },
    {
      id: "coll-2",
      priority: "monitor" as const,
      action: "Promise-to-pay conversion still below 55%.",
      detail: "Consider revising scripts or offering structured payment plans for higher PTP conversion.",
    },
    {
      id: "coll-3",
      priority: "urgent" as const,
      action: "Agent D and E cure rates below 60%.",
      detail: "Performance gap vs top agents suggests coaching opportunity. Review call recordings and approach.",
    },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Collections Deep Dive</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="coll_contact_rate"
          label="Contact Rate"
          value={scaleMetricValue(87.1, period, true)}
          prevValue={scaleMetricValue(86.3, period, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pContactRate.map((d: Record<string, unknown>) => d.rate as number)}
          target={90}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="coll_ptp_rate"
          label="Promise-to-Pay Rate"
          value={scaleMetricValue(50.2, period, true)}
          prevValue={scaleMetricValue(49.5, period, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={55}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="coll_cure_rate"
          label="Cure Rate"
          value={scaleMetricValue(62.9, period, true)}
          prevValue={scaleMetricValue(58.7, period, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pCureRate.map((d: Record<string, unknown>) => d.rate as number)}
          target={65}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="coll_recovery"
          label="Recovery Amount"
          value={scaleMetricValue(3800000000, period, false)}
          prevValue={scaleMetricValue(3500000000, period, false)}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard
          title="Contact Rate Trend"
          subtitle="% of delinquent accounts contacted"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pContactRate}
            lines={[{ key: "rate", color: "#3b82f6", label: "Contact Rate %" }]}
            valueType="percent"
            height={240}
          />
          <ChartInsights insights={contactRateInsights} />
        </ChartCard>

        <ChartCard
          title="PTP Rate Trend"
          subtitle="% that commit to paying"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pPtpRate}
            lines={[{ key: "rate", color: "#f59e0b", label: "PTP Rate %" }]}
            valueType="percent"
            height={240}
          />
          <ChartInsights insights={ptpRateInsights} />
        </ChartCard>

        <ChartCard
          title="Cure Rate Trend"
          subtitle="% returning to current after collections"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pCureRate}
            lines={[{ key: "rate", color: "#22c55e", label: "Cure Rate %" }]}
            valueType="percent"
            height={240}
          />
          <ChartInsights insights={cureRateInsights} />
        </ChartCard>
      </div>

      {/* Recovery amounts */}
      <ChartCard
        title="Recovery Amounts"
        subtitle="Total collected from delinquent accounts"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={pRecoveryAmounts}
          bars={[{ key: "amount", color: "#22c55e", label: "Recovery Amount" }]}
          height={280}
        />
        <ChartInsights insights={recoveryInsights} />
      </ChartCard>

      {/* Agent performance table */}
      <ChartCard
        title="Agent Performance"
        subtitle="From Freshworks data (placeholder)"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Agent</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Contacted</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">PTP</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Cured</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Cure Rate</th>
              </tr>
            </thead>
            <tbody>
              {agentPerformance.map((row) => (
                <tr key={row.agent} className="border-b border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--text-primary)]">{row.agent}</td>
                  <td className="py-2 px-3 text-[var(--text-primary)] text-right">{row.contacted}</td>
                  <td className="py-2 px-3 text-[var(--text-primary)] text-right">{row.ptp}</td>
                  <td className="py-2 px-3 text-[var(--text-primary)] text-right">{row.cured}</td>
                  <td className={`py-2 px-3 text-right font-medium ${row.cureRate >= 60 ? "text-emerald-400" : "text-amber-400"}`}>
                    {row.cureRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ChartInsights insights={agentPerformanceInsights} />
      </ChartCard>

      {/* Collection Cost Efficiency — blocked by mart_finance */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Collection cost and efficiency metrics require mart_finance access"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Cost per Collection Attempt & Recovery"
            subtitle="IDR cost per attempt and per successful recovery"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={collectionCostTrend}
              lines={[
                { key: "costPerAttempt", color: "#f59e0b", label: "Cost/Attempt (IDR)" },
                { key: "costPerRecovery", color: "#ef4444", label: "Cost/Recovery (IDR)" },
              ]}
              height={280}
            />
          </ChartCard>
          <ChartCard
            title="Collection Cost vs Recovery Ratio"
            subtitle="Collection cost as % of amount recovered"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={collectionCostTrend}
              lines={[{ key: "ratio", color: "#8b5cf6", label: "Cost/Recovery Ratio %" }]}
              valueType="percent"
              height={280}
            />
          </ChartCard>
        </div>
        <ChartInsights insights={collectionCostInsights} />
      </SampleDataBanner>

      {/* Write-Off & Recovery — blocked by mart_finance */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Write-off and recovery financial data requires mart_finance access"
      >
        <ChartCard
          title="Net Write-Off & Recovery Rate"
          subtitle="Monthly write-off amounts (~IDR 942M–958M) and recovery rate on written-off accounts"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={writeOffTrend}
            bars={[{ key: "writeOff", color: "#ef4444", label: "Write-Off (IDR)" }]}
            height={280}
          />
          <DashboardLineChart
            data={writeOffTrend}
            lines={[{ key: "recoveryRate", color: "#22c55e", label: "Recovery Rate %" }]}
            valueType="percent"
            height={240}
          />
          <ChartInsights insights={writeOffInsights} />
        </ChartCard>
      </SampleDataBanner>

      <ActionItems section="Collections" items={actionItems} />
    </div>
  );
}
