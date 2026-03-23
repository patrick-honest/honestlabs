import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";
import type { ParsedFilters } from "../_shared/filters";
import { productTypeWhere } from "../_shared/filters";

const FUNNEL_STAGES = [
  "Mobile verified", "Application agreements accepted", "KYC complete",
  "Personal details entered", "Personal info details part 2 complete", "Application submitted",
  "Decision complete", "Cardholder agreement viewed", "Cardholder agreement accepted",
  "Tutorial complete", "Delivery Address Entered", "PIN set",
];

const STAGE_LABELS: Record<string, string> = {
  "Mobile verified": "Mobile Verified",
  "Application agreements accepted": "Agreements Accepted", "KYC complete": "KYC Complete",
  "Personal details entered": "Personal Details", "Personal info details part 2 complete": "Personal Info Pt2",
  "Application submitted": "Application Submitted", "Decision complete": "Decision Complete",
  "Cardholder agreement viewed": "CMA Viewed", "Cardholder agreement accepted": "CMA Accepted",
  "Tutorial complete": "Tutorial Complete", "Delivery Address Entered": "Delivery Address", "PIN set": "PIN Set",
};

async function queryAcquisition(startDate: string, endDate: string, env: Env, filters: ParsedFilters, rawStartDate?: string) {
  const stageList = FUNNEL_STAGES.map(s => `'${s}'`).join(", ");
  const flagCols = FUNNEL_STAGES.map((s, i) => `MAX(CASE WHEN stage='${s}' THEN 1 ELSE 0 END) AS s${i}`).join(",\n");
  const cumulativeUnions = FUNNEL_STAGES.map((s, i) => {
    const conds = Array.from({ length: i + 1 }, (_, j) => `s${j}=1`).join(" AND ");
    return `SELECT '${s}' AS stage, COUNT(*) AS count FROM user_stage_flags WHERE ${conds}`;
  }).join("\nUNION ALL\n");

  const [funnelRows, decisionBreakdown, productMix, approvalRateTrend, creditLimitTrend] = await Promise.all([
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

    // Avg Credit Limit & Weighted Fee — weekly
    runQuery(
      `WITH fnx_accounts AS (
        SELECT F9_DW001_LOC_ACCT AS loc_acct, F9_DW001_LOC_LMT, F9_DW001_DECSN_DT,
          PX_DW001_CRD_PGM, ct_dict.admin_fee,
          ROW_NUMBER() OVER(PARTITION BY F9_DW001_LOC_ACCT ORDER BY f9_dw001_upd_tms DESC) AS rn
        FROM ${TABLES.new_card_application}
        LEFT JOIN ${TABLES.card_type_dictionary} ct_dict USING(PX_DW001_CRD_PGM)
        WHERE F9_DW001_DECSN_DT BETWEEN @startDate AND @endDate
        QUALIFY rn = 1
      )
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(F9_DW001_DECSN_DT, ISOWEEK)) AS week_start,
        COUNT(*) AS approval_count,
        ROUND(AVG(CAST(F9_DW001_LOC_LMT AS FLOAT64)), 0) AS avg_credit_limit_idr,
        ROUND(SAFE_DIVIDE(
          SUM(a.admin_fee * CAST(F9_DW001_LOC_LMT AS FLOAT64)),
          SUM(CAST(F9_DW001_LOC_LMT AS FLOAT64))
        ) * 100, 2) AS weighted_avg_fee_pct
      FROM fnx_accounts a
      LEFT JOIN ${TABLES.mapping_loc_user} br USING(loc_acct)
      LEFT JOIN ${TABLES.ft_application_decision_base} dec USING(application_status_id)
      WHERE dec.flag_FT = 0
        AND COALESCE(dec.is_account_opening_fee_applicable, FALSE) = FALSE
        AND COALESCE(dec.is_prepaid_card_applicable, FALSE) = FALSE
      GROUP BY 1
      ORDER BY week_start`,
      { startDate, endDate },
      env,
    ),
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

  return { funnel, decisionBreakdown, productMix, approvalRateTrend, creditLimitTrend };
}

// Custom handler that also runs comparison funnel for prev period
export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const rawStart = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  const prevStart = url.searchParams.get("prevStartDate");
  const prevEnd = url.searchParams.get("prevEndDate");
  const period = url.searchParams.get("period") || "monthly";

  const action = url.searchParams.get("action");

  if (!rawStart || !endDate) {
    return new Response(JSON.stringify({ error: "Missing startDate or endDate" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Handle dropoff CSV download
  if (action === "dropoff") {
    const stage = url.searchParams.get("stage") ?? "";
    const stageIdx = FUNNEL_STAGES.indexOf(stage) !== -1 ? FUNNEL_STAGES.indexOf(stage) : FUNNEL_STAGES.findIndex(s => (STAGE_LABELS[s] ?? s) === stage);
    if (stageIdx <= 0) {
      return new Response(JSON.stringify({ users: [] }), { headers: { "Content-Type": "application/json" } });
    }
    const stageList = FUNNEL_STAGES.map(s => `'${s}'`).join(", ");
    const flagCols = FUNNEL_STAGES.map((s, i) => `MAX(CASE WHEN stage='${s}' THEN 1 ELSE 0 END) AS s${i}`).join(",\n");
    const prevFlags = Array.from({ length: stageIdx }, (_, j) => `s${j}=1`).join(" AND ");
    const rows = await runQuery<{ user_id: string }>(
      `WITH user_stages AS (
        SELECT user_id, application_status AS stage FROM ${TABLES.milestone_complete}
        WHERE DATE(timestamp,'Asia/Jakarta') BETWEEN @startDate AND @endDate AND application_status IN (${stageList})
        GROUP BY user_id, application_status
      ), user_stage_flags AS (SELECT user_id, ${flagCols} FROM user_stages GROUP BY user_id)
      SELECT user_id FROM user_stage_flags WHERE ${prevFlags} AND s${stageIdx}=0`,
      { startDate: rawStart, endDate }, env,
    );
    return new Response(JSON.stringify({ users: rows.map(r => r.user_id) }), { headers: { "Content-Type": "application/json" } });
  }

  // Extend startDate for chart context (same logic as createHandler)
  const d = new Date(rawStart + "T00:00:00Z");
  switch (period) {
    case "weekly": d.setUTCDate(d.getUTCDate() - 42); break;
    case "monthly": d.setUTCMonth(d.getUTCMonth() - 6); break;
    case "quarterly": d.setUTCMonth(d.getUTCMonth() - 18); break;
    default: d.setUTCMonth(d.getUTCMonth() - 6);
  }
  const startDate = d.toISOString().slice(0, 10);

  const { parseFilters } = await import("../_shared/filters");
  const filters = parseFilters(url);

  try {
    const mainResult = await queryAcquisition(startDate, endDate, env, filters, rawStart) as Record<string, unknown>;

    // Run comparison funnel if prev dates available
    if (prevStart && prevEnd) {
      const stageList = FUNNEL_STAGES.map(s => `'${s}'`).join(", ");
      const flagCols = FUNNEL_STAGES.map((s, i) => `MAX(CASE WHEN stage='${s}' THEN 1 ELSE 0 END) AS s${i}`).join(",\n");
      const cumulativeUnions = FUNNEL_STAGES.map((s, i) => {
        const conds = Array.from({ length: i + 1 }, (_, j) => `s${j}=1`).join(" AND ");
        return `SELECT '${s}' AS stage, COUNT(*) AS count FROM user_stage_flags WHERE ${conds}`;
      }).join("\nUNION ALL\n");

      const prevFunnelRows = await runQuery<{ stage: string; count: number }>(
        `WITH user_stages AS (
          SELECT user_id, application_status AS stage FROM ${TABLES.milestone_complete}
          WHERE DATE(timestamp,'Asia/Jakarta') BETWEEN @startDate AND @endDate AND application_status IN (${stageList})
          GROUP BY user_id, application_status
        ), user_stage_flags AS (SELECT user_id, ${flagCols} FROM user_stages GROUP BY user_id),
        cumulative_funnel AS (${cumulativeUnions})
        SELECT stage, count FROM cumulative_funnel`,
        { startDate: prevStart, endDate: prevEnd }, env,
      );

      const prevCountMap = new Map(prevFunnelRows.map(r => [r.stage, r.count]));
      const prevFunnel = FUNNEL_STAGES.map(stage => ({
        stage,
        label: STAGE_LABELS[stage] ?? stage,
        count: prevCountMap.get(stage) ?? 0,
      }));
      mainResult.prevFunnel = prevFunnel;

      // Dropoff user queries — for each stage where current > 0 and there's a drop
      const dropoffQueries: Record<string, string> = {};
      for (let i = 1; i < FUNNEL_STAGES.length; i++) {
        const prev = FUNNEL_STAGES[i - 1];
        const curr = FUNNEL_STAGES[i];
        const prevFlags = Array.from({ length: i }, (_, j) => `s${j}=1`).join(" AND ");
        const currFlag = `s${i}=0`;
        dropoffQueries[curr] = `WITH user_stages AS (
          SELECT user_id, application_status AS stage FROM ${TABLES.milestone_complete}
          WHERE DATE(timestamp,'Asia/Jakarta') BETWEEN @startDate AND @endDate AND application_status IN (${stageList})
          GROUP BY user_id, application_status
        ), user_stage_flags AS (SELECT user_id, ${flagCols} FROM user_stages GROUP BY user_id)
        SELECT user_id FROM user_stage_flags WHERE ${prevFlags} AND ${currFlag}`;
      }
      mainResult.dropoffQueries = dropoffQueries;
    }

    return new Response(JSON.stringify(mainResult), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch acquisition data", message: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
