import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AcquisitionFunnelRow {
  stage: string;
  label: string;
  count: number;
  conversion_from_prev_pct: number | null;
}

export interface ApprovalsByProductRow {
  week_start: string;
  product_type: string;
  count: number;
  avg_credit_line: number;
}

// ---------------------------------------------------------------------------
// Funnel stage ordering (matches milestone_complete application_status values)
// ---------------------------------------------------------------------------

/**
 * Funnel stages in logical onboarding order.
 * Values must EXACTLY match `application_status` in milestone_complete.
 *
 * Early stages (Apply button pressed, Application started) have very low
 * distinct-user counts in recent data (legacy flow), so they're placed first
 * but will naturally show as small counts if users skip them.
 */
const FUNNEL_STAGES = [
  "OTP login started",
  "Mobile verified",
  "Application agreements accepted",
  "KYC complete",
  "Personal details entered",
  "Personal info details part 2 complete",
  "Application submitted",
  "Decision complete",
  "Cardholder agreement viewed",
  "Cardholder agreement accepted",
  "Tutorial complete",
  "Delivery Address Entered",
  "PIN set",
] as const;

/** Short display labels for the UI */
const STAGE_LABELS: Record<string, string> = {
  "OTP login started": "OTP Started",
  "Mobile verified": "Mobile Verified",
  "Application agreements accepted": "Agreements Accepted",
  "KYC complete": "KYC Complete",
  "Personal details entered": "Personal Details",
  "Personal info details part 2 complete": "Personal Info Pt2",
  "Application submitted": "Application Submitted",
  "Decision complete": "Decision Complete",
  "Cardholder agreement viewed": "CMA Viewed",
  "Cardholder agreement accepted": "CMA Accepted",
  "Tutorial complete": "Tutorial Complete",
  "Delivery Address Entered": "Delivery Address",
  "PIN set": "PIN Set",
};

// ---------------------------------------------------------------------------
// 1. Acquisition Funnel
// ---------------------------------------------------------------------------

export async function getAcquisitionFunnel(
  startDate: Date,
  endDate: Date,
): Promise<AcquisitionFunnelRow[]> {
  // True funnel: each step only counts users who completed ALL previous steps.
  // We pivot each user's milestones into a single row, then cumulatively
  // intersect: step N = users who completed steps 1..N.
  const stageList = FUNNEL_STAGES.map((s) => `'${s}'`).join(", ");

  // Step 1: For each user, find which stages they completed in the date range
  // Step 2: Build cumulative funnel — stage N requires stages 1..N all present
  const sql = `
    WITH user_stages AS (
      SELECT
        user_id,
        application_status AS stage
      FROM ${TABLES.milestone_complete}
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
        AND application_status IN (${stageList})
      GROUP BY user_id, application_status
    ),
    user_stage_flags AS (
      SELECT
        user_id,
        ${FUNNEL_STAGES.map(
          (s, i) =>
            `MAX(CASE WHEN stage = '${s}' THEN 1 ELSE 0 END) AS s${i}`
        ).join(",\n        ")}
      FROM user_stages
      GROUP BY user_id
    ),
    cumulative_funnel AS (
      ${FUNNEL_STAGES.map((s, i) => {
        // Each stage requires all previous stages (s0 AND s1 AND ... AND si)
        const conditions = Array.from({ length: i + 1 }, (_, j) => `s${j} = 1`).join(" AND ");
        return `SELECT '${s}' AS stage, COUNT(*) AS count FROM user_stage_flags WHERE ${conditions}`;
      }).join("\n      UNION ALL\n      ")}
    )
    SELECT stage, count FROM cumulative_funnel
  `;

  const rows = await runQuery<{ stage: string; count: number }>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });

  // Build a lookup map for counts
  const countMap = new Map<string, number>();
  for (const row of rows) {
    countMap.set(row.stage, row.count);
  }

  // Return ordered funnel with conversion rates
  const result: AcquisitionFunnelRow[] = [];
  let prevCount: number | null = null;

  for (const stage of FUNNEL_STAGES) {
    const count = countMap.get(stage) ?? 0;
    const conversion =
      prevCount !== null && prevCount > 0
        ? Math.round((count / prevCount) * 10000) / 100
        : null;

    result.push({
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      count,
      conversion_from_prev_pct: conversion,
    });

    prevCount = count;
  }

  return result;
}

// ---------------------------------------------------------------------------
// 2. Approvals by Product
// ---------------------------------------------------------------------------

export async function getApprovalsByProduct(
  startDate: Date,
  endDate: Date,
): Promise<ApprovalsByProductRow[]> {
  const sql = `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
      CASE
        WHEN is_prepaid_card_applicable = TRUE THEN 'RP1 Card'
        WHEN is_account_opening_fee_applicable = TRUE THEN 'Opening Fee Card'
        ELSE 'Standard Credit Card'
      END AS product_type,
      COUNT(*) AS count,
      ROUND(AVG(SAFE_CAST(credit_line AS FLOAT64)), 0) AS avg_credit_line
    FROM ${TABLES.decision_completed}
    WHERE decision = 'APPROVED'
      AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    GROUP BY week_start, product_type
    ORDER BY week_start, product_type
  `;

  return runQuery<ApprovalsByProductRow>(sql, {
    startDate: toSqlDate(startDate),
    endDate: toSqlDate(endDate),
  });
}
