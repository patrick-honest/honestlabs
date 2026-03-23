import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";
import { productTypeWhere } from "../_shared/filters";

const FUNNEL_STAGES = [
  "OTP login started", "Mobile verified", "Application agreements accepted", "KYC complete",
  "Personal details entered", "Personal info details part 2 complete", "Application submitted",
  "Decision complete", "Cardholder agreement viewed", "Cardholder agreement accepted",
  "Tutorial complete", "Delivery Address Entered", "PIN set",
];

const STAGE_LABELS: Record<string, string> = {
  "OTP login started": "OTP Started", "Mobile verified": "Mobile Verified",
  "Application agreements accepted": "Agreements Accepted", "KYC complete": "KYC Complete",
  "Personal details entered": "Personal Details", "Personal info details part 2 complete": "Personal Info Pt2",
  "Application submitted": "Application Submitted", "Decision complete": "Decision Complete",
  "Cardholder agreement viewed": "CMA Viewed", "Cardholder agreement accepted": "CMA Accepted",
  "Tutorial complete": "Tutorial Complete", "Delivery Address Entered": "Delivery Address", "PIN set": "PIN Set",
};

async function queryAcquisition(startDate: string, endDate: string, env: Env, filters: ParsedFilters) {
  const stageList = FUNNEL_STAGES.map(s => `'${s}'`).join(", ");
  const flagCols = FUNNEL_STAGES.map((s, i) => `MAX(CASE WHEN stage='${s}' THEN 1 ELSE 0 END) AS s${i}`).join(",\n");
  const cumulativeUnions = FUNNEL_STAGES.map((s, i) => {
    const conds = Array.from({ length: i + 1 }, (_, j) => `s${j}=1`).join(" AND ");
    return `SELECT '${s}' AS stage, COUNT(*) AS count FROM user_stage_flags WHERE ${conds}`;
  }).join("\nUNION ALL\n");

  const [funnelRows, decisionBreakdown, productMix, approvalRateTrend] = await Promise.all([
    runQuery<{ stage: string; count: number }>(
      `WITH user_stages AS (
        SELECT user_id, application_status AS stage FROM ${TABLES.milestone_complete}
        WHERE DATE(timestamp,'Asia/Jakarta') BETWEEN @startDate AND @endDate AND application_status IN (${stageList})
        GROUP BY user_id, application_status
      ), user_stage_flags AS (SELECT user_id, ${flagCols} FROM user_stages GROUP BY user_id),
      cumulative_funnel AS (${cumulativeUnions})
      SELECT stage, count FROM cumulative_funnel`,
      { startDate, endDate }, env,
    ),
    runQuery(`SELECT decision, COUNT(*) AS cnt FROM ${TABLES.decision_completed} dc WHERE DATE(dc.timestamp,'Asia/Jakarta') BETWEEN @startDate AND @endDate ${productTypeWhere(filters, 'dc')} GROUP BY decision`, { startDate, endDate }, env),
    runQuery(`SELECT CASE WHEN dc.is_prepaid_card_applicable=TRUE THEN 'RP1' WHEN dc.is_account_opening_fee_applicable=TRUE THEN 'Registration Fee' ELSE 'Standard CC' END AS product_type, COUNT(*) AS cnt FROM ${TABLES.decision_completed} dc WHERE dc.decision='APPROVED' AND DATE(dc.timestamp,'Asia/Jakarta') BETWEEN @startDate AND @endDate ${productTypeWhere(filters, 'dc')} GROUP BY product_type`, { startDate, endDate }, env),
    runQuery(`SELECT FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(dc.timestamp,'Asia/Jakarta'), WEEK(MONDAY))) AS week_start, COUNT(*) AS total, COUNTIF(dc.decision='APPROVED') AS approved, ROUND(SAFE_DIVIDE(COUNTIF(dc.decision='APPROVED'), COUNT(*))*100,2) AS approval_rate FROM ${TABLES.decision_completed} dc WHERE DATE(dc.timestamp,'Asia/Jakarta') BETWEEN @startDate AND @endDate ${productTypeWhere(filters, 'dc')} GROUP BY week_start ORDER BY week_start`, { startDate, endDate }, env),
  ]);

  // Build funnel with conversion rates
  const countMap = new Map(funnelRows.map(r => [r.stage, r.count]));
  let prevCount: number | null = null;
  const funnel = FUNNEL_STAGES.map(stage => {
    const count = countMap.get(stage) ?? 0;
    const conversion = prevCount !== null && prevCount > 0 ? Math.round((count / prevCount) * 10000) / 100 : null;
    prevCount = count;
    return { stage, label: STAGE_LABELS[stage] ?? stage, count, conversion_from_prev_pct: conversion };
  });

  return { funnel, decisionBreakdown, productMix, approvalRateTrend };
}

export const onRequest = createHandler({ section: "acquisition", queryFn: queryAcquisition });
