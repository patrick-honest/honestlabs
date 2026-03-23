import { runQuery, TABLES } from "../_shared/bigquery-client";
import { createHandler } from "../_shared/handler";
import type { Env } from "../_shared/bigquery-auth";

async function queryCardsOverview(startDate: string, endDate: string, env: Env) {
  const [cardStatusRaw, cardProgramBreakdown, verificationBreakdown] = await Promise.all([
    // Card Status Distribution (latest DW005 snapshot, last 7 days)
    // Page expects cardStatusBreakdown: { status, accounts }
    // Raw query returns card_status + brand, we'll aggregate to just status
    runQuery(
      `SELECT
        COALESCE(fx_dw005_crd_stat, 'Active') AS card_status,
        fx_dw005_crd_brn AS brand,
        COUNT(DISTINCT f9_dw005_loc_acct) AS accounts
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_upd_tms >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
      GROUP BY 1, 2
      ORDER BY accounts DESC`,
      undefined,
      env,
    ),

    // Card Program Distribution
    // Page expects: card_pgm, brand, accounts
    runQuery(
      `SELECT
        fx_dw005_crd_pgm AS card_pgm,
        fx_dw005_crd_brn AS brand,
        COUNT(DISTINCT f9_dw005_loc_acct) AS accounts
      FROM ${TABLES.principal_card_updates}
      WHERE f9_dw005_upd_tms >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
      GROUP BY 1, 2
      ORDER BY accounts DESC`,
      undefined,
      env,
    ),

    // Verification Split (VIDEO_VERIFIED vs DECISION_TO_SKIP)
    // Page expects verificationBreakdown: { verification, accounts }
    runQuery(
      `SELECT
        reason AS verification,
        COUNT(DISTINCT user_id) AS accounts
      FROM \`storage-58f5a02c.refined_rudderstack.videocall_verified\`
      WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
      GROUP BY reason`,
      { startDate, endDate },
      env,
    ),
  ]);

  // Aggregate card status rows (which have brand dimension) into just status + accounts
  const statusMap = new Map<string, number>();
  for (const row of cardStatusRaw as { card_status: string; brand: string; accounts: number }[]) {
    statusMap.set(row.card_status, (statusMap.get(row.card_status) ?? 0) + row.accounts);
  }
  const cardStatusBreakdown = [...statusMap.entries()]
    .map(([status, accounts]) => ({ status, accounts }))
    .sort((a, b) => b.accounts - a.accounts);

  return {
    cardStatusBreakdown,
    cardProgramBreakdown,
    verificationBreakdown,
  };
}

export const onRequest = createHandler({ section: "cards-overview", queryFn: queryCardsOverview });
