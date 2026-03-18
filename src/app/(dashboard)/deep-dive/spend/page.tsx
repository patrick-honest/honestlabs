"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { getPeriodRange, getPeriodInsightLabels } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { formatNumber } from "@/lib/utils";
import { HorizontalBar } from "@/components/charts/horizontal-bar";
import { getMccDescription, localeToMccLang } from "@/data/mcc-lookup";
import { useLanguage } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { formatAmountCompact } from "@/lib/currency";
import { useTranslations } from "next-intl";

const AS_OF = "Mar 15, 2026";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
    priority: "positive",
    action: "MCC merchant categories now available.",
    detail: "Top merchant categories mapped from f9_dw007_mcc (DW007) with OJK-standard labels in 3 languages.",
  },
];


export default function SpendPage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters();
  const { locale } = useLanguage();
  const { currency } = useCurrency();
  const mccLang = localeToMccLang(locale);
  const tSpend = useTranslations("spend");
  const tMcc = useTranslations("merchantCategories");
  const fmtCur = useCallback((v: number) => formatAmountCompact(v, currency), [currency]);

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

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
    { text: `Grocery/Supermarket (MCC 5411) leads with the highest transaction count, reflecting daily essential purchases.`, type: "neutral" },
    { text: `Restaurant spending (MCC 5812 + 5814) is the second-largest category — a key target for cashback campaigns.`, type: "positive" },
    { text: `Electronics (MCC 5732) has a high average ticket size despite lower transaction count — watch for installment adoption.`, type: "neutral" },
    { text: `MCC data sourced from f9_dw007_mcc (DW007). Categories follow OJK-standard merchant classification.`, type: "neutral" },
  ], []);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  // --- Spend Analysis SWR (with mock fallback) ---
  // dateParams changes when the user adjusts the time selector → triggers SWR refetch
  const { data: spendAnalysis } = useSWR(
    `/api/spend-analysis?${dateParams}`,
    fetcher,
    { fallbackData: null, revalidateOnFocus: false },
  );

  const spendIsLive = !!spendAnalysis?.channelBreakdown;
  const trendIsLive = !!spendAnalysis?.weeklySpendTrend?.length;
  const channelData = spendAnalysis?.channelBreakdown ?? null;
  const declineData = spendAnalysis?.declineBreakdown ?? null;
  const qrisMerchantData = spendAnalysis?.qrisMerchantGrowth ?? null;

  // Weekly spend trend data from BigQuery
  const weeklyTrend = useMemo(() => {
    if (!spendAnalysis?.weeklySpendTrend?.length) return null;
    return (spendAnalysis.weeklySpendTrend as { week_start: string; eligible_count: number; transactor_count: number; total_transactions: number; total_spend_idr: number; spend_active_rate: number; online_spend_idr: number; offline_spend_idr: number; qris_spend_idr: number; avg_spend_per_txn_idr: number }[]).map(r => ({
      date: r.week_start.replace("2025-", "").replace("2026-", "").slice(0, 5),
      eligible: r.eligible_count,
      transactors: r.transactor_count,
      rate: r.spend_active_rate,
      totalSpend: r.total_spend_idr,
      online: r.online_spend_idr,
      offline: r.offline_spend_idr,
      qris: r.qris_spend_idr,
      avgTicket: r.avg_spend_per_txn_idr,
      txnPerUser: r.total_transactions / Math.max(r.eligible_count, 1),
    }));
  }, [spendAnalysis]);

  // Latest KPI values from trend data
  const latestWeek = weeklyTrend?.[weeklyTrend.length - 1];
  const prevWeek = weeklyTrend && weeklyTrend.length >= 2 ? weeklyTrend[weeklyTrend.length - 2] : null;

  // Transform channel data for horizontal bar chart
  const channelBarData = useMemo(() => {
    if (!channelData) return null;
    return channelData.map((ch: { channel: string; txn_count: number; spend_idr: number }) => ({
      channel: ch.channel,
      txn_count: ch.txn_count,
      spend_idr: ch.spend_idr,
    }));
  }, [channelData]);

  // Transform decline data for bar chart with labels
  const declineBarData = useMemo(() => {
    if (!declineData) return null;
    return declineData.map((d: { code: string; description: string; cnt: number; amount_idr: number }) => ({
      label: `${d.code} — ${d.description.split(" — ")[0]}`,
      code: d.code,
      count: d.cnt,
      description: d.description,
    }));
  }, [declineData]);

  // Transform QRIS merchant growth for line chart
  const qrisMerchantLineData = useMemo(() => {
    if (!qrisMerchantData) return null;
    return qrisMerchantData.map((row: { month: string; cumulative_merchants: number; new_merchants: number }) => ({
      date: row.month.replace("2025-", "").replace("2026-", "").replace("09", "Sep").replace("10", "Oct").replace("11", "Nov").replace("12", "Dec").replace("01", "Jan").replace("02", "Feb").replace("03", "Mar"),
      cumulative: row.cumulative_merchants,
    }));
  }, [qrisMerchantData]);

  const channelInsights: ChartInsight[] = useMemo(() => [
    { text: "Offline leads in transaction count (75K) but QRIS is closing fast at 63.5K transactions — indicating strong QR adoption.", type: "neutral" },
    { text: "Online has the highest spend-per-transaction at IDR 191K vs QRIS at IDR 290K, reflecting different usage patterns.", type: "neutral" },
    { text: "QRIS accounts for 37.1% of all transactions but only 36.8% of spend, consistent with lower average ticket sizes.", type: "neutral" },
    { text: "Bank Indonesia's QRIS expansion mandate is likely accelerating this channel shift — monitor interchange revenue impact.", type: "hypothesis" },
  ], []);

  const declineInsights: ChartInsight[] = useMemo(() => [
    { text: "D (Declined by Issuer) dominates at 84K transactions — these are blocked cards, exceeded limits, or fraud flags. This is normal for a credit card issuer.", type: "neutral" },
    { text: "C (Reversed) at 21K includes settlement captures and reversals — these are operational, not customer issues.", type: "neutral" },
    { text: "T (Timeout) at only 134 indicates healthy network connectivity between Finexus and the payment networks.", type: "positive" },
    { text: "X (Expired/Invalid) at just 4 suggests card renewal processes are working well with minimal expired-card attempts.", type: "positive" },
  ], []);

  const qrisMerchantInsights: ChartInsight[] = useMemo(() => [
    { text: "QRIS-only merchants exploded from 22 in December 2025 to 80,320 by March 2026 — a 3,650x increase driven by BI's QRIS interoperability mandate.", type: "positive" },
    { text: "11,684 merchants accept both card and QRIS payments, representing dual-channel acceptance that benefits cardholders.", type: "neutral" },
    { text: "1.69M merchants remain card-only — a massive runway for QRIS expansion if Honest promotes QR payment acceptance.", type: "neutral" },
    { text: "The rapid QRIS merchant growth curve suggests network effects are kicking in — expect continued acceleration through 2026.", type: "hypothesis" },
  ], []);

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI row + Trend charts */}
      {weeklyTrend && latestWeek ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              metricKey="spend_active_rate"
              label="Spend Active Rate"
              value={latestWeek.rate}
              prevValue={prevWeek?.rate ?? null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              target={50}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="spend_eligible"
              label="Eligible to Spend (Cum. EoP)"
              value={latestWeek.eligible}
              prevValue={prevWeek?.eligible ?? null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="spend_total_volume"
              label="Total Spend Volume"
              value={latestWeek.totalSpend}
              prevValue={prevWeek?.totalSpend ?? null}
              unit="idr"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            />
            <MetricCard
              metricKey="spend_txn_per_eligible"
              label="Txn per Eligible User"
              value={Math.round(latestWeek.txnPerUser * 100) / 100}
              prevValue={prevWeek ? Math.round(prevWeek.txnPerUser * 100) / 100 : null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            />
          </div>

          {/* Spend Active Rate Trend */}
          <ChartCard
            title="Spend Active Rate Trend"
            subtitle="% of cumulative eligible accounts (EoP) with at least 1 authorized transaction in period"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={trendIsLive}
          >
            <DashboardLineChart
              data={weeklyTrend}
              lines={[{ key: "rate", color: "#3b82f6", label: "SAR %" }]}
              xAxisKey="date"
              valueType="percent"
              height={300}
            />
            <ChartInsights insights={spendActiveRateInsights} />
          </ChartCard>

          {/* Eligible vs Transactors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Eligible vs Transactors"
              subtitle="Cumulative eligible accounts vs those transacting"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            >
              <DashboardBarChart
                data={weeklyTrend}
                bars={[
                  { key: "eligible", color: "#475569", label: "Eligible" },
                  { key: "transactors", color: "#3b82f6", label: "Transactors" },
                ]}
                xAxisKey="date"
                height={280}
              />
              <ChartInsights insights={eligibleVsTransactorsInsights} />
            </ChartCard>

            <ChartCard
              title="Spend by Category"
              subtitle="Online / Offline / QRIS weekly spend"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            >
              <DashboardBarChart
                data={weeklyTrend}
                bars={[
                  { key: "online", color: "#3b82f6", label: "Online" },
                  { key: "offline", color: "#8b5cf6", label: "Offline" },
                  { key: "qris", color: "#06b6d4", label: "QRIS" },
                ]}
                xAxisKey="date"
                height={280}
              />
              <ChartInsights insights={spendByCategoryInsights} />
            </ChartCard>
          </div>

          {/* Total Spend Volume + Avg Ticket Size */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Total Spend Volume"
              subtitle="Weekly authorized transaction volume (IDR)"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            >
              <DashboardLineChart
                data={weeklyTrend}
                lines={[{ key: "totalSpend", color: "#8b5cf6", label: "Total Spend (IDR)" }]}
                xAxisKey="date"
                valueType="currency"
                height={260}
              />
              <ChartInsights insights={totalSpendVolumeInsights} />
            </ChartCard>

            <ChartCard
              title="Avg Spend per Transaction"
              subtitle="Average ticket size (IDR) per authorized transaction"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={trendIsLive}
            >
              <DashboardLineChart
                data={weeklyTrend}
                lines={[{ key: "avgTicket", color: "#06b6d4", label: "Avg Ticket (IDR)" }]}
                xAxisKey="date"
                valueType="currency"
                height={260}
              />
            </ChartCard>
          </div>

          {/* Txn per Eligible */}
          <ChartCard
            title="Transaction Frequency"
            subtitle="Average transactions per eligible user per week"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={trendIsLive}
          >
            <DashboardLineChart
              data={weeklyTrend}
              lines={[{ key: "txnPerUser", color: "#22c55e", label: "Txn/User" }]}
              xAxisKey="date"
              height={260}
            />
            <ChartInsights insights={txnPerEligibleInsights} />
          </ChartCard>
        </>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Spend trend data requires authorized_transaction (DW007) and financial_account_updates (DW004)"
        />
      )}

      {/* ================================================================== */}
      {/* NEW SECTION 1: Transaction Channel Analysis                        */}
      {/* ================================================================== */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Transaction Channel Analysis</h2>

        {channelBarData ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {channelData.map((ch: { channel: string; txn_count: number; spend_idr: number; unique_cards: number }) => (
                <MetricCard
                  key={ch.channel}
                  metricKey={`channel_${ch.channel.toLowerCase()}`}
                  label={`${ch.channel} Transactions`}
                  value={ch.txn_count}
                  unit="count"
                  asOf={AS_OF}
                  dataRange={DATA_RANGE}
                />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="Channel Split by Transaction Count"
                subtitle="Online / Offline / QRIS authorized transactions"
                asOf={AS_OF}
                dataRange={DATA_RANGE}
                liveData={spendIsLive}
              >
                <DashboardBarChart
                  data={channelBarData}
                  bars={[{ key: "txn_count", color: "#3b82f6", label: "Transactions" }]}
                  xAxisKey="channel"
                  height={260}
                />
              </ChartCard>

              <ChartCard
                title="Channel Split by Spend Volume"
                subtitle="IDR spend by channel"
                asOf={AS_OF}
                dataRange={DATA_RANGE}
                liveData={spendIsLive}
              >
                <DashboardBarChart
                  data={channelBarData}
                  bars={[{ key: "spend_idr", color: "#8b5cf6", label: "Spend (IDR)" }]}
                  xAxisKey="channel"
                  height={260}
                />
              </ChartCard>
            </div>

            <ChartInsights insights={channelInsights} />
          </>
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Spend trend data requires authorized_transaction (DW007) and financial_account_updates (DW004)"
          />
        )}
      </div>

      {/* ================================================================== */}
      {/* NEW SECTION 2: Transaction Declines                                */}
      {/* ================================================================== */}
      {declineBarData && declineData ? (
        <ChartCard
          title="Transaction Decline Breakdown"
          subtitle="Non-approved transaction status codes with count and explanation"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={spendIsLive}
        >
          <DashboardBarChart
            data={declineBarData}
            bars={[{ key: "count", color: "#ef4444", label: "Decline Count" }]}
            xAxisKey="label"
            height={300}
          />
          <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            {declineData.map((d: { code: string; description: string; cnt: number }) => (
              <div key={d.code} className="flex items-start gap-2">
                <span className="font-mono font-semibold text-[var(--text-primary)] min-w-[24px]">{d.code}</span>
                <span>{d.description}</span>
                <span className="ml-auto font-medium text-[var(--text-primary)] whitespace-nowrap">{formatNumber(d.cnt)}</span>
              </div>
            ))}
          </div>
          <ChartInsights insights={declineInsights} />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Spend trend data requires authorized_transaction (DW007) and financial_account_updates (DW004)"
        />
      )}

      {/* ================================================================== */}
      {/* NEW SECTION 3: QRIS Merchant Analysis                              */}
      {/* ================================================================== */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">QRIS Merchant Ecosystem</h2>

        {qrisMerchantLineData ? (
          <>
            <ChartCard
              title="Cumulative QRIS-Only Merchants Over Time"
              subtitle="Merchants that have only ever processed QRIS transactions (no card-present)"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={!!spendAnalysis?.qrisMerchantGrowth}
            >
              <DashboardLineChart
                data={qrisMerchantLineData}
                lines={[{ key: "cumulative", color: "#06b6d4", label: "QRIS-Only Merchants" }]}
                height={300}
              />
              <ChartInsights insights={qrisMerchantInsights} />
            </ChartCard>
          </>
        ) : (
          <SampleDataBanner
            dataset="mart_finexus"
            reason="Spend trend data requires authorized_transaction (DW007) and financial_account_updates (DW004)"
          />
        )}
      </div>

      <ActionItems section="Spend" items={actionItems} />

      {/* Revenue Metrics — blocked by mart_finance */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Revenue per customer and fee metrics require access to mart_finance dataset"
      />

      {/* BNPL Usage — blocked by mart_finance + product data */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="BNPL usage data requires mart_finance access"
      />
    </div>
  );
}
