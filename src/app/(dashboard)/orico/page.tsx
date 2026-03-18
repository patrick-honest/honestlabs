"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { Header } from "@/components/layout/header";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, scaleTrendData, scaleMetricValue } from "@/lib/period-data";
import { cn } from "@/lib/utils";
import { Printer, TrendingUp, TrendingDown, Minus, Lock } from "lucide-react";
import { SampleDataBanner, SampleDataBadge } from "@/components/dashboard/sample-data-banner";
import { PageGuard } from "@/components/layout/page-guard";
import type { QueryInfo } from "@/components/query-inspector/query-inspector";

const AS_OF = "Mar 15, 2026";

// ── Print styles (injected once) ────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  /* ── Page setup ─────────────────────────────────────────────────── */
  @page {
    size: A4 portrait;
    margin: 0.6in 0.6in 0.8in 0.6in;
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 7pt;
      color: #999;
    }
  }

  /* ── Hide UI chrome ─────────────────────────────────────────────── */
  nav, header, [data-print-hide], button, .no-print,
  .tab-navigation { display: none !important; }

  /* ── Base typography ────────────────────────────────────────────── */
  body {
    background: white !important;
    color: black !important;
    font-size: 9pt;
    line-height: 1.3;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Reset backgrounds & text but PRESERVE SVG/chart colors */
  *:not(svg):not(svg *):not(.recharts-surface):not(.recharts-surface *) {
    color: black !important;
    border-color: #ccc !important;
  }
  /* Only set white background on non-chart elements */
  div:not([class*="recharts"]),
  main, section, article, td, th, tr, thead, tbody, p, span, h1, h2, h3, h4, h5, h6 {
    background: white !important;
  }

  /* ── Preserve chart/SVG colors ──────────────────────────────────── */
  svg, svg *, .recharts-surface, .recharts-surface *,
  .recharts-bar-rectangle, .recharts-line, .recharts-area,
  .recharts-legend-item-text {
    color: inherit !important;
    fill: inherit !important;
    stroke: inherit !important;
  }
  svg rect[fill], svg path[fill], svg circle[fill] {
    fill: inherit !important;
  }
  svg path[stroke], svg line[stroke] {
    stroke: inherit !important;
  }
  .recharts-default-legend { color: #333 !important; }

  /* ── Print header ───────────────────────────────────────────────── */
  .print-header {
    display: block !important;
    text-align: center;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid #333;
    position: relative;
  }
  .print-header h1 { font-size: 16pt; font-weight: bold; margin: 0; }
  .print-header p { font-size: 9pt; margin: 3px 0 0; color: #666 !important; }
  .print-header .confidential {
    display: block !important;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: #c00 !important;
    margin-top: 4px;
  }

  /* ── Print footer (page numbers via fixed element) ──────────────── */
  .print-footer {
    display: block !important;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 7pt;
    color: #999 !important;
    padding: 4px 0;
    border-top: 1px solid #ddd;
  }

  /* ── Print section dividers ─────────────────────────────────────── */
  .print-section-divider {
    display: block !important;
    page-break-before: always;
    padding-top: 8px;
    margin-bottom: 12px;
    border-bottom: 1.5px solid #333;
  }
  .print-section-divider h2 {
    font-size: 14pt;
    font-weight: 700;
    margin: 0 0 4px 0;
  }
  .print-section-divider p {
    font-size: 8pt;
    color: #666 !important;
    margin: 0;
  }

  /* ── Compact tables ─────────────────────────────────────────────── */
  table {
    page-break-inside: avoid;
    width: 100% !important;
    border-collapse: collapse;
    font-size: 8pt;
  }
  th, td {
    padding: 3px 6px !important;
    line-height: 1.25;
  }
  thead th {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    border-bottom: 1.5px solid #333 !important;
  }

  /* ── Compact spacing ────────────────────────────────────────────── */
  .space-y-6 > * + * { margin-top: 12px !important; }
  .space-y-2 > * + * { margin-top: 6px !important; }
  .gap-4 { gap: 8px !important; }
  .mb-6 { margin-bottom: 10px !important; }
  .mb-8 { margin-bottom: 12px !important; }
  .p-6 { padding: 0 !important; }
  .py-2\\.5 { padding-top: 3px !important; padding-bottom: 3px !important; }

  /* ── Chart cards: avoid breaks ──────────────────────────────────── */
  [class*="chart-card"], [class*="ChartCard"],
  .rounded-lg, .overflow-x-auto {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* ── Page breaks ────────────────────────────────────────────────── */
  .page-break { page-break-before: always; }

  /* ── Metric cards grid: compact ─────────────────────────────────── */
  .grid { page-break-inside: avoid; }
  .grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4 {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 8px !important;
  }

  /* ── Full width content ─────────────────────────────────────────── */
  .flex-1, .flex.flex-col { width: 100% !important; max-width: 100% !important; }

  /* ── SampleDataBanner: hide overlay/watermark effects but keep label */
  [class*="sample-data-banner"] { position: relative !important; }
  [class*="sample-data-banner"]::before,
  [class*="sample-data-banner"]::after { display: none !important; }
  [data-sample-overlay] { display: none !important; }
  .sample-data-badge {
    display: inline-block !important;
    font-size: 6pt;
    border: 0.5px solid #999;
    padding: 0 3px;
    color: #999 !important;
  }

  /* ── Hide Recharts tooltips ─────────────────────────────────────── */
  .recharts-tooltip-wrapper { display: none !important; }

  /* ── Insights: compact ──────────────────────────────────────────── */
  [class*="chart-insights"], [class*="ChartInsights"] {
    font-size: 7.5pt;
    line-height: 1.3;
    margin-top: 4px !important;
  }

  /* ── Action items: compact ──────────────────────────────────────── */
  [class*="action-item"] {
    padding: 4px 8px !important;
    font-size: 8pt;
  }
}

@media screen {
  .print-header { display: none !important; }
  .print-section-divider { display: none !important; }
  .print-footer { display: none !important; }
}
`;

// Query metadata (inline to avoid pulling BigQuery SDK into client bundle)
const Q_APPROVED: QueryInfo = { title: "Orico: Approved by Segment", sql: "SELECT DATE_TRUNC(date_decision, MONTH) AS month_key, CASE WHEN is_account_opening_fee_applicable = FALSE AND is_prepaid_card_applicable = FALSE THEN 'Regular' WHEN is_prepaid_card_applicable = TRUE THEN 'RP1' WHEN is_account_opening_fee_applicable = TRUE THEN 'AOF' ELSE 'Regular' END AS segment, COUNT(DISTINCT CASE WHEN decision = 'APPROVED' THEN application_status_id END) AS total_approved FROM sandbox_risk.ft_application_decision_base GROUP BY 1, 2 ORDER BY 1, 2", params: [] };
const Q_ACCEPTED: QueryInfo = { title: "Orico: Accepted Users (Cumulative)", sql: "WITH T1 AS (...signed_contract_file parsing...) SELECT month_key, segment, total_accepted_user, SUM(...) OVER (...) AS cumul_accepted_user FROM summary ORDER BY 1", params: [] };
const Q_ACTIVE: QueryInfo = { title: "Orico: Active Portfolio", sql: "SELECT month_key, segment, COUNT(DISTINCT P9_DW004_LOC_ACCT) AS total_account FROM (...dim_daily_portfolio + dim_map_application_locacct + ft_application_decision_base...) WHERE dpd_bi < 7 GROUP BY 1, 2 ORDER BY 1, 2", params: [] };
const Q_PORTFOLIO: QueryInfo = { title: "Orico: Portfolio Summary", sql: "SELECT reporting_date_month, segment, product_segment, total_newly_account, total_newly_limit, cum_booked_customer FROM portfolio_agg_customer GROUP BY 1, 2, 3 ORDER BY 1, 3, 2", params: [] };
const Q_PROVISION = (d: string): QueryInfo => ({ title: "Orico: Provision & Undrawn Limit", sql: `SELECT segment, SUM(provision), SUM(undrawn_limit) FROM (...ECL calc with DPD-based rates...) WHERE reporting_date_day = '${d}' GROUP BY 1`, params: [{ name: "report_date", value: d, type: "DATE" }] });
const Q_RP1_TOPUP: QueryInfo = { title: "Orico: RP1 Top-up Rate", sql: "SELECT reporting_date_day, COUNT(DISTINCT P9_DW004_LOC_ACCT) AS total_account_rp1, COUNT(DISTINCT CASE WHEN ... THEN P9_DW004_LOC_ACCT END) AS total_topup_rp1 FROM dim_daily_portfolio WHERE f9_dw001_loc_lmt = 1 AND dpd_bi < 7 GROUP BY 1 ORDER BY 1", params: [] };
const Q_FUNNEL: QueryInfo = { title: "Orico: Onboarding Funnel", sql: "SELECT month_onboard, segment, total_onboard, total_accepted_user, cum_total_onboard, cum_total_accepted_user FROM (...approved + accepted join...) ORDER BY 1", params: [] };

// ── Mock Data matching query output shapes ──────────────────────────────────

// Query 1: Approved by Segment
const approvedBySegment = [
  { date: "Jul 25", Regular: 1200, RP1: 450, AOF: 180 },
  { date: "Aug 25", Regular: 1350, RP1: 520, AOF: 210 },
  { date: "Sep 25", Regular: 1480, RP1: 580, AOF: 240 },
  { date: "Oct 25", Regular: 1600, RP1: 630, AOF: 260 },
  { date: "Nov 25", Regular: 1720, RP1: 680, AOF: 290 },
  { date: "Dec 25", Regular: 1550, RP1: 610, AOF: 250 },
  { date: "Jan 26", Regular: 1850, RP1: 740, AOF: 310 },
  { date: "Feb 26", Regular: 1980, RP1: 790, AOF: 340 },
  { date: "Mar 26", Regular: 2100, RP1: 850, AOF: 370 },
];

const approvedInsights: ChartInsight[] = [
  { text: "Total approvals grew 14.7% MoM in Mar 2026 (3,320 vs 3,110 in Feb), driven by Regular segment expansion.", type: "positive" },
  { text: "RP1 segment approvals up 7.6% MoM (850 vs 790), maintaining ~25% share of total volume.", type: "positive" },
  { text: "AOF approvals growing steadily at ~9% MoM but still represent only 11% of total volume.", type: "neutral" },
  { text: "Dec 2025 dip of -8.9% likely due to year-end holidays reducing application flow and processing capacity.", type: "neutral" },
  { text: "[Hypothesis] Acceleration in Jan-Mar may reflect seasonal demand from Ramadan spending preparation and marketing pushes.", type: "hypothesis" },
];

// Query 2: Accepted (signed contract) with cumulative
const acceptedCumulative = [
  { date: "Jul 25", Regular: 980, RP1: 380, AOF: 150, cumRegular: 980, cumRP1: 380, cumAOF: 150 },
  { date: "Aug 25", Regular: 1120, RP1: 440, AOF: 175, cumRegular: 2100, cumRP1: 820, cumAOF: 325 },
  { date: "Sep 25", Regular: 1250, RP1: 490, AOF: 200, cumRegular: 3350, cumRP1: 1310, cumAOF: 525 },
  { date: "Oct 25", Regular: 1380, RP1: 540, AOF: 220, cumRegular: 4730, cumRP1: 1850, cumAOF: 745 },
  { date: "Nov 25", Regular: 1480, RP1: 580, AOF: 245, cumRegular: 6210, cumRP1: 2430, cumAOF: 990 },
  { date: "Dec 25", Regular: 1320, RP1: 520, AOF: 210, cumRegular: 7530, cumRP1: 2950, cumAOF: 1200 },
  { date: "Jan 26", Regular: 1600, RP1: 630, AOF: 260, cumRegular: 9130, cumRP1: 3580, cumAOF: 1460 },
  { date: "Feb 26", Regular: 1720, RP1: 680, AOF: 290, cumRegular: 10850, cumRP1: 4260, cumAOF: 1750 },
  { date: "Mar 26", Regular: 1830, RP1: 730, AOF: 310, cumRegular: 12680, cumRP1: 4990, cumAOF: 2060 },
];

const acceptedInsights: ChartInsight[] = [
  { text: "Cumulative accepted users reached 19,730 across all segments by Mar 2026, up from 16,860 in Feb (+17%).", type: "positive" },
  { text: "Acceptance rate (accepted / approved) for Regular is ~87%, RP1 ~86%, AOF ~84% -- relatively consistent across products.", type: "neutral" },
  { text: "Dec 2025 acceptance dip mirrors approval dip -- contract signing volume dropped ~8% likely due to holiday slowdown.", type: "negative" },
  { text: "[Hypothesis] AOF acceptance rate slightly lower than others -- potential friction in fee disclosure during contract signing flow.", type: "hypothesis" },
];

// Query 3: Active Portfolio (dpd_bi < 7, end of month)
const activePortfolio = [
  { date: "Jul 25", Regular: 3800, RP1: 1500, AOF: 620 },
  { date: "Aug 25", Regular: 4600, RP1: 1820, AOF: 750 },
  { date: "Sep 25", Regular: 5500, RP1: 2150, AOF: 890 },
  { date: "Oct 25", Regular: 6500, RP1: 2500, AOF: 1020 },
  { date: "Nov 25", Regular: 7500, RP1: 2850, AOF: 1150 },
  { date: "Dec 25", Regular: 8300, RP1: 3150, AOF: 1280 },
  { date: "Jan 26", Regular: 9400, RP1: 3600, AOF: 1450 },
  { date: "Feb 26", Regular: 10600, RP1: 4050, AOF: 1630 },
  { date: "Mar 26", Regular: 11900, RP1: 4550, AOF: 1830 },
];

const activePortfolioInsights: ChartInsight[] = [
  { text: "Active portfolio reached 18,280 accounts (dpd_bi < 7) in Mar 2026, up 12.9% from Feb (16,280).", type: "positive" },
  { text: "Regular segment dominates at 65% of active accounts, RP1 at 25%, AOF at 10%.", type: "neutral" },
  { text: "Portfolio growth rate accelerating: 12.9% in Mar vs 10.6% in Feb vs 8.7% in Jan.", type: "positive" },
  { text: "Active account retention (active / cumulative booked) is approximately 92.6%, indicating healthy portfolio quality.", type: "positive" },
  { text: "[Hypothesis] Growth acceleration may be driven by Ramadan campaign effects with higher card usage and lower dormancy.", type: "hypothesis" },
];

// Query 4: Portfolio Summary (risk segment x product segment)
interface PortfolioSummaryMock {
  month: string;
  segment: string;
  product: string;
  newlyAccounts: number;
  newlyLimit: number;
  cumBookedCustomer: number;
}

const portfolioSummary: PortfolioSummaryMock[] = [
  { month: "Mar 26", segment: "A", product: "Regular", newlyAccounts: 920, newlyLimit: 13800000000, cumBookedCustomer: 5200 },
  { month: "Mar 26", segment: "A", product: "RP1", newlyAccounts: 380, newlyLimit: 0, cumBookedCustomer: 2100 },
  { month: "Mar 26", segment: "A", product: "AOF", newlyAccounts: 160, newlyLimit: 1600000000, cumBookedCustomer: 850 },
  { month: "Mar 26", segment: "B", product: "Regular", newlyAccounts: 650, newlyLimit: 5850000000, cumBookedCustomer: 3800 },
  { month: "Mar 26", segment: "B", product: "RP1", newlyAccounts: 280, newlyLimit: 0, cumBookedCustomer: 1500 },
  { month: "Mar 26", segment: "B", product: "AOF", newlyAccounts: 110, newlyLimit: 770000000, cumBookedCustomer: 600 },
  { month: "Mar 26", segment: "C", product: "Regular", newlyAccounts: 380, newlyLimit: 2280000000, cumBookedCustomer: 2200 },
  { month: "Mar 26", segment: "C", product: "RP1", newlyAccounts: 150, newlyLimit: 0, cumBookedCustomer: 900 },
  { month: "Mar 26", segment: "C", product: "AOF", newlyAccounts: 70, newlyLimit: 350000000, cumBookedCustomer: 400 },
  { month: "Mar 26", segment: "D", product: "Regular", newlyAccounts: 150, newlyLimit: 750000000, cumBookedCustomer: 700 },
  { month: "Mar 26", segment: "D", product: "RP1", newlyAccounts: 40, newlyLimit: 0, cumBookedCustomer: 90 },
  { month: "Mar 26", segment: "D", product: "AOF", newlyAccounts: 30, newlyLimit: 120000000, cumBookedCustomer: 110 },
];

const portfolioSummaryInsights: ChartInsight[] = [
  { text: "Segment A (lowest risk) accounts for 50.4% of new Regular accounts and 53.3% of new RP1 -- strong credit quality intake.", type: "positive" },
  { text: "RP1 newly_limit is Rp 0 across all segments as expected (prepaid cards have no revolving credit limit).", type: "neutral" },
  { text: "Total newly booked in Mar: 3,320 accounts with Rp 25.5B in new limits (ex-RP1), avg Rp 10.9M per non-RP1 account.", type: "neutral" },
  { text: "Segment D (highest risk) represents only 7.6% of new accounts -- suggesting scorecard is effectively filtering.", type: "positive" },
  { text: "[Hypothesis] D-segment share may rise if marketing channels shift to broader reach audiences in upcoming campaigns.", type: "hypothesis" },
];

// Query 5: Provision & Undrawn Limit
interface ProvisionMock {
  segment: string;
  provision: number;
  undrawnLimit: number;
}

const provisionData: ProvisionMock[] = [
  { segment: "Regular", provision: 2850000000, undrawnLimit: 18500000000 },
  { segment: "RP1", provision: 420000000, undrawnLimit: 0 },
  { segment: "AOF", provision: 310000000, undrawnLimit: 2100000000 },
];

const provisionInsights: ChartInsight[] = [
  { text: "Total ECL provision stands at Rp 3.58B -- Regular accounts for 79.6% (Rp 2.85B) as the dominant portfolio.", type: "neutral" },
  { text: "RP1 undrawn limit is Rp 0 as expected -- prepaid accounts have no unused credit facility.", type: "neutral" },
  { text: "Provision-to-outstanding ratio for Regular segment is ~1.8% indicating healthy coverage levels.", type: "positive" },
  { text: "[Hypothesis] If DPD 0 accounts shift to DPD 1+ in coming months, provision could increase 3-5x for those accounts due to stage migration.", type: "hypothesis" },
];

// Query 6: RP1 Top-up Rate
const rp1Topup = [
  { date: "Jul 25", totalRp1: 1500, topupRp1: 180, rate: 12.0 },
  { date: "Aug 25", totalRp1: 1820, topupRp1: 240, rate: 13.19 },
  { date: "Sep 25", totalRp1: 2150, topupRp1: 310, rate: 14.42 },
  { date: "Oct 25", totalRp1: 2500, topupRp1: 400, rate: 16.0 },
  { date: "Nov 25", totalRp1: 2850, topupRp1: 485, rate: 17.02 },
  { date: "Dec 25", totalRp1: 3150, topupRp1: 567, rate: 18.0 },
  { date: "Jan 26", totalRp1: 3600, topupRp1: 684, rate: 19.0 },
  { date: "Feb 26", totalRp1: 4050, topupRp1: 810, rate: 20.0 },
  { date: "Mar 26", totalRp1: 4550, topupRp1: 955, rate: 20.99 },
];

const rp1TopupInsights: ChartInsight[] = [
  { text: "RP1 top-up rate reached 21% in Mar 2026, a steady climb from 12% in Jul 2025 -- strong engagement signal.", type: "positive" },
  { text: "955 out of 4,550 RP1 accounts have topped up, indicating growing usage beyond initial prepaid balance.", type: "positive" },
  { text: "Top-up rate has improved ~1pp per month consistently for 9 months.", type: "neutral" },
  { text: "[Hypothesis] Top-up rate acceleration may correlate with Ramadan spending season -- users needing additional balance for holiday purchases.", type: "hypothesis" },
  { text: "[Hypothesis] If RP1 top-up rate exceeds 30%, it could signal readiness for upsell to Regular credit product.", type: "hypothesis" },
];

// Query 7: Onboarding Funnel (Approved -> Accepted with cumulative)
const onboardingFunnel = [
  { date: "Jul 25", approvedReg: 1200, acceptedReg: 980, approvedRP1: 450, acceptedRP1: 380, approvedAOF: 180, acceptedAOF: 150 },
  { date: "Aug 25", approvedReg: 1350, acceptedReg: 1120, approvedRP1: 520, acceptedRP1: 440, approvedAOF: 210, acceptedAOF: 175 },
  { date: "Sep 25", approvedReg: 1480, acceptedReg: 1250, approvedRP1: 580, acceptedRP1: 490, approvedAOF: 240, acceptedAOF: 200 },
  { date: "Oct 25", approvedReg: 1600, acceptedReg: 1380, approvedRP1: 630, acceptedRP1: 540, approvedAOF: 260, acceptedAOF: 220 },
  { date: "Nov 25", approvedReg: 1720, acceptedReg: 1480, approvedRP1: 680, acceptedRP1: 580, approvedAOF: 290, acceptedAOF: 245 },
  { date: "Dec 25", approvedReg: 1550, acceptedReg: 1320, approvedRP1: 610, acceptedRP1: 520, approvedAOF: 250, acceptedAOF: 210 },
  { date: "Jan 26", approvedReg: 1850, acceptedReg: 1600, approvedRP1: 740, acceptedRP1: 630, approvedAOF: 310, acceptedAOF: 260 },
  { date: "Feb 26", approvedReg: 1980, acceptedReg: 1720, approvedRP1: 790, acceptedRP1: 680, approvedAOF: 340, acceptedAOF: 290 },
  { date: "Mar 26", approvedReg: 2100, acceptedReg: 1830, approvedRP1: 850, acceptedRP1: 730, approvedAOF: 370, acceptedAOF: 310 },
];

const onboardingInsights: ChartInsight[] = [
  { text: "Overall acceptance rate (accepted / approved) is 86.4% in Mar 2026 -- Regular 87.1%, RP1 85.9%, AOF 83.8%.", type: "neutral" },
  { text: "Approved-to-accepted gap widened slightly for AOF (16.2% drop-off vs 12.9% for Regular), suggesting friction in fee acceptance.", type: "negative" },
  { text: "Mar 2026 achieved highest-ever monthly approved volume at 3,320, surpassing Jan 2026 record of 2,900.", type: "positive" },
  { text: "Cumulative accepted users reached 19,730 -- on track for 25,000 milestone by Jun 2026 at current growth rates.", type: "positive" },
  { text: "[Hypothesis] AOF drop-off may be reduced by improving fee transparency earlier in the application flow.", type: "hypothesis" },
];

// Action items
const actionItems: ActionItem[] = [
  {
    id: "orico-1",
    priority: "positive",
    action: "Active portfolio surpassed 18K accounts.",
    detail: "Strong growth at 12.9% MoM. Cumulative accepted users at 19.7K on track for 25K by mid-2026.",
  },
  {
    id: "orico-2",
    priority: "positive",
    action: "RP1 top-up rate steadily climbing to 21%.",
    detail: "Indicates growing engagement with prepaid product. Consider upsell paths for high-engagement RP1 users.",
  },
  {
    id: "orico-3",
    priority: "monitor",
    action: "AOF acceptance rate (83.8%) trails Regular (87.1%).",
    detail: "3.3pp gap suggests fee disclosure may cause hesitation. Review contract signing UX for AOF customers.",
  },
  {
    id: "orico-4",
    priority: "monitor",
    action: "ECL provision at Rp 3.58B warrants monitoring.",
    detail: "While provision ratios are healthy at ~1.8%, stage migration from DPD 0 to DPD 1+ could cause rapid increases.",
  },
  {
    id: "orico-5",
    priority: "urgent",
    action: "Segment D intake at 7.6% -- watch for creep.",
    detail: "Scorecards are filtering effectively but any expansion of marketing channels could shift the risk mix upward.",
  },
];

// ── Tab 2: KPIs & Financial Results Data ────────────────────────────────────

interface KpiRow {
  metric: string;
  plan: string;
  actual: string;
  gap: string;
  achievement: string;
  indent?: boolean;
  isSectionTotal?: boolean;
}

const kpiRows: KpiRow[] = [
  { metric: "Total Booked Customer (Cumulative)", plan: "235,636", actual: "235,138", gap: "-498", achievement: "99.8%" },
  { metric: "(of which) 1Rp cards", plan: "47,658", actual: "46,796", gap: "-862", achievement: "98.2%", indent: true },
  { metric: "New Customer (Monthly)", plan: "4,000", actual: "4,649", gap: "+649", achievement: "116.2%" },
  { metric: "(of which) Core Cards and Registration Fee", plan: "--", actual: "1,561", gap: "--", achievement: "--", indent: true },
  { metric: "(of which) 1Rp cards", plan: "1,536", actual: "3,088", gap: "+1,552", achievement: "201.0%", indent: true },
  { metric: "Active ratio", plan: "--", actual: "48.5%", gap: "--", achievement: "--" },
  { metric: "Revolving ratio", plan: "68.1%", actual: "63.7%", gap: "-4.4pp", achievement: "93.5%" },
  { metric: "Spending (IDR 000)", plan: "11,722,920", actual: "15,431,355", gap: "+3,708,435", achievement: "131.6%" },
  { metric: "Card Receivables Balance (Gross)", plan: "42,586,756", actual: "38,043,558", gap: "-4,543,198", achievement: "89.3%" },
  { metric: "(of which) A/B Segment", plan: "22,299,401", actual: "24,347,877", gap: "+2,048,476", achievement: "109.2%", indent: true },
  { metric: "Average limit per customer (USD)", plan: "$293", actual: "$278", gap: "-$15", achievement: "94.9%" },
  { metric: "Utilization ratio", plan: "48.6%", actual: "55.3%", gap: "+6.7pp", achievement: "113.8%" },
  { metric: "Receivables per customer (USD)", plan: "$181", actual: "$161.8", gap: "-$19.2", achievement: "89.4%" },
  { metric: "CAC per customer (USD)", plan: "$20.4", actual: "$9.2", gap: "-$11.2", achievement: "--" },
  { metric: "NPL (IDR 000)", plan: "2,576,403", actual: "3,821,676", gap: "+1,245,273", achievement: "--" },
  { metric: "NPL ratio", plan: "6.0%", actual: "10.05%", gap: "+4.05pp", achievement: "--" },
];

const revenueRows: KpiRow[] = [
  { metric: "Total Revenue", plan: "1,849,797", actual: "1,842,467", gap: "-7,330", achievement: "99.6%", isSectionTotal: true },
  { metric: "Interest Income", plan: "397,382", actual: "462,600", gap: "+65,218", achievement: "116.4%" },
  { metric: "Admin Fee", plan: "1,247,856", actual: "1,127,192", gap: "-120,664", achievement: "90.3%" },
  { metric: "Interchange Fee", plan: "197,476", actual: "242,720", gap: "+45,244", achievement: "122.9%" },
  { metric: "Corporate Card Income", plan: "1,144", actual: "0", gap: "-1,144", achievement: "0.0%" },
  { metric: "Registration Fee", plan: "5,939", actual: "9,955", gap: "+4,016", achievement: "167.6%" },
  { metric: "Co Branding SaaS", plan: "0", actual: "0", gap: "0", achievement: "--" },
];

const costRows: KpiRow[] = [
  { metric: "Total Cost", plan: "3,155,324", actual: "3,790,147", gap: "+634,823", achievement: "120.1%", isSectionTotal: true },
  { metric: "Risk Cost (HFT)", plan: "1,429,637", actual: "1,864,493", gap: "+434,856", achievement: "130.4%" },
  { metric: "Net Write-Off", plan: "942,701", actual: "958,227", gap: "+15,526", achievement: "101.6%", indent: true },
  { metric: "Provision", plan: "486,936", actual: "906,266", gap: "+419,330", achievement: "186.1%", indent: true },
  { metric: "Funding Cost", plan: "233,554", actual: "236,487", gap: "+2,933", achievement: "101.3%" },
  { metric: "HFT", plan: "120,082", actual: "116,742", gap: "-3,340", achievement: "97.2%", indent: true },
  { metric: "HFTI", plan: "113,472", actual: "119,745", gap: "+6,273", achievement: "105.5%", indent: true },
  { metric: "Direct Cost", plan: "152,100", actual: "363,645", gap: "+211,545", achievement: "239.1%" },
  { metric: "Interchange cost", plan: "36,945", actual: "230,882", gap: "+193,937", achievement: "524.9%", indent: true },
  { metric: "Repayment cost", plan: "27,153", actual: "24,983", gap: "-2,170", achievement: "92.0%", indent: true },
  { metric: "Reward cost", plan: "87,922", actual: "107,780", gap: "+19,858", achievement: "122.6%", indent: true },
  { metric: "Corporate Card Related Cost", plan: "80", actual: "0", gap: "-80", achievement: "0.0%", indent: true },
  { metric: "CAC", plan: "92,454", actual: "86,153", gap: "-6,301", achievement: "93.2%" },
  { metric: "Marketing cost", plan: "36,225", actual: "0", gap: "-36,225", achievement: "0.0%", indent: true },
  { metric: "Underwriting", plan: "27,934", actual: "5,094", gap: "-22,840", achievement: "18.2%", indent: true },
  { metric: "Onboarding", plan: "9,580", actual: "61,075", gap: "+51,495", achievement: "637.5%", indent: true },
  { metric: "Card printing", plan: "18,715", actual: "19,984", gap: "+1,269", achievement: "106.8%", indent: true },
  { metric: "Customer Service & Collection", plan: "126,242", actual: "122,872", gap: "-3,370", achievement: "97.3%" },
  { metric: "Manpower Cost", plan: "457,167", actual: "466,175", gap: "+9,008", achievement: "102.0%" },
  { metric: "HFT", plan: "198,597", actual: "148,428", gap: "-50,168", achievement: "74.7%", indent: true },
  { metric: "Honest Thailand", plan: "257,300", actual: "258,360", gap: "+1,060", achievement: "100.4%", indent: true },
  { metric: "HMI", plan: "1,270", actual: "1,411", gap: "+141", achievement: "111.1%", indent: true },
  { metric: "HFTI", plan: "0", actual: "57,976", gap: "+57,976", achievement: "--", indent: true },
  { metric: "Total System Cost & OPEX", plan: "664,170", actual: "650,323", gap: "-13,847", achievement: "97.9%" },
  { metric: "System Cost", plan: "307,973", actual: "459,014", gap: "+151,042", achievement: "149.0%", indent: true },
  { metric: "Opex", plan: "356,197", actual: "191,308", gap: "-164,889", achievement: "53.7%", indent: true },
  { metric: "Depreciation & Amortization", plan: "38,909", actual: "36,612", gap: "-2,297", achievement: "94.1%", indent: true },
  { metric: "Others (Net non card)", plan: "-12,944", actual: "69,222", gap: "+82,166", achievement: "--" },
];

const bottomLineRow: KpiRow = { metric: "Net Operating Profit before Tax", plan: "-1,318,471", actual: "-1,878,458", gap: "-559,987", achievement: "--", isSectionTotal: true };

interface BalanceSheetRow {
  metric: string;
  plan: string;
  actual: string;
}

const balanceSheetRows: BalanceSheetRow[] = [
  { metric: "Cash", plan: "19,957,597", actual: "23,023,232" },
  { metric: "  Unrestricted cash", plan: "-1,447,519", actual: "1,618,117" },
  { metric: "  Restricted cash", plan: "21,405,116", actual: "21,405,116" },
  { metric: "Card Receivables (Gross)", plan: "42,586,756", actual: "38,043,558" },
  { metric: "  Current - 0", plan: "36,057,239", actual: "30,915,072" },
  { metric: "  DPD 1-30", plan: "1,412,510", actual: "1,580,229" },
  { metric: "  DPD 31-60", plan: "1,269,028", actual: "1,541,491" },
  { metric: "  DPD 61-90", plan: "1,271,577", actual: "185,090" },
  { metric: "  DPD 91-120", plan: "1,288,499", actual: "1,372,372" },
  { metric: "  DPD 121-150", plan: "1,237,615", actual: "1,291,613" },
  { metric: "  DPD 151-180", plan: "50,289", actual: "1,157,691" },
  { metric: "Provision Balance", plan: "11,767,017", actual: "11,418,991" },
  { metric: "Bank Loan", plan: "43,738,657", actual: "43,522,625" },
  { metric: "  SBLC / HFT", plan: "12,606,061", actual: "12,391,279" },
  { metric: "  SBLC / HFTI", plan: "7,000,000", actual: "7,000,000" },
  { metric: "  Bank INA", plan: "3,996,232", actual: "3,997,306" },
  { metric: "  HSBC SG", plan: "20,000,000", actual: "20,000,000" },
  { metric: "  BPR Xen", plan: "136,364", actual: "134,040" },
  { metric: "MIMD ratio", plan: "-20.3%", actual: "13.6%" },
  { metric: "Core Capital", plan: "-4,655", actual: "3,154,386" },
  { metric: "Paid-up Capital", plan: "22,975", actual: "23,175,794" },
];

// ── Tab 3: Monthly Metrics Data ─────────────────────────────────────────────

interface MonthlyMetric {
  name: string;
  group: string;
  values: Record<string, string>;
  /** If true, this metric needs mart_finance or external data and is currently sample data */
  isSample?: boolean;
  /** What blocks this metric from being live */
  blockedBy?: string;
}

const monthlyMonths = ["Sep 25", "Oct 25", "Nov 25", "Dec 25", "Jan 26", "Feb 26"];

const monthlyMetrics: MonthlyMetric[] = [
  // Customer & Growth
  { name: "Users", group: "Customer & Growth", values: { "Sep 25": "207,675", "Oct 25": "217,760", "Nov 25": "229,848", "Dec 25": "234,160", "Jan 26": "235,138", "Feb 26": "238,371" } },
  { name: "Revenue from all products (gross)", group: "Customer & Growth", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "1,635,746", "Oct 25": "1,694,061", "Nov 25": "1,869,548", "Dec 25": "1,799,641", "Jan 26": "1,853,544", "Feb 26": "1,865,948" } },
  { name: "Total Revenue (incl reg fee)", group: "Customer & Growth", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "1,623,902", "Oct 25": "1,678,665", "Nov 25": "1,861,108", "Dec 25": "1,788,803", "Jan 26": "1,842,467", "Feb 26": "1,865,948" } },
  { name: "Revenue before write off (card only)", group: "Customer & Growth", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "1,593,194", "Oct 25": "1,645,841", "Nov 25": "1,834,365", "Dec 25": "1,774,144", "Jan 26": "1,832,513", "Feb 26": "1,858,560" } },
  { name: "Revenue after write off (card + reg fee)", group: "Customer & Growth", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "1,421,647", "Oct 25": "1,332,141", "Nov 25": "1,861,108", "Dec 25": "1,788,803", "Jan 26": "1,842,467", "Feb 26": "1,865,948" } },
  { name: "Transactions (Count)", group: "Customer & Growth", values: { "Sep 25": "616,878", "Oct 25": "675,665", "Nov 25": "669,501", "Dec 25": "664,907", "Jan 26": "586,913", "Feb 26": "489,875" } },
  // Per-Customer Economics
  { name: "ARPAC", group: "Per-Customer Economics", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "$14.12", "Oct 25": "$12.54", "Nov 25": "$17.17", "Dec 25": "$16.96", "Jan 26": "$18.63", "Feb 26": "$21.01" } },
  { name: "Average Monthly Fees", group: "Per-Customer Economics", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "$11.29", "Oct 25": "$11.46", "Nov 25": "$11.71", "Dec 25": "$11.69", "Jan 26": "$11.87", "Feb 26": "$12.04" } },
  { name: "Average Monthly Fees (refund adjusted)", group: "Per-Customer Economics", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "$8.17", "Oct 25": "$8.34", "Nov 25": "$8.38", "Dec 25": "$8.35", "Jan 26": "$8.57", "Feb 26": "$8.69" } },
  { name: "CAC of Approved Customer", group: "Per-Customer Economics", isSample: true, blockedBy: "Marketing platforms", values: { "Sep 25": "--", "Oct 25": "--", "Nov 25": "--", "Dec 25": "--", "Jan 26": "--", "Feb 26": "--" } },
  { name: "Cost of Debt Capital", group: "Per-Customer Economics", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "9.10%", "Oct 25": "9.10%", "Nov 25": "9.10%", "Dec 25": "9.10%", "Jan 26": "9.10%", "Feb 26": "9.10%" } },
  { name: "Cost to Serve per Active Customer", group: "Per-Customer Economics", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "$0.42", "Oct 25": "$0.40", "Nov 25": "$0.36", "Dec 25": "$0.37", "Jan 26": "$0.43", "Feb 26": "$0.46" } },
  { name: "Monthly Income Customers", group: "Per-Customer Economics", isSample: true, blockedBy: "mart_finance", values: { "Sep 25": "$531", "Oct 25": "$523", "Nov 25": "$531", "Dec 25": "$510", "Jan 26": "$299", "Feb 26": "$328" } },
  // Portfolio Quality
  { name: "Revolve Rate", group: "Portfolio Quality", values: { "Sep 25": "66.17%", "Oct 25": "65.23%", "Nov 25": "65.44%", "Dec 25": "63.80%", "Jan 26": "64.24%", "Feb 26": "64.98%" } },
  { name: "Active Customers", group: "Portfolio Quality", values: { "Sep 25": "63%", "Oct 25": "65%", "Nov 25": "66%", "Dec 25": "64%", "Jan 26": "61%", "Feb 26": "57%" } },
  { name: "Credit Line Used (Utilization)", group: "Portfolio Quality", values: { "Sep 25": "45.35%", "Oct 25": "45.65%", "Nov 25": "47.45%", "Dec 25": "47.99%", "Jan 26": "48.55%", "Feb 26": "49.72%" } },
  { name: "Churn (Voluntary)", group: "Portfolio Quality", values: { "Sep 25": "0.025%", "Oct 25": "0.016%", "Nov 25": "0.026%", "Dec 25": "0.021%", "Jan 26": "0.022%", "Feb 26": "0.020%" } },
  // Risk & Delinquency
  { name: "Delinquency Rate (15-90 days)", group: "Risk & Delinquency", values: { "Sep 25": "9.87%", "Oct 25": "7.64%", "Nov 25": "10.70%", "Dec 25": "11.35%", "Jan 26": "8.00%", "Feb 26": "11.37%" } },
  { name: "Customers 30-149 Days Past Due", group: "Risk & Delinquency", values: { "Sep 25": "8.94%", "Oct 25": "9.79%", "Nov 25": "10.15%", "Dec 25": "10.98%", "Jan 26": "11.89%", "Feb 26": "15.09%" } },
  { name: "Customers 30+ DPD last monthly cohort", group: "Risk & Delinquency", values: { "Sep 25": "5.94%", "Oct 25": "5.10%", "Nov 25": "5.46%", "Dec 25": "1.86%", "Jan 26": "--", "Feb 26": "--" } },
  // Marketing & Acquisition
  { name: "CAC (Approved & Declined) - new", group: "Marketing & Acquisition", isSample: true, blockedBy: "Marketing platforms", values: { "Sep 25": "$21.67", "Oct 25": "$17.95", "Nov 25": "$17.43", "Dec 25": "$13.32", "Jan 26": "$9.49", "Feb 26": "$19.69" } },
  { name: "Marketing per customer - Google", group: "Marketing & Acquisition", isSample: true, blockedBy: "Google Ads", values: { "Sep 25": "$31.05", "Oct 25": "$30.50", "Nov 25": "$29.63", "Dec 25": "$21.54", "Jan 26": "$0.00", "Feb 26": "$0.00" } },
  { name: "Marketing per customer - Meta", group: "Marketing & Acquisition", isSample: true, blockedBy: "Meta Ads", values: { "Sep 25": "$35.66", "Oct 25": "$32.27", "Nov 25": "$31.51", "Dec 25": "$24.86", "Jan 26": "$0.00", "Feb 26": "$15.03" } },
  { name: "Marketing per customer - TikTok", group: "Marketing & Acquisition", isSample: true, blockedBy: "TikTok Ads", values: { "Sep 25": "$38.80", "Oct 25": "$30.76", "Nov 25": "$30.44", "Dec 25": "$15.63", "Jan 26": "$0.00", "Feb 26": "$49.46" } },
  { name: "Organic Traffic", group: "Marketing & Acquisition", values: { "Sep 25": "43.8%", "Oct 25": "48.8%", "Nov 25": "43.2%", "Dec 25": "73.5%", "Jan 26": "99.10%", "Feb 26": "79.90%" } },
  { name: "Applicant Approval Rate", group: "Marketing & Acquisition", values: { "Sep 25": "18.35%", "Oct 25": "16.94%", "Nov 25": "16.86%", "Dec 25": "12.67%", "Jan 26": "8.18%", "Feb 26": "10.67%" } },
  // Product & Engagement
  { name: "Calls Answered in 45 Seconds", group: "Product & Engagement", values: { "Sep 25": "94%", "Oct 25": "96%", "Nov 25": "98%", "Dec 25": "99%", "Jan 26": "98%", "Feb 26": "95%" } },
  { name: "Google Play Store Rating", group: "Product & Engagement", isSample: true, blockedBy: "Play Console API", values: { "Sep 25": "4.6", "Oct 25": "4.5", "Nov 25": "4.9", "Dec 25": "4.9", "Jan 26": "4.9", "Feb 26": "4.9" } },
  { name: "First or Second Credit Card", group: "Product & Engagement", isSample: true, blockedBy: "Survey data", values: { "Sep 25": "85.56%", "Oct 25": "85.77%", "Nov 25": "85.60%", "Dec 25": "88.85%", "Jan 26": "91.01%", "Feb 26": "87.52%" } },
  { name: "Used BNPL", group: "Product & Engagement", isSample: true, blockedBy: "Survey data", values: { "Sep 25": "88.42%", "Oct 25": "88.17%", "Nov 25": "88.58%", "Dec 25": "85.37%", "Jan 26": "83.80%", "Feb 26": "88.67%" } },
];

const monthlyGroups = ["Customer & Growth", "Per-Customer Economics", "Portfolio Quality", "Risk & Delinquency", "Marketing & Acquisition", "Product & Engagement"];

// ── Tab 4: KPIs & Financial Results (OJK Plan) ───────────────────────────────

const ojkKpiRows: KpiRow[] = [
  { metric: "Total Booked Customer (Cumulative)", plan: "230,193", actual: "235,138", gap: "+4,945", achievement: "102.1%" },
  { metric: "(of which) 1Rp cards", plan: "43,204", actual: "46,796", gap: "+3,592", achievement: "108.3%", indent: true },
  { metric: "New Customer (Monthly)", plan: "8,000", actual: "4,649", gap: "-3,351", achievement: "58.1%" },
  { metric: "(of which) Core Cards and Registration Fee", plan: "4,868", actual: "1,561", gap: "-3,307", achievement: "--", indent: true },
  { metric: "(of which) 1Rp cards", plan: "3,132", actual: "3,088", gap: "-44", achievement: "98.6%", indent: true },
  { metric: "Active ratio", plan: "N/A", actual: "48.5%", gap: "--", achievement: "--" },
  { metric: "Revolving ratio", plan: "68.8%", actual: "63.7%", gap: "-5.1pp", achievement: "92.6%" },
  { metric: "Card Receivables Balance (Gross)", plan: "43,212,020", actual: "38,043,558", gap: "-5,168,462", achievement: "88.0%" },
  { metric: "(of which) A/B Segment", plan: "24,606,834", actual: "24,347,877", gap: "-258,957", achievement: "98.9%", indent: true },
  { metric: "Average limit per customer", plan: "$322", actual: "$278.3", gap: "-$43.7", achievement: "86.4%" },
  { metric: "Utilization ratio", plan: "67.2%", actual: "55.3%", gap: "-11.9pp", achievement: "82.3%" },
  { metric: "Receivables per customer (USD)", plan: "$106.9", actual: "$161.8", gap: "+$54.9", achievement: "151.4%" },
  { metric: "CAC per customer (USD)", plan: "$20.4", actual: "$9.2", gap: "-$11.2", achievement: "--" },
  { metric: "NPL (IDR 000)", plan: "3,626,368", actual: "3,821,676", gap: "+195,308", achievement: "105.4%" },
  { metric: "NPL ratio", plan: "8.39%", actual: "10.05%", gap: "+1.7pp", achievement: "119.7%" },
];

const ojkRevenueRows: KpiRow[] = [
  { metric: "Total Revenue", plan: "1,918,212", actual: "1,842,467", gap: "-75,745", achievement: "96.1%", isSectionTotal: true },
  { metric: "Interest Income", plan: "441,760", actual: "462,600", gap: "+20,840", achievement: "104.7%" },
  { metric: "Admin Fee", plan: "1,256,353", actual: "1,127,192", gap: "-129,161", achievement: "89.7%" },
  { metric: "Interchange Fee", plan: "194,493", actual: "242,720", gap: "+48,227", achievement: "124.8%" },
];

// ── Tab 5: Detailed Cost Breakdown ────────────────────────────────────────────

interface CostBreakdownRow {
  category: string;
  vendor: string;
  amount: number;
  note: string;
}

const interchangeCostBreakdown: CostBreakdownRow[] = [
  { category: "Interchange Cost", vendor: "Total", amount: 230882, note: "0.79% of total spend" },
  { category: "", vendor: "Quarterly system cost", amount: 108967, note: "" },
  { category: "", vendor: "Asia Pacific Platinum/Titanium Card Fees", amount: 81203, note: "" },
  { category: "", vendor: "Domestic Issuer Interchange MC Purchase Volume", amount: 27764, note: "" },
  { category: "", vendor: "Interchange cost (net)", amount: 121915, note: "" },
];

const underwritingBreakdown: CostBreakdownRow[] = [
  { category: "Underwriting", vendor: "Total", amount: 5897, note: "" },
  { category: "", vendor: "Reversal", amount: -42734, note: "Non regular" },
  { category: "", vendor: "PT scoring", amount: 30338, note: "Actual usage costs $3,576" },
  { category: "", vendor: "Monai", amount: 226, note: "Regular" },
  { category: "", vendor: "Trust Decision", amount: 2826, note: "Regular" },
  { category: "", vendor: "Telco", amount: 6123, note: "Regular" },
  { category: "", vendor: "CRIF", amount: 9118, note: "Regular" },
];

const onboardingBreakdown: CostBreakdownRow[] = [
  { category: "Onboarding", vendor: "Total", amount: 61100, note: "" },
  { category: "", vendor: "Vida", amount: 10852, note: "Regular" },
  { category: "", vendor: "Wultra and Comply Advantage", amount: 3700, note: "Regular" },
  { category: "", vendor: "Vida unused commitment", amount: 46548, note: "Non regular" },
];

// ── Tab 6: Funnel Tracking ────────────────────────────────────────────────────

interface FunnelRow {
  step: string;
  avg2024: string;
  yoy: string;
  avg2025: string;
  jan2026: string;
  vsAvg: string;
  commentary: string;
}

const funnelRows: FunnelRow[] = [
  { step: "Install to Application Started Rate %", avg2024: "79%", yoy: "+9%", avg2025: "86%", jan2026: "90%", vsAvg: "+4%", commentary: "" },
  { step: "Application Started to Submitted Rate %", avg2024: "67%", yoy: "+2%", avg2025: "68%", jan2026: "58%", vsAvg: "-15%", commentary: "No acquisition activities in Jan leading to lower quality traffic which has a lower submission rate" },
  { step: "Approval Rate %", avg2024: "15%", yoy: "+7%", avg2025: "16%", jan2026: "8%", vsAvg: "-51%", commentary: "Approval Rate impacted by change in policy, as well as lower quality traffic" },
  { step: "Approval to CMA Accepted Rate %", avg2024: "86%", yoy: "-2%", avg2025: "84%", jan2026: "81%", vsAvg: "-4%", commentary: "Drop likely driven by lower limits in Jan" },
  { step: "CMA Accepted to Video Verified %", avg2024: "87%", yoy: "-5%", avg2025: "83%", jan2026: "70%", vsAvg: "-15%", commentary: "Drop likely driven by lower limits in Jan" },
  { step: "Video Verified to First Transaction Rate %", avg2024: "58%", yoy: "-7%", avg2025: "54%", jan2026: "54%", vsAvg: "0%", commentary: "Similar to 2025 average levels" },
];

// ── Formatting helpers ──────────────────────────────────────────────────────

function formatIDR(value: number): string {
  if (value >= 1_000_000_000_000) return `Rp ${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(0)}M`;
  return `Rp ${value.toLocaleString()}`;
}

function gapColor(gap: string): string {
  if (gap === "--" || gap === "") return "text-[var(--text-muted)]";
  // For costs, positive gap means over-budget (bad), but we color purely by sign for simplicity
  if (gap.startsWith("+")) return "text-emerald-500";
  if (gap.startsWith("-")) return "text-red-500";
  return "text-[var(--text-primary)]";
}

function gapColorInverse(gap: string): string {
  // For costs: positive gap = bad (over budget), negative gap = good (under budget)
  if (gap === "--" || gap === "") return "text-[var(--text-muted)]";
  if (gap.startsWith("+")) return "text-red-500";
  if (gap.startsWith("-")) return "text-emerald-500";
  return "text-[var(--text-primary)]";
}

/** Determine trend direction from the last two values in monthlyMetrics */
function getTrend(metric: MonthlyMetric): "up" | "down" | "flat" | "na" {
  const vals = monthlyMonths.map((m) => metric.values[m]);
  const last = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  if (!last || !prev || last === "--" || prev === "--") return "na";
  const numLast = parseFloat(last.replace(/[^0-9.\-]/g, ""));
  const numPrev = parseFloat(prev.replace(/[^0-9.\-]/g, ""));
  if (isNaN(numLast) || isNaN(numPrev)) return "na";
  if (numLast > numPrev) return "up";
  if (numLast < numPrev) return "down";
  return "flat";
}

// ── Tab definitions ─────────────────────────────────────────────────────────

type TabId = "segment" | "kpi" | "ojk" | "costbreakdown" | "funnel" | "monthly";

const TABS: { id: TabId; label: string }[] = [
  { id: "segment", label: "Segment Analysis" },
  { id: "kpi", label: "KPIs (Orico Plan)" },
  { id: "ojk", label: "KPIs (OJK Plan)" },
  { id: "costbreakdown", label: "Cost Breakdown" },
  { id: "funnel", label: "Funnel Tracking" },
  { id: "monthly", label: "Monthly Metrics" },
];

// ── Sub-components ──────────────────────────────────────────────────────────

function KpiTable({ title, rows, invertColors }: { title: string; rows: KpiRow[]; invertColors?: boolean }) {
  const colorFn = invertColors ? gapColorInverse : gapColor;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="text-left py-2.5 px-4 text-[var(--text-secondary)] font-medium w-[40%]">Metric</th>
              <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Plan</th>
              <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Actual</th>
              <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Gap</th>
              <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Achievement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={`${title}-${i}`}
                className={cn(
                  "border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]",
                  row.isSectionTotal && "bg-[var(--surface)] font-semibold"
                )}
              >
                <td className={cn("py-2 px-4 text-[var(--text-primary)]", row.indent && "pl-8 text-[var(--text-secondary)]")}>
                  {row.metric}
                </td>
                <td className="py-2 px-4 text-right text-[var(--text-muted)] font-mono text-xs">{row.plan}</td>
                <td className="py-2 px-4 text-right text-[var(--text-primary)] font-mono text-xs font-medium">{row.actual}</td>
                <td className={cn("py-2 px-4 text-right font-mono text-xs font-medium", colorFn(row.gap))}>{row.gap}</td>
                <td className="py-2 px-4 text-right text-[var(--text-secondary)] font-mono text-xs">{row.achievement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BalanceSheetTable({ rows }: { rows: BalanceSheetRow[] }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Balance Sheet (IDR 000)</h3>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
              <th className="text-left py-2.5 px-4 text-[var(--text-secondary)] font-medium w-[50%]">Metric</th>
              <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Plan</th>
              <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Actual</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]">
                <td className="py-2 px-4 text-[var(--text-primary)] font-medium">{row.metric}</td>
                <td className="py-2 px-4 text-right text-[var(--text-muted)] font-mono text-xs">{row.plan}</td>
                <td className="py-2 px-4 text-right text-[var(--text-primary)] font-mono text-xs font-medium">{row.actual}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function OricoPageWrapper() {
  return (
    <PageGuard>
      <OricoPageContent />
    </PageGuard>
  );
}

function OricoPageContent() {
  const { period, setPeriod, periodLabel } = usePeriod();
  const { filters } = useFilters();

  // Orico reports are monthly — default to monthly on mount
  useEffect(() => {
    if (period !== "monthly") setPeriod("monthly");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const [activeTab, setActiveTab] = useState<TabId>("segment");
  const [printMode, setPrintMode] = useState(false);

  const pApprovedBySegment = useMemo(() => applyFilterToData(scaleTrendData(approvedBySegment, period), filters), [period, filters]);
  const pAcceptedCumulative = useMemo(() => applyFilterToData(scaleTrendData(acceptedCumulative, period), filters), [period, filters]);
  const pActivePortfolio = useMemo(() => applyFilterToData(scaleTrendData(activePortfolio, period), filters), [period, filters]);
  const pRp1Topup = useMemo(() => applyFilterToData(scaleTrendData(rp1Topup, period), filters), [period, filters]);
  const pOnboardingFunnel = useMemo(() => applyFilterToData(scaleTrendData(onboardingFunnel, period), filters), [period, filters]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  // Compute KPI summaries from latest data point
  const latestApproved = approvedBySegment[approvedBySegment.length - 1];
  const prevApproved = approvedBySegment[approvedBySegment.length - 2];
  const totalApprovedCurrent = latestApproved.Regular + latestApproved.RP1 + latestApproved.AOF;
  const totalApprovedPrev = prevApproved.Regular + prevApproved.RP1 + prevApproved.AOF;

  const latestActive = activePortfolio[activePortfolio.length - 1];
  const prevActive = activePortfolio[activePortfolio.length - 2];
  const totalActiveCurrent = latestActive.Regular + latestActive.RP1 + latestActive.AOF;
  const totalActivePrev = prevActive.Regular + prevActive.RP1 + prevActive.AOF;

  const totalProvision = provisionData.reduce((s, r) => s + r.provision, 0);
  const totalUndrawn = provisionData.reduce((s, r) => s + r.undrawnLimit, 0);

  const latestTopup = rp1Topup[rp1Topup.length - 1];

  // Grouped portfolio summary for table
  const segments = ["A", "B", "C", "D"];
  const products = ["Regular", "RP1", "AOF"];

  const handlePrint = useCallback(() => {
    setPrintMode(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
        setPrintMode(false);
      });
    });
  }, []);

  return (
    <div className="flex flex-col">
      {/* Injected print styles */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* Print-only header */}
      <div className="print-header">
        <h1>Honest Bank Indonesia &mdash; Orico Monthly Report</h1>
        <p>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
        <span className="confidential">CONFIDENTIAL</span>
      </div>

      {/* Print-only footer */}
      <div className="print-footer">
        Honest Bank Indonesia &mdash; Orico Monthly Report &mdash; CONFIDENTIAL
      </div>

      <Header title="Orico Reports" />

      <div className="flex-1 space-y-6 p-6">
        <ActiveFiltersBanner />
        {/* Title row with PDF button */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Orico Partner Reports</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Partner reporting for Orico &mdash; segment performance, KPIs, financial results, and monthly metrics
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{periodLabel}</p>
          </div>
          <button
            onClick={handlePrint}
            className="no-print flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
            data-print-hide
          >
            <Printer className="w-4 h-4" />
            Download PDF
          </button>
        </div>

        {/* Tab navigation */}
        <div className="no-print flex gap-1 p-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] w-fit" data-print-hide>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all",
                activeTab === tab.id
                  ? "bg-[var(--text-primary)] text-[var(--surface)] shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: Segment Analysis (existing charts)                          */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {(activeTab === "segment" || printMode) && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                metricKey="orico_total_approved"
                label="Total Approved (Month)"
                value={applyFilterToMetric(scaleMetricValue(totalApprovedCurrent, period, false), filters, false)}
                prevValue={applyFilterToMetric(scaleMetricValue(totalApprovedPrev, period, false), filters, false)}
                unit="count"
                asOf={AS_OF}
                dataRange={DATA_RANGE}
                onRefresh={handleRefresh}
              />
              <MetricCard
                metricKey="orico_active_portfolio"
                label="Active Portfolio"
                value={applyFilterToMetric(totalActiveCurrent, filters, false)}
                prevValue={applyFilterToMetric(totalActivePrev, filters, false)}
                unit="count"
                asOf={AS_OF}
                dataRange={DATA_RANGE}
                onRefresh={handleRefresh}
              />
              <MetricCard
                metricKey="orico_ecl_provision"
                label="ECL Provision"
                value={applyFilterToMetric(totalProvision, filters, false)}
                unit="idr"
                asOf={AS_OF}
                dataRange={DATA_RANGE}
                onRefresh={handleRefresh}
              />
              <MetricCard
                metricKey="orico_rp1_topup_rate"
                label="RP1 Top-up Rate"
                value={applyFilterToMetric(latestTopup.rate, filters, true)}
                prevValue={applyFilterToMetric(rp1Topup[rp1Topup.length - 2].rate, filters, true)}
                unit="percent"
                asOf={AS_OF}
                dataRange={DATA_RANGE}
                onRefresh={handleRefresh}
              />
            </div>

            {/* Section 1: Approved by Segment */}
            <ChartCard
              title="Approved Applications by Segment"
              subtitle="Monthly approved counts by Regular / RP1 / AOF"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              onRefresh={handleRefresh}
              query={Q_APPROVED}
            >
              <DashboardBarChart
                data={pApprovedBySegment}
                bars={[
                  { key: "Regular", color: "#3b82f6", label: "Regular" },
                  { key: "RP1", color: "#8b5cf6", label: "RP1" },
                  { key: "AOF", color: "#06b6d4", label: "AOF" },
                ]}
                stacked
                height={320}
              />
              <ChartInsights insights={approvedInsights} />
            </ChartCard>

            {/* Section 2: Accepted Users (Cumulative) */}
            <ChartCard
              title="Accepted Users (Signed Contract)"
              subtitle="Monthly accepted users with cumulative line by segment"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              onRefresh={handleRefresh}
              query={Q_ACCEPTED}
            >
              <div className="space-y-4">
                <DashboardBarChart
                  data={pAcceptedCumulative}
                  bars={[
                    { key: "Regular", color: "#3b82f6", label: "Regular" },
                    { key: "RP1", color: "#8b5cf6", label: "RP1" },
                    { key: "AOF", color: "#06b6d4", label: "AOF" },
                  ]}
                  stacked
                  height={280}
                />
                <DashboardLineChart
                  data={pAcceptedCumulative}
                  lines={[
                    { key: "cumRegular", color: "#3b82f6", label: "Cum. Regular" },
                    { key: "cumRP1", color: "#8b5cf6", label: "Cum. RP1" },
                    { key: "cumAOF", color: "#06b6d4", label: "Cum. AOF" },
                  ]}
                  height={200}
                />
              </div>
              <ChartInsights insights={acceptedInsights} />
            </ChartCard>

            {/* Section 3: Active Portfolio */}
            <ChartCard
              title="Active Portfolio (DPD < 7)"
              subtitle="End-of-month active accounts by segment"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              onRefresh={handleRefresh}
              query={Q_ACTIVE}
            >
              <DashboardBarChart
                data={pActivePortfolio}
                bars={[
                  { key: "Regular", color: "#3b82f6", label: "Regular" },
                  { key: "RP1", color: "#8b5cf6", label: "RP1" },
                  { key: "AOF", color: "#06b6d4", label: "AOF" },
                ]}
                stacked
                height={320}
              />
              <ChartInsights insights={activePortfolioInsights} />
            </ChartCard>

            {/* Section 4: Portfolio Summary Table */}
            <ChartCard
              title="Portfolio Summary"
              subtitle="Newly booked accounts, limits, and cumulative by risk segment x product (Mar 2026)"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              onRefresh={handleRefresh}
              query={Q_PORTFOLIO}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Risk Seg</th>
                      <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Product</th>
                      <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">New Accounts</th>
                      <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">New Limits</th>
                      <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Cum. Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {segments.map((seg) =>
                      products.map((prod, pIdx) => {
                        const row = portfolioSummary.find(
                          (r) => r.segment === seg && r.product === prod
                        );
                        if (!row) return null;
                        return (
                          <tr
                            key={`${seg}-${prod}`}
                            className="border-b border-[var(--border)]"
                          >
                            {pIdx === 0 ? (
                              <td
                                rowSpan={3}
                                className={`py-2 px-3 font-semibold align-top ${
                                  seg === "A"
                                    ? "text-emerald-400"
                                    : seg === "B"
                                      ? "text-blue-400"
                                      : seg === "C"
                                        ? "text-amber-400"
                                        : "text-red-400"
                                }`}
                              >
                                {seg}
                              </td>
                            ) : null}
                            <td className="py-2 px-3 text-[var(--text-secondary)]">{prod}</td>
                            <td className="py-2 px-3 text-right text-[var(--text-primary)] font-medium">
                              {row.newlyAccounts.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                              {formatIDR(row.newlyLimit)}
                            </td>
                            <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                              {row.cumBookedCustomer.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {/* Totals row */}
                    <tr className="border-t-2 border-[var(--border)] font-semibold">
                      <td className="py-2 px-3 text-[var(--text-primary)]" colSpan={2}>
                        Total
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                        {portfolioSummary.reduce((s, r) => s + r.newlyAccounts, 0).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                        {formatIDR(portfolioSummary.reduce((s, r) => s + r.newlyLimit, 0))}
                      </td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                        {portfolioSummary.reduce((s, r) => s + r.cumBookedCustomer, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ChartInsights insights={portfolioSummaryInsights} />
            </ChartCard>

            {/* Section 5: Provision & Undrawn Limit */}
            <ChartCard
              title="ECL Provision & Undrawn Limit"
              subtitle="Expected credit loss provision and undrawn limit by segment"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              onRefresh={handleRefresh}
              query={Q_PROVISION("2026-03-15")}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      <th className="text-left py-2 px-3 text-[var(--text-secondary)] font-medium">Segment</th>
                      <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">ECL Provision</th>
                      <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Undrawn Limit</th>
                      <th className="text-right py-2 px-3 text-[var(--text-secondary)] font-medium">Provision %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provisionData.map((row) => (
                      <tr key={row.segment} className="border-b border-[var(--border)]">
                        <td className="py-2 px-3 text-[var(--text-primary)] font-medium">{row.segment}</td>
                        <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                          {formatIDR(row.provision)}
                        </td>
                        <td className="py-2 px-3 text-right text-[var(--text-primary)]">
                          {row.undrawnLimit > 0 ? formatIDR(row.undrawnLimit) : "--"}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-[var(--text-primary)]">
                          {((row.provision / totalProvision) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[var(--border)] font-semibold">
                      <td className="py-2 px-3 text-[var(--text-primary)]">Total</td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">{formatIDR(totalProvision)}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">{formatIDR(totalUndrawn)}</td>
                      <td className="py-2 px-3 text-right text-[var(--text-primary)]">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ChartInsights insights={provisionInsights} />
            </ChartCard>

            {/* Section 6: RP1 Top-up Rate */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title="RP1 Top-up Rate"
                subtitle="% of RP1 accounts that have made at least one top-up"
                asOf={AS_OF}
                dataRange={DATA_RANGE}
                onRefresh={handleRefresh}
                query={Q_RP1_TOPUP}
              >
                <DashboardLineChart
                  data={pRp1Topup}
                  lines={[{ key: "rate", color: "#8b5cf6", label: "Top-up Rate %" }]}
                  valueType="percent"
                  height={280}
                />
                <ChartInsights insights={rp1TopupInsights} />
              </ChartCard>

              <ChartCard
                title="RP1 Accounts vs Top-up Volume"
                subtitle="Total RP1 accounts and those who topped up"
                asOf={AS_OF}
                dataRange={DATA_RANGE}
                onRefresh={handleRefresh}
              >
                <DashboardBarChart
                  data={pRp1Topup}
                  bars={[
                    { key: "totalRp1", color: "#475569", label: "Total RP1" },
                    { key: "topupRp1", color: "#8b5cf6", label: "Topped Up" },
                  ]}
                  height={280}
                />
                <ChartInsights
                  insights={[
                    { text: "955 of 4,550 RP1 accounts topped up in Mar 2026 -- 79% of accounts have never topped up.", type: "negative" },
                    { text: "Top-up accounts growing faster than total RP1 base (17.9% vs 12.3% MoM), indicating improving engagement.", type: "positive" },
                    { text: "Gap between total and topped-up is narrowing: from 88% untouched in Jul 2025 to 79% in Mar 2026.", type: "positive" },
                    { text: "[Hypothesis] Push notifications or incentives (cashback on first top-up) could accelerate top-up adoption rate.", type: "hypothesis" },
                  ]}
                />
              </ChartCard>
            </div>

            {/* Section 7: Onboarding Funnel */}
            <ChartCard
              title="Onboarding Funnel: Approved to Accepted"
              subtitle="Monthly approved vs accepted (signed contract) by segment"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              onRefresh={handleRefresh}
              query={Q_FUNNEL}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Regular */}
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">Regular</h4>
                  <DashboardBarChart
                    data={pOnboardingFunnel}
                    bars={[
                      { key: "approvedReg", color: "#3b82f6", label: "Approved" },
                      { key: "acceptedReg", color: "#22c55e", label: "Accepted" },
                    ]}
                    height={220}
                  />
                </div>
                {/* RP1 */}
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">RP1</h4>
                  <DashboardBarChart
                    data={pOnboardingFunnel}
                    bars={[
                      { key: "approvedRP1", color: "#8b5cf6", label: "Approved" },
                      { key: "acceptedRP1", color: "#22c55e", label: "Accepted" },
                    ]}
                    height={220}
                  />
                </div>
                {/* AOF */}
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-2 uppercase tracking-wider">AOF</h4>
                  <DashboardBarChart
                    data={pOnboardingFunnel}
                    bars={[
                      { key: "approvedAOF", color: "#06b6d4", label: "Approved" },
                      { key: "acceptedAOF", color: "#22c55e", label: "Accepted" },
                    ]}
                    height={220}
                  />
                </div>
              </div>
              <ChartInsights insights={onboardingInsights} />
            </ChartCard>

            {/* Action Items */}
            <ActionItems section="Orico Reports" items={actionItems} />
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: KPIs & Financial Results                                    */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {printMode && (
          <div className="print-section-divider">
            <h2>KPIs &amp; Financial Results (Orico Plan)</h2>
            <p>Plan vs Actual vs Gap vs Achievement Rate</p>
          </div>
        )}
        {(activeTab === "kpi" || printMode) && (
          <div className="space-y-2">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">KPIs & Financial Results</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Plan vs Actual vs Gap vs Achievement Rate &mdash; January 2026 data. All IDR values in thousands (IDR 000).
              </p>
            </div>

            <KpiTable title="Key Performance Indicators" rows={kpiRows} />

            <div className="page-break" />

            <SampleDataBanner
              dataset="mart_finance"
              reason="Revenue, cost, and P&L data cannot be automated"
            >
              <KpiTable title="P&L Revenue (IDR 000)" rows={revenueRows} />

              <KpiTable title="P&L Cost (IDR 000)" rows={costRows} invertColors />

              {/* Bottom line */}
              <div className="mb-6">
                <div className="overflow-x-auto rounded-lg border-2 border-[var(--border)]">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="bg-[var(--surface)]">
                        <td className="py-3 px-4 text-[var(--text-primary)] font-bold w-[40%]">{bottomLineRow.metric}</td>
                        <td className="py-3 px-4 text-right text-red-500 font-mono text-xs font-bold">{bottomLineRow.plan}</td>
                        <td className="py-3 px-4 text-right text-red-500 font-mono text-xs font-bold">{bottomLineRow.actual}</td>
                        <td className="py-3 px-4 text-right text-red-500 font-mono text-xs font-bold">{bottomLineRow.gap}</td>
                        <td className="py-3 px-4 text-right text-[var(--text-muted)] font-mono text-xs">{bottomLineRow.achievement}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </SampleDataBanner>

            <div className="page-break" />

            <SampleDataBanner
              dataset="mart_finance"
              reason="Cash, bank loan, and capital data cannot be automated"
              variant="inline"
            >
              <BalanceSheetTable rows={balanceSheetRows} />
            </SampleDataBanner>

            {/* Flow Rates */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Flow Rates (Jan 2026)</h3>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                      <th className="text-left py-2.5 px-4 text-[var(--text-secondary)] font-medium w-[50%]">DPD Bucket</th>
                      <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Plan</th>
                      <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { bucket: "Current - 0", plan: "4%", actual: "5.52%" },
                      { bucket: "DPD 1-30", plan: "91%", actual: "81.96%" },
                      { bucket: "DPD 31-60", plan: "100%", actual: "100.29%" },
                      { bucket: "DPD 61-90", plan: "100%", actual: "98.85%" },
                      { bucket: "DPD 91-120", plan: "100%", actual: "98.30%" },
                      { bucket: "DPD 121-150", plan: "100%", actual: "98.20%" },
                      { bucket: "DPD 151-180", plan: "100%", actual: "98.25%" },
                    ].map((row) => (
                      <tr key={row.bucket} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]">
                        <td className="py-2 px-4 text-[var(--text-primary)] font-medium">{row.bucket}</td>
                        <td className="py-2 px-4 text-right text-[var(--text-muted)] font-mono text-xs">{row.plan}</td>
                        <td className="py-2 px-4 text-right text-[var(--text-primary)] font-mono text-xs font-medium">{row.actual}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: KPIs & Financial Results (OJK Plan)                         */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {printMode && (
          <div className="print-section-divider">
            <h2>KPIs &amp; Financial Results (OJK Plan)</h2>
            <p>OJK business plan targets</p>
          </div>
        )}
        {(activeTab === "ojk" || printMode) && (
          <div className="space-y-2">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">KPIs & Financial Results (OJK Plan)</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Plan vs Actual using <span className="font-semibold">OJK business plan</span> targets &mdash; January 2026. All USD values in thousands (USD 000).
              </p>
            </div>
            <KpiTable title="Key Performance Indicators (OJK Plan)" rows={ojkKpiRows} />
            <div className="page-break" />
            <SampleDataBanner
              dataset="mart_finance"
              reason="Revenue data cannot be automated"
              variant="inline"
            >
              <KpiTable title="P&L Revenue (USD 000) — OJK Plan" rows={ojkRevenueRows} />
            </SampleDataBanner>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: Detailed Cost Breakdown                                     */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {printMode && (
          <div className="print-section-divider">
            <h2>Detailed Cost Breakdown</h2>
            <p>Vendor-level cost breakdown</p>
          </div>
        )}
        {(activeTab === "costbreakdown" || printMode) && (
          <div className="space-y-2">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Detailed Cost Breakdown</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Vendor-level cost breakdown for January 2026. All values in USD.
              </p>
            </div>

            <SampleDataBanner
              dataset="mart_finance"
              reason="Vendor-level cost data cannot be automated"
            >
            {[
              { title: "Interchange Cost", rows: interchangeCostBreakdown, totalSpend: "15,431,355" },
              { title: "Underwriting", rows: underwritingBreakdown },
              { title: "Onboarding", rows: onboardingBreakdown },
            ].map((section) => (
              <div key={section.title} className="mb-6">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                  {section.title}
                  {section.totalSpend && <span className="text-[var(--text-muted)] font-normal ml-2">(Total Spend: ${section.totalSpend})</span>}
                </h3>
                <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                        <th className="text-left py-2.5 px-4 text-[var(--text-secondary)] font-medium w-[50%]">Vendor / Item</th>
                        <th className="text-right py-2.5 px-4 text-[var(--text-secondary)] font-medium">Amount (USD)</th>
                        <th className="text-left py-2.5 px-4 text-[var(--text-secondary)] font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.rows.map((row, i) => (
                        <tr
                          key={i}
                          className={cn(
                            "border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]",
                            row.vendor === "Total" && "bg-[var(--surface)] font-semibold"
                          )}
                        >
                          <td className={cn("py-2 px-4 text-[var(--text-primary)]", row.vendor !== "Total" && "pl-8 text-[var(--text-secondary)]")}>
                            {row.vendor}
                          </td>
                          <td className={cn(
                            "py-2 px-4 text-right font-mono text-xs",
                            row.amount < 0 ? "text-red-500" : "text-[var(--text-primary)]"
                          )}>
                            {row.amount < 0 ? `-$${Math.abs(row.amount).toLocaleString()}` : `$${row.amount.toLocaleString()}`}
                          </td>
                          <td className="py-2 px-4 text-[var(--text-muted)] text-xs">{row.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            </SampleDataBanner>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: Funnel Tracking                                             */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {printMode && (
          <div className="print-section-divider">
            <h2>Application Funnel Tracking</h2>
            <p>Conversion rates across the application funnel</p>
          </div>
        )}
        {(activeTab === "funnel" || printMode) && (
          <div className="space-y-2">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Application Funnel Tracking</h3>
              <p className="text-sm text-[var(--text-muted)]">
                Conversion rates across the application funnel &mdash; 2024 Avg vs 2025 Avg vs Jan 2026. Data source: Mixpanel
              </p>
            </div>

            <SampleDataBanner
              dataset="Mixpanel"
              reason="Funnel conversion data lives in Mixpanel, not BigQuery"
              variant="inline"
            >
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                    <th className="text-left py-2.5 px-4 text-[var(--text-secondary)] font-medium min-w-[250px]">Funnel Step</th>
                    <th className="text-right py-2.5 px-3 text-[var(--text-secondary)] font-medium">2024 Avg</th>
                    <th className="text-right py-2.5 px-3 text-[var(--text-secondary)] font-medium">YoY</th>
                    <th className="text-right py-2.5 px-3 text-[var(--text-secondary)] font-medium">2025 Avg</th>
                    <th className="text-right py-2.5 px-3 text-[var(--text-secondary)] font-medium font-bold">Jan 2026</th>
                    <th className="text-right py-2.5 px-3 text-[var(--text-secondary)] font-medium">vs 2025 Avg</th>
                    <th className="text-left py-2.5 px-4 text-[var(--text-secondary)] font-medium min-w-[200px]">Commentary</th>
                  </tr>
                </thead>
                <tbody>
                  {funnelRows.map((row, i) => {
                    const vsNum = parseFloat(row.vsAvg);
                    const vsColor = vsNum > 0 ? "text-emerald-500" : vsNum < 0 ? "text-red-500" : "text-[var(--text-muted)]";
                    return (
                      <tr key={i} className="border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]">
                        <td className="py-2 px-4 text-[var(--text-primary)] font-medium">{row.step}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-[var(--text-muted)]">{row.avg2024}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-[var(--text-muted)]">{row.yoy}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-[var(--text-primary)]">{row.avg2025}</td>
                        <td className="py-2 px-3 text-right font-mono text-xs text-[var(--text-primary)] font-bold">{row.jan2026}</td>
                        <td className={cn("py-2 px-3 text-right font-mono text-xs font-medium", vsColor)}>{row.vsAvg}</td>
                        <td className="py-2 px-4 text-[var(--text-muted)] text-xs">{row.commentary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2 italic">Data source: Mixpanel</p>
            </SampleDataBanner>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* TAB 6: Monthly Metrics                                             */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {printMode && (
          <div className="print-section-divider">
            <h2>Monthly Metrics</h2>
            <p>Time-series metrics with trend indicators</p>
          </div>
        )}
        {(activeTab === "monthly" || printMode) && (
          <div className="space-y-2">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Monthly Metrics</h3>
              <p className="text-sm text-[var(--text-muted)]">
                30 time-series metrics from Jul 2023 &ndash; Feb 2026. Showing last 6 months with trend indicators.
              </p>
            </div>

            {monthlyGroups.map((group) => {
              const metricsInGroup = monthlyMetrics.filter((m) => m.group === group);
              return (
                <div key={group} className="mb-8">
                  <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">{group}</h3>
                  <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                          <th className="text-left py-2.5 px-4 text-[var(--text-secondary)] font-medium sticky left-0 bg-[var(--surface)] min-w-[240px]">Metric</th>
                          {monthlyMonths.map((m) => (
                            <th key={m} className="text-right py-2.5 px-3 text-[var(--text-secondary)] font-medium whitespace-nowrap min-w-[100px]">{m}</th>
                          ))}
                          <th className="text-center py-2.5 px-3 text-[var(--text-secondary)] font-medium w-[60px]">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metricsInGroup.map((metric, i) => {
                          const trend = getTrend(metric);
                          return (
                            <tr key={i} className={cn("border-b border-[var(--border)] transition-colors hover:bg-[var(--surface)]", metric.isSample && "bg-amber-50/50 dark:bg-amber-950/20")}>
                              <td className="py-2 px-4 text-[var(--text-primary)] font-medium sticky left-0 bg-inherit">
                                <span className="flex items-center gap-2">
                                  {metric.name}
                                  {metric.isSample && <SampleDataBadge />}
                                </span>
                              </td>
                              {monthlyMonths.map((m) => (
                                <td key={m} className="py-2 px-3 text-right text-[var(--text-primary)] font-mono text-xs whitespace-nowrap">
                                  {metric.values[m] || "--"}
                                </td>
                              ))}
                              <td className="py-2 px-3 text-center">
                                {trend === "up" && <TrendingUp className="w-4 h-4 text-emerald-500 inline-block" />}
                                {trend === "down" && <TrendingDown className="w-4 h-4 text-red-500 inline-block" />}
                                {trend === "flat" && <Minus className="w-4 h-4 text-[var(--text-muted)] inline-block" />}
                                {trend === "na" && <span className="text-[var(--text-muted)] text-xs">--</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
