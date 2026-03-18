"use client";

import { useCallback, useMemo } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, getPeriodInsightLabels, scaleTrendData, scaleMetricValue } from "@/lib/period-data";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const AS_OF = "Mar 15, 2026";

// Mock data
const activeAccountsTrend = [
  { date: "Oct", active: 18500 },
  { date: "Nov", active: 19200 },
  { date: "Dec", active: 20100 },
  { date: "Jan", active: 21000 },
  { date: "Feb", active: 21800 },
  { date: "Mar", active: 22500 },
];

const newAccountsPerPeriod = [
  { date: "Oct", newAccounts: 3200 },
  { date: "Nov", newAccounts: 3450 },
  { date: "Dec", newAccounts: 2900 },
  { date: "Jan", newAccounts: 3800 },
  { date: "Feb", newAccounts: 4100 },
  { date: "Mar", newAccounts: 4200 },
];

const creditLimitDistribution = [
  { bucket: "0-5M", count: 4200 },
  { bucket: "5-10M", count: 8100 },
  { bucket: "10-15M", count: 5800 },
  { bucket: "15-20M", count: 2900 },
  { bucket: "20-30M", count: 1100 },
  { bucket: "30M+", count: 400 },
];

const creditUtilization = [
  { date: "Oct", utilization: 32.5 },
  { date: "Nov", utilization: 34.1 },
  { date: "Dec", utilization: 38.8 },
  { date: "Jan", utilization: 35.2 },
  { date: "Feb", utilization: 36.1 },
  { date: "Mar", utilization: 37.4 },
];

const accountStatusBreakdown = [
  { name: "Good/Normal", value: 20800, color: "#22c55e" },
  { name: "Blocked", value: 850, color: "#f59e0b" },
  { name: "Closed", value: 620, color: "#ef4444" },
  { name: "Suspended", value: 230, color: "#6b7280" },
];

const repaymentMetrics = [
  { date: "Oct", volume: 15000000000, count: 12500 },
  { date: "Nov", volume: 16200000000, count: 13100 },
  { date: "Dec", volume: 18500000000, count: 14800 },
  { date: "Jan", volume: 17000000000, count: 13900 },
  { date: "Feb", volume: 17800000000, count: 14200 },
  { date: "Mar", volume: 18200000000, count: 14600 },
];

const actionItems: ActionItem[] = [
  {
    id: "port-1",
    priority: "positive",
    action: "Portfolio growing steadily at ~700 net new accounts/month.",
    detail: "Active accounts reached 22.5K. Credit utilization at healthy 37.4%.",
  },
  {
    id: "port-2",
    priority: "monitor",
    action: "Credit utilization trending up from 32.5% to 37.4%.",
    detail: "Still within normal range but worth monitoring. Higher utilization may signal increased risk for some segments.",
  },
  {
    id: "port-3",
    priority: "monitor",
    action: "850 accounts in blocked status.",
    detail: "Review blocked accounts for potential reactivation or closure. Some may be resolved fraud cases.",
  },
];


// ── Sample data: Card Receivables Balance (mart_finance blocked) ──
const grossReceivablesTrend = [
  { date: "Apr 25", receivables: 38200 },
  { date: "May 25", receivables: 38900 },
  { date: "Jun 25", receivables: 39400 },
  { date: "Jul 25", receivables: 39100 },
  { date: "Aug 25", receivables: 39800 },
  { date: "Sep 25", receivables: 40200 },
  { date: "Oct 25", receivables: 40600 },
  { date: "Nov 25", receivables: 41100 },
  { date: "Dec 25", receivables: 41800 },
  { date: "Jan 26", receivables: 41200 },
  { date: "Feb 26", receivables: 41600 },
  { date: "Mar 26", receivables: 42100 },
];

const receivablesPerCustomerTrend = [
  { date: "Apr 25", perCustomer: 161 },
  { date: "May 25", perCustomer: 163 },
  { date: "Jun 25", perCustomer: 165 },
  { date: "Jul 25", perCustomer: 164 },
  { date: "Aug 25", perCustomer: 167 },
  { date: "Sep 25", perCustomer: 170 },
  { date: "Oct 25", perCustomer: 172 },
  { date: "Nov 25", perCustomer: 174 },
  { date: "Dec 25", perCustomer: 178 },
  { date: "Jan 26", perCustomer: 175 },
  { date: "Feb 26", perCustomer: 177 },
  { date: "Mar 26", perCustomer: 181 },
];

// ── Sample data: NPL & Provision (mart_finance blocked) ──
const nplAbsoluteTrend = [
  { date: "Apr 25", npl: 2520 },
  { date: "May 25", npl: 2610 },
  { date: "Jun 25", npl: 2700 },
  { date: "Jul 25", npl: 2780 },
  { date: "Aug 25", npl: 2900 },
  { date: "Sep 25", npl: 3050 },
  { date: "Oct 25", npl: 3200 },
  { date: "Nov 25", npl: 3350 },
  { date: "Dec 25", npl: 3500 },
  { date: "Jan 26", npl: 3620 },
  { date: "Feb 26", npl: 3710 },
  { date: "Mar 26", npl: 3800 },
];

const nplRatioTrend = [
  { date: "Apr 25", nplRatio: 6.6 },
  { date: "May 25", nplRatio: 6.7 },
  { date: "Jun 25", nplRatio: 6.9 },
  { date: "Jul 25", nplRatio: 7.1 },
  { date: "Aug 25", nplRatio: 7.3 },
  { date: "Sep 25", nplRatio: 7.6 },
  { date: "Oct 25", nplRatio: 7.9 },
  { date: "Nov 25", nplRatio: 8.2 },
  { date: "Dec 25", nplRatio: 8.4 },
  { date: "Jan 26", nplRatio: 8.8 },
  { date: "Feb 26", nplRatio: 9.0 },
  { date: "Mar 26", nplRatio: 9.5 },
];

const provisionBalanceTrend = [
  { date: "Apr 25", provision: 1800 },
  { date: "May 25", provision: 1870 },
  { date: "Jun 25", provision: 1940 },
  { date: "Jul 25", provision: 2010 },
  { date: "Aug 25", provision: 2100 },
  { date: "Sep 25", provision: 2200 },
  { date: "Oct 25", provision: 2320 },
  { date: "Nov 25", provision: 2440 },
  { date: "Dec 25", provision: 2560 },
  { date: "Jan 26", provision: 2670 },
  { date: "Feb 26", provision: 2760 },
  { date: "Mar 26", provision: 2850 },
];

// ── Sample data: Revolving Rate (mart_finance blocked) ──
const revolvingRateTrend = [
  { date: "Apr 25", revolvingRate: 63.2 },
  { date: "May 25", revolvingRate: 64.0 },
  { date: "Jun 25", revolvingRate: 64.5 },
  { date: "Jul 25", revolvingRate: 65.1 },
  { date: "Aug 25", revolvingRate: 65.8 },
  { date: "Sep 25", revolvingRate: 66.4 },
  { date: "Oct 25", revolvingRate: 67.0 },
  { date: "Nov 25", revolvingRate: 67.8 },
  { date: "Dec 25", revolvingRate: 69.5 },
  { date: "Jan 26", revolvingRate: 68.2 },
  { date: "Feb 26", revolvingRate: 68.8 },
  { date: "Mar 26", revolvingRate: 69.7 },
];

const activeCustomerRatioTrend = [
  { date: "Apr 25", activeRatio: 47.2 },
  { date: "May 25", activeRatio: 47.5 },
  { date: "Jun 25", activeRatio: 47.8 },
  { date: "Jul 25", activeRatio: 48.0 },
  { date: "Aug 25", activeRatio: 48.1 },
  { date: "Sep 25", activeRatio: 48.3 },
  { date: "Oct 25", activeRatio: 48.5 },
  { date: "Nov 25", activeRatio: 48.4 },
  { date: "Dec 25", activeRatio: 48.8 },
  { date: "Jan 26", activeRatio: 48.2 },
  { date: "Feb 26", activeRatio: 48.5 },
  { date: "Mar 26", activeRatio: 48.7 },
];

export default function PortfolioPage() {
  const { period, periodLabel, timeRangeMultiplier } = usePeriod();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const pActiveAccounts = useMemo(() => applyFilterToData(scaleTrendData(activeAccountsTrend, period), filters), [period, filters]);
  const pNewAccounts = useMemo(() => applyFilterToData(scaleTrendData(newAccountsPerPeriod, period), filters), [period, filters]);
  const pCreditUtilization = useMemo(() => applyFilterToData(scaleTrendData(creditUtilization, period), filters), [period, filters]);
  const pRepaymentMetrics = useMemo(() => applyFilterToData(scaleTrendData(repaymentMetrics, period), filters), [period, filters]);

  const activeAccountsInsights: ChartInsight[] = useMemo(() => [
    { text: `Portfolio grew 21.62% over ${p.span}, adding ~700 net accounts per ${p.unit}.`, type: "positive" },
    { text: `Growth is accelerating — ${p.changeAbbrev} net adds (700) maintained despite a larger base.`, type: "positive" },
    { text: "At current trajectory the portfolio will cross 25K active accounts by mid-2026.", type: "neutral" },
    { text: "Indonesia digital banking adoption is expanding — rising smartphone penetration may be sustaining above-trend acquisition.", type: "hypothesis" },
  ], [p]);

  const newAccountsInsights: ChartInsight[] = useMemo(() => [
    { text: `New account volume hit 4,200 in ${p.lastLabel}, the highest in the ${p.trailingWindow}.`, type: "positive" },
    { text: "Dec dipped to 2,900 — a seasonal slowdown likely tied to year-end holidays.", type: "neutral" },
    { text: "Jan-Mar rebound (+44.83% from Dec trough) signals a healthy acquisition pipeline heading into Q2.", type: "positive" },
    { text: "Competitor promotional campaigns in Q1 may be lifting overall market demand, benefiting our pipeline.", type: "hypothesis" },
  ], [p]);

  const creditLimitInsights: ChartInsight[] = useMemo(() => [
    { text: "The 5-10M IDR bucket holds 35.92% of all accounts — the portfolio is concentrated in mid-tier limits.", type: "neutral" },
    { text: "Only 400 accounts (1.77%) carry limits above 30M IDR, indicating conservative underwriting at the top end.", type: "neutral" },
    { text: "Heavy concentration below 15M IDR limits overall credit exposure but also caps per-account revenue potential.", type: "negative" },
    { text: "Regulatory tightening on unsecured consumer lending in Indonesia may be constraining higher-limit approvals.", type: "hypothesis" },
  ], [p]);

  const creditUtilizationInsights: ChartInsight[] = useMemo(() => [
    { text: `Utilization rose from 32.5% to 37.4% over ${p.span} — a 4.9pp increase worth monitoring.`, type: "neutral" },
    { text: "The 35-40% range is considered healthy; crossing 45% would signal elevated portfolio risk.", type: "neutral" },
    { text: "Dec spike to 38.8% aligns with holiday spending; Jan correction to 35.2% shows seasonal normalization.", type: "positive" },
    { text: "Rising e-commerce penetration in Indonesia may be structurally pushing credit card utilization higher.", type: "hypothesis" },
  ], [p]);

  const accountStatusInsights: ChartInsight[] = useMemo(() => [
    { text: "92.45% of accounts are in Good/Normal status — a strong portfolio health indicator.", type: "positive" },
    { text: "850 blocked accounts (3.78%) represent a reactivation opportunity if fraud reviews are cleared.", type: "neutral" },
    { text: "Closed accounts at 620 (2.75%) — investigate whether voluntary churn or forced closures dominate.", type: "negative" },
    { text: "Suspended accounts (230) are low at 1.02%, but each should be reviewed for resolution within 30 days.", type: "neutral" },
    { text: "Tighter OJK enforcement on dormant accounts may be contributing to the blocked/suspended volume.", type: "hypothesis" },
  ], [p]);

  const repaymentInsights: ChartInsight[] = useMemo(() => [
    { text: `Repayment volume grew 21.33% from ${p.firstLabel} (15B IDR) to ${p.lastLabel} (18.2B IDR), tracking portfolio growth.`, type: "positive" },
    { text: "Repayment count rose from 12,500 to 14,600 — average repayment size stayed relatively stable.", type: "neutral" },
    { text: "Dec peak (18.5B IDR) likely reflects statement-cycle timing after holiday spend; Jan dipped before recovering.", type: "neutral" },
    { text: "Growing digital payment infrastructure in Indonesia may be reducing friction and boosting on-time repayment rates.", type: "hypothesis" },
  ], [p]);

  const receivablesInsights: ChartInsight[] = useMemo(() => [
    { text: "Gross receivables grew from $38.2M to $42.1M (+10.2%) over 12 months, tracking portfolio expansion.", type: "positive" },
    { text: "Receivables per customer rose from $161 to $181, indicating higher average balances per cardholder.", type: "neutral" },
    { text: "Dec peak ($41.8M) reflects seasonal holiday spending; Jan correction is typical.", type: "neutral" },
    { text: "If per-customer receivables keep climbing, it may signal rising credit dependency among cardholders.", type: "hypothesis" },
  ], [p]);

  const nplInsights: ChartInsight[] = useMemo(() => [
    { text: "NPL absolute value grew 50.8% ($2.52M to $3.80M) — outpacing portfolio growth, a concern.", type: "negative" },
    { text: "NPL ratio climbed from 6.6% to 9.5% — approaching the 10% OJK regulatory watch threshold.", type: "negative" },
    { text: "Provision balance increased in lockstep ($1.8M to $2.85M), maintaining ~75% coverage ratio.", type: "neutral" },
    { text: "Macroeconomic headwinds (IDR depreciation, inflation) may be accelerating delinquency migration.", type: "hypothesis" },
  ], [p]);

  const revolvingInsights: ChartInsight[] = useMemo(() => [
    { text: `Revolving rate rose from 63.2% to 69.7% — more customers carrying balances ${p.changeFull}.`, type: "neutral" },
    { text: "Dec spike to 69.5% aligns with holiday spending; the rate did not fully revert in Jan.", type: "negative" },
    { text: "Active customer ratio is stable near 48%, indicating roughly half of issued cards see regular use.", type: "neutral" },
    { text: "Rising revolving rate combined with rising NPL may indicate stress in the lower-income cardholder segment.", type: "hypothesis" },
  ], [p]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Portfolio Deep Dive</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="port_active_accounts"
          label="Active Accounts"
          value={applyFilterToMetric(22500, filters, false)}
          prevValue={applyFilterToMetric(21800, filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pActiveAccounts.map((d) => d.active)}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="port_new_accounts"
          label="New Accounts (Period)"
          value={applyFilterToMetric(scaleMetricValue(4200, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(4100, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="port_utilization"
          label="Avg Credit Utilization"
          value={applyFilterToMetric(scaleMetricValue(37.4, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(36.1, period, true), filters, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="port_repayment_vol"
          label="Repayment Volume"
          value={applyFilterToMetric(scaleMetricValue(18200000000, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(17800000000, period, false, timeRangeMultiplier), filters, false)}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Active Accounts Trend"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pActiveAccounts}
            lines={[{ key: "active", color: "#3b82f6", label: "Active Accounts" }]}
            height={280}
          />
          <ChartInsights insights={activeAccountsInsights} />
        </ChartCard>

        <ChartCard
          title="New Accounts per Period"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={pNewAccounts}
            bars={[{ key: "newAccounts", color: "#22c55e", label: "New Accounts" }]}
            height={280}
          />
          <ChartInsights insights={newAccountsInsights} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Credit Limit Distribution"
          subtitle="Accounts by approved credit limit bucket"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={creditLimitDistribution}
            bars={[{ key: "count", color: "#8b5cf6", label: "Accounts" }]}
            xAxisKey="bucket"
            height={280}
          />
          <ChartInsights insights={creditLimitInsights} />
        </ChartCard>

        <ChartCard
          title="Credit Utilization Trend"
          subtitle="Average utilization % over time"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pCreditUtilization}
            lines={[{ key: "utilization", color: "#f59e0b", label: "Utilization %" }]}
            valueType="percent"
            height={280}
          />
          <ChartInsights insights={creditUtilizationInsights} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Account Status Breakdown"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountStatusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {accountStatusBreakdown.map((entry) => (
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
          <ChartInsights insights={accountStatusInsights} />
        </ChartCard>

        <ChartCard
          title="Repayment Metrics"
          subtitle="Monthly repayment volume and transaction count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={pRepaymentMetrics}
            bars={[{ key: "count", color: "#06b6d4", label: "Repayment Count" }]}
            height={280}
          />
          <ChartInsights insights={repaymentInsights} />
        </ChartCard>
      </div>

      {/* ── Card Receivables Balance (mart_finance blocked) ── */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Receivables balance data requires access to mart_finance dataset"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Gross Receivables Balance"
            subtitle="USD thousands"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={grossReceivablesTrend}
              lines={[{ key: "receivables", color: "#6366f1", label: "Receivables ($K)" }]}
              height={280}
            />
          </ChartCard>

          <ChartCard
            title="Receivables per Customer"
            subtitle="USD per active customer"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={receivablesPerCustomerTrend}
              lines={[{ key: "perCustomer", color: "#8b5cf6", label: "Per Customer ($)" }]}
              height={280}
            />
          </ChartCard>
        </div>
        <ChartInsights insights={receivablesInsights} />
      </SampleDataBanner>

      {/* ── NPL & Provision (mart_finance blocked) ── */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="NPL and provision data requires access to mart_finance dataset"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="NPL Absolute Value"
            subtitle="USD thousands"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={nplAbsoluteTrend}
              lines={[{ key: "npl", color: "#ef4444", label: "NPL ($K)" }]}
              height={280}
            />
          </ChartCard>

          <ChartCard
            title="NPL Ratio"
            subtitle="NPL as % of gross receivables"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={nplRatioTrend}
              lines={[{ key: "nplRatio", color: "#f97316", label: "NPL Ratio %" }]}
              valueType="percent"
              height={280}
            />
          </ChartCard>
        </div>

        <ChartCard
          title="Provision Balance"
          subtitle="USD thousands"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={provisionBalanceTrend}
            bars={[{ key: "provision", color: "#f59e0b", label: "Provision ($K)" }]}
            height={260}
          />
        </ChartCard>
        <ChartInsights insights={nplInsights} />
      </SampleDataBanner>

      {/* ── Revolving Rate (mart_finance blocked) ── */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Revolving and active customer financial ratios require mart_finance access"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Revolving Rate"
            subtitle="% of customers carrying a balance"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={revolvingRateTrend}
              lines={[{ key: "revolvingRate", color: "#14b8a6", label: "Revolving Rate %" }]}
              valueType="percent"
              height={280}
            />
          </ChartCard>

          <ChartCard
            title="Active Customer Ratio"
            subtitle="% of issued cards with activity"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={activeCustomerRatioTrend}
              lines={[{ key: "activeRatio", color: "#0ea5e9", label: "Active Ratio %" }]}
              valueType="percent"
              height={280}
            />
          </ChartCard>
        </div>
        <ChartInsights insights={revolvingInsights} />
      </SampleDataBanner>

      <ActionItems section="Portfolio" items={actionItems} />
    </div>
  );
}
