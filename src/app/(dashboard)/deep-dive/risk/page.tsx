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
import { useFilters } from "@/hooks/use-filters";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, getPeriodInsightLabels, scaleTrendData, scaleMetricValue } from "@/lib/period-data";

const AS_OF = "Mar 15, 2026";

// Mock data
const dpdDistribution = [
  { date: "Oct", current: 17500, dpd1_30: 1200, dpd31_60: 450, dpd61_90: 180, dpd90plus: 120 },
  { date: "Nov", current: 18100, dpd1_30: 1250, dpd31_60: 470, dpd61_90: 190, dpd90plus: 130 },
  { date: "Dec", current: 18900, dpd1_30: 1350, dpd31_60: 500, dpd61_90: 200, dpd90plus: 140 },
  { date: "Jan", current: 19500, dpd1_30: 1400, dpd31_60: 520, dpd61_90: 210, dpd90plus: 150 },
  { date: "Feb", current: 20100, dpd1_30: 1380, dpd31_60: 510, dpd61_90: 205, dpd90plus: 155 },
  { date: "Mar", current: 20800, dpd1_30: 1320, dpd31_60: 490, dpd61_90: 195, dpd90plus: 160 },
];

const delinquencyRate = [
  { date: "Oct", rate30plus: 4.8, rate60plus: 1.5, rate90plus: 0.6 },
  { date: "Nov", rate30plus: 4.9, rate60plus: 1.6, rate90plus: 0.6 },
  { date: "Dec", rate30plus: 5.2, rate60plus: 1.7, rate90plus: 0.7 },
  { date: "Jan", rate30plus: 5.1, rate60plus: 1.6, rate90plus: 0.7 },
  { date: "Feb", rate30plus: 4.9, rate60plus: 1.5, rate90plus: 0.7 },
  { date: "Mar", rate30plus: 4.7, rate60plus: 1.4, rate90plus: 0.7 },
];

const flowRates = [
  { from: "Current", to_1_30: 1320, stayed: 20800 },
  { from: "1-30 DPD", to_31_60: 490, cured: 830, stayed: 0 },
  { from: "31-60 DPD", to_61_90: 195, cured: 295, stayed: 0 },
  { from: "61-90 DPD", to_90plus: 160, cured: 35, stayed: 0 },
];

const collectionsEffectiveness = [
  { date: "Oct", contacted: 1200, cured: 720 },
  { date: "Nov", contacted: 1250, cured: 700 },
  { date: "Dec", contacted: 1350, cured: 750 },
  { date: "Jan", contacted: 1400, cured: 800 },
  { date: "Feb", contacted: 1380, cured: 810 },
  { date: "Mar", contacted: 1320, cured: 830 },
];

const writeOffTrend = [
  { date: "Oct", amount: 850000000 },
  { date: "Nov", amount: 920000000 },
  { date: "Dec", amount: 980000000 },
  { date: "Jan", amount: 1050000000 },
  { date: "Feb", amount: 1020000000 },
  { date: "Mar", amount: 990000000 },
];

// --- Sample data: Risk Cost Financial Impact (blocked by mart_finance) ---
const riskCostTrend = [
  { date: "Oct", riskCostHFT: 1420, netWriteOff: 942, provisionExpense: 486 },
  { date: "Nov", riskCostHFT: 1510, netWriteOff: 948, provisionExpense: 562 },
  { date: "Dec", riskCostHFT: 1680, netWriteOff: 955, provisionExpense: 725 },
  { date: "Jan", riskCostHFT: 1890, netWriteOff: 958, provisionExpense: 906 },
  { date: "Feb", riskCostHFT: 1760, netWriteOff: 951, provisionExpense: 809 },
  { date: "Mar", riskCostHFT: 1640, netWriteOff: 945, provisionExpense: 695 },
];

// --- Sample data: Balance Sheet DPD Buckets with $ Values (blocked by mart_finance) ---
const dpdBalanceExposure = [
  { bucket: "Current", balance: 30900, pctOfTotal: 83.2, flowRate: null },
  { bucket: "DPD 1-30", balance: 1580, pctOfTotal: 4.3, flowRate: 5.1 },
  { bucket: "DPD 31-60", balance: 1540, pctOfTotal: 4.1, flowRate: 37.1 },
  { bucket: "DPD 61-90", balance: 1230, pctOfTotal: 3.3, flowRate: 39.9 },
  { bucket: "DPD 91-120", balance: 890, pctOfTotal: 2.4, flowRate: 43.2 },
  { bucket: "DPD 121-150", balance: 620, pctOfTotal: 1.7, flowRate: 52.8 },
  { bucket: "DPD 151-180", balance: 380, pctOfTotal: 1.0, flowRate: 61.3 },
];

const dpdBalanceTrend = [
  { date: "Oct", current: 28200, dpd1_30: 1420, dpd31_60: 1380, dpd61_90: 1100, dpd91Plus: 1650 },
  { date: "Nov", current: 29100, dpd1_30: 1460, dpd31_60: 1410, dpd61_90: 1140, dpd91Plus: 1720 },
  { date: "Dec", current: 29800, dpd1_30: 1520, dpd31_60: 1480, dpd61_90: 1190, dpd91Plus: 1810 },
  { date: "Jan", current: 30200, dpd1_30: 1560, dpd31_60: 1530, dpd61_90: 1220, dpd91Plus: 1870 },
  { date: "Feb", current: 30500, dpd1_30: 1570, dpd31_60: 1540, dpd61_90: 1230, dpd91Plus: 1890 },
  { date: "Mar", current: 30900, dpd1_30: 1580, dpd31_60: 1540, dpd61_90: 1230, dpd91Plus: 1890 },
];

const actionItems: ActionItem[] = [
  {
    id: "risk-1",
    priority: "positive",
    action: "30+ DPD rate declining to 4.7%.",
    detail: "Down from 5.2% peak in Dec. Collections effectiveness improving with cure rate at 62.9%.",
  },
  {
    id: "risk-2",
    priority: "urgent",
    action: "90+ DPD accounts still growing at 0.7%.",
    detail: "Flow rate from 61-90 to 90+ needs attention. Consider accelerated recovery strategies for this bucket.",
  },
  {
    id: "risk-3",
    priority: "monitor",
    action: "Write-off amounts plateauing near Rp 1B/month.",
    detail: "Monitor vintage performance to identify if specific cohorts are driving losses disproportionately.",
  },
];

export default function RiskPage() {
  const { period, periodLabel } = usePeriod();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const pDpdDistribution = useMemo(() => applyFilterToData(scaleTrendData(dpdDistribution, period), filters), [period, filters]);
  const pDelinquencyRate = useMemo(() => applyFilterToData(scaleTrendData(delinquencyRate, period), filters), [period, filters]);
  const pCollectionsEffectiveness = useMemo(() => applyFilterToData(scaleTrendData(collectionsEffectiveness, period), filters), [period, filters]);
  const pWriteOffTrend = useMemo(() => applyFilterToData(scaleTrendData(writeOffTrend, period), filters), [period, filters]);
  const pRiskCostTrend = useMemo(() => applyFilterToData(scaleTrendData(riskCostTrend, period), filters), [period, filters]);
  const pDpdBalanceTrend = useMemo(() => applyFilterToData(scaleTrendData(dpdBalanceTrend, period), filters), [period, filters]);

  const dpdDistributionInsights: ChartInsight[] = useMemo(() => [
    { text: `Current accounts grew 18.86% (17,500 to 20,800) over ${p.span}, outpacing delinquent bucket growth.`, type: "positive" },
    { text: `1-30 DPD bucket peaked at 1,400 then declined to 1,320 — early-stage delinquency is contracting.`, type: "positive" },
    { text: `90+ DPD continues to grow each ${p.unit} (120 to 160), indicating persistent roll-forward from older buckets.`, type: "negative" },
    { text: `Delinquent accounts as a share of total fell from 10.01% (${p.firstLabel}) to 9.42% (${p.lastLabel}) — portfolio quality improving.`, type: "neutral" },
    { text: `Seasonal hiring recovery may be supporting repayment capacity across lower-income segments.`, type: "hypothesis" },
  ], [p]);

  const delinquencyRateInsights: ChartInsight[] = useMemo(() => [
    { text: `30+ DPD rate declined from 5.2% peak to 4.7% in ${p.lastLabel} — strongest improvement across thresholds.`, type: "positive" },
    { text: `60+ DPD rate improved from 1.7% to 1.4%, converging toward the 90+ rate.`, type: "positive" },
    { text: `90+ DPD rate remains flat at 0.7% for three consecutive ${p.unit}s — accounts entering this bucket are not being resolved.`, type: "negative" },
    { text: `Gap between 30+ and 60+ narrowed from 3.3pp to 3.3pp — roll rates between early and mid-stage are stable.`, type: "neutral" },
    { text: `Tightened underwriting criteria introduced previously may be contributing to the improving early-stage rates.`, type: "hypothesis" },
  ], [p]);

  const collectionsInsights: ChartInsight[] = useMemo(() => [
    { text: `Cure rate improved from 60% (${p.firstLabel}) to 62.88% (${p.lastLabel}) — collections team is converting contacts more effectively.`, type: "positive" },
    { text: `Contacted volume dropped 5.71% ${p.changeAbbrev} from peak (1,400 to 1,320) as fewer accounts enter early delinquency.`, type: "positive" },
    { text: `Gap between contacted and cured narrowed from 480 to 490 — marginal improvement but the uncured tail persists.`, type: "negative" },
    { text: `${p.lastLabel} cured volume (830) is the highest on record, suggesting improved scripting or channel mix is working.`, type: "neutral" },
    { text: `Rising digital collections adoption in Indonesia's fintech sector may be boosting contact-to-cure conversion.`, type: "hypothesis" },
  ], [p]);

  const flowRateInsights: ChartInsight[] = useMemo(() => [
    { text: `1-30 DPD cure rate is 62.88% (830 of 1,320) — the most effective intervention point in the portfolio.`, type: "positive" },
    { text: `31-60 DPD cure rate drops to 60.2% (295 of 490) — still reasonable but shows diminishing recovery leverage.`, type: "neutral" },
    { text: `61-90 DPD cure rate collapses to 17.95% (35 of 195) — accounts reaching this stage are very likely to write off.`, type: "negative" },
    { text: `Roll rate from Current to 1-30 DPD is 5.97% (1,320 of 22,120 total) — entry into delinquency remains contained.`, type: "neutral" },
    { text: `Macro headwinds from rising consumer leverage ratios may widen the 61-90 to 90+ funnel in coming ${p.unit}s.`, type: "hypothesis" },
  ], [p]);

  const writeOffInsights: ChartInsight[] = useMemo(() => [
    { text: `Write-offs declined 5.71% ${p.changeAbbrev} from Rp 1.05B to Rp 990M (${p.lastLabel}) — first consecutive two-${p.unit} decline.`, type: "positive" },
    { text: `Cumulative write-offs over ${p.span} total Rp 5.81B, with the ${p.firstLabel}-Dec trajectory steeper than Jan-${p.lastLabel}.`, type: "neutral" },
    { text: `Despite improving delinquency rates, write-offs remain near Rp 1B/${p.unit} due to legacy 90+ DPD accounts aging out.`, type: "negative" },
    { text: `Near-term write-offs expected to stabilize as the shrinking 61-90 pipeline feeds fewer accounts into loss.`, type: "neutral" },
    { text: `Indonesia's anticipated minimum wage increase in mid-2026 could further support repayment and reduce loss severity.`, type: "hypothesis" },
  ], [p]);

  const riskCostInsights: ChartInsight[] = useMemo(() => [
    { text: `Risk Cost (HFT) peaked at $1.89M then declined 13.2% to $1.64M in ${p.lastLabel} — provisioning pressure easing.`, type: "positive" },
    { text: `Net write-offs remain highly stable ($942K-$958K range) — loss realization is predictable and well-controlled.`, type: "neutral" },
    { text: `Provision expense surged 86.4% from ${p.firstLabel} ($486K) to peak ($906K) before moderating — likely driven by IFRS 9 stage migration.`, type: "negative" },
    { text: `Risk cost as a share of outstanding balances likely declined given portfolio growth outpacing loss growth.`, type: "hypothesis" },
  ], [p]);

  const dpdBalanceInsights: ChartInsight[] = useMemo(() => [
    { text: `Current bucket holds 83.2% of total exposure ($30.9M) — portfolio remains overwhelmingly performing.`, type: "positive" },
    { text: `DPD 1-30 and 31-60 carry nearly equal balances ($1.58M vs $1.54M) — early-stage delinquency is not accelerating.`, type: "neutral" },
    { text: `Flow rates escalate sharply beyond 90 DPD (43.2% at 91-120 to 61.3% at 151-180) — recovery interventions lose effectiveness past 90 days.`, type: "negative" },
    { text: `Total exposure in DPD 91+ buckets is $1.89M (5.1% of book) — concentrated loss tail that drives write-off volume.`, type: "negative" },
    { text: `Slower portfolio growth may compress current-bucket share if new originations taper while delinquent balances persist.`, type: "hypothesis" },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Risk Deep Dive</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="risk_dpd30plus_rate"
          label="30+ DPD Rate"
          value={applyFilterToMetric(scaleMetricValue(4.7, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(4.9, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          sparklineData={pDelinquencyRate.map((d) => d.rate30plus)}
          target={4.0}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="risk_dpd90plus_rate"
          label="90+ DPD Rate"
          value={applyFilterToMetric(scaleMetricValue(0.7, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(0.7, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="risk_exposure_at_risk"
          label="Exposure at Risk (30+ DPD)"
          value={applyFilterToMetric(scaleMetricValue(28500000000, period, false), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(29200000000, period, false), filters, false)}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="risk_writeoff"
          label="Write-offs (Period)"
          value={applyFilterToMetric(scaleMetricValue(990000000, period, false), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(1020000000, period, false), filters, false)}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
      </div>

      {/* DPD Distribution */}
      <ChartCard
        title="DPD Distribution"
        subtitle="Accounts by aging bucket over time"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={pDpdDistribution}
          bars={[
            { key: "current", color: "#22c55e", label: "Current" },
            { key: "dpd1_30", color: "#f59e0b", label: "1-30 DPD" },
            { key: "dpd31_60", color: "#f97316", label: "31-60 DPD" },
            { key: "dpd61_90", color: "#ef4444", label: "61-90 DPD" },
            { key: "dpd90plus", color: "#991b1b", label: "90+ DPD" },
          ]}
          stacked
          height={320}
        />
        <ChartInsights insights={dpdDistributionInsights} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Delinquency Rate Trend */}
        <ChartCard
          title="Delinquency Rate Trend"
          subtitle="% of accounts by DPD threshold"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pDelinquencyRate}
            lines={[
              { key: "rate30plus", color: "#f59e0b", label: "30+ DPD %" },
              { key: "rate60plus", color: "#ef4444", label: "60+ DPD %" },
              { key: "rate90plus", color: "#991b1b", label: "90+ DPD %" },
            ]}
            valueType="percent"
            height={280}
          />
          <ChartInsights insights={delinquencyRateInsights} />
        </ChartCard>

        {/* Collections Effectiveness */}
        <ChartCard
          title="Collections Effectiveness"
          subtitle="Contacted vs Cured accounts"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={pCollectionsEffectiveness}
            bars={[
              { key: "contacted", color: "#475569", label: "Contacted" },
              { key: "cured", color: "#22c55e", label: "Cured" },
            ]}
            height={280}
          />
          <ChartInsights insights={collectionsInsights} />
        </ChartCard>
      </div>

      {/* Flow rates table */}
      <ChartCard
        title="DPD Flow Rates"
        subtitle="Account movement between DPD buckets (this period)"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">From Bucket</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Rolled Forward</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Cured</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Stayed</th>
              </tr>
            </thead>
            <tbody>
              {flowRates.map((row) => (
                <tr key={row.from} className="border-b border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--text-primary)]">{row.from}</td>
                  <td className="py-2 px-3 text-[var(--danger,#FF6B6B)] text-right font-medium">
                    {(row.from === "Current" ? row.to_1_30 : row.from === "1-30 DPD" ? row.to_31_60 : row.from === "31-60 DPD" ? row.to_61_90 : row.to_90plus)?.toLocaleString() ?? "-"}
                  </td>
                  <td className="py-2 px-3 text-[var(--success,#06D6A0)] text-right font-medium">
                    {row.cured?.toLocaleString() ?? "-"}
                  </td>
                  <td className="py-2 px-3 text-[var(--text-primary)] text-right">
                    {row.stayed > 0 ? row.stayed.toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ChartInsights insights={flowRateInsights} />
      </ChartCard>

      {/* Write-off Trend */}
      <ChartCard
        title="Write-off Trend"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={pWriteOffTrend}
          lines={[{ key: "amount", color: "#ef4444", label: "Write-off Amount" }]}
          valueType="currency"
          height={260}
        />
        <ChartInsights insights={writeOffInsights} />
      </ChartCard>

      {/* Risk Cost Financial Impact — blocked by mart_finance */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Risk cost, write-off, and provision expense data requires access to mart_finance dataset"
      >
        <ChartCard
          title="Risk Cost Financial Impact"
          subtitle="Monthly risk cost (HFT), net write-off, and provision expense (USD thousands)"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pRiskCostTrend}
            lines={[
              { key: "riskCostHFT", color: "#ef4444", label: "Risk Cost (HFT)" },
              { key: "netWriteOff", color: "#f97316", label: "Net Write-Off" },
              { key: "provisionExpense", color: "#8b5cf6", label: "Provision Expense" },
            ]}
            valueType="currency"
            height={300}
          />
          <ChartInsights insights={riskCostInsights} />
        </ChartCard>
      </SampleDataBanner>

      {/* Balance Sheet DPD Buckets with $ Values — blocked by mart_finance */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="DPD balance exposure and financial flow rates require mart_finance access"
      >
        <div className="space-y-4">
          {/* DPD Balance Trend */}
          <ChartCard
            title="Balance Sheet DPD Exposure"
            subtitle="Outstanding balances by DPD bucket over time (USD thousands)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardBarChart
              data={pDpdBalanceTrend}
              bars={[
                { key: "current", color: "#22c55e", label: "Current" },
                { key: "dpd1_30", color: "#f59e0b", label: "DPD 1-30" },
                { key: "dpd31_60", color: "#f97316", label: "DPD 31-60" },
                { key: "dpd61_90", color: "#ef4444", label: "DPD 61-90" },
                { key: "dpd91Plus", color: "#991b1b", label: "DPD 91+" },
              ]}
              stacked
              height={320}
            />
          </ChartCard>

          {/* DPD Balance Exposure Table with Flow Rates */}
          <ChartCard
            title="DPD Balance Exposure & Flow Rates"
            subtitle="Current period balance by bucket with roll-forward rates"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">DPD Bucket</th>
                    <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Balance (USD K)</th>
                    <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">% of Total</th>
                    <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Flow Rate %</th>
                  </tr>
                </thead>
                <tbody>
                  {dpdBalanceExposure.map((row) => (
                    <tr key={row.bucket} className="border-b border-[var(--border)]">
                      <td className="py-2 px-3 text-[var(--text-primary)] font-medium">{row.bucket}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                        ${row.balance.toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                        {row.pctOfTotal.toFixed(1)}%
                      </td>
                      <td className={`py-2 px-3 text-right font-medium ${
                        row.flowRate === null
                          ? "text-[var(--text-secondary)]"
                          : row.flowRate > 50
                            ? "text-[var(--danger,#FF6B6B)]"
                            : row.flowRate > 35
                              ? "text-amber-500"
                              : "text-[var(--text-primary)]"
                      }`}>
                        {row.flowRate !== null ? `${row.flowRate.toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[var(--border)]">
                    <td className="py-2 px-3 text-[var(--text-primary)] font-bold">Total</td>
                    <td className="py-2 px-3 text-right text-[var(--text-primary)] font-bold">
                      ${dpdBalanceExposure.reduce((sum, r) => sum + r.balance, 0).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-right text-[var(--text-secondary)] font-bold">100.0%</td>
                    <td className="py-2 px-3 text-right text-[var(--text-secondary)]">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <ChartInsights insights={dpdBalanceInsights} />
          </ChartCard>
        </div>
      </SampleDataBanner>

      <ActionItems section="Risk" items={actionItems} />
    </div>
  );
}
