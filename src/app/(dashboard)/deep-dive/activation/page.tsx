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
// DATA_RANGE is now computed inside the component via useMemo

// Mock data
const activationRateTrend = [
  { date: "Oct", rate: 58.2 },
  { date: "Nov", rate: 60.5 },
  { date: "Dec", rate: 62.1 },
  { date: "Jan", rate: 59.8 },
  { date: "Feb", rate: 63.4 },
  { date: "Mar", rate: 65.2 },
];

const avgDaysToFirstTxn = [
  { date: "Oct", days: 5.8 },
  { date: "Nov", days: 5.5 },
  { date: "Dec", days: 4.9 },
  { date: "Jan", days: 5.2 },
  { date: "Feb", days: 4.8 },
  { date: "Mar", days: 4.5 },
];

const dormancy = [
  { bucket: "No txn 7d", percent: 22.5 },
  { bucket: "No txn 14d", percent: 18.3 },
  { bucket: "No txn 30d", percent: 14.1 },
  { bucket: "No txn 60d", percent: 9.8 },
  { bucket: "No txn 90d", percent: 6.2 },
];

const activationByProduct = [
  { product: "Standard CC", activated: 2100, total: 2800 },
  { product: "Prepaid", activated: 620, total: 900 },
  { product: "Opening Fee", activated: 380, total: 500 },
];

const deliveryToActivation = [
  { days: "0-1", count: 850 },
  { days: "2-3", count: 1200 },
  { days: "4-7", count: 680 },
  { days: "8-14", count: 420 },
  { days: "15-30", count: 180 },
  { days: "30+", count: 70 },
];

// Sample data — Revolving Rate (blocked by mart_finance)
const revolvingRateTrend = [
  { date: "Oct", rate: 63.2 },
  { date: "Nov", rate: 64.8 },
  { date: "Dec", rate: 66.1 },
  { date: "Jan", rate: 67.5 },
  { date: "Feb", rate: 68.9 },
  { date: "Mar", rate: 70.3 },
];

// Sample data — Monthly Income Distribution (blocked by Credit Bureau + mart_finance)
const monthlyIncomeDistribution = [
  { bucket: "$400–$600", count: 820 },
  { bucket: "$600–$800", count: 1450 },
  { bucket: "$800–$1,000", count: 1180 },
  { bucket: "$1,000–$1,200", count: 640 },
  { bucket: "$1,200+", count: 310 },
];

const actionItems: ActionItem[] = [
  {
    id: "act-1",
    priority: "positive",
    action: "Activation rate hit 65.2%, a 6-month high.",
    detail: "Avg days to first transaction down to 4.5 days. Push notification campaigns appear effective.",
  },
  {
    id: "act-2",
    priority: "monitor",
    action: "22.5% of accounts inactive within 7 days.",
    detail: "Consider targeted welcome offers or onboarding nudges for accounts that haven't transacted in first week.",
  },
  {
    id: "act-3",
    priority: "urgent",
    action: "Prepaid activation rate is lowest at 68.9%.",
    detail: "Prepaid card users may not understand value prop. Investigate UX and consider first-load bonus.",
  },
];

export default function ActivationPage() {
  const { period, periodLabel } = usePeriod();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const periodActivationRate = useMemo(() => applyFilterToData(scaleTrendData(activationRateTrend, period), filters), [period, filters]);
  const periodAvgDays = useMemo(() => applyFilterToData(scaleTrendData(avgDaysToFirstTxn, period), filters), [period, filters]);
  const periodDormancy = useMemo(() => applyFilterToData(scaleTrendData(dormancy, period, "bucket"), filters), [period, filters]);
  const periodActivationByProduct = useMemo(() => applyFilterToData(scaleTrendData(activationByProduct, period, "product"), filters), [period, filters]);
  const periodDeliveryToActivation = useMemo(() => applyFilterToData(scaleTrendData(deliveryToActivation, period, "days"), filters), [period, filters]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const activationRateInsights = useMemo<ChartInsight[]>(() => [
    { text: `Activation rate climbed from 58.2% to 65.2% over ${p.span}, a 7pp improvement driven by onboarding flow optimizations launched in Nov.`, type: "positive" },
    { text: `Current rate of 65.2% still falls 4.8pp short of the 70% target. Gap is closing but needs sustained push to hit goal by Q2.`, type: "negative" },
    { text: `${p.lastLabel} ${p.changeAbbrev} acceleration (+1.8pp) coincides with the push notification welcome series rollout, suggesting high-touch nudges are effective.`, type: "positive" },
    { text: `Ramadan spending uplift in ${p.lastLabel} may be inflating activation; expect a seasonal pullback as discretionary spend normalizes.`, type: "hypothesis" },
  ], [p]);

  const avgDaysInsights = useMemo<ChartInsight[]>(() => [
    { text: `Average days to first transaction dropped from 5.8 to 4.5 over ${p.span}, a 22.41% improvement.`, type: "positive" },
    { text: `Steepest decline occurred mid-period, aligning with year-end holiday shopping behavior.`, type: "neutral" },
    { text: `A slight regression mid-period is likely due to post-holiday spending fatigue and lower merchant promotion activity.`, type: "hypothesis" },
    { text: `If the current trajectory holds, reaching sub-4-day activation by Q3 is feasible with continued SMS/push reminders within 48 hours of card delivery.`, type: "positive" },
  ], [p]);

  const dormancyInsights = useMemo<ChartInsight[]>(() => [
    { text: `22.5% of accounts have no transaction within 7 days, the largest dormancy bucket and the primary drag on overall activation rate.`, type: "negative" },
    { text: `Dormancy drops sharply after 14 days (18.3% to 14.1%), suggesting accounts that survive the first two weeks are significantly more likely to remain active.`, type: "neutral" },
    { text: `The 90-day dormancy cohort at 6.2% represents structurally disengaged users who may require win-back campaigns rather than onboarding nudges.`, type: "negative" },
    { text: `High early dormancy may reflect customers who applied for credit limit access but have no immediate spending need, common in emerging market card portfolios.`, type: "hypothesis" },
    { text: `A day-3 welcome offer (e.g., cashback on first transaction) could convert a meaningful share of the 7-day dormant bucket before habits solidify.`, type: "neutral" },
  ], [p]);

  const activationByProductInsights = useMemo<ChartInsight[]>(() => [
    { text: `Standard CC leads activation at 75% (2,100 of 2,800), benefiting from the most mature onboarding flow and highest credit limits.`, type: "positive" },
    { text: `Prepaid activates at 68.89% (620 of 900), the lowest rate across products. Users may not perceive urgency to load and spend on a prepaid card.`, type: "negative" },
    { text: `Opening Fee product activates at 76% (380 of 500), outperforming Standard CC despite a smaller base, suggesting high-intent applicants.`, type: "positive" },
    { text: `The 7.11pp gap between Prepaid and Opening Fee indicates product-level UX and value-prop clarity matter more than volume for activation outcomes.`, type: "neutral" },
  ], [p]);

  const deliveryToActivationInsights = useMemo<ChartInsight[]>(() => [
    { text: `The 2-3 day bucket captures the most activations (1,200 accounts), confirming that the critical engagement window is 48-72 hours post-delivery.`, type: "positive" },
    { text: `850 accounts activate on day 0-1, indicating strong intent among roughly 25% of recipients who transact almost immediately.`, type: "positive" },
    { text: `The long tail (15-30 days: 180, 30+: 70) accounts for 7.35% of activations and likely requires separate re-engagement treatment.`, type: "negative" },
    { text: `Distribution shape resembles a right-skewed Poisson, typical of card activation in markets where digital wallet linking delays first physical-card use.`, type: "hypothesis" },
  ], [p]);

  const revolvingRateInsights = useMemo<ChartInsight[]>(() => [
    { text: `Revolving ratio rose steadily from 63.2% to 70.3% over ${p.span}, indicating growing reliance on credit among active cardholders.`, type: "negative" },
    { text: `The 7.1pp increase suggests minimum-due payment behavior is becoming entrenched — a profitability tailwind but a credit risk concern.`, type: "neutral" },
    { text: `Holiday-period jump of 1.4pp aligns with seasonal spending that was not fully repaid, converting transactors into revolvers.`, type: "hypothesis" },
    { text: `If revolving rate exceeds 72%, delinquency inflow may accelerate — monitor Bucket 1 entries alongside this metric.`, type: "negative" },
  ], [p]);

  const monthlyIncomeInsights = useMemo<ChartInsight[]>(() => [
    { text: `The $600–$800 bracket is the largest segment at 1,450 customers, representing the core middle-income target demographic.`, type: "neutral" },
    { text: `Only 310 customers (7%) earn above $1,200/month — high-income penetration remains limited, constraining average credit limit upside.`, type: "negative" },
    { text: `Weighted average monthly income across activated customers is approximately $842, consistent with Indonesia urban salaried workers.`, type: "neutral" },
    { text: `Income verification via credit bureau could be cross-referenced with stated income to flag discrepancies and reduce fraud risk.`, type: "hypothesis" },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Activation Deep Dive</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="act_activation_rate"
          label="Activation (1st Txn ≤7d of Approval)"
          value={applyFilterToMetric(scaleMetricValue(65.2, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(63.4, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={periodActivationRate.map((d) => d.rate)}
          target={70}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="act_cards_activated"
          label="Cards Activated"
          value={applyFilterToMetric(scaleMetricValue(3100, period, false), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(2850, period, false), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="act_avg_days"
          label="Avg Days to First Txn"
          value={applyFilterToMetric(4.5, filters, false)}
          prevValue={applyFilterToMetric(4.8, filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="act_dormant_30d"
          label="Dormant 30d+"
          value={applyFilterToMetric(scaleMetricValue(14.1, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(15.2, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Hero chart */}
      <ChartCard
        title="New Customer Activation Rate"
        subtitle="% making first purchase within 7 days of approval"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={periodActivationRate}
          lines={[{ key: "rate", color: "#22c55e", label: "Activation Rate %" }]}
          valueType="percent"
          height={300}
        />
        <ChartInsights insights={activationRateInsights} />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Avg Days to First Transaction"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={periodAvgDays}
            lines={[{ key: "days", color: "#f59e0b", label: "Avg Days" }]}
            height={280}
          />
          <ChartInsights insights={avgDaysInsights} />
        </ChartCard>

        <ChartCard
          title="Dormancy Analysis"
          subtitle="% of accounts with no transaction by period"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={periodDormancy}
            bars={[{ key: "percent", color: "#ef4444", label: "% Dormant" }]}
            xAxisKey="bucket"
            height={280}
          />
          <ChartInsights insights={dormancyInsights} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Activation by Product Type"
          subtitle="Activated vs total by product"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={periodActivationByProduct}
            bars={[
              { key: "total", color: "#475569", label: "Total" },
              { key: "activated", color: "#22c55e", label: "Activated" },
            ]}
            xAxisKey="product"
            height={280}
          />
          <ChartInsights insights={activationByProductInsights} />
        </ChartCard>

        <ChartCard
          title="Card Delivery to Activation Timeline"
          subtitle="Distribution of days from delivery to first transaction"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={periodDeliveryToActivation}
            bars={[{ key: "count", color: "#8b5cf6", label: "Accounts" }]}
            xAxisKey="days"
            height={280}
          />
          <ChartInsights insights={deliveryToActivationInsights} />
        </ChartCard>
      </div>

      {/* Revolving Rate — blocked by mart_finance */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Revolving rate data requires mart_finance access for balance and minimum due calculations"
      >
        <ChartCard
          title="Revolving Rate Trend"
          subtitle="% of accounts revolving (paying less than full statement balance)"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={revolvingRateTrend}
            lines={[{ key: "rate", color: "#ef4444", label: "Revolving Rate %" }]}
            valueType="percent"
            height={300}
          />
          <ChartInsights insights={revolvingRateInsights} />
        </ChartCard>
      </SampleDataBanner>

      {/* Monthly Income Distribution — blocked by Credit Bureau + mart_finance */}
      <SampleDataBanner
        dataset="Credit Bureau + mart_finance"
        reason="Customer income data requires credit bureau integration and mart_finance access"
      >
        <ChartCard
          title="Monthly Income Distribution"
          subtitle="Activated customer income brackets (avg $560–$1,204)"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={monthlyIncomeDistribution}
            bars={[{ key: "count", color: "#6366f1", label: "Customers" }]}
            xAxisKey="bucket"
            height={300}
          />
          <ChartInsights insights={monthlyIncomeInsights} />
        </ChartCard>
      </SampleDataBanner>

      <ActionItems section="Activation" items={actionItems} />
    </div>
  );
}
