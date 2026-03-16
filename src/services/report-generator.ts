import { prisma } from "@/lib/db";
import { setCached, cacheKey } from "@/lib/cache";
import {
  getCurrentPeriod,
  getPreviousPeriod,
  toSqlDate,
  formatPeriodLabel,
  type Cycle,
} from "@/lib/dates";
import {
  getEligibleAndTransactors,
  getSpendMetrics,
  getNewCustomerActivationRate,
  getDecisionFunnel,
  getPortfolioSnapshot,
  getRepaymentMetrics,
  type EligibleAndTransactorsRow,
  type SpendMetricsRow,
  type NewCustomerActivationRow,
  type DecisionFunnelRow,
  type PortfolioSnapshot,
  type RepaymentMetricsRow,
} from "@/services/queries/kpi";
import { analyzeTrends, type MetricPoint } from "@/services/trend-analyzer";
import type { KpiMetric, ReportSection } from "@/types/reports";
import { getKpisBySection, getAllSections } from "@/config/kpi-definitions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedReport {
  id: string;
  cycle: Cycle;
  periodStart: string;
  periodEnd: string;
  section: string;
  title: string;
  data: ReportData;
  trends: string[];
  suggestions: string[];
  generatedAt: string;
}

interface ReportData {
  kpis: KpiMetric[];
  sections: ReportSection[];
  rawData: Record<string, unknown>;
}

interface QueryBundle {
  eligible: EligibleAndTransactorsRow[];
  spend: SpendMetricsRow[];
  activation: NewCustomerActivationRow[];
  decision: DecisionFunnelRow[];
  portfolio: PortfolioSnapshot;
  repayment: RepaymentMetricsRow[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate the executive summary report covering all sections.
 */
export async function generateExecutiveReport(
  cycle: Cycle,
  startDate?: Date,
): Promise<GeneratedReport> {
  const period = startDate
    ? { start: startDate, end: getCurrentPeriod(cycle).end }
    : getCurrentPeriod(cycle);
  const prevPeriod = getPreviousPeriod(cycle, period.start);

  const [current, previous] = await Promise.all([
    runAllQueries(period.start, period.end),
    runAllQueries(prevPeriod.start, prevPeriod.end),
  ]);

  const sections = buildAllSections(current, previous);
  const kpis = sections.flatMap((s) => s.kpis);
  const trends = sections.flatMap((s) => s.trends).slice(0, 15);
  const suggestions = generateAllSuggestions(current, previous);

  const report = await storeReport({
    cycle,
    period,
    section: "executive",
    title: `Executive Report — ${formatPeriodLabel(cycle, period.start)}`,
    data: { kpis, sections, rawData: current as unknown as Record<string, unknown> },
    trends,
    suggestions,
  });

  return report;
}

/**
 * Generate a deep-dive report for a specific section.
 */
export async function generateSectionReport(
  section: string,
  cycle: Cycle,
  startDate?: Date,
): Promise<GeneratedReport> {
  const period = startDate
    ? { start: startDate, end: getCurrentPeriod(cycle).end }
    : getCurrentPeriod(cycle);
  const prevPeriod = getPreviousPeriod(cycle, period.start);

  const [current, previous] = await Promise.all([
    runAllQueries(period.start, period.end),
    runAllQueries(prevPeriod.start, prevPeriod.end),
  ]);

  const sectionData = buildSection(section, current, previous);
  const suggestions = generateActionableSuggestions(
    section,
    current,
    previous,
    sectionData.trends,
  );

  const report = await storeReport({
    cycle,
    period,
    section,
    title: `${capitalize(section)} Report — ${formatPeriodLabel(cycle, period.start)}`,
    data: {
      kpis: sectionData.kpis,
      sections: [sectionData],
      rawData: current as unknown as Record<string, unknown>,
    },
    trends: sectionData.trends,
    suggestions,
  });

  return report;
}

/**
 * Generate reports for ALL sections. Returns array of generated reports.
 */
export async function generateAllReports(
  cycle: Cycle,
  startDate?: Date,
): Promise<GeneratedReport[]> {
  const reports: GeneratedReport[] = [];

  // Executive report first
  const execReport = await generateExecutiveReport(cycle, startDate);
  reports.push(execReport);

  // Then each section deep-dive
  const sections = getAllSections();
  for (const section of sections) {
    if (section === "executive") continue;
    try {
      const sectionReport = await generateSectionReport(section, cycle, startDate);
      reports.push(sectionReport);
    } catch (err) {
      console.error(`[report-generator] Failed to generate ${section} report:`, err);
    }
  }

  return reports;
}

// ---------------------------------------------------------------------------
// Actionable suggestions per business function
// ---------------------------------------------------------------------------

export function generateActionableSuggestions(
  section: string,
  currentData: QueryBundle,
  previousData: QueryBundle,
  trends: string[],
): string[] {
  const suggestions: string[] = [];

  switch (section) {
    case "executive":
      suggestions.push(...generateAllSuggestions(currentData, previousData));
      break;

    case "acquisition": {
      const currDecision = lastOf(currentData.decision);
      const prevDecision = lastOf(previousData.decision);
      if (currDecision && prevDecision) {
        const approvalDelta = currDecision.approval_rate_pct - prevDecision.approval_rate_pct;
        if (approvalDelta < -2) {
          suggestions.push(
            `Approval rate dropped ${Math.abs(approvalDelta).toFixed(1)}% WoW — review if new risk model is too conservative`,
          );
        } else if (approvalDelta > 3) {
          suggestions.push(
            `Approval rate increased ${approvalDelta.toFixed(1)}% WoW — monitor early DPD rates to ensure quality is maintained`,
          );
        }
      }
      const currTotal = lastOf(currentData.decision)?.total_decisions ?? 0;
      const prevTotal = lastOf(previousData.decision)?.total_decisions ?? 0;
      if (prevTotal > 0) {
        const volumeChange = ((currTotal - prevTotal) / prevTotal) * 100;
        if (volumeChange < -10) {
          suggestions.push(
            `Application volume down ${Math.abs(volumeChange).toFixed(0)}% — check marketing funnel and partner channel performance`,
          );
        }
      }
      break;
    }

    case "spend": {
      const currSpend = lastOf(currentData.spend);
      const prevSpend = lastOf(previousData.spend);
      if (currSpend && prevSpend) {
        const qrisCurr = currSpend.avg_spend_qris_idr ?? 0;
        const qrisPrev = prevSpend.avg_spend_qris_idr ?? 0;
        if (qrisPrev > 0) {
          const qrisChange = ((qrisCurr - qrisPrev) / qrisPrev) * 100;
          const txnChange =
            prevSpend.total_txn_count > 0
              ? ((currSpend.total_txn_count - prevSpend.total_txn_count) / prevSpend.total_txn_count) * 100
              : 0;
          if (txnChange > 10 && qrisChange < -5) {
            suggestions.push(
              `QRIS transactions up ${txnChange.toFixed(0)}% but avg ticket size down ${Math.abs(qrisChange).toFixed(0)}% — consider QRIS cashback promotion to increase ticket size`,
            );
          }
        }
        const avgDelta = currSpend.avg_spend_idr - prevSpend.avg_spend_idr;
        if (prevSpend.avg_spend_idr > 0 && (avgDelta / prevSpend.avg_spend_idr) * 100 < -10) {
          suggestions.push(
            `Average spend per transaction declined significantly — review if merchant mix is shifting toward low-value categories`,
          );
        }
      }
      break;
    }

    case "risk": {
      const currPortfolio = currentData.portfolio;
      const prevPortfolio = previousData.portfolio;
      const curr30 = currPortfolio.dpd_buckets.find((b) => b.label === "1-30 DPD")?.count ?? 0;
      const prev30 = prevPortfolio.dpd_buckets.find((b) => b.label === "1-30 DPD")?.count ?? 0;
      const delta30 = curr30 - prev30;
      if (delta30 > 50) {
        suggestions.push(
          `30+ DPD accounts increased by ${delta30} from last week — flag accounts entering 31-60 bucket for proactive collections outreach`,
        );
      }
      const curr90 = currPortfolio.dpd_buckets.find((b) => b.label === "90+ DPD")?.count ?? 0;
      const prev90 = prevPortfolio.dpd_buckets.find((b) => b.label === "90+ DPD")?.count ?? 0;
      if (curr90 > prev90 + 10) {
        suggestions.push(
          `90+ DPD accounts growing — review write-off policy and acceleration of legal collections for chronic non-payers`,
        );
      }
      const totalAccounts = currPortfolio.active_accounts || 1;
      const totalDelinquent = currPortfolio.dpd_buckets
        .filter((b) => b.label !== "Current")
        .reduce((sum, b) => sum + b.count, 0);
      const delinquentRate = (totalDelinquent / totalAccounts) * 100;
      if (delinquentRate > 10) {
        suggestions.push(
          `Overall delinquent rate at ${delinquentRate.toFixed(1)}% — consider tightening approval criteria and reviewing credit policy thresholds`,
        );
      }
      break;
    }

    case "activation": {
      const currActivation = lastOf(currentData.activation);
      if (currActivation) {
        const rate = currActivation.activation_rate_pct;
        const target = 52;
        if (rate < target) {
          suggestions.push(
            `New customer activation rate at ${rate.toFixed(0)}% vs ${target}% target — investigate if card delivery delays are impacting first-txn window`,
          );
        }
        if (currActivation.approved_count > 0 && currActivation.activated_count === 0) {
          suggestions.push(
            `Zero activations this period despite ${currActivation.approved_count} approvals — check card issuance and delivery pipeline`,
          );
        }
      }
      break;
    }

    case "portfolio": {
      const currPortfolio = currentData.portfolio;
      // Credit utilization proxy: we don't have exact utilization from queries,
      // but we can flag based on account status distribution
      const blockedCount = currPortfolio.status_breakdown.find(
        (s) => s.status === "B",
      )?.count ?? 0;
      const totalActive = currPortfolio.active_accounts || 1;
      if (blockedCount > totalActive * 0.05) {
        suggestions.push(
          `Blocked accounts at ${((blockedCount / (currPortfolio.total_accounts || 1)) * 100).toFixed(1)}% of portfolio — review block reasons and consider proactive CLI increases for low-risk accounts`,
        );
      }
      const currEligible = lastOf(currentData.eligible);
      const prevEligible = lastOf(previousData.eligible);
      if (currEligible && prevEligible && prevEligible.eligible_count > 0) {
        const growthRate = ((currEligible.eligible_count - prevEligible.eligible_count) / prevEligible.eligible_count) * 100;
        if (growthRate < 0) {
          suggestions.push(
            `Eligible account base shrank ${Math.abs(growthRate).toFixed(1)}% — investigate if accounts are being blocked or closed at higher rates`,
          );
        }
      }
      break;
    }

    case "collections": {
      const currRepayment = lastOf(currentData.repayment);
      const prevRepayment = lastOf(previousData.repayment);
      if (currRepayment && prevRepayment && prevRepayment.total_repayments > 0) {
        const repaymentChange =
          ((currRepayment.total_repayments - prevRepayment.total_repayments) /
            prevRepayment.total_repayments) *
          100;
        if (repaymentChange < -5) {
          suggestions.push(
            `Repayment volume down ${Math.abs(repaymentChange).toFixed(0)}% — review agent scripts and settlement offer terms`,
          );
        }
        const avgChange =
          prevRepayment.avg_amount > 0
            ? ((currRepayment.avg_amount - prevRepayment.avg_amount) / prevRepayment.avg_amount) * 100
            : 0;
        if (repaymentChange > 5 && avgChange < -5) {
          suggestions.push(
            `Contact rate improved ${repaymentChange.toFixed(0)}% but average repayment amount down — review if settlement discounts are too aggressive`,
          );
        }
      }
      break;
    }

    default:
      break;
  }

  // Fallback: if no suggestions, add a generic one
  if (suggestions.length === 0) {
    suggestions.push(
      `No significant anomalies detected for ${section} this period — continue monitoring key metrics`,
    );
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Internal: build sections
// ---------------------------------------------------------------------------

function buildAllSections(
  current: QueryBundle,
  previous: QueryBundle,
): ReportSection[] {
  const sectionNames = getAllSections();
  return sectionNames.map((s) => buildSection(s, current, previous));
}

function buildSection(
  section: string,
  current: QueryBundle,
  previous: QueryBundle,
): ReportSection {
  const defs = getKpisBySection(section);
  const kpis: KpiMetric[] = defs.map((def) => {
    const currVal = extractValue(def.key, section, current);
    const prevVal = extractValue(def.key, section, previous);
    const change =
      prevVal !== null && prevVal !== 0
        ? ((currVal - prevVal) / Math.abs(prevVal)) * 100
        : null;
    return {
      metric: def.key,
      label: def.label,
      value: currVal,
      prevValue: prevVal,
      unit: def.unit,
      changePercent: change !== null ? Math.round(change * 10) / 10 : null,
      direction:
        change === null || Math.abs(change) < 0.5
          ? "flat"
          : change > 0
            ? "up"
            : "down",
    };
  });

  // Build chart data from time-series results
  const chartData = buildChartData(section, current);

  // Build trends
  const trends = buildSectionTrends(section, current, previous);

  return {
    id: section,
    title: capitalize(section),
    kpis,
    chartData,
    trends,
  };
}

function buildChartData(
  section: string,
  data: QueryBundle,
): { date: string; [key: string]: string | number }[] {
  switch (section) {
    case "executive":
    case "spend": {
      return (data.spend || []).map((row) => ({
        date: row.week_start,
        total_spend_idr: row.total_spend_idr,
        avg_spend_idr: row.avg_spend_idr,
        total_txn_count: row.total_txn_count,
        avg_spend_online_idr: row.avg_spend_online_idr ?? 0,
        avg_spend_offline_idr: row.avg_spend_offline_idr ?? 0,
        avg_spend_qris_idr: row.avg_spend_qris_idr ?? 0,
      }));
    }
    case "risk": {
      // DPD buckets as a single-point snapshot (no time series)
      return data.portfolio.dpd_buckets.map((b) => ({
        date: "current",
        label: b.label,
        count: b.count,
        exposure_idr: b.exposure_idr,
      }));
    }
    case "activation": {
      return (data.activation || []).map((row) => ({
        date: row.week_start,
        approved_count: row.approved_count,
        activated_count: row.activated_count,
        activation_rate_pct: row.activation_rate_pct,
      }));
    }
    case "portfolio": {
      return data.portfolio.status_breakdown.map((s) => ({
        date: "current",
        status: s.status,
        count: s.count,
      }));
    }
    case "acquisition": {
      return (data.decision || []).map((row) => ({
        date: row.week_start,
        total_decisions: row.total_decisions,
        approved: row.approved,
        declined: row.declined,
        waitlisted: row.waitlisted,
        approval_rate_pct: row.approval_rate_pct,
      }));
    }
    case "collections": {
      return (data.repayment || []).map((row) => ({
        date: row.week_start,
        total_repayments: row.total_repayments,
        total_amount: row.total_amount,
        avg_amount: row.avg_amount,
      }));
    }
    default:
      return [];
  }
}

function buildSectionTrends(
  section: string,
  current: QueryBundle,
  previous: QueryBundle,
): string[] {
  const trendMap: Record<string, { data: unknown[]; prevData: unknown[]; field: string; label: string }[]> = {
    executive: [
      { data: current.eligible, prevData: previous.eligible, field: "eligible_count", label: "Eligible Accounts" },
      { data: current.eligible, prevData: previous.eligible, field: "spend_active_rate", label: "Spend Active Rate" },
      { data: current.spend, prevData: previous.spend, field: "total_spend_idr", label: "Total Spend" },
    ],
    spend: [
      { data: current.spend, prevData: previous.spend, field: "total_spend_idr", label: "Total Spend" },
      { data: current.spend, prevData: previous.spend, field: "avg_spend_idr", label: "Avg Spend per Txn" },
      { data: current.spend, prevData: previous.spend, field: "total_txn_count", label: "Transaction Count" },
    ],
    acquisition: [
      { data: current.decision, prevData: previous.decision, field: "approval_rate_pct", label: "Approval Rate" },
      { data: current.decision, prevData: previous.decision, field: "total_decisions", label: "Total Applications" },
    ],
    activation: [
      { data: current.activation, prevData: previous.activation, field: "activation_rate_pct", label: "Activation Rate" },
      { data: current.activation, prevData: previous.activation, field: "activated_count", label: "Cards Activated" },
    ],
    risk: [],
    portfolio: [],
    collections: [
      { data: current.repayment, prevData: previous.repayment, field: "total_repayments", label: "Repayment Count" },
      { data: current.repayment, prevData: previous.repayment, field: "total_amount", label: "Repayment Amount" },
    ],
  };

  const configs = trendMap[section] || [];
  const allTrends: string[] = [];

  for (const { data, prevData, field, label } of configs) {
    if (!Array.isArray(data)) continue;
    const currPoints: MetricPoint[] = (data as Record<string, unknown>[]).map((r) => ({
      date: (r as Record<string, string>).week_start,
      value: ((r as Record<string, number>)[field]) ?? 0,
    }));
    const prevPoints: MetricPoint[] = Array.isArray(prevData)
      ? (prevData as Record<string, unknown>[]).map((r) => ({
          date: (r as Record<string, string>).week_start,
          value: ((r as Record<string, number>)[field]) ?? 0,
        }))
      : [];
    allTrends.push(...analyzeTrends(currPoints, prevPoints, label).slice(0, 2));
  }

  return allTrends.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Internal: query runner
// ---------------------------------------------------------------------------

async function runAllQueries(
  startDate: Date,
  endDate: Date,
): Promise<QueryBundle> {
  const [eligible, spend, activation, decision, portfolio, repayment] =
    await Promise.all([
      getEligibleAndTransactors(startDate, endDate),
      getSpendMetrics(startDate, endDate),
      getNewCustomerActivationRate(startDate, endDate),
      getDecisionFunnel(startDate, endDate),
      getPortfolioSnapshot(endDate),
      getRepaymentMetrics(startDate, endDate),
    ]);

  return { eligible, spend, activation, decision, portfolio, repayment };
}

// ---------------------------------------------------------------------------
// Internal: store report in Prisma + cache
// ---------------------------------------------------------------------------

async function storeReport(params: {
  cycle: Cycle;
  period: { start: Date; end: Date };
  section: string;
  title: string;
  data: ReportData;
  trends: string[];
  suggestions: string[];
}): Promise<GeneratedReport> {
  const id = crypto.randomUUID();
  const now = new Date();
  const periodStart = toSqlDate(params.period.start);
  const periodEnd = toSqlDate(params.period.end);

  // Store in Prisma (SQLite Report table)
  await prisma.report.create({
    data: {
      id,
      cycle: params.cycle,
      periodStart: params.period.start,
      periodEnd: params.period.end,
      section: params.section,
      title: params.title,
      data: JSON.stringify({
        ...params.data,
        suggestions: params.suggestions,
      }),
      trends: JSON.stringify(params.trends),
      generatedAt: now,
      status: "completed",
    },
  });

  // Store in cache for fast reads
  const key = cacheKey("report", params.section, params.cycle, periodStart);
  setCached(key, {
    id,
    ...params.data,
    trends: params.trends,
    suggestions: params.suggestions,
  });

  // Also cache the KPI blob for the section
  const kpiKey = cacheKey("kpi", params.section, params.cycle, periodStart);
  setCached(kpiKey, {
    kpis: params.data.kpis,
    chartData: params.data.sections[0]?.chartData ?? [],
    trends: params.trends,
  });

  return {
    id,
    cycle: params.cycle,
    periodStart,
    periodEnd,
    section: params.section,
    title: params.title,
    data: params.data,
    trends: params.trends,
    suggestions: params.suggestions,
    generatedAt: now.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Internal: extract metric values from QueryBundle
// ---------------------------------------------------------------------------

function extractValue(
  key: string,
  section: string,
  data: QueryBundle,
): number {
  const fieldMap: Record<string, () => number> = {
    eligible_count: () => lastOf(data.eligible)?.eligible_count ?? 0,
    transactor_count: () => lastOf(data.eligible)?.transactor_count ?? 0,
    spend_active_rate: () => lastOf(data.eligible)?.spend_active_rate ?? 0,
    total_spend: () => lastOf(data.spend)?.total_spend_idr ?? 0,
    avg_spend_per_txn: () => lastOf(data.spend)?.avg_spend_idr ?? 0,
    avg_spend_idr: () => lastOf(data.spend)?.avg_spend_idr ?? 0,
    avg_spend_online: () => lastOf(data.spend)?.avg_spend_online_idr ?? 0,
    avg_spend_offline: () => lastOf(data.spend)?.avg_spend_offline_idr ?? 0,
    avg_spend_qris: () => lastOf(data.spend)?.avg_spend_qris_idr ?? 0,
    total_txn_count: () => lastOf(data.spend)?.total_txn_count ?? 0,
    txn_per_eligible_user: () => {
      const txns = lastOf(data.eligible)?.total_transactions ?? 0;
      const eligible = lastOf(data.eligible)?.eligible_count ?? 1;
      return eligible > 0 ? Math.round((txns / eligible) * 100) / 100 : 0;
    },
    new_customer_activation_rate: () => lastOf(data.activation)?.activation_rate_pct ?? 0,
    activation_rate_7d: () => lastOf(data.activation)?.activation_rate_pct ?? 0,
    cards_activated: () => lastOf(data.activation)?.activated_count ?? 0,
    cards_dormant_30d: () => 0, // Requires separate query not yet implemented
    avg_days_to_first_txn: () => 0, // Requires separate query not yet implemented
    approval_rate: () => lastOf(data.decision)?.approval_rate_pct ?? 0,
    total_applications: () => lastOf(data.decision)?.total_decisions ?? 0,
    new_accounts: () => lastOf(data.decision)?.approved ?? 0,
    current_dpd_0: () => data.portfolio.dpd_buckets.find((b) => b.label === "Current")?.count ?? 0,
    dpd_1_30: () => data.portfolio.dpd_buckets.find((b) => b.label === "1-30 DPD")?.count ?? 0,
    dpd_31_60: () => data.portfolio.dpd_buckets.find((b) => b.label === "31-60 DPD")?.count ?? 0,
    dpd_61_90: () => data.portfolio.dpd_buckets.find((b) => b.label === "61-90 DPD")?.count ?? 0,
    dpd_90_plus: () => data.portfolio.dpd_buckets.find((b) => b.label === "90+ DPD")?.count ?? 0,
    total_delinquent_rate: () => {
      const totalActive = data.portfolio.active_accounts || 1;
      const delinquent = data.portfolio.dpd_buckets
        .filter((b) => b.label !== "Current")
        .reduce((sum, b) => sum + b.count, 0);
      return Math.round((delinquent / totalActive) * 1000) / 10;
    },
    total_active_accounts: () => data.portfolio.active_accounts,
    total_credit_limit: () => 0, // Requires additional field in portfolio query
    avg_utilization: () => 0, // Requires additional field in portfolio query
  };

  const extractor = fieldMap[key];
  return extractor ? extractor() : 0;
}

// ---------------------------------------------------------------------------
// Internal: generate suggestions across all sections
// ---------------------------------------------------------------------------

function generateAllSuggestions(
  current: QueryBundle,
  previous: QueryBundle,
): string[] {
  const sections = [
    "acquisition",
    "spend",
    "risk",
    "activation",
    "portfolio",
    "collections",
  ];

  const suggestions: string[] = [];
  for (const section of sections) {
    const sectionTrends = buildSectionTrends(section, current, previous);
    const sectionSuggestions = generateActionableSuggestions(
      section,
      current,
      previous,
      sectionTrends,
    );
    suggestions.push(...sectionSuggestions.slice(0, 2)); // Top 2 per section
  }

  return suggestions.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lastOf<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[arr.length - 1] : undefined;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
