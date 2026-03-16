import { runQuery, TABLES } from "@/lib/bigquery";
import { toSqlDate } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AcquisitionFunnelRow {
  stage: string;
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

const FUNNEL_STAGES = [
  "Waitlisted",
  "Apply button pressed",
  "Application started",
  "Agreements accepted",
  "Mobile verified",
  "OTP login started",
  "KYC complete",
  "Personal details",
  "Decision complete",
  "Application submitted",
  "Income details",
  "Personal info pt2",
  "Cardholder agreement viewed",
  "Cardholder agreement accepted",
  "Tutorial complete",
  "Delivery address",
  "PIN set",
] as const;

// ---------------------------------------------------------------------------
// 1. Acquisition Funnel
// ---------------------------------------------------------------------------

export async function getAcquisitionFunnel(
  startDate: Date,
  endDate: Date,
): Promise<AcquisitionFunnelRow[]> {
  const stageList = FUNNEL_STAGES.map((s) => `'${s}'`).join(", ");

  const sql = `
    SELECT
      application_status AS stage,
      COUNT(DISTINCT user_id) AS count
    FROM ${TABLES.milestone_complete}
    WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      AND application_status IN (${stageList})
    GROUP BY application_status
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
        WHEN is_prepaid_card_applicable = TRUE THEN 'Prepaid Card'
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
