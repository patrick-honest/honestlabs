"use client";

import { useCallback, useMemo } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardAreaChart } from "@/components/charts/area-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange, scaleTrendData, scaleMetricValue, getPeriodInsightLabels } from "@/lib/period-data";
import { applyFilterToData, applyFilterToMetric, hasActiveFilters } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 15, 2026";

// Mock data
const spendActiveRateTrend = [
  { date: "Oct", rate: 42.5 },
  { date: "Nov", rate: 44.1 },
  { date: "Dec", rate: 48.3 },
  { date: "Jan", rate: 45.2 },
  { date: "Feb", rate: 46.8 },
  { date: "Mar", rate: 47.5 },
];

const eligibleVsTransactors = [
  { date: "Oct", eligible: 18500, transactors: 7863 },
  { date: "Nov", eligible: 19200, transactors: 8467 },
  { date: "Dec", eligible: 20100, transactors: 9708 },
  { date: "Jan", eligible: 21000, transactors: 9492 },
  { date: "Feb", eligible: 21800, transactors: 10202 },
  { date: "Mar", eligible: 22500, transactors: 10688 },
];

const spendByCategory = [
  { date: "Oct", online: 12000000000, offline: 8000000000, qris: 0 },
  { date: "Nov", online: 13500000000, offline: 8500000000, qris: 3500000000 },
  { date: "Dec", online: 18000000000, offline: 11000000000, qris: 5000000000 },
  { date: "Jan", online: 14000000000, offline: 9000000000, qris: 4000000000 },
  { date: "Feb", online: 15000000000, offline: 9500000000, qris: 4500000000 },
  { date: "Mar", online: 16000000000, offline: 10000000000, qris: 5000000000 },
];

const avgSpendPerTxn = [
  { date: "Oct", online: 450000, offline: 380000, qris: 0 },
  { date: "Nov", online: 460000, offline: 390000, qris: 125000 },
  { date: "Dec", online: 520000, offline: 420000, qris: 135000 },
  { date: "Jan", online: 470000, offline: 395000, qris: 130000 },
  { date: "Feb", online: 480000, offline: 400000, qris: 132000 },
  { date: "Mar", online: 490000, offline: 410000, qris: 138000 },
];

const totalSpendVolume = [
  { date: "Oct", volume: 23000000000 },
  { date: "Nov", volume: 25500000000 },
  { date: "Dec", volume: 34000000000 },
  { date: "Jan", volume: 27000000000 },
  { date: "Feb", volume: 29000000000 },
  { date: "Mar", volume: 31000000000 },
];

const txnPerEligible = [
  { date: "Oct", txnPerUser: 4.2 },
  { date: "Nov", txnPerUser: 4.5 },
  { date: "Dec", txnPerUser: 5.8 },
  { date: "Jan", txnPerUser: 4.6 },
  { date: "Feb", txnPerUser: 4.8 },
  { date: "Mar", txnPerUser: 5.0 },
];

const actionItems: ActionItem[] = [
  {
    id: "spend-1",
    priority: "positive",
    action: "Spend active rate reached 47.5%.",
    detail: "Highest in 6 months, driven by QRIS adoption growth and seasonal effects.",
  },
  {
    id: "spend-2",
    priority: "monitor",
    action: "QRIS spend growing faster than card spend.",
    detail: "QRIS now 16% of total volume, up from 13%. Monitor interchange revenue impact.",
  },
  {
    id: "spend-3",
    priority: "urgent",
    action: "Top merchant category data unavailable.",
    detail: "Merchant category code (MCC) enrichment pipeline needs to be connected for deeper spend analysis.",
  },
];

// --- Sample data: Revenue metrics (blocked by mart_finance) ---
const sampleArpacTrend = [
  { date: "Apr 25", arpac: 10.2 },
  { date: "May 25", arpac: 10.8 },
  { date: "Jun 25", arpac: 11.1 },
  { date: "Jul 25", arpac: 11.5 },
  { date: "Aug 25", arpac: 11.9 },
  { date: "Sep 25", arpac: 12.3 },
  { date: "Oct 25", arpac: 12.7 },
  { date: "Nov 25", arpac: 13.1 },
  { date: "Dec 25", arpac: 14.2 },
  { date: "Jan 26", arpac: 13.5 },
  { date: "Feb 26", arpac: 13.9 },
  { date: "Mar 26", arpac: 14.6 },
];

const sampleAvgMonthlyFeesTrend = [
  { date: "Apr 25", fees: 4.1 },
  { date: "May 25", fees: 4.3 },
  { date: "Jun 25", fees: 4.5 },
  { date: "Jul 25", fees: 4.8 },
  { date: "Aug 25", fees: 5.0 },
  { date: "Sep 25", fees: 5.2 },
  { date: "Oct 25", fees: 5.5 },
  { date: "Nov 25", fees: 5.7 },
  { date: "Dec 25", fees: 6.4 },
  { date: "Jan 26", fees: 5.9 },
  { date: "Feb 26", fees: 6.1 },
  { date: "Mar 26", fees: 6.5 },
];

const sampleAvgMonthlyFeesRefundAdj = [
  { date: "Apr 25", feesAdj: 3.8 },
  { date: "May 25", feesAdj: 4.0 },
  { date: "Jun 25", feesAdj: 4.2 },
  { date: "Jul 25", feesAdj: 4.4 },
  { date: "Aug 25", feesAdj: 4.6 },
  { date: "Sep 25", feesAdj: 4.8 },
  { date: "Oct 25", feesAdj: 5.1 },
  { date: "Nov 25", feesAdj: 5.3 },
  { date: "Dec 25", feesAdj: 5.9 },
  { date: "Jan 26", feesAdj: 5.4 },
  { date: "Feb 26", feesAdj: 5.6 },
  { date: "Mar 26", feesAdj: 6.0 },
];

const sampleInterchangeIncomeTrend = [
  { date: "Apr 25", interchange: 82000 },
  { date: "May 25", interchange: 89000 },
  { date: "Jun 25", interchange: 95000 },
  { date: "Jul 25", interchange: 101000 },
  { date: "Aug 25", interchange: 108000 },
  { date: "Sep 25", interchange: 114000 },
  { date: "Oct 25", interchange: 121000 },
  { date: "Nov 25", interchange: 130000 },
  { date: "Dec 25", interchange: 158000 },
  { date: "Jan 26", interchange: 135000 },
  { date: "Feb 26", interchange: 142000 },
  { date: "Mar 26", interchange: 151000 },
];

const sampleArpacInsights: ChartInsight[] = [
  { text: "ARPAC reached $14.60 in March, up 43% from the $10.20 baseline a year ago.", type: "positive" },
  { text: "December seasonality spike ($14.20) is now being exceeded organically in March.", type: "positive" },
  { text: "Rising transaction frequency and QRIS adoption are the primary ARPAC growth levers.", type: "neutral" },
  { text: "Peer benchmark (Orico JP): ARPAC of $18-$22 for mature portfolios — Honest still has headroom.", type: "hypothesis" },
];

const sampleAvgMonthlyFeesInsights: ChartInsight[] = [
  { text: "Average monthly fees grew to $6.50, up 58.5% from $4.10 a year ago.", type: "positive" },
  { text: "Post-December normalization is shallower each cycle, suggesting fee base is becoming more resilient.", type: "neutral" },
  { text: "Late fee and overlimit fee contributions should be broken out once mart_finance is accessible.", type: "neutral" },
];

const sampleAvgMonthlyFeesRefundAdjInsights: ChartInsight[] = [
  { text: "Refund-adjusted fees of $6.00 represent a 7.7% haircut from gross fees ($6.50) — within acceptable range.", type: "neutral" },
  { text: "Refund ratio has been stable at 7-8%, indicating fee disputes are not escalating.", type: "positive" },
  { text: "Tracking refund-adjusted fees separately is critical for accurate revenue forecasting.", type: "neutral" },
];

const sampleInterchangeIncomeInsights: ChartInsight[] = [
  { text: "Interchange income reached $151K in March, up 84% from $82K a year ago, tracking spend volume growth.", type: "positive" },
  { text: "December peak of $158K was driven by seasonal holiday volume; March is approaching that level organically.", type: "neutral" },
  { text: "QRIS interchange rates are lower than card-present — channel mix shift may compress blended interchange margin.", type: "negative" },
  { text: "Bank Indonesia MDR cap reductions could further pressure interchange revenue per transaction.", type: "hypothesis" },
];

// --- Sample data: BNPL usage (blocked by mart_finance + product data) ---
const sampleBnplUsageRateTrend = [
  { date: "Apr 25", rate: 84.2 },
  { date: "May 25", rate: 84.8 },
  { date: "Jun 25", rate: 85.3 },
  { date: "Jul 25", rate: 85.9 },
  { date: "Aug 25", rate: 86.4 },
  { date: "Sep 25", rate: 86.8 },
  { date: "Oct 25", rate: 87.1 },
  { date: "Nov 25", rate: 87.6 },
  { date: "Dec 25", rate: 88.5 },
  { date: "Jan 26", rate: 87.9 },
  { date: "Feb 26", rate: 88.2 },
  { date: "Mar 26", rate: 88.7 },
];

const sampleBnplUsageInsights: ChartInsight[] = [
  { text: "BNPL usage rate reached 88.7% in March, up from 84.2% a year ago — near saturation among active users.", type: "positive" },
  { text: "Post-December dip is minimal (88.5% → 87.9%), confirming BNPL is habitual, not seasonal.", type: "neutral" },
  { text: "The remaining ~11% of non-BNPL users may represent higher-income segments preferring full payment.", type: "neutral" },
  { text: "BNPL adoption ceiling of ~90% is consistent with Orico's mature BNPL portfolio in Japan.", type: "hypothesis" },
];

export default function SpendPage() {
  const { period, periodLabel, timeRangeMultiplier } = usePeriod();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const pSpendActiveRate = useMemo(() => applyFilterToData(scaleTrendData(spendActiveRateTrend, period), filters), [period, filters]);
  const pEligibleVsTransactors = useMemo(() => applyFilterToData(scaleTrendData(eligibleVsTransactors, period), filters), [period, filters]);
  const pSpendByCategory = useMemo(() => applyFilterToData(scaleTrendData(spendByCategory, period), filters), [period, filters]);
  const pAvgSpendPerTxn = useMemo(() => applyFilterToData(scaleTrendData(avgSpendPerTxn, period), filters), [period, filters]);
  const pTotalSpendVolume = useMemo(() => applyFilterToData(scaleTrendData(totalSpendVolume, period), filters), [period, filters]);
  const pTxnPerEligible = useMemo(() => applyFilterToData(scaleTrendData(txnPerEligible, period), filters), [period, filters]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const spendActiveRateInsights: ChartInsight[] = useMemo(() => [
    { text: `Spend active rate rose to 47.5%, the highest in the ${p.trailingWindow}, up 0.7pp ${p.changeAbbrev}.`, type: "positive" },
    { text: "Still 7.5pp below the 55% target — closing the gap requires activating ~1,690 more eligible accounts.", type: "negative" },
    { text: "December spike to 48.3% was seasonal; the post-holiday dip has been shallower each cycle, suggesting structural improvement.", type: "neutral" },
    { text: "QRIS wallet-linking campaigns in Feb-Mar may be pulling dormant cardholders into first transactions.", type: "hypothesis" },
  ], [p]);

  const eligibleVsTransactorsInsights: ChartInsight[] = useMemo(() => [
    { text: `11,812 eligible accounts (52.5%) had zero transactions in ${p.lastLabel} — the single largest activation opportunity.`, type: "negative" },
    { text: `Transactor count grew 4.76% ${p.changeAbbrev} vs eligible base growth of 3.21%, meaning conversion rate is improving.`, type: "positive" },
    { text: "Gap between eligible and transactors has widened in absolute terms even as the ratio improves, due to faster onboarding.", type: "neutral" },
    { text: "Rising e-commerce penetration in Indonesia (21% YoY per eMarketer) could organically lift transactor conversion.", type: "hypothesis" },
  ], [p]);

  const spendByCategoryInsights: ChartInsight[] = useMemo(() => [
    { text: `Online remains the dominant channel at 51.61% of ${p.lastLabel} volume, but QRIS is the fastest-growing at +11.11% ${p.changeAbbrev}.`, type: "neutral" },
    { text: `QRIS share increased from 13.04% in ${p.firstLabel} to 16.13% in ${p.lastLabel} — a 3.09pp channel mix shift in ${p.span}.`, type: "positive" },
    { text: `Offline spend growth is the slowest at 5.26% ${p.changeAbbrev}, suggesting card-present usage is plateauing.`, type: "negative" },
    { text: "Bank Indonesia's QRIS interoperability mandate may be accelerating small-ticket migration away from card-present channels.", type: "hypothesis" },
  ], [p]);

  const avgSpendPerTxnInsights: ChartInsight[] = useMemo(() => [
    { text: "Online ticket size leads at IDR 490K, 19.51% higher than offline (IDR 410K) and 3.55x higher than QRIS (IDR 138K).", type: "neutral" },
    { text: `QRIS ticket size grew 4.55% ${p.changeAbbrev} (IDR 132K → 138K), indicating users are trusting QRIS for slightly larger purchases.`, type: "positive" },
    { text: "Despite having the smallest ticket size, QRIS volume growth means total QRIS revenue contribution is rising.", type: "neutral" },
    { text: "Indonesian consumer shift toward micro-transactions for daily essentials (grab-and-go, coffee) may keep QRIS tickets structurally low.", type: "hypothesis" },
  ], [p]);

  const totalSpendVolumeInsights: ChartInsight[] = useMemo(() => [
    { text: `${p.lastLabel} volume hit IDR 31B, a 6.9% ${p.changeAbbrev} increase and 34.78% above the ${p.firstLabel} baseline.`, type: "positive" },
    { text: "December peak (IDR 34B) remains the high-water mark — seasonal holiday and year-end bonus effects.", type: "neutral" },
    { text: "Post-December recovery has been steady: Jan → Feb → Mar each grew ~7%, suggesting durable momentum rather than one-off spikes.", type: "positive" },
    { text: "Ramadan spending uplift in Mar-Apr (historically +15-20% in Indonesian retail) could push volume past the December peak.", type: "hypothesis" },
  ], [p]);

  const txnPerEligibleInsights: ChartInsight[] = useMemo(() => [
    { text: `Engagement depth reached 5.0 txn/user in ${p.lastLabel}, up from 4.2 in ${p.firstLabel} — a 19.05% improvement.`, type: "positive" },
    { text: "December's 5.8 txn/user spike confirmed seasonal behavior; the key signal is the rising floor (4.2 → 4.6 → 5.0).", type: "neutral" },
    { text: "Higher transaction frequency directly increases interchange revenue and float income per account.", type: "positive" },
    { text: "Growth in super-app integrations (Tokopedia, Grab) may be driving habitual multi-transaction behavior.", type: "hypothesis" },
  ], [p]);

  const topMerchantInsights: ChartInsight[] = useMemo(() => [
    { text: "MCC enrichment pipeline is not yet connected — merchant-level spend analysis is unavailable.", type: "negative" },
    { text: "Once available, MCC data will enable targeted cashback campaigns and merchant partnership decisions.", type: "neutral" },
    { text: "Priority: connect Finexus Cardworks MCC fields to BigQuery to unlock this view.", type: "neutral" },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Spend Deep Dive</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">All spend metrics are based on <span className="font-semibold">authorized transactions</span> unless otherwise noted</p>
      </div>

      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="spend_active_rate"
          label="Spend Active Rate"
          value={applyFilterToMetric(scaleMetricValue(47.5, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(46.8, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pSpendActiveRate.map((d: Record<string, unknown>) => d.rate as number)}
          target={55}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="spend_eligible"
          label="Eligible to Spend (Cum. EoP)"
          value={applyFilterToMetric(22500, filters, false)}
          prevValue={applyFilterToMetric(21800, filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="spend_total_volume"
          label="Total Spend Volume"
          value={applyFilterToMetric(scaleMetricValue(31000000000, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(29000000000, period, false, timeRangeMultiplier), filters, false)}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="spend_txn_per_user"
          label="Txn per Eligible User"
          value={5.0}
          prevValue={4.8}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Spend Active Rate hero chart */}
      <ChartCard
        title="Spend Active Rate Trend"
        subtitle="% of cumulative eligible accounts (EoP) with at least 1 authorized transaction in period"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={pSpendActiveRate}
          lines={[{ key: "rate", color: "#3b82f6", label: "Spend Active Rate %" }]}
          valueType="percent"
          height={300}
        />
        <ChartInsights insights={spendActiveRateInsights} />
      </ChartCard>

      {/* Two column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Eligible vs Transactors"
          subtitle="Cumulative eligible accounts (as of last day of period) vs those transacting"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={pEligibleVsTransactors}
            bars={[
              { key: "eligible", color: "#475569", label: "Eligible" },
              { key: "transactors", color: "#3b82f6", label: "Transactors" },
            ]}
            height={280}
          />
          <ChartInsights insights={eligibleVsTransactorsInsights} />
        </ChartCard>

        <ChartCard
          title="Spend by Category"
          subtitle="Online / Offline / QRIS · Based on authorized transactions"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardAreaChart
            data={pSpendByCategory}
            areas={[
              { key: "online", color: "#3b82f6", label: "Online" },
              { key: "offline", color: "#8b5cf6", label: "Offline" },
              { key: "qris", color: "#06b6d4", label: "QRIS" },
            ]}
            valueType="currency"
            height={280}
          />
          <ChartInsights insights={spendByCategoryInsights} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Avg Spend per Transaction"
          subtitle="By category · Based on authorized transactions"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pAvgSpendPerTxn}
            lines={[
              { key: "online", color: "#3b82f6", label: "Online" },
              { key: "offline", color: "#8b5cf6", label: "Offline" },
              { key: "qris", color: "#06b6d4", label: "QRIS" },
            ]}
            valueType="currency"
            height={260}
          />
          <ChartInsights insights={avgSpendPerTxnInsights} />
        </ChartCard>

        <ChartCard
          title="Total Spend Volume"
          subtitle="Based on authorized transactions"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={pTotalSpendVolume}
            bars={[{ key: "volume", color: "#3b82f6", label: "Total Volume" }]}
            height={260}
          />
          <ChartInsights insights={totalSpendVolumeInsights} />
        </ChartCard>
      </div>

      <ChartCard
        title="Transactions per Eligible User"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={pTxnPerEligible}
          lines={[{ key: "txnPerUser", color: "#f59e0b", label: "Txn / User" }]}
          height={260}
        />
        <ChartInsights insights={txnPerEligibleInsights} />
      </ChartCard>

      {/* Top merchant categories placeholder */}
      <ChartCard
        title="Top Merchant Categories"
        subtitle="Merchant category data TBD -- pending MCC enrichment pipeline"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
      >
        <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">
          Merchant category data not yet available. Connect MCC enrichment pipeline to enable.
        </div>
        <ChartInsights insights={topMerchantInsights} />
      </ChartCard>

      <ActionItems section="Spend" items={actionItems} />

      {/* Revenue Metrics — blocked by mart_finance */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Revenue per customer and fee metrics require access to mart_finance dataset"
      >
        <div className="space-y-4 p-3">
          <ChartCard
            title="ARPAC Trend (Average Revenue per Active Customer)"
            subtitle="USD per active customer per month · Sample data based on Orico benchmarks ($10–$15)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
          >
            <DashboardLineChart
              data={sampleArpacTrend}
              lines={[{ key: "arpac", color: "#10b981", label: "ARPAC (USD)" }]}
              height={280}
            />
            <ChartInsights insights={sampleArpacInsights} />
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Average Monthly Fees"
              subtitle="USD per active customer · Gross fees before refunds · Sample data ($4–$7)"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            >
              <DashboardLineChart
                data={sampleAvgMonthlyFeesTrend}
                lines={[{ key: "fees", color: "#8b5cf6", label: "Avg Monthly Fees (USD)" }]}
                height={260}
              />
              <ChartInsights insights={sampleAvgMonthlyFeesInsights} />
            </ChartCard>

            <ChartCard
              title="Average Monthly Fees (Refund-Adjusted)"
              subtitle="USD per active customer · Net of refunds · Sample data ($4–$7)"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
            >
              <DashboardLineChart
                data={sampleAvgMonthlyFeesRefundAdj}
                lines={[{ key: "feesAdj", color: "#f59e0b", label: "Refund-Adj Fees (USD)" }]}
                height={260}
              />
              <ChartInsights insights={sampleAvgMonthlyFeesRefundAdjInsights} />
            </ChartCard>
          </div>

          <ChartCard
            title="Interchange Fee Income Trend"
            subtitle="Total interchange revenue (USD) · Sample data"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
          >
            <DashboardBarChart
              data={sampleInterchangeIncomeTrend}
              bars={[{ key: "interchange", color: "#06b6d4", label: "Interchange Income (USD)" }]}
              height={280}
            />
            <ChartInsights insights={sampleInterchangeIncomeInsights} />
          </ChartCard>
        </div>
      </SampleDataBanner>

      {/* BNPL Usage — blocked by mart_finance + product data */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="BNPL usage data requires mart_finance access"
      >
        <div className="p-3">
          <ChartCard
            title="BNPL Usage Rate Trend"
            subtitle="% of active transactors using BNPL (installment) · Sample data based on Orico benchmarks (84%–89%)"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
          >
            <DashboardLineChart
              data={sampleBnplUsageRateTrend}
              lines={[{ key: "rate", color: "#ec4899", label: "Used BNPL Rate %" }]}
              valueType="percent"
              height={300}
            />
            <ChartInsights insights={sampleBnplUsageInsights} />
          </ChartCard>
        </div>
      </SampleDataBanner>
    </div>
  );
}
