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

// Mock data — Auth approval rate trend
const authApprovalRateTrend = [
  { date: "Oct", rate: 93.8 },
  { date: "Nov", rate: 94.2 },
  { date: "Dec", rate: 94.5 },
  { date: "Jan", rate: 94.9 },
  { date: "Feb", rate: 95.1 },
  { date: "Mar", rate: 95.4 },
];

// Mock data — Total auths (approved + declined)
const totalAuthsTrend = [
  { date: "Oct", approved: 470000, declined: 32000 },
  { date: "Nov", approved: 485000, declined: 31000 },
  { date: "Dec", approved: 540000, declined: 30000 },
  { date: "Jan", approved: 495000, declined: 26000 },
  { date: "Feb", approved: 510000, declined: 25500 },
  { date: "Mar", approved: 525000, declined: 24500 },
];

// Mock data — Channel mix (stacked bar)
const channelMixTrend = [
  { date: "Oct", online: 210000, offline: 175000, qris: 67500, atm: 25000 },
  { date: "Nov", online: 220000, offline: 178000, qris: 72000, atm: 24500 },
  { date: "Dec", online: 248000, offline: 190000, qris: 82000, atm: 24000 },
  { date: "Jan", online: 225000, offline: 173000, qris: 78000, atm: 23500 },
  { date: "Feb", online: 232000, offline: 177000, qris: 82000, atm: 23000 },
  { date: "Mar", online: 240000, offline: 182000, qris: 86000, atm: 22500 },
];

// Mock data — Top merchants (horizontal bar)
const topMerchants = [
  { merchant: "Tokopedia", txnCount: 68500 },
  { merchant: "Shopee", txnCount: 55200 },
  { merchant: "Grab", txnCount: 42800 },
  { merchant: "Gojek", txnCount: 38100 },
  { merchant: "Indomaret", txnCount: 31500 },
  { merchant: "Alfamart", txnCount: 27800 },
  { merchant: "Bukalapak", txnCount: 18200 },
  { merchant: "Lazada", txnCount: 15600 },
  { merchant: "Traveloka", txnCount: 12400 },
  { merchant: "Blibli", txnCount: 9800 },
];

// Mock data — Ticket size trend (area)
const ticketSizeTrend = [
  { date: "Oct", avgTicket: 335000 },
  { date: "Nov", avgTicket: 340000 },
  { date: "Dec", avgTicket: 365000 },
  { date: "Jan", avgTicket: 345000 },
  { date: "Feb", avgTicket: 350000 },
  { date: "Mar", avgTicket: 355000 },
];

// Mock data — Foreign txn % trend
const foreignTxnTrend = [
  { date: "Oct", rate: 2.5 },
  { date: "Nov", rate: 2.7 },
  { date: "Dec", rate: 3.2 },
  { date: "Jan", rate: 2.9 },
  { date: "Feb", rate: 3.0 },
  { date: "Mar", rate: 3.1 },
];

const actionItems: ActionItem[] = [
  {
    id: "auth-1",
    priority: "positive",
    action: "Auth approval rate reached 95.4%, highest in 6 months.",
    detail: "Steady improvement driven by better fraud rules and decline reason tuning.",
  },
  {
    id: "auth-2",
    priority: "monitor",
    action: "QRIS channel growing fastest at +27.4% over 6 months.",
    detail: "Now 16.2% of total authorizations. Monitor interchange revenue impact from lower QRIS MDR.",
  },
  {
    id: "auth-3",
    priority: "urgent",
    action: "Decline reason code breakdown unavailable.",
    detail: "Need to parse transaction_response_code details beyond 00/non-00 for decline reason analysis.",
  },
  {
    id: "auth-4",
    priority: "monitor",
    action: "Foreign transaction share stable at ~3%.",
    detail: "FX markup revenue opportunity — consider premium FX rate campaigns for travel season.",
  },
];

export default function TransactionAuthPage() {
  const { period, periodLabel, timeRangeMultiplier } = usePeriod();
  const { filters } = useFilters();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const pAuthRate = useMemo(() => applyFilterToData(scaleTrendData(authApprovalRateTrend, period), filters), [period, filters]);
  const pTotalAuths = useMemo(() => applyFilterToData(scaleTrendData(totalAuthsTrend, period), filters), [period, filters]);
  const pChannelMix = useMemo(() => applyFilterToData(scaleTrendData(channelMixTrend, period), filters), [period, filters]);
  const pTicketSize = useMemo(() => applyFilterToData(scaleTrendData(ticketSizeTrend, period), filters), [period, filters]);
  const pForeignTxn = useMemo(() => applyFilterToData(scaleTrendData(foreignTxnTrend, period), filters), [period, filters]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const authRateInsights: ChartInsight[] = useMemo(() => [
    { text: `Auth approval rate reached 95.4% in ${p.lastLabel}, up 1.6pp from ${p.firstLabel} baseline of 93.8%.`, type: "positive" },
    { text: "Decline rate dropped from 6.2% to 4.6%, suggesting fraud model calibration improvements are working.", type: "positive" },
    { text: "Industry benchmark for Indonesian credit card issuers is 93-96% — Honest is now in the upper quartile.", type: "neutral" },
    { text: "Further improvements may require decline reason code analysis to identify false positive patterns.", type: "hypothesis" },
  ], [p]);

  const totalAuthsInsights: ChartInsight[] = useMemo(() => [
    { text: `Total authorizations reached ~549K in ${p.lastLabel}, a 9.5% increase over ${p.firstLabel}.`, type: "positive" },
    { text: "December peak of ~570K was seasonal; post-holiday recovery has been strong with consistent month-over-month growth.", type: "neutral" },
    { text: `Declined transactions decreased from 32K to 24.5K, a 23.4% reduction over the ${p.span}.`, type: "positive" },
    { text: "Ramadan spending surge in Mar-Apr could push total auths past the December peak.", type: "hypothesis" },
  ], [p]);

  const channelMixInsights: ChartInsight[] = useMemo(() => [
    { text: `Online remains dominant at 45.2% of ${p.lastLabel} volume, but QRIS is the fastest-growing channel.`, type: "neutral" },
    { text: `QRIS share grew from 14.1% in ${p.firstLabel} to 16.2% in ${p.lastLabel} — a 2.1pp channel shift.`, type: "positive" },
    { text: "ATM transactions are declining steadily (5.2% → 4.2%), consistent with digital payment adoption trends.", type: "neutral" },
    { text: "Bank Indonesia QRIS interoperability mandate is likely accelerating the shift from offline POS to QRIS.", type: "hypothesis" },
  ], [p]);

  const topMerchantInsights: ChartInsight[] = useMemo(() => [
    { text: "Tokopedia and Shopee dominate with 23.1% of all approved authorizations combined.", type: "neutral" },
    { text: "Super-app integrations (Grab, Gojek) account for 13.7% — high-frequency, lower-ticket transactions.", type: "neutral" },
    { text: "Convenience stores (Indomaret, Alfamart) represent growing offline-to-QRIS migration opportunity.", type: "positive" },
    { text: "Merchant concentration risk: top 5 merchants account for ~40% of volume — diversification campaigns may be needed.", type: "hypothesis" },
  ], [p]);

  const ticketSizeInsights: ChartInsight[] = useMemo(() => [
    { text: `Avg ticket size rose to IDR 355K in ${p.lastLabel}, up 5.97% from IDR 335K in ${p.firstLabel}.`, type: "positive" },
    { text: "December spike to IDR 365K was holiday-driven; the organic uptrend from Jan-Mar is a healthier signal.", type: "neutral" },
    { text: "QRIS micro-transactions (avg IDR 45K) are pulling the blended average down — channel-level analysis recommended.", type: "neutral" },
    { text: "Rising consumer confidence and credit line increases may be enabling higher-value purchases.", type: "hypothesis" },
  ], [p]);

  const foreignTxnInsights: ChartInsight[] = useMemo(() => [
    { text: `Foreign transactions steady at 3.1% of total volume in ${p.lastLabel}.`, type: "neutral" },
    { text: "December peak of 3.2% aligns with year-end international travel season.", type: "neutral" },
    { text: "FX markup on foreign transactions is a high-margin revenue line — even small share increases matter.", type: "positive" },
    { text: "Post-pandemic travel recovery in Indonesia could push foreign txn share to 4-5% by end of 2026.", type: "hypothesis" },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="auth_approval_rate"
          label="Auth Approval Rate"
          value={applyFilterToMetric(scaleMetricValue(95.4, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(95.1, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pAuthRate.map((d: Record<string, unknown>) => d.rate as number)}
          target={97}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="auth_total"
          label="Total Authorizations"
          value={applyFilterToMetric(scaleMetricValue(549500, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(535500, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="auth_avg_ticket"
          label="Avg Ticket Size"
          value={applyFilterToMetric(355000, filters, false)}
          prevValue={applyFilterToMetric(350000, filters, false)}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="auth_foreign_pct"
          label="Foreign Txn %"
          value={applyFilterToMetric(scaleMetricValue(3.1, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(3.0, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pForeignTxn.map((d: Record<string, unknown>) => d.rate as number)}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Auth rate hero chart */}
      <ChartCard
        title="Auth Approval Rate Trend"
        subtitle="% of authorization requests approved (response_code = '00')"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={pAuthRate}
          lines={[{ key: "rate", color: "#3b82f6", label: "Approval Rate %" }]}
          valueType="percent"
          height={300}
        />
        <ChartInsights insights={authRateInsights} />
      </ChartCard>

      {/* Two column charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Approved vs Declined"
          subtitle="Total authorization attempts by outcome"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={pTotalAuths}
            bars={[
              { key: "approved", color: "#22c55e", label: "Approved" },
              { key: "declined", color: "#ef4444", label: "Declined" },
            ]}
            height={280}
          />
          <ChartInsights insights={totalAuthsInsights} />
        </ChartCard>

        <ChartCard
          title="Channel Mix"
          subtitle="Authorization volume by transaction channel"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={pChannelMix}
            bars={[
              { key: "online", color: "#3b82f6", label: "Online" },
              { key: "offline", color: "#8b5cf6", label: "Offline POS" },
              { key: "qris", color: "#06b6d4", label: "QRIS" },
              { key: "atm", color: "#f59e0b", label: "ATM" },
            ]}
            height={280}
          />
          <ChartInsights insights={channelMixInsights} />
        </ChartCard>
      </div>

      {/* Top merchants */}
      <ChartCard
        title="Top 10 Merchants by Transaction Count"
        subtitle="Approved authorizations only"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={topMerchants}
          bars={[{ key: "txnCount", color: "#3b82f6", label: "Txn Count" }]}
          xAxisKey="merchant"
          height={360}
        />
        <ChartInsights insights={topMerchantInsights} />
      </ChartCard>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Avg Ticket Size Trend"
          subtitle="Average transaction amount (IDR) for approved auths"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardAreaChart
            data={pTicketSize}
            areas={[{ key: "avgTicket", color: "#8b5cf6", label: "Avg Ticket (IDR)" }]}
            valueType="currency"
            height={260}
          />
          <ChartInsights insights={ticketSizeInsights} />
        </ChartCard>

        <ChartCard
          title="Foreign Transaction Share"
          subtitle="% of authorizations flagged as foreign transactions"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pForeignTxn}
            lines={[{ key: "rate", color: "#f59e0b", label: "Foreign Txn %" }]}
            valueType="percent"
            height={260}
          />
          <ChartInsights insights={foreignTxnInsights} />
        </ChartCard>
      </div>

      {/* Decline reason breakdown — future */}
      <SampleDataBanner
        dataset="transaction_response_codes"
        reason="Decline reason code breakdown requires parsing non-00 response codes into categories"
      >
        <div className="p-3">
          <ChartCard
            title="Decline Reason Breakdown"
            subtitle="Top decline reasons by response code category"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
          >
            <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">
              Decline reason analysis requires response code mapping. Connect Finexus response code reference to enable.
            </div>
          </ChartCard>
        </div>
      </SampleDataBanner>

      <ActionItems section="Transaction Authorization" items={actionItems} />
    </div>
  );
}
