"use client";

import { useCallback, useMemo } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { usePeriod } from "@/hooks/use-period";
import { getPeriodRange, scaleTrendData, scaleMetricValue } from "@/lib/period-data";
import { Header } from "@/components/layout/header";
import type { QueryInfo } from "@/components/query-inspector/query-inspector";

const AS_OF = "Mar 15, 2026";

// ---------------------------------------------------------------------------
// Query metadata — describes the BigQuery SQL that would power each section
// ---------------------------------------------------------------------------

const Q_REPAYMENT_KPIS: QueryInfo = {
  title: "Repayments: Monthly KPIs",
  sql: `-- Total repayment count & amount from posted_transaction (DW009)
SELECT
  DATE_TRUNC(txn_dte, MONTH)              AS month_key,
  COUNT(*)                                 AS repayment_count,
  SUM(txn_amt)                             AS total_repaid,
  COUNT(DISTINCT P9_DW004_LOC_ACCT)        AS unique_accounts
FROM \`honest-data-warehouse.cardworks_dw.posted_transaction\`       -- DW009
WHERE txn_cde IN ('4111','4621','4631')    -- payment transaction codes
  AND txn_dte BETWEEN @start_date AND @end_date
GROUP BY 1
ORDER BY 1`,
  params: [
    { name: "start_date", value: "2025-10-01", type: "DATE" },
    { name: "end_date", value: "2026-03-15", type: "DATE" },
  ],
};

const Q_CHANNEL_BREAKDOWN: QueryInfo = {
  title: "Repayments: Channel / Vendor Breakdown",
  sql: `-- Repayment channel mix from repayment_completed + posted_transaction
SELECT
  DATE_TRUNC(rc.completed_at, MONTH)       AS month_key,
  rc.payment_channel,                       -- VA, QRIS, CONVENIENCE_STORE, AUTO_DEBIT, OTHER
  COUNT(*)                                  AS txn_count,
  SUM(pt.txn_amt)                           AS amount
FROM \`honest-data-warehouse.payments.repayment_completed\` rc
JOIN \`honest-data-warehouse.cardworks_dw.posted_transaction\` pt  -- DW009
  ON rc.loc_acct = pt.P9_DW004_LOC_ACCT
  AND rc.reference_id = pt.txn_ref_no
WHERE pt.txn_cde IN ('4111','4621','4631')
  AND rc.completed_at BETWEEN @start_date AND @end_date
GROUP BY 1, 2
ORDER BY 1, 2`,
  params: [
    { name: "start_date", value: "2025-10-01", type: "DATE" },
    { name: "end_date", value: "2026-03-15", type: "DATE" },
  ],
};

const Q_TIMELINESS: QueryInfo = {
  title: "Repayments: Payment Timeliness (DPD at time of payment)",
  sql: `-- Timeliness buckets: join payment date against due date from financial_account_updates (DW004)
SELECT
  DATE_TRUNC(pt.txn_dte, MONTH)            AS month_key,
  CASE
    WHEN DATE_DIFF(pt.txn_dte, fa.pmt_due_dte, DAY) <= 0 THEN 'On-Time'
    WHEN DATE_DIFF(pt.txn_dte, fa.pmt_due_dte, DAY) BETWEEN 1 AND 7 THEN 'Grace Period'
    WHEN DATE_DIFF(pt.txn_dte, fa.pmt_due_dte, DAY) BETWEEN 8 AND 30 THEN 'Late'
    ELSE 'Very Late'
  END                                       AS timeliness_bucket,
  COUNT(DISTINCT pt.P9_DW004_LOC_ACCT)     AS account_count
FROM \`honest-data-warehouse.cardworks_dw.posted_transaction\` pt   -- DW009
JOIN \`honest-data-warehouse.cardworks_dw.financial_account_updates\` fa  -- DW004
  ON pt.P9_DW004_LOC_ACCT = fa.P4_DW004_LOC_ACCT
WHERE pt.txn_cde IN ('4111','4621','4631')
  AND pt.txn_dte BETWEEN @start_date AND @end_date
GROUP BY 1, 2
ORDER BY 1, 2`,
  params: [
    { name: "start_date", value: "2025-10-01", type: "DATE" },
    { name: "end_date", value: "2026-03-15", type: "DATE" },
  ],
};

const Q_PAYMENT_RATIO: QueryInfo = {
  title: "Repayments: Payment-to-Bill Ratio Distribution",
  sql: `-- Ratio of amount paid vs. statement balance from DW004
WITH bills AS (
  SELECT P4_DW004_LOC_ACCT, DATE_TRUNC(stm_dte, MONTH) AS month_key,
         stm_bal AS billed_amount
  FROM \`honest-data-warehouse.cardworks_dw.financial_account_updates\`  -- DW004
  WHERE stm_dte BETWEEN @start_date AND @end_date
),
payments AS (
  SELECT P9_DW004_LOC_ACCT, DATE_TRUNC(txn_dte, MONTH) AS month_key,
         SUM(txn_amt) AS paid_amount
  FROM \`honest-data-warehouse.cardworks_dw.posted_transaction\`         -- DW009
  WHERE txn_cde IN ('4111','4621','4631')
    AND txn_dte BETWEEN @start_date AND @end_date
  GROUP BY 1, 2
)
SELECT b.month_key,
  CASE
    WHEN SAFE_DIVIDE(p.paid_amount, b.billed_amount) >= 1.0 THEN 'Full (100%+)'
    WHEN SAFE_DIVIDE(p.paid_amount, b.billed_amount) >= 0.75 THEN '75-99%'
    WHEN SAFE_DIVIDE(p.paid_amount, b.billed_amount) >= 0.50 THEN '50-74%'
    WHEN SAFE_DIVIDE(p.paid_amount, b.billed_amount) >= 0.25 THEN '25-49%'
    WHEN p.paid_amount > 0 THEN 'Min Only (<25%)'
    ELSE 'Zero Payment'
  END AS ratio_bucket,
  COUNT(DISTINCT b.P4_DW004_LOC_ACCT) AS account_count
FROM bills b
LEFT JOIN payments p ON b.P4_DW004_LOC_ACCT = p.P9_DW004_LOC_ACCT AND b.month_key = p.month_key
GROUP BY 1, 2
ORDER BY 1, 2`,
  params: [
    { name: "start_date", value: "2025-10-01", type: "DATE" },
    { name: "end_date", value: "2026-03-15", type: "DATE" },
  ],
};

const Q_AMOUNT_TREND: QueryInfo = {
  title: "Repayments: Amount Trend & Avg per Customer",
  sql: `-- Total and average repayment amounts from posted_transaction (DW009)
SELECT
  DATE_TRUNC(txn_dte, MONTH)                        AS month_key,
  SUM(txn_amt)                                       AS total_repaid,
  AVG(txn_amt)                                       AS avg_repayment,
  SUM(txn_amt) / COUNT(DISTINCT P9_DW004_LOC_ACCT)  AS avg_per_account
FROM \`honest-data-warehouse.cardworks_dw.posted_transaction\`  -- DW009
WHERE txn_cde IN ('4111','4621','4631')
  AND txn_dte BETWEEN @start_date AND @end_date
GROUP BY 1
ORDER BY 1`,
  params: [
    { name: "start_date", value: "2025-10-01", type: "DATE" },
    { name: "end_date", value: "2026-03-15", type: "DATE" },
  ],
};

const Q_DPD_COHORT: QueryInfo = {
  title: "Repayments: Late Payment Cohort (DPD Buckets)",
  sql: `-- DPD bucket analysis from financial_account_updates (DW004) + payment data
SELECT
  CASE
    WHEN fa.dpd_days = 0 THEN 'Current (0)'
    WHEN fa.dpd_days BETWEEN 1 AND 7 THEN '1-7 days'
    WHEN fa.dpd_days BETWEEN 8 AND 30 THEN '8-30 days'
    WHEN fa.dpd_days BETWEEN 31 AND 60 THEN '31-60 days'
    WHEN fa.dpd_days BETWEEN 61 AND 90 THEN '61-90 days'
  END AS dpd_bucket,
  COUNT(DISTINCT fa.P4_DW004_LOC_ACCT) AS account_count,
  SAFE_DIVIDE(
    SUM(pt.txn_amt),
    SUM(fa.stm_bal)
  ) AS avg_payment_rate
FROM \`honest-data-warehouse.cardworks_dw.financial_account_updates\` fa  -- DW004
LEFT JOIN \`honest-data-warehouse.cardworks_dw.posted_transaction\` pt    -- DW009
  ON fa.P4_DW004_LOC_ACCT = pt.P9_DW004_LOC_ACCT
  AND pt.txn_cde IN ('4111','4621','4631')
WHERE fa.dpd_days <= 90
  AND fa.reporting_date BETWEEN @start_date AND @end_date
GROUP BY 1
ORDER BY 1`,
  params: [
    { name: "start_date", value: "2025-10-01", type: "DATE" },
    { name: "end_date", value: "2026-03-15", type: "DATE" },
  ],
};

// ---------------------------------------------------------------------------
// Mock data — realistic for ~235K customers, ~115K active accounts
// ---------------------------------------------------------------------------

// --- Section 1: KPI sparklines ---
const repaymentCountTrend = [
  { date: "Oct", count: 41200 },
  { date: "Nov", count: 42500 },
  { date: "Dec", count: 39800 },
  { date: "Jan", count: 43100 },
  { date: "Feb", count: 44200 },
  { date: "Mar", count: 45300 },
];

const totalAmountTrend = [
  { date: "Oct", amount: 24500000000 },
  { date: "Nov", amount: 25800000000 },
  { date: "Dec", amount: 23200000000 },
  { date: "Jan", amount: 26400000000 },
  { date: "Feb", amount: 27100000000 },
  { date: "Mar", amount: 28300000000 },
];

const latePaymentRateTrend = [
  { date: "Oct", rate: 25.8 },
  { date: "Nov", rate: 24.5 },
  { date: "Dec", rate: 27.1 },
  { date: "Jan", rate: 24.0 },
  { date: "Feb", rate: 23.2 },
  { date: "Mar", rate: 22.4 },
];

const paymentToBillRatioTrend = [
  { date: "Oct", rate: 74.2 },
  { date: "Nov", rate: 75.1 },
  { date: "Dec", rate: 72.8 },
  { date: "Jan", rate: 76.3 },
  { date: "Feb", rate: 77.0 },
  { date: "Mar", rate: 78.4 },
];

// --- Section 2: Channel breakdown (stacked bar) ---
const channelBreakdown = [
  { date: "Oct", virtualAccount: 18540, qris: 7420, convenienceStore: 7830, autoDebit: 4530, other: 2880 },
  { date: "Nov", virtualAccount: 19130, qris: 8080, convenienceStore: 7870, autoDebit: 4760, other: 2660 },
  { date: "Dec", virtualAccount: 17910, qris: 7760, convenienceStore: 7370, autoDebit: 4380, other: 2380 },
  { date: "Jan", virtualAccount: 19400, qris: 8620, convenienceStore: 7760, autoDebit: 4870, other: 2450 },
  { date: "Feb", virtualAccount: 19890, qris: 9280, convenienceStore: 7740, autoDebit: 4890, other: 2400 },
  { date: "Mar", virtualAccount: 20390, qris: 9510, convenienceStore: 7920, autoDebit: 5010, other: 2470 },
];

// --- Section 3: Payment timeliness (stacked bar) ---
const timelinessTrend = [
  { date: "Oct", onTime: 30490, gracePeriod: 5770, late: 3500, veryLate: 1440 },
  { date: "Nov", onTime: 31880, gracePeriod: 5740, late: 3440, veryLate: 1440 },
  { date: "Dec", onTime: 29010, gracePeriod: 5730, late: 3620, veryLate: 1440 },
  { date: "Jan", onTime: 32760, gracePeriod: 5590, late: 3310, veryLate: 1440 },
  { date: "Feb", onTime: 33930, gracePeriod: 5440, late: 3350, veryLate: 1480 },
  { date: "Mar", onTime: 35140, gracePeriod: 5310, late: 3370, veryLate: 1480 },
];

// --- Section 4: Payment-to-bill ratio distribution (stacked bar) ---
const ratioDistribution = [
  { date: "Oct", full: 28200, above75: 14800, pct50to75: 11300, pct25to50: 8400, minOnly: 5200, zero: 4600 },
  { date: "Nov", full: 29100, above75: 15100, pct50to75: 11500, pct25to50: 8200, minOnly: 5000, zero: 4300 },
  { date: "Dec", full: 26800, above75: 14200, pct50to75: 11100, pct25to50: 8700, minOnly: 5500, zero: 5100 },
  { date: "Jan", full: 30200, above75: 15500, pct50to75: 11400, pct25to50: 8100, minOnly: 4800, zero: 4100 },
  { date: "Feb", full: 31000, above75: 15800, pct50to75: 11300, pct25to50: 7900, minOnly: 4700, zero: 3900 },
  { date: "Mar", full: 31800, above75: 16200, pct50to75: 11500, pct25to50: 7800, minOnly: 4500, zero: 3700 },
];

// --- Section 5: Repayment amount trend (line chart) ---
const amountTrend = [
  { date: "Oct", totalAmount: 24500000000, avgPerAccount: 595150 },
  { date: "Nov", totalAmount: 25800000000, avgPerAccount: 607060 },
  { date: "Dec", totalAmount: 23200000000, avgPerAccount: 582910 },
  { date: "Jan", totalAmount: 26400000000, avgPerAccount: 612530 },
  { date: "Feb", totalAmount: 27100000000, avgPerAccount: 613120 },
  { date: "Mar", totalAmount: 28300000000, avgPerAccount: 624170 },
];

// --- Section 6: DPD cohort table ---
const dpdCohort = [
  { bucket: "Current (0)", count: 89350, pctPortfolio: 77.6, avgPaymentRate: 91.2, momChange: 0.8 },
  { bucket: "1-7 days", count: 9430, pctPortfolio: 8.2, avgPaymentRate: 72.4, momChange: -0.3 },
  { bucket: "8-30 days", count: 8280, pctPortfolio: 7.2, avgPaymentRate: 48.6, momChange: -0.5 },
  { bucket: "31-60 days", count: 4830, pctPortfolio: 4.2, avgPaymentRate: 28.3, momChange: 0.2 },
  { bucket: "61-90 days", count: 3210, pctPortfolio: 2.8, avgPaymentRate: 14.7, momChange: -0.1 },
];

// ---------------------------------------------------------------------------
// Chart insights
// ---------------------------------------------------------------------------

const channelInsights: ChartInsight[] = [
  { text: "Virtual Account remains the dominant channel at 45% of volume, but share is slowly declining as QRIS grows.", type: "neutral" },
  { text: "QRIS share grew from 18.0% in Oct to 21.0% in Mar (+3pp) — the fastest-growing channel, driven by merchant QR ubiquity.", type: "positive" },
  { text: "Convenience store repayments are flat at ~17-18%, suggesting a stable base of cash-preference customers.", type: "neutral" },
  { text: "Auto-debit penetration at 11% is low — increasing enrollment could reduce late payments and lower channel costs.", type: "hypothesis" },
];

const timelinessInsights: ChartInsight[] = [
  { text: "On-time payments rose from 74.0% in Oct to 77.5% in Mar — a 3.5pp improvement over 6 months.", type: "positive" },
  { text: "Grace period (1-7 days late) accounts decreased from 14.0% to 11.7%, suggesting reminder effectiveness improving.", type: "positive" },
  { text: "Very Late (31+ days) remains stubbornly flat at ~3.2-3.3%, indicating a hard-to-reach segment.", type: "negative" },
  { text: "Pre-due-date SMS reminders (T-3 and T-1) launched in Jan appear to be driving the on-time improvement.", type: "hypothesis" },
];

const ratioInsights: ChartInsight[] = [
  { text: "Full payers (100%+) increased from 38.9% to 42.0% of accounts — healthy trend toward full repayment behavior.", type: "positive" },
  { text: "Zero-payment accounts dropped from 6.3% in Oct to 4.9% in Mar — strong 1.4pp improvement.", type: "positive" },
  { text: "The minimum-only segment (<25%) dropped from 7.2% to 5.9%, suggesting financial health improvement or better nudges.", type: "positive" },
  { text: "Targeted nudges showing 'cost of minimum payment' projections may further convert minimum-payers to higher repayment.", type: "hypothesis" },
];

const amountInsights: ChartInsight[] = [
  { text: "Total repayment volume grew 15.5% from IDR 24.5B in Oct to IDR 28.3B in Mar, outpacing portfolio growth of ~12%.", type: "positive" },
  { text: "Average repayment per account rose from IDR 595K to IDR 624K (+4.9%), reflecting improved payment behaviour.", type: "positive" },
  { text: "Dec dip to IDR 23.2B aligns with holiday spending — seasonal pattern expected to repeat.", type: "neutral" },
  { text: "If avg repayment per account reaches IDR 650K, total monthly collections could exceed IDR 30B by mid-2026.", type: "hypothesis" },
];

const dpdCohortInsights: ChartInsight[] = [
  { text: "77.6% of portfolio is current (0 DPD), up 0.8pp MoM — portfolio quality improving.", type: "positive" },
  { text: "8-30 day bucket shrank 0.5pp MoM, suggesting early intervention is pulling accounts back to current.", type: "positive" },
  { text: "61-90 day bucket at 2.8% with only 14.7% avg payment rate is the highest risk — these accounts contribute disproportionately to losses.", type: "negative" },
  { text: "Targeted restructuring offers for 31-60 day accounts (avg 28.3% payment rate) could prevent further roll into 61-90.", type: "hypothesis" },
];

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

const actionItems: ActionItem[] = [
  {
    id: "repay-1",
    priority: "positive",
    action: "On-time payments improved to 77.5%, highest in 6 months.",
    detail: "Pre-due-date SMS reminders appear effective. Payment-to-bill ratio also up to 78.4%. Continue current reminder cadence.",
  },
  {
    id: "repay-2",
    priority: "monitor",
    action: "Auto-debit penetration remains low at 11%.",
    detail: "Increasing auto-debit enrollment would reduce late payments and lower payment processing costs. Consider incentives (e.g., cashback on first auto-debit).",
  },
  {
    id: "repay-3",
    priority: "urgent",
    action: "61-90 DPD bucket has only 14.7% avg payment rate.",
    detail: "These 3,210 accounts are at high risk of write-off. Prioritize restructuring or settlement offers before they roll past 90 days.",
  },
  {
    id: "repay-4",
    priority: "monitor",
    action: "Zero-payment accounts still at 4.9% (approx 3,700 accounts).",
    detail: "Despite improvement from 6.3%, these accounts need proactive outreach. Cross-reference with collections team contact status.",
  },
];

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function RepaymentsPage() {
  const { period, periodLabel } = usePeriod();

  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  // Scale trend data for selected period
  const pRepaymentCount = useMemo(() => scaleTrendData(repaymentCountTrend, period), [period]);
  const pTotalAmount = useMemo(() => scaleTrendData(totalAmountTrend, period), [period]);
  const pLateRate = useMemo(() => scaleTrendData(latePaymentRateTrend, period), [period]);
  const pPayBillRatio = useMemo(() => scaleTrendData(paymentToBillRatioTrend, period), [period]);
  const pChannel = useMemo(() => scaleTrendData(channelBreakdown, period), [period]);
  const pTimeliness = useMemo(() => scaleTrendData(timelinessTrend, period), [period]);
  const pRatio = useMemo(() => scaleTrendData(ratioDistribution, period), [period]);
  const pAmount = useMemo(() => scaleTrendData(amountTrend, period), [period]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Repayments Deep Dive</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{periodLabel}</p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: KPI Summary Row                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="repay_count"
          label="Total Repayments"
          value={scaleMetricValue(45300, period, false)}
          prevValue={scaleMetricValue(44200, period, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pRepaymentCount.map((d: Record<string, unknown>) => d.count as number)}
          onRefresh={handleRefresh}
          query={Q_REPAYMENT_KPIS}
        />
        <MetricCard
          metricKey="repay_amount"
          label="Total Amount Collected"
          value={scaleMetricValue(28300000000, period, false)}
          prevValue={scaleMetricValue(27100000000, period, false)}
          unit="idr"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pTotalAmount.map((d: Record<string, unknown>) => d.amount as number)}
          onRefresh={handleRefresh}
          query={Q_REPAYMENT_KPIS}
        />
        <MetricCard
          metricKey="repay_late_rate"
          label="Late Payment Rate"
          value={scaleMetricValue(22.4, period, true)}
          prevValue={scaleMetricValue(23.2, period, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pLateRate.map((d: Record<string, unknown>) => d.rate as number)}
          target={20}
          onRefresh={handleRefresh}
          query={Q_TIMELINESS}
        />
        <MetricCard
          metricKey="repay_bill_ratio"
          label="Payment-to-Bill Ratio"
          value={scaleMetricValue(78.4, period, true)}
          prevValue={scaleMetricValue(77.0, period, true)}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          sparklineData={pPayBillRatio.map((d: Record<string, unknown>) => d.rate as number)}
          target={85}
          onRefresh={handleRefresh}
          query={Q_PAYMENT_RATIO}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Repayment Channel Breakdown                             */}
      {/* ------------------------------------------------------------------ */}
      <ChartCard
        title="Repayment Channel Breakdown"
        subtitle="Monthly repayment volume by payment channel"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
        query={Q_CHANNEL_BREAKDOWN}
      >
        <DashboardBarChart
          data={pChannel}
          bars={[
            { key: "virtualAccount", color: "#3b82f6", label: "Virtual Account" },
            { key: "qris", color: "#8b5cf6", label: "QRIS" },
            { key: "convenienceStore", color: "#f59e0b", label: "Convenience Store" },
            { key: "autoDebit", color: "#22c55e", label: "Auto-Debit" },
            { key: "other", color: "#6b7280", label: "Other" },
          ]}
          stacked
          height={300}
        />
        <ChartInsights insights={channelInsights} />
      </ChartCard>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Payment Timeliness                                      */}
      {/* ------------------------------------------------------------------ */}
      <ChartCard
        title="Payment Timeliness"
        subtitle="Monthly breakdown by days past due at time of payment"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
        query={Q_TIMELINESS}
      >
        <DashboardBarChart
          data={pTimeliness}
          bars={[
            { key: "onTime", color: "#22c55e", label: "On-Time (before due)" },
            { key: "gracePeriod", color: "#f59e0b", label: "Grace Period (1-7d)" },
            { key: "late", color: "#f97316", label: "Late (8-30d)" },
            { key: "veryLate", color: "#ef4444", label: "Very Late (31d+)" },
          ]}
          stacked
          height={300}
        />
        <ChartInsights insights={timelinessInsights} />
      </ChartCard>

      {/* ------------------------------------------------------------------ */}
      {/* Section 4: Payment-to-Bill Ratio Distribution                      */}
      {/* ------------------------------------------------------------------ */}
      <ChartCard
        title="Payment-to-Bill Ratio Distribution"
        subtitle="What % of their billed amount did customers pay?"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
        query={Q_PAYMENT_RATIO}
      >
        <DashboardBarChart
          data={pRatio}
          bars={[
            { key: "full", color: "#22c55e", label: "Full (100%+)" },
            { key: "above75", color: "#84cc16", label: "75-99%" },
            { key: "pct50to75", color: "#f59e0b", label: "50-74%" },
            { key: "pct25to50", color: "#f97316", label: "25-49%" },
            { key: "minOnly", color: "#ef4444", label: "Min Only (<25%)" },
            { key: "zero", color: "#991b1b", label: "Zero Payment" },
          ]}
          stacked
          height={300}
        />
        <ChartInsights insights={ratioInsights} />
      </ChartCard>

      {/* ------------------------------------------------------------------ */}
      {/* Section 5: Repayment Amount Trend                                  */}
      {/* ------------------------------------------------------------------ */}
      <ChartCard
        title="Repayment Amount Trend"
        subtitle="Total repayment volume and average per account"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
        query={Q_AMOUNT_TREND}
      >
        <DashboardLineChart
          data={pAmount}
          lines={[
            { key: "totalAmount", color: "#3b82f6", label: "Total Repaid (IDR)" },
          ]}
          height={280}
        />
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-secondary)] mb-2 font-medium">Average Repayment per Account</p>
          <DashboardLineChart
            data={pAmount}
            lines={[
              { key: "avgPerAccount", color: "#8b5cf6", label: "Avg per Account (IDR)" },
            ]}
            height={200}
          />
        </div>
        <ChartInsights insights={amountInsights} />
      </ChartCard>

      {/* ------------------------------------------------------------------ */}
      {/* Section 6: Late Payment Cohort Analysis (DPD Buckets)              */}
      {/* ------------------------------------------------------------------ */}
      <ChartCard
        title="Late Payment Cohort Analysis"
        subtitle="Portfolio breakdown by days past due — current month snapshot"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
        query={Q_DPD_COHORT}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">DPD Bucket</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Count</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">% of Portfolio</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Avg Payment Rate</th>
                <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">MoM Change</th>
              </tr>
            </thead>
            <tbody>
              {dpdCohort.map((row) => (
                <tr key={row.bucket} className="border-b border-[var(--border)]">
                  <td className="py-2 px-3 text-[var(--text-primary)] font-medium">{row.bucket}</td>
                  <td className="py-2 px-3 text-[var(--text-primary)] text-right">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="py-2 px-3 text-[var(--text-primary)] text-right">{row.pctPortfolio}%</td>
                  <td
                    className={`py-2 px-3 text-right font-medium ${
                      row.avgPaymentRate >= 70
                        ? "text-emerald-400"
                        : row.avgPaymentRate >= 40
                          ? "text-amber-400"
                          : "text-red-400"
                    }`}
                  >
                    {row.avgPaymentRate}%
                  </td>
                  <td
                    className={`py-2 px-3 text-right font-medium ${
                      row.momChange > 0 ? "text-emerald-400" : row.momChange < 0 ? "text-red-400" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {row.momChange > 0 ? "+" : ""}
                    {row.momChange}pp
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--border)]">
                <td className="py-2 px-3 text-[var(--text-primary)] font-bold">Total</td>
                <td className="py-2 px-3 text-[var(--text-primary)] text-right font-bold">
                  {dpdCohort.reduce((s, r) => s + r.count, 0).toLocaleString()}
                </td>
                <td className="py-2 px-3 text-[var(--text-primary)] text-right font-bold">100.0%</td>
                <td className="py-2 px-3 text-right font-bold text-[var(--text-primary)]">
                  {(
                    dpdCohort.reduce((s, r) => s + r.avgPaymentRate * r.count, 0) /
                    dpdCohort.reduce((s, r) => s + r.count, 0)
                  ).toFixed(1)}
                  %
                </td>
                <td className="py-2 px-3 text-right text-[var(--text-secondary)]">--</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <ChartInsights insights={dpdCohortInsights} />
      </ChartCard>

      {/* ------------------------------------------------------------------ */}
      {/* Action Items                                                       */}
      {/* ------------------------------------------------------------------ */}
      <ActionItems section="Repayments" items={actionItems} />
    </div>
  );
}
