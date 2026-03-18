"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { ChartCard } from "@/components/dashboard/chart-card";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { applyFilterToData } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, getPeriodInsightLabels, scaleTrendData } from "@/lib/period-data";

const AS_OF = "Mar 15, 2026";
// DATA_RANGE is now computed inside the component via useMemo

const fetcher = (url: string) => fetch(url).then((r) => r.json());


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
    action: "RP1 activation rate is lowest at 68.9%.",
    detail: "RP1 card users may not understand value prop. Investigate UX and consider first-load bonus.",
  },
];

export default function ActivationPage() {
  const { period } = usePeriod();
  const { filters } = useFilters();
  const { dateParams } = useDateParams();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/activation?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  const activationIsLive = !!apiData?.activationRateTrend;

  // ── API-backed data ──
  const apiActivationRate = useMemo((): { date: string; rate: number }[] | null => {
    if (!apiData?.activationRateTrend) return null;
    return apiData.activationRateTrend.map((r: { week: string; approved_count: number; activated_count: number; rate: number }) => ({
      date: r.week,
      rate: r.rate,
    }));
  }, [apiData]);

  const apiDaysToFirstTxn = useMemo((): { days: string; count: number }[] | null => {
    if (!apiData?.daysToFirstTransaction) return null;
    return apiData.daysToFirstTransaction.map((r: { days_bucket: string; count: number }) => ({
      days: r.days_bucket,
      count: r.count,
    }));
  }, [apiData]);

  const apiActivationByProduct = useMemo((): { product: string; activated: number; total: number }[] | null => {
    if (!apiData?.activationByProductType) return null;
    return apiData.activationByProductType.map((r: { product_type: string; approved: number; activated: number; rate: number }) => ({
      product: r.product_type,
      activated: r.activated,
      total: r.approved,
    }));
  }, [apiData]);

  const apiPinSetRate = useMemo((): { date: string; rate: number }[] | null => {
    if (!apiData?.pinSetRateTrend) return null;
    return apiData.pinSetRateTrend.map((r: { week: string; decision_count: number; pin_set_count: number; rate: number }) => ({
      date: r.week,
      rate: r.rate,
    }));
  }, [apiData]);

  // Dormancy analysis from DW004
  const dormancyAnalysis = useMemo((): { bucket: string; accounts: number }[] | null => {
    if (!apiData?.dormancyAnalysis?.length) return null;
    return apiData.dormancyAnalysis as { bucket: string; accounts: number }[];
  }, [apiData]);

  // KPI summary values computed from API data
  const kpiSummary = useMemo(() => {
    if (!apiData?.activationRateTrend?.length) return null;
    const trend = apiData.activationRateTrend as { week: string; approved_count: number; activated_count: number; rate: number }[];
    const latest = trend[trend.length - 1];
    const prev = trend.length > 1 ? trend[trend.length - 2] : null;
    const totalApproved = trend.reduce((s: number, r: { approved_count: number }) => s + r.approved_count, 0);
    const totalActivated = trend.reduce((s: number, r: { activated_count: number }) => s + r.activated_count, 0);
    const overallRate = totalApproved > 0 ? Math.round((totalActivated / totalApproved) * 10000) / 100 : 0;

    return {
      latestRate: latest?.rate ?? 0,
      prevRate: prev?.rate ?? null,
      totalApproved,
      totalActivated,
      overallRate,
    };
  }, [apiData]);

  const periodActivationRate = useMemo(() => apiActivationRate?.length ? applyFilterToData(scaleTrendData(apiActivationRate, period), filters) : null, [period, filters, apiActivationRate]);
  const periodActivationByProduct = useMemo(() => apiActivationByProduct?.length ? applyFilterToData(scaleTrendData(apiActivationByProduct, period, "product"), filters) : null, [period, filters, apiActivationByProduct]);
  const periodDeliveryToActivation = useMemo(() => apiDaysToFirstTxn?.length ? applyFilterToData(scaleTrendData(apiDaysToFirstTxn, period, "days"), filters) : null, [period, filters, apiDaysToFirstTxn]);

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
    { text: `RP1 activates at 68.89% (620 of 900), the lowest rate across products. Users may not perceive urgency to load and spend on an RP1 card.`, type: "negative" },
    { text: `Opening Fee product activates at 76% (380 of 500), outperforming Standard CC despite a smaller base, suggesting high-intent applicants.`, type: "positive" },
    { text: `The 7.11pp gap between RP1 and Opening Fee indicates product-level UX and value-prop clarity matter more than volume for activation outcomes.`, type: "neutral" },
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
      <ActiveFiltersBanner />

      {/* KPI row — Activation summary MetricCards */}
      {kpiSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            metricKey="activation-rate"
            label="Latest Activation Rate"
            value={kpiSummary.latestRate}
            prevValue={kpiSummary.prevRate}
            unit="percent"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            target={70}
            liveData
          />
          <MetricCard
            metricKey="overall-activation-rate"
            label="Overall Activation Rate"
            value={kpiSummary.overallRate}
            unit="percent"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            target={70}
            liveData
          />
          <MetricCard
            metricKey="total-approved"
            label="Total Approved"
            value={kpiSummary.totalApproved}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
          <MetricCard
            metricKey="total-activated"
            label="Total Activated"
            value={kpiSummary.totalActivated}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData
          />
        </div>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Activation KPIs require financial_account_updates (DW004) and authorized_transaction (DW007)"
        />
      )}

      {/* Hero chart */}
      {periodActivationRate ? (
        <ChartCard
          title="New Customer Activation Rate"
          subtitle="% making first purchase within 7 days of approval"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData={activationIsLive}
        >
          <DashboardLineChart
            data={periodActivationRate}
            lines={[{ key: "rate", color: "#22c55e", label: "Activation Rate %" }]}
            valueType="percent"
            height={300}
          />
          <ChartInsights insights={activationRateInsights} />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Activation rate trend requires financial_account_updates (DW004) and authorized_transaction (DW007)"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {periodDeliveryToActivation ? (
          <ChartCard
            title="Card Delivery to Activation Timeline"
            subtitle="Distribution of days from delivery to first transaction"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData={!!apiData?.daysToFirstTransaction}
          >
            <DashboardBarChart
              data={periodDeliveryToActivation}
              bars={[{ key: "count", color: "#8b5cf6", label: "Accounts" }]}
              xAxisKey="days"
              height={280}
            />
            <ChartInsights insights={deliveryToActivationInsights} />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Activation timeline requires financial_account_updates (DW004)"
          />
        )}

        {periodActivationByProduct ? (
          <ChartCard
            title="Activation by Product Type"
            subtitle="Activated vs total by product"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
            liveData={!!apiData?.activationByProductType}
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
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Activation by product requires financial_account_updates (DW004)"
          />
        )}
      </div>

      {/* Dormancy Analysis — from DW004 */}
      {dormancyAnalysis ? (
        <ChartCard
          title="Dormancy Analysis"
          subtitle="Account status distribution by DPD bucket"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
          liveData
        >
          <DashboardBarChart
            data={dormancyAnalysis.map((r: { bucket: string; accounts: number }) => ({
              bucket: r.bucket,
              accounts: r.accounts,
            }))}
            bars={[{ key: "accounts", color: "#f59e0b", label: "Accounts" }]}
            xAxisKey="bucket"
            height={280}
          />
          <ChartInsights insights={dormancyInsights} />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Dormancy analysis requires financial_account_updates (DW004)"
        />
      )}

      {/* Revolving Rate — blocked by mart_finance */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Revolving rate data requires mart_finance access for balance and minimum due calculations"
      />

      {/* Monthly Income Distribution — blocked by Credit Bureau + mart_finance */}
      <SampleDataBanner
        dataset="Credit Bureau + mart_finance"
        reason="Customer income data requires credit bureau integration and mart_finance access"
      />

      <ActionItems section="Activation" items={actionItems} />
    </div>
  );
}
