// ---------------------------------------------------------------------------
// PDF Report Manifest — defines all 19 reports, their API endpoints,
// KPI metrics, and chart configurations for server-side PDF generation.
// ---------------------------------------------------------------------------

export type MetricUnit = "count" | "percent" | "currency";
export type ChartType = "line" | "bar" | "table";
export type ValueType = "number" | "percent" | "currency";

export interface MetricDef {
  labelKey: string;       // i18n key under pdf.metrics.*
  dataPath: string;       // dot-path into the API response (supports simple nesting)
  unit: MetricUnit;
}

export interface ChartLineDef {
  dataKey: string;        // field name in each data point
  labelKey: string;       // i18n key for legend label
  color?: string;         // hex override (defaults to palette rotation)
}

export interface ChartDef {
  id: string;
  titleKey: string;       // i18n key under pdf.charts.*
  type: ChartType;
  dataKey: string;        // field in API response that holds the array
  xAxisKey: string;       // field in each row used for x-axis labels
  lines?: ChartLineDef[]; // for multi-line charts
  valueType: ValueType;
  showPrevPeriod?: boolean;
}

export interface ReportDef {
  id: string;
  apiEndpoint: string;
  titleKey: string;       // i18n key under pdf.reports.*
  metrics: MetricDef[];
  charts: ChartDef[];
}

// ---------------------------------------------------------------------------
// Brand color palette
// ---------------------------------------------------------------------------
export const BRAND_COLORS = {
  primary: "#5B22FF",
  green: "#06D6A0",
  red: "#FF6B6B",
  yellow: "#FFD166",
  teal: "#4ECDC4",
  gray: "#8E8E93",
  blue: "#4A90D9",
  orange: "#FF9F43",
} as const;

export const COLOR_PALETTE = [
  BRAND_COLORS.primary,
  BRAND_COLORS.green,
  BRAND_COLORS.red,
  BRAND_COLORS.yellow,
  BRAND_COLORS.teal,
  BRAND_COLORS.blue,
  BRAND_COLORS.orange,
  BRAND_COLORS.gray,
];

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

export const REPORT_MANIFEST: ReportDef[] = [
  // 1. Dashboard (KPIs)
  {
    id: "dashboard",
    apiEndpoint: "/api/kpis",
    titleKey: "pdf.reports.dashboard",
    metrics: [
      { labelKey: "pdf.metrics.eligibleAccounts", dataPath: "kpis.0.value", unit: "count" },
      { labelKey: "pdf.metrics.spendActiveRate", dataPath: "kpis.1.value", unit: "percent" },
      { labelKey: "pdf.metrics.totalSpend", dataPath: "kpis.2.value", unit: "currency" },
      { labelKey: "pdf.metrics.dpd30PlusRate", dataPath: "kpis.3.value", unit: "percent" },
      { labelKey: "pdf.metrics.approvalRate", dataPath: "kpis.4.value", unit: "percent" },
    ],
    charts: [
      {
        id: "eligible-trend",
        titleKey: "pdf.charts.eligibleVsTransactors",
        type: "line",
        dataKey: "chartData.eligible",
        xAxisKey: "date",
        lines: [
          { dataKey: "eligible", labelKey: "pdf.metrics.eligibleAccounts", color: BRAND_COLORS.primary },
          { dataKey: "transactors", labelKey: "pdf.metrics.transactors", color: BRAND_COLORS.green },
        ],
        valueType: "number",
        showPrevPeriod: false,
      },
      {
        id: "spend-trend",
        titleKey: "pdf.charts.spendTrend",
        type: "line",
        dataKey: "chartData.spend",
        xAxisKey: "date",
        lines: [
          { dataKey: "total", labelKey: "pdf.metrics.totalSpend", color: BRAND_COLORS.primary },
        ],
        valueType: "currency",
        showPrevPeriod: true,
      },
      {
        id: "decision-trend",
        titleKey: "pdf.charts.decisionTrend",
        type: "bar",
        dataKey: "chartData.decisions",
        xAxisKey: "date",
        lines: [
          { dataKey: "approved", labelKey: "pdf.metrics.approved", color: BRAND_COLORS.green },
          { dataKey: "declined", labelKey: "pdf.metrics.declined", color: BRAND_COLORS.red },
          { dataKey: "waitlisted", labelKey: "pdf.metrics.waitlisted", color: BRAND_COLORS.yellow },
        ],
        valueType: "number",
      },
      {
        id: "dpd-buckets",
        titleKey: "pdf.charts.dpdDistribution",
        type: "table",
        dataKey: "chartData.portfolio.dpdBuckets",
        xAxisKey: "label",
        valueType: "number",
      },
    ],
  },

  // 2. Acquisition
  {
    id: "acquisition",
    apiEndpoint: "/api/acquisition",
    titleKey: "pdf.reports.acquisition",
    metrics: [],
    charts: [
      {
        id: "acq-funnel",
        titleKey: "pdf.charts.acquisitionFunnel",
        type: "table",
        dataKey: "funnel",
        xAxisKey: "label",
        valueType: "number",
      },
      {
        id: "acq-decision",
        titleKey: "pdf.charts.decisionBreakdown",
        type: "bar",
        dataKey: "decisionBreakdown",
        xAxisKey: "decision",
        lines: [{ dataKey: "cnt", labelKey: "common.count", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
      {
        id: "acq-product-mix",
        titleKey: "pdf.charts.productMix",
        type: "bar",
        dataKey: "productMix",
        xAxisKey: "product_type",
        lines: [{ dataKey: "cnt", labelKey: "common.count", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "acq-approval-rate",
        titleKey: "pdf.charts.approvalRateTrend",
        type: "line",
        dataKey: "approvalRateTrend",
        xAxisKey: "week_start",
        lines: [{ dataKey: "approval_rate", labelKey: "pdf.metrics.approvalRate", color: BRAND_COLORS.primary }],
        valueType: "percent",
        showPrevPeriod: true,
      },
      {
        id: "acq-credit-limit",
        titleKey: "pdf.charts.creditLimitTrend",
        type: "line",
        dataKey: "creditLimitTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "avg_credit_limit_idr", labelKey: "pdf.metrics.avgCreditLimit", color: BRAND_COLORS.primary },
        ],
        valueType: "currency",
        showPrevPeriod: true,
      },
    ],
  },

  // 3. Activation
  {
    id: "activation",
    apiEndpoint: "/api/activation",
    titleKey: "pdf.reports.activation",
    metrics: [],
    charts: [
      {
        id: "act-rate-trend",
        titleKey: "pdf.charts.activationRateTrend",
        type: "line",
        dataKey: "activationRateTrend",
        xAxisKey: "week",
        lines: [
          { dataKey: "rate", labelKey: "pdf.metrics.activationRate", color: BRAND_COLORS.primary },
        ],
        valueType: "percent",
        showPrevPeriod: true,
      },
      {
        id: "act-timeline",
        titleKey: "pdf.charts.daysToFirstTransaction",
        type: "bar",
        dataKey: "daysToFirstTransaction",
        xAxisKey: "days_bucket",
        lines: [{ dataKey: "count", labelKey: "common.count", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "act-product-type",
        titleKey: "pdf.charts.activationByProduct",
        type: "table",
        dataKey: "activationByProductType",
        xAxisKey: "product_type",
        valueType: "percent",
      },
      {
        id: "act-dormancy",
        titleKey: "pdf.charts.dormancyAnalysis",
        type: "bar",
        dataKey: "dormancyAnalysis",
        xAxisKey: "bucket",
        lines: [{ dataKey: "accounts", labelKey: "pdf.metrics.accounts", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
    ],
  },

  // 4. Billing Cycle
  {
    id: "billing-cycle",
    apiEndpoint: "/api/billing-cycle",
    titleKey: "pdf.reports.billingCycle",
    metrics: [],
    charts: [
      {
        id: "bc-revolve-trend",
        titleKey: "pdf.charts.revolveTrend",
        type: "line",
        dataKey: "revolveTrend",
        xAxisKey: "month",
        lines: [{ dataKey: "revolve_rate", labelKey: "pdf.metrics.revolveRate", color: BRAND_COLORS.primary }],
        valueType: "percent",
        showPrevPeriod: true,
      },
      {
        id: "bc-utilization-dist",
        titleKey: "pdf.charts.utilizationDistribution",
        type: "table",
        dataKey: "utilizationDistribution",
        xAxisKey: "bucket",
        valueType: "number",
      },
      {
        id: "bc-dpd-dist",
        titleKey: "pdf.charts.dpdDistribution",
        type: "table",
        dataKey: "dpdDistribution",
        xAxisKey: "bucket",
        valueType: "number",
      },
      {
        id: "bc-balance-trend",
        titleKey: "pdf.charts.balanceTrend",
        type: "line",
        dataKey: "balanceTrend",
        xAxisKey: "month",
        lines: [
          { dataKey: "avg_balance_idr", labelKey: "pdf.metrics.avgBalance", color: BRAND_COLORS.primary },
          { dataKey: "avg_limit_idr", labelKey: "pdf.metrics.avgLimit", color: BRAND_COLORS.gray },
        ],
        valueType: "currency",
      },
      {
        id: "bc-payment-behavior",
        titleKey: "pdf.charts.paymentBehavior",
        type: "table",
        dataKey: "paymentBehavior",
        xAxisKey: "behavior",
        valueType: "number",
      },
    ],
  },

  // 5. Cards Overview
  {
    id: "cards-overview",
    apiEndpoint: "/api/cards-overview",
    titleKey: "pdf.reports.cardsOverview",
    metrics: [],
    charts: [
      {
        id: "co-status",
        titleKey: "pdf.charts.cardStatusBreakdown",
        type: "bar",
        dataKey: "cardStatusBreakdown",
        xAxisKey: "status",
        lines: [{ dataKey: "accounts", labelKey: "pdf.metrics.accounts", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
      {
        id: "co-program",
        titleKey: "pdf.charts.cardProgramBreakdown",
        type: "table",
        dataKey: "cardProgramBreakdown",
        xAxisKey: "card_pgm",
        valueType: "number",
      },
      {
        id: "co-verification",
        titleKey: "pdf.charts.verificationBreakdown",
        type: "bar",
        dataKey: "verificationBreakdown",
        xAxisKey: "verification",
        lines: [{ dataKey: "accounts", labelKey: "pdf.metrics.accounts", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
    ],
  },

  // 6. Channel Quality
  {
    id: "channel-quality",
    apiEndpoint: "/api/channel-quality",
    titleKey: "pdf.reports.channelQuality",
    metrics: [],
    charts: [
      {
        id: "cq-table",
        titleKey: "pdf.charts.channelQualityTable",
        type: "table",
        dataKey: "channelQuality",
        xAxisKey: "utm_source",
        valueType: "number",
      },
    ],
  },

  // 7. Collections
  {
    id: "collections",
    apiEndpoint: "/api/collections",
    titleKey: "pdf.reports.collections",
    metrics: [],
    charts: [
      {
        id: "col-cure-rate",
        titleKey: "pdf.charts.cureRateTrend",
        type: "line",
        dataKey: "cureRateTrend",
        xAxisKey: "month",
        lines: [{ dataKey: "cure_rate_pct", labelKey: "pdf.metrics.cureRate", color: BRAND_COLORS.green }],
        valueType: "percent",
        showPrevPeriod: true,
      },
    ],
  },

  // 8. Credit Line
  {
    id: "credit-line",
    apiEndpoint: "/api/credit-line",
    titleKey: "pdf.reports.creditLine",
    metrics: [],
    charts: [
      {
        id: "cl-trend",
        titleKey: "pdf.charts.cliActivityTrend",
        type: "line",
        dataKey: "trend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "cli_count", labelKey: "pdf.metrics.cliCount", color: BRAND_COLORS.primary },
          { dataKey: "unique_users", labelKey: "pdf.metrics.uniqueUsers", color: BRAND_COLORS.green },
        ],
        valueType: "number",
        showPrevPeriod: true,
      },
      {
        id: "cl-by-type",
        titleKey: "pdf.charts.cliByType",
        type: "bar",
        dataKey: "byType",
        xAxisKey: "credit_line_update_type",
        lines: [{ dataKey: "cli_count", labelKey: "pdf.metrics.cliCount", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "cl-volume",
        titleKey: "pdf.charts.cliVolumeTrend",
        type: "line",
        dataKey: "volumeTrend",
        xAxisKey: "month",
        lines: [
          { dataKey: "total_increase_idr", labelKey: "pdf.metrics.totalIncrease", color: BRAND_COLORS.primary },
        ],
        valueType: "currency",
      },
    ],
  },

  // 9. Customer Service
  {
    id: "customer-service",
    apiEndpoint: "/api/customer-service",
    titleKey: "pdf.reports.customerService",
    metrics: [],
    charts: [
      {
        id: "cs-ticket-trend",
        titleKey: "pdf.charts.ticketVolumeTrend",
        type: "line",
        dataKey: "weeklyTicketTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "ticket_count", labelKey: "pdf.metrics.ticketCount", color: BRAND_COLORS.primary },
          { dataKey: "resolved_count", labelKey: "pdf.metrics.resolvedCount", color: BRAND_COLORS.green },
        ],
        valueType: "number",
        showPrevPeriod: true,
      },
      {
        id: "cs-response-time",
        titleKey: "pdf.charts.responseTimeTrend",
        type: "line",
        dataKey: "weeklyTicketTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "avg_first_response_hrs", labelKey: "pdf.metrics.firstResponseHrs", color: BRAND_COLORS.yellow },
          { dataKey: "avg_resolution_hrs", labelKey: "pdf.metrics.resolutionHrs", color: BRAND_COLORS.red },
        ],
        valueType: "number",
      },
      {
        id: "cs-contact-reasons",
        titleKey: "pdf.charts.topContactReasons",
        type: "bar",
        dataKey: "topContactReasons",
        xAxisKey: "reason",
        lines: [{ dataKey: "ticket_count", labelKey: "pdf.metrics.ticketCount", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
    ],
  },

  // 10. Points Program
  {
    id: "points-program",
    apiEndpoint: "/api/points-program",
    titleKey: "pdf.reports.pointsProgram",
    metrics: [],
    charts: [
      {
        id: "pp-flow-trend",
        titleKey: "pdf.charts.pointsFlowTrend",
        type: "line",
        dataKey: "flowTrend",
        xAxisKey: "month",
        lines: [
          { dataKey: "earned", labelKey: "pdf.metrics.pointsEarned", color: BRAND_COLORS.green },
          { dataKey: "redeemed", labelKey: "pdf.metrics.pointsRedeemed", color: BRAND_COLORS.red },
          { dataKey: "expired", labelKey: "pdf.metrics.pointsExpired", color: BRAND_COLORS.gray },
        ],
        valueType: "number",
      },
      {
        id: "pp-liability",
        titleKey: "pdf.charts.pointsLiability",
        type: "line",
        dataKey: "closingBalance",
        xAxisKey: "month",
        lines: [
          { dataKey: "total_points", labelKey: "pdf.metrics.totalPoints", color: BRAND_COLORS.primary },
        ],
        valueType: "number",
      },
      {
        id: "pp-redemption-category",
        titleKey: "pdf.charts.redemptionByCategory",
        type: "bar",
        dataKey: "redemptionBreakdown",
        xAxisKey: "category",
        lines: [{ dataKey: "points", labelKey: "pdf.metrics.pointsRedeemed", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "pp-redemption-rate",
        titleKey: "pdf.charts.redemptionRate",
        type: "line",
        dataKey: "summary",
        xAxisKey: "week_start",
        lines: [{ dataKey: "redemption_rate", labelKey: "pdf.metrics.redemptionRate", color: BRAND_COLORS.primary }],
        valueType: "percent",
      },
    ],
  },

  // 11. Portfolio
  {
    id: "portfolio",
    apiEndpoint: "/api/portfolio",
    titleKey: "pdf.reports.portfolio",
    metrics: [],
    charts: [
      {
        id: "pf-active-trend",
        titleKey: "pdf.charts.activeAccountsTrend",
        type: "line",
        dataKey: "snapshot",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "active_accounts", labelKey: "pdf.metrics.activeAccounts", color: BRAND_COLORS.green },
          { dataKey: "total_accounts", labelKey: "pdf.metrics.totalAccounts", color: BRAND_COLORS.primary },
        ],
        valueType: "number",
        showPrevPeriod: true,
      },
      {
        id: "pf-utilization",
        titleKey: "pdf.charts.utilizationTrend",
        type: "line",
        dataKey: "snapshot",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "utilization_pct", labelKey: "pdf.metrics.utilization", color: BRAND_COLORS.primary },
        ],
        valueType: "percent",
      },
      {
        id: "pf-status",
        titleKey: "pdf.charts.statusBreakdown",
        type: "bar",
        dataKey: "statusBreakdown",
        xAxisKey: "status",
        lines: [{ dataKey: "accounts", labelKey: "pdf.metrics.accounts", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "pf-limit-dist",
        titleKey: "pdf.charts.creditLimitDistribution",
        type: "bar",
        dataKey: "creditLimitDist",
        xAxisKey: "bucket",
        lines: [{ dataKey: "accounts", labelKey: "pdf.metrics.accounts", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
      {
        id: "pf-revolve-rate",
        titleKey: "pdf.charts.revolveRateTrend",
        type: "line",
        dataKey: "revolveRateTrend",
        xAxisKey: "month",
        lines: [
          { dataKey: "revolve_rate_count_pct", labelKey: "pdf.metrics.revolveRate", color: BRAND_COLORS.primary },
        ],
        valueType: "percent",
      },
    ],
  },

  // 12. Referral
  {
    id: "referral",
    apiEndpoint: "/api/referral",
    titleKey: "pdf.reports.referral",
    metrics: [],
    charts: [
      {
        id: "ref-conversion",
        titleKey: "pdf.charts.referralConversionTrend",
        type: "line",
        dataKey: "funnel",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "started", labelKey: "pdf.metrics.referralsStarted", color: BRAND_COLORS.primary },
          { dataKey: "approved", labelKey: "pdf.metrics.approved", color: BRAND_COLORS.green },
        ],
        valueType: "number",
        showPrevPeriod: true,
      },
      {
        id: "ref-by-channel",
        titleKey: "pdf.charts.referralByChannel",
        type: "table",
        dataKey: "byChannel",
        xAxisKey: "referring_source",
        valueType: "number",
      },
      {
        id: "ref-per-user",
        titleKey: "pdf.charts.referralsPerUser",
        type: "bar",
        dataKey: "perUser",
        xAxisKey: "bucket",
        lines: [{ dataKey: "users", labelKey: "pdf.metrics.users", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "ref-funnel-trend",
        titleKey: "pdf.charts.referralFunnelTrend",
        type: "line",
        dataKey: "funnelTrend",
        xAxisKey: "month",
        lines: [
          { dataKey: "shared", labelKey: "pdf.metrics.shared", color: BRAND_COLORS.gray },
          { dataKey: "started", labelKey: "pdf.metrics.referralsStarted", color: BRAND_COLORS.primary },
          { dataKey: "approved", labelKey: "pdf.metrics.approved", color: BRAND_COLORS.green },
        ],
        valueType: "number",
      },
      {
        id: "ref-approval-rate",
        titleKey: "pdf.charts.approvalRateTrend",
        type: "line",
        dataKey: "approvalRate",
        xAxisKey: "month",
        lines: [{ dataKey: "rate", labelKey: "pdf.metrics.approvalRate", color: BRAND_COLORS.primary }],
        valueType: "percent",
      },
    ],
  },

  // 13. Repayments
  {
    id: "repayments",
    apiEndpoint: "/api/repayments",
    titleKey: "pdf.reports.repayments",
    metrics: [],
    charts: [
      {
        id: "rp-trend",
        titleKey: "pdf.charts.repaymentTrend",
        type: "line",
        dataKey: "weeklyTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "payment_count", labelKey: "pdf.metrics.paymentCount", color: BRAND_COLORS.primary },
          { dataKey: "unique_accounts", labelKey: "pdf.metrics.uniqueAccounts", color: BRAND_COLORS.green },
        ],
        valueType: "number",
        showPrevPeriod: true,
      },
      {
        id: "rp-amount",
        titleKey: "pdf.charts.repaymentAmount",
        type: "line",
        dataKey: "weeklyTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "total_amount_idr", labelKey: "pdf.metrics.totalAmount", color: BRAND_COLORS.primary },
        ],
        valueType: "currency",
      },
      {
        id: "rp-by-vendor",
        titleKey: "pdf.charts.repaymentByVendor",
        type: "bar",
        dataKey: "byVendor",
        xAxisKey: "vendor",
        lines: [{ dataKey: "count", labelKey: "common.count", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "rp-timeliness",
        titleKey: "pdf.charts.repaymentTimeliness",
        type: "bar",
        dataKey: "timeliness",
        xAxisKey: "bucket",
        lines: [{ dataKey: "accounts", labelKey: "pdf.metrics.accounts", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
    ],
  },

  // 14. Risk
  {
    id: "risk",
    apiEndpoint: "/api/risk",
    titleKey: "pdf.reports.risk",
    metrics: [],
    charts: [
      {
        id: "risk-dpd-trend",
        titleKey: "pdf.charts.dpdDistributionTrend",
        type: "line",
        dataKey: "dpdTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "delinquency_rate_30plus", labelKey: "pdf.metrics.delinquencyRate30Plus", color: BRAND_COLORS.red },
        ],
        valueType: "percent",
        showPrevPeriod: true,
      },
      {
        id: "risk-balance-exposure",
        titleKey: "pdf.charts.balanceExposure",
        type: "bar",
        dataKey: "balanceExposure",
        xAxisKey: "bucket",
        lines: [{ dataKey: "total_balance_idr", labelKey: "pdf.metrics.totalBalance", color: BRAND_COLORS.primary }],
        valueType: "currency",
      },
      {
        id: "risk-dpd-first-stmt",
        titleKey: "pdf.charts.dpdFirstStatement",
        type: "line",
        dataKey: "dpdFirstStatement",
        xAxisKey: "month",
        lines: [{ dataKey: "pd30_rate_pct", labelKey: "pdf.metrics.pd30Rate", color: BRAND_COLORS.red }],
        valueType: "percent",
      },
      {
        id: "risk-dpd-app-month",
        titleKey: "pdf.charts.dpdByAppMonth",
        type: "line",
        dataKey: "dpdApplicationMonth",
        xAxisKey: "month",
        lines: [{ dataKey: "pd30_rate_pct", labelKey: "pdf.metrics.pd30Rate", color: BRAND_COLORS.red }],
        valueType: "percent",
      },
    ],
  },

  // 15. Spend Analysis
  {
    id: "spend-analysis",
    apiEndpoint: "/api/spend-analysis",
    titleKey: "pdf.reports.spendAnalysis",
    metrics: [],
    charts: [
      {
        id: "sa-sar",
        titleKey: "pdf.charts.spendActiveRateTrend",
        type: "line",
        dataKey: "weeklySpendTrend",
        xAxisKey: "week_start",
        lines: [{ dataKey: "spend_active_rate", labelKey: "pdf.metrics.spendActiveRate", color: BRAND_COLORS.primary }],
        valueType: "percent",
        showPrevPeriod: true,
      },
      {
        id: "sa-total-spend",
        titleKey: "pdf.charts.totalSpendTrend",
        type: "line",
        dataKey: "weeklySpendTrend",
        xAxisKey: "week_start",
        lines: [{ dataKey: "total_spend_idr", labelKey: "pdf.metrics.totalSpend", color: BRAND_COLORS.primary }],
        valueType: "currency",
        showPrevPeriod: true,
      },
      {
        id: "sa-avg-spend",
        titleKey: "pdf.charts.avgSpendPerTxn",
        type: "line",
        dataKey: "weeklySpendTrend",
        xAxisKey: "week_start",
        lines: [{ dataKey: "avg_spend_per_txn_idr", labelKey: "pdf.metrics.avgSpendPerTxn", color: BRAND_COLORS.teal }],
        valueType: "currency",
      },
      {
        id: "sa-txn-frequency",
        titleKey: "pdf.charts.txnFrequency",
        type: "line",
        dataKey: "weeklySpendTrend",
        xAxisKey: "week_start",
        lines: [{ dataKey: "total_transactions", labelKey: "pdf.metrics.totalTransactions", color: BRAND_COLORS.green }],
        valueType: "number",
      },
      {
        id: "sa-channel-breakdown",
        titleKey: "pdf.charts.channelBreakdown",
        type: "bar",
        dataKey: "channelBreakdown",
        xAxisKey: "channel",
        lines: [
          { dataKey: "txn_count", labelKey: "pdf.metrics.txnCount", color: BRAND_COLORS.primary },
        ],
        valueType: "number",
      },
      {
        id: "sa-channel-mix",
        titleKey: "pdf.charts.channelMixTrend",
        type: "line",
        dataKey: "weeklySpendTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "online_spend_idr", labelKey: "pdf.metrics.onlineSpend", color: BRAND_COLORS.primary },
          { dataKey: "offline_spend_idr", labelKey: "pdf.metrics.offlineSpend", color: BRAND_COLORS.green },
          { dataKey: "qris_spend_idr", labelKey: "pdf.metrics.qrisSpend", color: BRAND_COLORS.teal },
        ],
        valueType: "currency",
      },
      {
        id: "sa-decline",
        titleKey: "pdf.charts.declineBreakdown",
        type: "table",
        dataKey: "declineBreakdown",
        xAxisKey: "description",
        valueType: "number",
      },
      {
        id: "sa-first-txn-channel",
        titleKey: "pdf.charts.firstTxnChannel",
        type: "bar",
        dataKey: "firstTxnChannel",
        xAxisKey: "channel",
        lines: [{ dataKey: "user_count", labelKey: "pdf.metrics.users", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
    ],
  },

  // 16. Transaction Auth
  {
    id: "transaction-auth",
    apiEndpoint: "/api/transaction-auth",
    titleKey: "pdf.reports.transactionAuth",
    metrics: [],
    charts: [
      {
        id: "ta-approval-rate",
        titleKey: "pdf.charts.authApprovalRateTrend",
        type: "line",
        dataKey: "weeklyAuthTrend",
        xAxisKey: "week_start",
        lines: [{ dataKey: "approval_rate", labelKey: "pdf.metrics.approvalRate", color: BRAND_COLORS.primary }],
        valueType: "percent",
        showPrevPeriod: true,
      },
      {
        id: "ta-total-auths",
        titleKey: "pdf.charts.totalAuthsTrend",
        type: "line",
        dataKey: "weeklyAuthTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "total_auths", labelKey: "pdf.metrics.totalAuths", color: BRAND_COLORS.primary },
          { dataKey: "approved", labelKey: "pdf.metrics.approved", color: BRAND_COLORS.green },
        ],
        valueType: "number",
      },
      {
        id: "ta-channel-mix",
        titleKey: "pdf.charts.authChannelMix",
        type: "line",
        dataKey: "weeklyAuthTrend",
        xAxisKey: "week_start",
        lines: [
          { dataKey: "online_txns", labelKey: "pdf.metrics.onlineTxns", color: BRAND_COLORS.primary },
          { dataKey: "qris_txns", labelKey: "pdf.metrics.qrisTxns", color: BRAND_COLORS.teal },
          { dataKey: "offline_txns", labelKey: "pdf.metrics.offlineTxns", color: BRAND_COLORS.green },
        ],
        valueType: "number",
      },
      {
        id: "ta-ticket-size",
        titleKey: "pdf.charts.avgTicketSize",
        type: "line",
        dataKey: "weeklyAuthTrend",
        xAxisKey: "week_start",
        lines: [{ dataKey: "avg_ticket_idr", labelKey: "pdf.metrics.avgTicketSize", color: BRAND_COLORS.primary }],
        valueType: "currency",
      },
      {
        id: "ta-foreign-txn",
        titleKey: "pdf.charts.foreignTxnPct",
        type: "line",
        dataKey: "weeklyAuthTrend",
        xAxisKey: "week_start",
        lines: [{ dataKey: "foreign_txn_pct", labelKey: "pdf.metrics.foreignTxnPct", color: BRAND_COLORS.yellow }],
        valueType: "percent",
      },
      {
        id: "ta-top-merchants",
        titleKey: "pdf.charts.topMerchants",
        type: "table",
        dataKey: "topMerchants",
        xAxisKey: "merchant_name",
        valueType: "number",
      },
    ],
  },

  // 17. Users Overview
  {
    id: "users-overview",
    apiEndpoint: "/api/users-overview",
    titleKey: "pdf.reports.usersOverview",
    metrics: [],
    charts: [
      {
        id: "uo-status",
        titleKey: "pdf.charts.statusBreakdown",
        type: "bar",
        dataKey: "statusBreakdown",
        xAxisKey: "status",
        lines: [{ dataKey: "accounts", labelKey: "pdf.metrics.accounts", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
      {
        id: "uo-growth",
        titleKey: "pdf.charts.accountGrowthTrend",
        type: "line",
        dataKey: "accountGrowth",
        xAxisKey: "month",
        lines: [
          { dataKey: "total_accounts", labelKey: "pdf.metrics.totalAccounts", color: BRAND_COLORS.primary },
          { dataKey: "new_accounts", labelKey: "pdf.metrics.newAccounts", color: BRAND_COLORS.green },
        ],
        valueType: "number",
        showPrevPeriod: true,
      },
      {
        id: "uo-device-mfg",
        titleKey: "pdf.charts.deviceManufacturers",
        type: "bar",
        dataKey: "deviceManufacturers",
        xAxisKey: "manufacturer",
        lines: [{ dataKey: "users", labelKey: "pdf.metrics.users", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "uo-os",
        titleKey: "pdf.charts.osDistribution",
        type: "bar",
        dataKey: "osBreakdown",
        xAxisKey: "os",
        lines: [{ dataKey: "users", labelKey: "pdf.metrics.users", color: BRAND_COLORS.primary }],
        valueType: "number",
      },
      {
        id: "uo-geo",
        titleKey: "pdf.charts.geoDistribution",
        type: "table",
        dataKey: "geoDeepDive",
        xAxisKey: "province",
        valueType: "number",
      },
    ],
  },

  // 18. Vintage
  {
    id: "vintage",
    apiEndpoint: "/api/vintage",
    titleKey: "pdf.reports.vintage",
    metrics: [],
    charts: [
      {
        id: "vin-dpd-app-month",
        titleKey: "pdf.charts.dpdByAppMonth",
        type: "line",
        dataKey: "dpdByAppMonth",
        xAxisKey: "month_key",
        lines: [{ dataKey: "v1_pd30_rate", labelKey: "pdf.metrics.pd30Rate", color: BRAND_COLORS.red }],
        valueType: "percent",
      },
      {
        id: "vin-dpd-first-stmt",
        titleKey: "pdf.charts.dpdFirstStatement",
        type: "line",
        dataKey: "dpdByFirstStatement",
        xAxisKey: "month_key",
        lines: [{ dataKey: "v1_pd30_rate", labelKey: "pdf.metrics.pd30Rate", color: BRAND_COLORS.red }],
        valueType: "percent",
      },
      {
        id: "vin-cure-rate",
        titleKey: "pdf.charts.cureRateTrend",
        type: "line",
        dataKey: "cureRate",
        xAxisKey: "month_key",
        lines: [{ dataKey: "cure_rate_pct", labelKey: "pdf.metrics.cureRate", color: BRAND_COLORS.green }],
        valueType: "percent",
      },
    ],
  },

  // 19. QRIS Experiment
  {
    id: "qris-experiment",
    apiEndpoint: "/api/qris-experiment",
    titleKey: "pdf.reports.qrisExperiment",
    metrics: [],
    charts: [
      {
        id: "qris-cohort",
        titleKey: "pdf.charts.cohortComparison",
        type: "table",
        dataKey: "cohortComparison",
        xAxisKey: "grp",
        valueType: "number",
      },
      {
        id: "qris-merchant",
        titleKey: "pdf.charts.merchantClassification",
        type: "table",
        dataKey: "merchantClassification",
        xAxisKey: "classification",
        valueType: "number",
      },
      {
        id: "qris-merchant-growth",
        titleKey: "pdf.charts.qrisMerchantGrowth",
        type: "line",
        dataKey: "qrisOnlyMerchantGrowth",
        xAxisKey: "month",
        lines: [{ dataKey: "new_merchants", labelKey: "pdf.metrics.newMerchants", color: BRAND_COLORS.teal }],
        valueType: "number",
      },
      {
        id: "qris-interchange",
        titleKey: "pdf.charts.interchangeProjection",
        type: "table",
        dataKey: "interchangeProjection",
        xAxisKey: "grp",
        valueType: "currency",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getReportById(id: string): ReportDef | undefined {
  return REPORT_MANIFEST.find((r) => r.id === id);
}
