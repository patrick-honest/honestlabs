// ---------------------------------------------------------------------------
// KPI Definitions — display config, thresholds, and query mappings
// ---------------------------------------------------------------------------

export interface KpiDefinition {
  key: string;
  label: string;
  unit: "count" | "percent" | "idr" | "usd";
  section: string;
  queryFn: string;
  description: string;
  target?: number;
  warningThreshold?: number;
  dangerThreshold?: number;
  higherIsBetter: boolean;
}

// ---------------------------------------------------------------------------
// Executive KPIs
// ---------------------------------------------------------------------------

const executiveKpis: KpiDefinition[] = [
  {
    key: "eligible_count",
    label: "Eligible Accounts",
    unit: "count",
    section: "executive",
    queryFn: "getEligibleAndTransactors",
    description: "Number of active accounts eligible for spend (unblocked, status G/N, DPD >= 0). Includes all product types: standard, prepaid (RP1), and opening fee.",
    target: undefined,
    higherIsBetter: true,
  },
  {
    key: "transactor_count",
    label: "Transactors",
    unit: "count",
    section: "executive",
    queryFn: "getEligibleAndTransactors",
    description: "Number of eligible accounts with at least one valid authorized transaction. All product types included.",
    higherIsBetter: true,
  },
  {
    key: "spend_active_rate",
    label: "Spend Active Rate",
    unit: "percent",
    section: "executive",
    queryFn: "getEligibleAndTransactors",
    description: "Percentage of eligible accounts that transacted (transactors / eligible)",
    target: 60,
    warningThreshold: 50,
    dangerThreshold: 40,
    higherIsBetter: true,
  },
  {
    key: "total_spend",
    label: "Total Spend",
    unit: "idr",
    section: "executive",
    queryFn: "getSpendMetrics",
    description: "Total authorized spend amount in IDR across all valid transactions",
    higherIsBetter: true,
  },
  {
    key: "avg_spend_per_txn",
    label: "Avg Spend per Txn",
    unit: "idr",
    section: "executive",
    queryFn: "getSpendMetrics",
    description: "Average transaction amount in IDR (total spend / total transactions)",
    higherIsBetter: true,
  },
  {
    key: "new_customer_activation_rate",
    label: "New Customer Activation Rate",
    unit: "percent",
    section: "executive",
    queryFn: "getNewCustomerActivationRate",
    description: "Percentage of newly approved customers who transacted within 7 days",
    target: 52,
    warningThreshold: 45,
    dangerThreshold: 35,
    higherIsBetter: true,
  },
  {
    key: "approval_rate",
    label: "Approval Rate",
    unit: "percent",
    section: "executive",
    queryFn: "getDecisionFunnel",
    description: "Percentage of credit decisions that resulted in approval",
    target: 40,
    warningThreshold: 30,
    dangerThreshold: 20,
    higherIsBetter: true,
  },
  {
    key: "total_applications",
    label: "Total Applications",
    unit: "count",
    section: "executive",
    queryFn: "getDecisionFunnel",
    description: "Total number of credit decisions processed",
    higherIsBetter: true,
  },
];

// ---------------------------------------------------------------------------
// Spend KPIs
// ---------------------------------------------------------------------------

const spendKpis: KpiDefinition[] = [
  {
    key: "total_spend",
    label: "Total Spend",
    unit: "idr",
    section: "spend",
    queryFn: "getSpendMetrics",
    description: "Total authorized spend amount in IDR",
    higherIsBetter: true,
  },
  {
    key: "avg_spend_idr",
    label: "Avg Spend (IDR)",
    unit: "idr",
    section: "spend",
    queryFn: "getSpendMetrics",
    description: "Average transaction amount in IDR",
    higherIsBetter: true,
  },
  {
    key: "avg_spend_online",
    label: "Avg Spend Online",
    unit: "idr",
    section: "spend",
    queryFn: "getSpendMetrics",
    description: "Average online (e-commerce) transaction amount in IDR",
    higherIsBetter: true,
  },
  {
    key: "avg_spend_offline",
    label: "Avg Spend Offline",
    unit: "idr",
    section: "spend",
    queryFn: "getSpendMetrics",
    description: "Average offline (POS/tap) transaction amount in IDR",
    higherIsBetter: true,
  },
  {
    key: "avg_spend_qris",
    label: "Avg Spend QRIS",
    unit: "idr",
    section: "spend",
    queryFn: "getSpendMetrics",
    description: "Average QRIS transaction amount in IDR",
    higherIsBetter: true,
  },
  {
    key: "total_txn_count",
    label: "Total Transactions",
    unit: "count",
    section: "spend",
    queryFn: "getSpendMetrics",
    description: "Total number of valid authorized transactions",
    higherIsBetter: true,
  },
  {
    key: "txn_per_eligible_user",
    label: "Txn per Eligible User",
    unit: "count",
    section: "spend",
    queryFn: "getEligibleAndTransactors",
    description: "Average number of transactions per eligible account",
    higherIsBetter: true,
  },
];

// ---------------------------------------------------------------------------
// Risk KPIs
// ---------------------------------------------------------------------------

const riskKpis: KpiDefinition[] = [
  {
    key: "current_dpd_0",
    label: "Current (DPD 0)",
    unit: "count",
    section: "risk",
    queryFn: "getPortfolioSnapshot",
    description: "Number of accounts with 0 days past due (current/healthy)",
    higherIsBetter: true,
  },
  {
    key: "dpd_1_30",
    label: "1-30 DPD",
    unit: "count",
    section: "risk",
    queryFn: "getPortfolioSnapshot",
    description: "Number of accounts 1-30 days past due (early delinquency)",
    warningThreshold: 200,
    dangerThreshold: 350,
    higherIsBetter: false,
  },
  {
    key: "dpd_31_60",
    label: "31-60 DPD",
    unit: "count",
    section: "risk",
    queryFn: "getPortfolioSnapshot",
    description: "Number of accounts 31-60 days past due",
    warningThreshold: 100,
    dangerThreshold: 200,
    higherIsBetter: false,
  },
  {
    key: "dpd_61_90",
    label: "61-90 DPD",
    unit: "count",
    section: "risk",
    queryFn: "getPortfolioSnapshot",
    description: "Number of accounts 61-90 days past due",
    warningThreshold: 50,
    dangerThreshold: 100,
    higherIsBetter: false,
  },
  {
    key: "dpd_90_plus",
    label: "90+ DPD",
    unit: "count",
    section: "risk",
    queryFn: "getPortfolioSnapshot",
    description: "Number of accounts 90+ days past due (severe delinquency)",
    warningThreshold: 30,
    dangerThreshold: 60,
    higherIsBetter: false,
  },
  {
    key: "total_delinquent_rate",
    label: "Total Delinquent Rate",
    unit: "percent",
    section: "risk",
    queryFn: "getPortfolioSnapshot",
    description: "Percentage of accounts with DPD > 0 out of total active accounts",
    target: 5,
    warningThreshold: 8,
    dangerThreshold: 12,
    higherIsBetter: false,
  },
];

// ---------------------------------------------------------------------------
// Activation KPIs
// ---------------------------------------------------------------------------

const activationKpis: KpiDefinition[] = [
  {
    key: "activation_rate_7d",
    label: "7-Day Activation Rate",
    unit: "percent",
    section: "activation",
    queryFn: "getNewCustomerActivationRate",
    description: "Percentage of newly approved customers who transacted within 7 days of approval",
    target: 52,
    warningThreshold: 45,
    dangerThreshold: 35,
    higherIsBetter: true,
  },
  {
    key: "cards_activated",
    label: "Cards Activated",
    unit: "count",
    section: "activation",
    queryFn: "getNewCustomerActivationRate",
    description: "Number of newly approved customers who made their first transaction within 7 days",
    higherIsBetter: true,
  },
  {
    key: "cards_dormant_30d",
    label: "Dormant 30d+",
    unit: "count",
    section: "activation",
    queryFn: "getPortfolioSnapshot",
    description: "Number of active accounts with no transactions in the last 30 days",
    warningThreshold: 500,
    dangerThreshold: 1000,
    higherIsBetter: false,
  },
  {
    key: "avg_days_to_first_txn",
    label: "Avg Days to First Txn",
    unit: "count",
    section: "activation",
    queryFn: "getNewCustomerActivationRate",
    description: "Average number of days from approval to first transaction for activated users",
    target: 3,
    warningThreshold: 5,
    dangerThreshold: 7,
    higherIsBetter: false,
  },
];

// ---------------------------------------------------------------------------
// Portfolio KPIs
// ---------------------------------------------------------------------------

const portfolioKpis: KpiDefinition[] = [
  {
    key: "total_active_accounts",
    label: "Total Active Accounts",
    unit: "count",
    section: "portfolio",
    queryFn: "getPortfolioSnapshot",
    description: "Total number of accounts with status G (Good) or N (Normal)",
    higherIsBetter: true,
  },
  {
    key: "total_credit_limit",
    label: "Total Credit Limit",
    unit: "idr",
    section: "portfolio",
    queryFn: "getPortfolioSnapshot",
    description: "Sum of credit limits across all active accounts",
    higherIsBetter: true,
  },
  {
    key: "avg_utilization",
    label: "Avg Utilization",
    unit: "percent",
    section: "portfolio",
    queryFn: "getPortfolioSnapshot",
    description: "Average credit utilization across active accounts (balance / limit)",
    target: 60,
    warningThreshold: 70,
    dangerThreshold: 80,
    higherIsBetter: false,
  },
  {
    key: "new_accounts",
    label: "New Accounts",
    unit: "count",
    section: "portfolio",
    queryFn: "getDecisionFunnel",
    description: "Number of newly approved accounts in the period",
    higherIsBetter: true,
  },
];

// ---------------------------------------------------------------------------
// All KPIs (combined + indexed)
// ---------------------------------------------------------------------------

export const ALL_KPI_DEFINITIONS: KpiDefinition[] = [
  ...executiveKpis,
  ...spendKpis,
  ...riskKpis,
  ...activationKpis,
  ...portfolioKpis,
];

/** Lookup a KPI definition by key + section */
export function getKpiDefinition(
  key: string,
  section?: string,
): KpiDefinition | undefined {
  if (section) {
    return ALL_KPI_DEFINITIONS.find(
      (d) => d.key === key && d.section === section,
    );
  }
  return ALL_KPI_DEFINITIONS.find((d) => d.key === key);
}

/** Get all KPI definitions for a given section */
export function getKpisBySection(section: string): KpiDefinition[] {
  return ALL_KPI_DEFINITIONS.filter((d) => d.section === section);
}

/** Get all unique sections */
export function getAllSections(): string[] {
  return [...new Set(ALL_KPI_DEFINITIONS.map((d) => d.section))];
}

/** Get the unique set of query functions needed for a section */
export function getQueryFnsForSection(section: string): string[] {
  return [
    ...new Set(
      ALL_KPI_DEFINITIONS.filter((d) => d.section === section).map(
        (d) => d.queryFn,
      ),
    ),
  ];
}
