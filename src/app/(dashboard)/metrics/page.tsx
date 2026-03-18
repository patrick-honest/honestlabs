"use client";

import React, { useState, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { useTranslations } from "next-intl";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";

// ==========================================================================
// Metric Definition type
// ==========================================================================

interface MetricDef {
  key: string;
  label: string;
  unit: "count" | "percent" | "idr" | "usd";
  section: string;
  queryFn: string;
  description: string;
  sql: string;
  target?: number;
  warningThreshold?: number;
  dangerThreshold?: number;
  higherIsBetter: boolean;
}

// ==========================================================================
// SQL Snippets — extracted from src/services/queries/*
// ==========================================================================

const SQL_ELIGIBLE_AND_TRANSACTORS = `-- Product type filtering handled by UI (productType filter dimension)
WITH card_unblocked AS (
  SELECT DISTINCT f9_dw005_loc_acct AS loc_acct
  FROM \${TABLES.principal_card_updates}
  WHERE f9_dw005_1st_unblk_all_mtd_tms IS NOT NULL
    AND TRIM(CAST(f9_dw005_1st_unblk_all_mtd_tms AS STRING)) != ''
    AND f9_dw005_hce_txn_ind LIKE '%0%'
    AND f9_dw005_net_txn_ind LIKE '%0%'
    AND fx_dw005_contc_less_flg LIKE '%Y%'
    AND f9_dw005_contc_txn_ind LIKE '%0%'
),

weekly_eligible AS (
  SELECT
    DATE_TRUNC(dw4.f9_dw004_bus_dt, ISOWEEK) AS week_start,
    COUNT(DISTINCT dw4.p9_dw004_loc_acct) AS eligible_count
  FROM \${TABLES.financial_account_updates} dw4
  JOIN card_unblocked cu
    ON dw4.p9_dw004_loc_acct = cu.loc_acct
  WHERE dw4.f9_dw004_bus_dt BETWEEN @startDate AND @endDate
    AND EXTRACT(DAYOFWEEK FROM dw4.f9_dw004_bus_dt) = 1
    AND dw4.fx_dw004_loc_stat IN ('G', 'N')
    AND dw4.f9_dw004_curr_dpd = 0                        -- Current only (not past due)
  GROUP BY week_start
),

card_acct_map AS (
  SELECT DISTINCT
    f9_dw005_crn AS crn,
    f9_dw005_loc_acct AS loc_acct
  FROM \${TABLES.principal_card_updates}
),

weekly_transactors AS (
  SELECT
    DATE_TRUNC(dw7.f9_dw007_dt, ISOWEEK) AS week_start,
    COUNT(DISTINCT cam.loc_acct) AS transactor_count,
    COUNT(*) AS total_transactions
  FROM \${TABLES.authorized_transaction} dw7
  JOIN card_acct_map cam
    ON dw7.f9_dw007_prin_crn = cam.crn
  WHERE dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
    AND (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
    AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
  GROUP BY week_start
)

SELECT
  FORMAT_DATE('%Y-%m-%d', e.week_start) AS week_start,
  e.eligible_count,
  COALESCE(t.transactor_count, 0) AS transactor_count,
  COALESCE(t.total_transactions, 0) AS total_transactions,
  ROUND(SAFE_DIVIDE(COALESCE(t.transactor_count, 0), e.eligible_count) * 100, 2) AS spend_active_rate
FROM weekly_eligible e
LEFT JOIN weekly_transactors t
  ON e.week_start = t.week_start
ORDER BY e.week_start`;

const SQL_SPEND_METRICS = `WITH valid_spend AS (
  SELECT
    DATE_TRUNC(dw7.f9_dw007_dt, ISOWEEK) AS week_start,
    dw7.fx_dw007_txn_typ AS txn_typ,
    dw7.fx_dw007_rte_dest AS rte_dest,
    dw7.f9_dw007_amt_req / 100.0 AS amt_idr,
    COALESCE(dw9.f9_dw009_setl_amt / 100.0 / 16000.0, 0) AS amt_usd
  FROM \${TABLES.authorized_transaction} dw7
  LEFT JOIN \${TABLES.posted_transaction} dw9
    ON dw7.fx_dw007_txn_id = dw9.fx_dw009_txn_id
   AND dw7.fx_dw007_given_apv_cde = dw9.fx_dw009_apv_cde
  WHERE dw7.f9_dw007_dt BETWEEN @startDate AND @endDate
    AND (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
    AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
    AND dw7.f9_dw007_ori_amt > 0
)

SELECT
  FORMAT_DATE('%Y-%m-%d', week_start) AS week_start,
  ROUND(AVG(amt_idr), 0) AS avg_spend_idr,
  ROUND(AVG(amt_usd), 2) AS avg_spend_usd,
  ROUND(AVG(CASE WHEN txn_typ = 'TM' THEN amt_idr END), 0) AS avg_spend_online_idr,
  ROUND(AVG(CASE
    WHEN txn_typ != 'TM'
     AND NOT (txn_typ = 'RA' AND rte_dest = 'L')
    THEN amt_idr
  END), 0) AS avg_spend_offline_idr,
  ROUND(AVG(CASE
    WHEN txn_typ = 'RA' AND rte_dest = 'L'
    THEN amt_idr
  END), 0) AS avg_spend_qris_idr,
  ROUND(SUM(amt_idr), 0) AS total_spend_idr,
  COUNT(*) AS total_txn_count
FROM valid_spend
GROUP BY week_start
ORDER BY week_start`;

const SQL_NEW_CUSTOMER_ACTIVATION = `WITH approved_users AS (
  SELECT
    user_id,
    DATE(MIN(timestamp), 'Asia/Jakarta') AS approval_date
  FROM \${TABLES.decision_completed}
  WHERE decision = 'APPROVED'
    -- Product type filtering handled by UI (productType filter dimension)
  GROUP BY user_id
),

user_crn AS (
  SELECT
    au.user_id,
    au.approval_date,
    dw4.p9_dw004_prin_crn AS crn,
    ROW_NUMBER() OVER (PARTITION BY au.user_id ORDER BY dw4.p9_dw004_prin_crn) AS rn
  FROM approved_users au
  JOIN \${TABLES.cms_line_of_credit} cloc
    ON au.user_id = cloc.user_id
  JOIN \${TABLES.financial_account_updates} dw4
    ON cloc.external_id = dw4.p9_dw004_loc_acct
),

cohort AS (
  SELECT user_id, approval_date, crn
  FROM user_crn WHERE rn = 1
),

weekly_cohort AS (
  SELECT
    DATE_TRUNC(approval_date, ISOWEEK) AS week_start,
    user_id, approval_date, crn
  FROM cohort
  WHERE DATE_TRUNC(approval_date, ISOWEEK) BETWEEN @startDate AND @endDate
),

activated AS (
  SELECT DISTINCT wc.user_id
  FROM weekly_cohort wc
  JOIN \${TABLES.authorized_transaction} dw7
    ON wc.crn = dw7.f9_dw007_prin_crn
   AND dw7.f9_dw007_dt BETWEEN wc.approval_date AND DATE_ADD(wc.approval_date, INTERVAL 7 DAY)
  WHERE (dw7.fx_dw007_stat IS NULL OR TRIM(dw7.fx_dw007_stat) = '' OR dw7.fx_dw007_stat = ' ')
    AND dw7.fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
)

SELECT
  FORMAT_DATE('%Y-%m-%d', wc.week_start) AS week_start,
  COUNT(DISTINCT wc.user_id) AS approved_count,
  COUNT(DISTINCT a.user_id) AS activated_count,
  ROUND(SAFE_DIVIDE(COUNT(DISTINCT a.user_id), COUNT(DISTINCT wc.user_id)) * 100, 2) AS activation_rate_pct
FROM weekly_cohort wc
LEFT JOIN activated a ON wc.user_id = a.user_id
WHERE DATE_ADD(wc.week_start, INTERVAL 13 DAY) <= CURRENT_DATE()
GROUP BY wc.week_start
ORDER BY wc.week_start`;

const SQL_DECISION_FUNNEL = `SELECT
  FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
  COUNT(*) AS total_decisions,
  COUNTIF(decision = 'APPROVED') AS approved,
  COUNTIF(decision = 'DECLINED') AS declined,
  COUNTIF(decision = 'WAITLISTED') AS waitlisted,
  ROUND(SAFE_DIVIDE(COUNTIF(decision = 'APPROVED'), COUNT(*)) * 100, 2) AS approval_rate_pct
FROM \${TABLES.decision_completed}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
GROUP BY week_start
ORDER BY week_start`;

const SQL_PORTFOLIO_DPD = `SELECT
  CASE
    WHEN f9_dw004_curr_dpd = 0 THEN 'Current'
    WHEN f9_dw004_curr_dpd BETWEEN 1 AND 30 THEN '1-30 DPD'
    WHEN f9_dw004_curr_dpd BETWEEN 31 AND 60 THEN '31-60 DPD'
    WHEN f9_dw004_curr_dpd BETWEEN 61 AND 90 THEN '61-90 DPD'
    WHEN f9_dw004_curr_dpd > 90 THEN '90+ DPD'
  END AS label,
  COUNT(DISTINCT p9_dw004_loc_acct) AS count,
  ROUND(SUM(f9_dw004_clo_bal / 100.0), 0) AS exposure_idr
FROM \${TABLES.financial_account_updates}
WHERE f9_dw004_bus_dt = @snapshotDate
  AND f9_dw004_curr_dpd >= 0
GROUP BY label`;

const SQL_PORTFOLIO_STATUS = `SELECT
  fx_dw004_loc_stat AS status,
  COUNT(DISTINCT p9_dw004_loc_acct) AS count
FROM \${TABLES.financial_account_updates}
WHERE f9_dw004_bus_dt = @snapshotDate
GROUP BY status
ORDER BY count DESC`;

const SQL_PORTFOLIO_SUMMARY = `SELECT
  COUNT(DISTINCT p9_dw004_loc_acct) AS total_accounts,
  COUNT(DISTINCT CASE WHEN fx_dw004_loc_stat IN ('G', 'N') THEN p9_dw004_loc_acct END) AS active_accounts
FROM \${TABLES.financial_account_updates}
WHERE f9_dw004_bus_dt = @snapshotDate`;

const SQL_REPAYMENT_METRICS = `SELECT
  FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
  COUNT(*) AS total_repayments,
  ROUND(SUM(amount / 100.0), 0) AS total_amount,
  ROUND(AVG(amount / 100.0), 0) AS avg_amount,
  ARRAY_AGG(STRUCT(vendor, vendor_count AS count, vendor_amount AS amount)) AS vendor_breakdown
FROM (
  SELECT
    timestamp, amount, vendor,
    COUNT(*) OVER (PARTITION BY DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK), vendor) AS vendor_count,
    ROUND(SUM(amount / 100.0) OVER (PARTITION BY DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK), vendor), 0) AS vendor_amount,
    ROW_NUMBER() OVER (PARTITION BY DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK), vendor ORDER BY timestamp) AS rn
  FROM \${TABLES.repayment_completed}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
)
WHERE rn = 1
GROUP BY week_start
ORDER BY week_start`;

const SQL_AUTH_METRICS = `SELECT
  FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
  COUNTIF(transaction_response_code = '00') AS approved_count,
  COUNTIF(transaction_response_code != '00') AS declined_count,
  COUNT(*) AS total_count,
  ROUND(SAFE_DIVIDE(COUNTIF(transaction_response_code = '00'), COUNT(*)) * 100, 2) AS approval_rate
FROM \${TABLES.transaction_authorized}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
GROUP BY week_start
ORDER BY week_start`;

const SQL_CHANNEL_MIX = `SELECT
  FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
  COALESCE(transaction_channel, 'Unknown') AS transaction_channel,
  COUNT(*) AS txn_count,
  ROUND(SUM(SAFE_CAST(transaction_amount AS FLOAT64)), 0) AS total_amount
FROM \${TABLES.transaction_authorized}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
GROUP BY week_start, transaction_channel
ORDER BY week_start, txn_count DESC`;

const SQL_TICKET_SIZE_TREND = `SELECT
  FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
  ROUND(AVG(SAFE_CAST(transaction_amount AS FLOAT64)), 0) AS avg_ticket_size,
  ROUND(APPROX_QUANTILES(SAFE_CAST(transaction_amount AS FLOAT64), 100)[OFFSET(50)], 0) AS median_ticket_size
FROM \${TABLES.transaction_authorized}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
  AND transaction_response_code = '00'
  AND SAFE_CAST(transaction_amount AS FLOAT64) > 0
GROUP BY week_start
ORDER BY week_start`;

const SQL_TOP_MERCHANTS = `SELECT
  COALESCE(NULLIF(TRIM(merchant_name), ''), 'Unknown') AS merchant_name,
  COUNT(*) AS txn_count,
  ROUND(SUM(SAFE_CAST(transaction_amount AS FLOAT64)), 0) AS total_amount,
  ROUND(AVG(SAFE_CAST(transaction_amount AS FLOAT64)), 0) AS avg_amount
FROM \${TABLES.transaction_authorized}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
  AND transaction_response_code = '00'
GROUP BY merchant_name
ORDER BY txn_count DESC
LIMIT 20`;

const SQL_ACTIVE_USERS = `WITH daily_active AS (
  SELECT
    DATE(timestamp, 'Asia/Jakarta') AS activity_date,
    user_id
  FROM \${TABLES.tracks}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    AND event = 'application_opened'
    AND user_id IS NOT NULL
  GROUP BY activity_date, user_id
),

weekly_windows AS (
  SELECT
    FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(activity_date, ISOWEEK)) AS week_start,
    activity_date, user_id
  FROM daily_active
),

weekly_metrics AS (
  SELECT
    week_start,
    ROUND(COUNT(DISTINCT CONCAT(CAST(activity_date AS STRING), '-', user_id)) * 1.0
          / COUNT(DISTINCT activity_date), 0) AS dau,
    COUNT(DISTINCT user_id) AS wau
  FROM weekly_windows
  GROUP BY week_start
),

monthly_users AS (
  SELECT
    FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(activity_date, ISOWEEK)) AS week_start,
    COUNT(DISTINCT user_id) AS mau
  FROM daily_active
  WHERE activity_date BETWEEN
    DATE_SUB(DATE_TRUNC(activity_date, ISOWEEK), INTERVAL 27 DAY)
    AND DATE_ADD(DATE_TRUNC(activity_date, ISOWEEK), INTERVAL 6 DAY)
  GROUP BY week_start
)

SELECT
  wm.week_start,
  wm.dau,
  wm.wau,
  COALESCE(mu.mau, wm.wau) AS mau,
  ROUND(SAFE_DIVIDE(wm.dau, COALESCE(mu.mau, wm.wau)) * 100, 2) AS dau_mau_ratio
FROM weekly_metrics wm
LEFT JOIN monthly_users mu ON wm.week_start = mu.week_start
ORDER BY wm.week_start`;

const SQL_SESSION_METRICS = `WITH session_data AS (
  SELECT
    DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK) AS week_start,
    context_session_id,
    COUNT(*) AS event_count,
    TIMESTAMP_DIFF(MAX(timestamp), MIN(timestamp), SECOND) AS session_duration_sec
  FROM \${TABLES.tracks}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    AND context_session_id IS NOT NULL
    AND user_id IS NOT NULL
  GROUP BY week_start, context_session_id
),

screen_counts AS (
  SELECT
    DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK) AS week_start,
    context_session_id,
    COUNT(*) AS screen_count
  FROM \${TABLES.screens}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    AND context_session_id IS NOT NULL
    AND user_id IS NOT NULL
  GROUP BY week_start, context_session_id
),

error_events AS (
  SELECT
    DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK) AS week_start,
    COUNT(*) AS error_count
  FROM \${TABLES.tracks}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    AND (event LIKE '%error%' OR event LIKE '%fail%' OR event LIKE '%crash%')
    AND user_id IS NOT NULL
  GROUP BY week_start
)

SELECT
  FORMAT_DATE('%Y-%m-%d', sd.week_start) AS week_start,
  COUNT(DISTINCT sd.context_session_id) AS total_sessions,
  ROUND(AVG(COALESCE(sc.screen_count, 0)), 1) AS avg_screens_per_session,
  ROUND(AVG(sd.session_duration_sec), 0) AS avg_session_duration_sec,
  COALESCE(MAX(ee.error_count), 0) AS error_count,
  ROUND(SAFE_DIVIDE(COALESCE(MAX(ee.error_count), 0), COUNT(DISTINCT sd.context_session_id)) * 100, 2) AS error_rate
FROM session_data sd
LEFT JOIN screen_counts sc
  ON sd.week_start = sc.week_start AND sd.context_session_id = sc.context_session_id
LEFT JOIN error_events ee ON sd.week_start = ee.week_start
GROUP BY sd.week_start
ORDER BY sd.week_start`;

const SQL_TOP_SCREENS = `SELECT
  COALESCE(NULLIF(TRIM(name), ''), 'unknown') AS screen_name,
  COUNT(*) AS view_count,
  COUNT(DISTINCT user_id) AS unique_users
FROM \${TABLES.screens}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
  AND user_id IS NOT NULL
GROUP BY screen_name
ORDER BY view_count DESC
LIMIT 20`;

const SQL_REFERRAL_FUNNEL = `WITH started AS (
  SELECT
    FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
    COUNT(DISTINCT referred_user_id) AS started
  FROM \${TABLES.referral_application_started}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
  GROUP BY week_start
),
approved AS (
  SELECT
    FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
    COUNT(DISTINCT user_id) AS approved
  FROM \${TABLES.referral_approved}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
  GROUP BY week_start
)
SELECT
  s.week_start,
  s.started,
  COALESCE(a.approved, 0) AS approved,
  ROUND(SAFE_DIVIDE(COALESCE(a.approved, 0), s.started) * 100, 2) AS conversion_rate
FROM started s
LEFT JOIN approved a ON s.week_start = a.week_start
ORDER BY s.week_start`;

const SQL_REFERRAL_BY_CHANNEL = `WITH started AS (
  SELECT
    COALESCE(referring_source, 'unknown') AS referring_source,
    COALESCE(referring_medium, 'unknown') AS referring_medium,
    COUNT(DISTINCT referred_user_id) AS started_count
  FROM \${TABLES.referral_application_started}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
  GROUP BY referring_source, referring_medium
),
approved AS (
  SELECT
    COALESCE(r.referring_source, 'unknown') AS referring_source,
    COALESCE(r.referring_medium, 'unknown') AS referring_medium,
    COUNT(DISTINCT a.user_id) AS approved_count
  FROM \${TABLES.referral_approved} a
  INNER JOIN \${TABLES.referral_application_started} r
    ON a.user_id = r.referred_user_id
  WHERE DATE(a.timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
  GROUP BY referring_source, referring_medium
)
SELECT
  s.referring_source,
  s.referring_medium,
  s.started_count,
  COALESCE(a.approved_count, 0) AS approved_count,
  ROUND(SAFE_DIVIDE(COALESCE(a.approved_count, 0), s.started_count) * 100, 2) AS conversion_rate
FROM started s
LEFT JOIN approved a
  ON s.referring_source = a.referring_source
  AND s.referring_medium = a.referring_medium
ORDER BY s.started_count DESC`;

const SQL_CLI_TREND = `SELECT
  FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(DATE(timestamp, 'Asia/Jakarta'), ISOWEEK)) AS week_start,
  COUNT(*) AS cli_count,
  ROUND(AVG(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS avg_credit_line_change,
  COUNT(DISTINCT user_id) AS unique_users
FROM \${TABLES.credit_line_increased}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
GROUP BY week_start
ORDER BY week_start`;

const SQL_CLI_BY_TYPE = `SELECT
  COALESCE(credit_line_update_type, 'unknown') AS credit_line_update_type,
  COUNT(*) AS cli_count,
  ROUND(AVG(SAFE_CAST(credit_line_change AS FLOAT64)), 0) AS avg_credit_line_change,
  COUNT(DISTINCT user_id) AS unique_users
FROM \${TABLES.credit_line_increased}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
GROUP BY credit_line_update_type
ORDER BY cli_count DESC`;

const SQL_ACTIVE_EXPERIMENTS = `SELECT
  experiment_id,
  variant_id,
  COUNT(DISTINCT user_id) AS user_count,
  COUNT(*) AS total_exposures
FROM \${TABLES.experiment_viewed}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
GROUP BY experiment_id, variant_id
HAVING COUNT(DISTINCT user_id) > 100
ORDER BY total_exposures DESC`;

const SQL_EXPERIMENT_EXPOSURE_TREND = `SELECT
  FORMAT_DATE('%Y-%m-%d', DATE(timestamp, 'Asia/Jakarta')) AS date,
  COUNT(*) AS exposures
FROM \${TABLES.experiment_viewed}
WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
GROUP BY date
ORDER BY date`;

const SQL_CHANNEL_VOLUME = `WITH applications AS (
  SELECT
    COALESCE(NULLIF(context_traits_first_utm_source, ''), 'organic') AS utm_source,
    user_id
  FROM \${TABLES.milestone_complete}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    AND application_status = 'Application started'
  GROUP BY utm_source, user_id
),
decisions AS (
  SELECT user_id
  FROM \${TABLES.decision_completed}
  WHERE decision = 'APPROVED'
    AND DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
)
SELECT
  a.utm_source,
  COUNT(DISTINCT a.user_id) AS applications,
  COUNT(DISTINCT d.user_id) AS approvals,
  ROUND(SAFE_DIVIDE(COUNT(DISTINCT d.user_id), COUNT(DISTINCT a.user_id)) * 100, 2) AS approval_rate
FROM applications a
LEFT JOIN decisions d ON a.user_id = d.user_id
GROUP BY a.utm_source
ORDER BY applications DESC`;

const SQL_CHANNEL_DELINQUENCY = `WITH channel_users AS (
  SELECT
    COALESCE(NULLIF(context_traits_first_utm_source, ''), 'organic') AS utm_source,
    user_id
  FROM \${TABLES.milestone_complete}
  WHERE DATE(timestamp, 'Asia/Jakarta') BETWEEN @startDate AND @endDate
    AND application_status = 'Application started'
  GROUP BY utm_source, user_id
),
approved_users AS (
  SELECT cu.utm_source, cu.user_id, d.credit_line
  FROM channel_users cu
  INNER JOIN \${TABLES.decision_completed} d
    ON cu.user_id = d.user_id AND d.decision = 'APPROVED'
),
delinquent AS (
  SELECT au.utm_source, au.user_id
  FROM approved_users au
  INNER JOIN \${TABLES.cms_line_of_credit} cloc ON au.user_id = cloc.user_id
  INNER JOIN \${TABLES.financial_account_updates} fau
    ON cloc.account_number = fau.account_number
  WHERE SAFE_CAST(fau.days_past_due AS INT64) >= 30
  GROUP BY au.utm_source, au.user_id
)
SELECT
  au.utm_source,
  COUNT(DISTINCT au.user_id) AS total_approved,
  COUNT(DISTINCT del.user_id) AS dpd_30_plus,
  ROUND(SAFE_DIVIDE(COUNT(DISTINCT del.user_id), COUNT(DISTINCT au.user_id)) * 100, 2) AS dpd_rate
FROM approved_users au
LEFT JOIN delinquent del
  ON au.utm_source = del.utm_source AND au.user_id = del.user_id
GROUP BY au.utm_source
ORDER BY total_approved DESC`;

// ==========================================================================
// All metric definitions
// ==========================================================================

const ALL_METRICS: MetricDef[] = [
  // --- Executive ---
  { key: "eligible_count", label: "Eligible Accounts", unit: "count", section: "Executive", queryFn: "getEligibleAndTransactors", description: "Accounts eligible to spend on last day of period. Requires: account status G or N, DPD = 0 (current), card unblocked (videocall verified + all txn channels enabled).", sql: SQL_ELIGIBLE_AND_TRANSACTORS, higherIsBetter: true },
  { key: "transactor_count", label: "Transactors", unit: "count", section: "Executive", queryFn: "getEligibleAndTransactors", description: "Number of eligible accounts with at least one valid authorized transaction", sql: SQL_ELIGIBLE_AND_TRANSACTORS, higherIsBetter: true },
  { key: "spend_active_rate", label: "Spend Active Rate", unit: "percent", section: "Executive", queryFn: "getEligibleAndTransactors", description: "Percentage of eligible accounts that transacted (transactors / eligible)", sql: SQL_ELIGIBLE_AND_TRANSACTORS, target: 60, warningThreshold: 50, dangerThreshold: 40, higherIsBetter: true },
  { key: "total_spend", label: "Total Spend", unit: "idr", section: "Executive", queryFn: "getSpendMetrics", description: "Total authorized spend amount in IDR across all valid transactions", sql: SQL_SPEND_METRICS, higherIsBetter: true },
  { key: "avg_spend_per_txn", label: "Avg Spend per Txn", unit: "idr", section: "Executive", queryFn: "getSpendMetrics", description: "Average transaction amount in IDR (total spend / total transactions)", sql: SQL_SPEND_METRICS, higherIsBetter: true },
  { key: "new_customer_activation_rate", label: "New Customer Activation Rate", unit: "percent", section: "Executive", queryFn: "getNewCustomerActivationRate", description: "Percentage of newly approved customers who transacted within 7 days", sql: SQL_NEW_CUSTOMER_ACTIVATION, target: 52, warningThreshold: 45, dangerThreshold: 35, higherIsBetter: true },
  { key: "approval_rate", label: "Approval Rate", unit: "percent", section: "Executive", queryFn: "getDecisionFunnel", description: "Percentage of credit decisions that resulted in approval", sql: SQL_DECISION_FUNNEL, target: 40, warningThreshold: 30, dangerThreshold: 20, higherIsBetter: true },
  { key: "total_applications", label: "Total Applications", unit: "count", section: "Executive", queryFn: "getDecisionFunnel", description: "Total number of credit decisions processed", sql: SQL_DECISION_FUNNEL, higherIsBetter: true },

  // --- Spend ---
  { key: "total_spend", label: "Total Spend", unit: "idr", section: "Spend", queryFn: "getSpendMetrics", description: "Total authorized spend amount in IDR", sql: SQL_SPEND_METRICS, higherIsBetter: true },
  { key: "avg_spend_idr", label: "Avg Spend (IDR)", unit: "idr", section: "Spend", queryFn: "getSpendMetrics", description: "Average transaction amount in IDR", sql: SQL_SPEND_METRICS, higherIsBetter: true },
  { key: "avg_spend_online", label: "Avg Spend Online", unit: "idr", section: "Spend", queryFn: "getSpendMetrics", description: "Average online (e-commerce) transaction amount in IDR", sql: SQL_SPEND_METRICS, higherIsBetter: true },
  { key: "avg_spend_offline", label: "Avg Spend Offline", unit: "idr", section: "Spend", queryFn: "getSpendMetrics", description: "Average offline (POS/tap) transaction amount in IDR", sql: SQL_SPEND_METRICS, higherIsBetter: true },
  { key: "avg_spend_qris", label: "Avg Spend QRIS", unit: "idr", section: "Spend", queryFn: "getSpendMetrics", description: "Average QRIS transaction amount in IDR", sql: SQL_SPEND_METRICS, higherIsBetter: true },
  { key: "total_txn_count", label: "Total Transactions", unit: "count", section: "Spend", queryFn: "getSpendMetrics", description: "Total number of valid authorized transactions", sql: SQL_SPEND_METRICS, higherIsBetter: true },
  { key: "txn_per_eligible_user", label: "Txn per Eligible User", unit: "count", section: "Spend", queryFn: "getEligibleAndTransactors", description: "Average number of transactions per eligible account", sql: SQL_ELIGIBLE_AND_TRANSACTORS, higherIsBetter: true },

  // --- Risk ---
  { key: "current_dpd_0", label: "Current (DPD 0)", unit: "count", section: "Risk", queryFn: "getPortfolioSnapshot", description: "Number of accounts with 0 days past due (current/healthy)", sql: SQL_PORTFOLIO_DPD, higherIsBetter: true },
  { key: "dpd_1_30", label: "1-30 DPD", unit: "count", section: "Risk", queryFn: "getPortfolioSnapshot", description: "Number of accounts 1-30 days past due (early delinquency)", sql: SQL_PORTFOLIO_DPD, warningThreshold: 200, dangerThreshold: 350, higherIsBetter: false },
  { key: "dpd_31_60", label: "31-60 DPD", unit: "count", section: "Risk", queryFn: "getPortfolioSnapshot", description: "Number of accounts 31-60 days past due", sql: SQL_PORTFOLIO_DPD, warningThreshold: 100, dangerThreshold: 200, higherIsBetter: false },
  { key: "dpd_61_90", label: "61-90 DPD", unit: "count", section: "Risk", queryFn: "getPortfolioSnapshot", description: "Number of accounts 61-90 days past due", sql: SQL_PORTFOLIO_DPD, warningThreshold: 50, dangerThreshold: 100, higherIsBetter: false },
  { key: "dpd_90_plus", label: "90+ DPD", unit: "count", section: "Risk", queryFn: "getPortfolioSnapshot", description: "Number of accounts 90+ days past due (severe delinquency)", sql: SQL_PORTFOLIO_DPD, warningThreshold: 30, dangerThreshold: 60, higherIsBetter: false },
  { key: "total_delinquent_rate", label: "Total Delinquent Rate", unit: "percent", section: "Risk", queryFn: "getPortfolioSnapshot", description: "Percentage of accounts with DPD > 0 out of total active accounts", sql: SQL_PORTFOLIO_DPD, target: 5, warningThreshold: 8, dangerThreshold: 12, higherIsBetter: false },

  // --- Activation ---
  { key: "activation_rate_7d", label: "7-Day Activation Rate", unit: "percent", section: "Activation", queryFn: "getNewCustomerActivationRate", description: "Percentage of newly approved customers who transacted within 7 days of approval", sql: SQL_NEW_CUSTOMER_ACTIVATION, target: 52, warningThreshold: 45, dangerThreshold: 35, higherIsBetter: true },
  { key: "cards_activated", label: "Cards Activated", unit: "count", section: "Activation", queryFn: "getNewCustomerActivationRate", description: "Number of newly approved customers who made their first transaction within 7 days", sql: SQL_NEW_CUSTOMER_ACTIVATION, higherIsBetter: true },
  { key: "cards_dormant_30d", label: "Dormant 30d+", unit: "count", section: "Activation", queryFn: "getPortfolioSnapshot", description: "Number of active accounts with no transactions in the last 30 days", sql: SQL_PORTFOLIO_SUMMARY, warningThreshold: 500, dangerThreshold: 1000, higherIsBetter: false },
  { key: "avg_days_to_first_txn", label: "Avg Days to First Txn", unit: "count", section: "Activation", queryFn: "getNewCustomerActivationRate", description: "Average number of days from approval to first transaction for activated users", sql: SQL_NEW_CUSTOMER_ACTIVATION, target: 3, warningThreshold: 5, dangerThreshold: 7, higherIsBetter: false },

  // --- Portfolio ---
  { key: "total_active_accounts", label: "Total Active Accounts", unit: "count", section: "Portfolio", queryFn: "getPortfolioSnapshot", description: "Total number of accounts with status G (Good) or N (Normal)", sql: SQL_PORTFOLIO_SUMMARY, higherIsBetter: true },
  { key: "total_credit_limit", label: "Total Credit Limit", unit: "idr", section: "Portfolio", queryFn: "getPortfolioSnapshot", description: "Sum of credit limits across all active accounts", sql: SQL_PORTFOLIO_SUMMARY, higherIsBetter: true },
  { key: "avg_utilization", label: "Avg Utilization", unit: "percent", section: "Portfolio", queryFn: "getPortfolioSnapshot", description: "Average credit utilization across active accounts (balance / limit)", sql: SQL_PORTFOLIO_SUMMARY, target: 60, warningThreshold: 70, dangerThreshold: 80, higherIsBetter: false },
  { key: "new_accounts", label: "New Accounts", unit: "count", section: "Portfolio", queryFn: "getDecisionFunnel", description: "Number of newly approved accounts in the period", sql: SQL_DECISION_FUNNEL, higherIsBetter: true },
  { key: "repayment_total", label: "Total Repayments", unit: "count", section: "Portfolio", queryFn: "getRepaymentMetrics", description: "Total number of repayment transactions", sql: SQL_REPAYMENT_METRICS, higherIsBetter: true },
  { key: "repayment_amount", label: "Total Repayment Amount", unit: "idr", section: "Portfolio", queryFn: "getRepaymentMetrics", description: "Total repayment amount in IDR", sql: SQL_REPAYMENT_METRICS, higherIsBetter: true },

  // --- Transaction Auth ---
  { key: "auth_approval_rate", label: "Auth Approval Rate", unit: "percent", section: "Transaction Auth", queryFn: "getAuthMetrics", description: "Percentage of authorization requests approved (response_code = '00')", sql: SQL_AUTH_METRICS, higherIsBetter: true },
  { key: "total_auths", label: "Total Authorizations", unit: "count", section: "Transaction Auth", queryFn: "getAuthMetrics", description: "Total number of authorization requests processed", sql: SQL_AUTH_METRICS, higherIsBetter: true },
  { key: "avg_ticket_size", label: "Avg Ticket Size", unit: "idr", section: "Transaction Auth", queryFn: "getTicketSizeTrend", description: "Average transaction amount for approved authorizations", sql: SQL_TICKET_SIZE_TREND, higherIsBetter: true },
  { key: "median_ticket_size", label: "Median Ticket Size", unit: "idr", section: "Transaction Auth", queryFn: "getTicketSizeTrend", description: "Median transaction amount for approved authorizations", sql: SQL_TICKET_SIZE_TREND, higherIsBetter: true },
  { key: "channel_mix", label: "Channel Mix", unit: "count", section: "Transaction Auth", queryFn: "getChannelMix", description: "Transaction count and volume by channel (online, POS, QRIS, etc.)", sql: SQL_CHANNEL_MIX, higherIsBetter: true },
  { key: "top_merchants", label: "Top Merchants", unit: "count", section: "Transaction Auth", queryFn: "getTopMerchants", description: "Top 20 merchants by transaction count (approved only)", sql: SQL_TOP_MERCHANTS, higherIsBetter: true },

  // --- App Health ---
  { key: "dau", label: "DAU (Daily Active Users)", unit: "count", section: "App Health", queryFn: "getActiveUsers", description: "Average distinct users per day who opened the app (application_opened event)", sql: SQL_ACTIVE_USERS, higherIsBetter: true },
  { key: "wau", label: "WAU (Weekly Active Users)", unit: "count", section: "App Health", queryFn: "getActiveUsers", description: "Distinct users who opened the app at least once in the week", sql: SQL_ACTIVE_USERS, higherIsBetter: true },
  { key: "mau", label: "MAU (Monthly Active Users)", unit: "count", section: "App Health", queryFn: "getActiveUsers", description: "Distinct users who opened the app in the trailing 28 days", sql: SQL_ACTIVE_USERS, higherIsBetter: true },
  { key: "dau_mau_ratio", label: "DAU/MAU Ratio", unit: "percent", section: "App Health", queryFn: "getActiveUsers", description: "Stickiness ratio: DAU divided by MAU, indicates daily engagement", sql: SQL_ACTIVE_USERS, higherIsBetter: true },
  { key: "total_sessions", label: "Total Sessions", unit: "count", section: "App Health", queryFn: "getSessionMetrics", description: "Total number of distinct user sessions per week", sql: SQL_SESSION_METRICS, higherIsBetter: true },
  { key: "avg_session_duration", label: "Avg Session Duration", unit: "count", section: "App Health", queryFn: "getSessionMetrics", description: "Average session duration in seconds", sql: SQL_SESSION_METRICS, higherIsBetter: true },
  { key: "error_rate", label: "Error Rate", unit: "percent", section: "App Health", queryFn: "getSessionMetrics", description: "Percentage of sessions encountering error/fail/crash events", sql: SQL_SESSION_METRICS, higherIsBetter: false },
  { key: "top_screens", label: "Top Screens", unit: "count", section: "App Health", queryFn: "getTopScreens", description: "Top 20 screens by view count with unique user counts", sql: SQL_TOP_SCREENS, higherIsBetter: true },

  // --- Referral ---
  { key: "referral_started", label: "Referrals Started", unit: "count", section: "Referral", queryFn: "getReferralFunnel", description: "Number of distinct referred users who started an application", sql: SQL_REFERRAL_FUNNEL, higherIsBetter: true },
  { key: "referral_approved", label: "Referrals Approved", unit: "count", section: "Referral", queryFn: "getReferralFunnel", description: "Number of referred users who were approved", sql: SQL_REFERRAL_FUNNEL, higherIsBetter: true },
  { key: "referral_conversion_rate", label: "Referral Conversion Rate", unit: "percent", section: "Referral", queryFn: "getReferralFunnel", description: "Percentage of started referrals that resulted in approval", sql: SQL_REFERRAL_FUNNEL, higherIsBetter: true },
  { key: "referral_by_channel", label: "Referral by Channel", unit: "count", section: "Referral", queryFn: "getReferralByChannel", description: "Referral volume and conversion broken down by referring source and medium", sql: SQL_REFERRAL_BY_CHANNEL, higherIsBetter: true },

  // --- Credit Line ---
  { key: "cli_count", label: "CLIs Issued", unit: "count", section: "Credit Line", queryFn: "getCLITrend", description: "Total number of credit line increases issued", sql: SQL_CLI_TREND, higherIsBetter: true },
  { key: "avg_credit_line_change", label: "Avg CLI Increase", unit: "idr", section: "Credit Line", queryFn: "getCLITrend", description: "Average credit line change amount in IDR", sql: SQL_CLI_TREND, higherIsBetter: true },
  { key: "cli_unique_users", label: "CLI Unique Users", unit: "count", section: "Credit Line", queryFn: "getCLITrend", description: "Number of distinct users receiving a CLI", sql: SQL_CLI_TREND, higherIsBetter: true },
  { key: "cli_by_type", label: "CLI by Type", unit: "count", section: "Credit Line", queryFn: "getCLIByType", description: "CLI count and average change broken down by update type (auto vs manual)", sql: SQL_CLI_BY_TYPE, higherIsBetter: true },

  // --- A/B Tests ---
  { key: "active_experiments", label: "Active Experiments", unit: "count", section: "A/B Tests", queryFn: "getActiveExperiments", description: "Experiments with >100 unique users, by variant", sql: SQL_ACTIVE_EXPERIMENTS, higherIsBetter: true },
  { key: "experiment_exposures", label: "Daily Exposures", unit: "count", section: "A/B Tests", queryFn: "getExperimentExposureTrend", description: "Daily total experiment exposure events", sql: SQL_EXPERIMENT_EXPOSURE_TREND, higherIsBetter: true },

  // --- Channel Quality ---
  { key: "channel_applications", label: "Applications by Channel", unit: "count", section: "Channel Quality", queryFn: "getChannelVolumeAndApproval", description: "Application and approval count per UTM source channel", sql: SQL_CHANNEL_VOLUME, higherIsBetter: true },
  { key: "channel_approval_rate", label: "Approval Rate by Channel", unit: "percent", section: "Channel Quality", queryFn: "getChannelVolumeAndApproval", description: "Approval rate per UTM source channel", sql: SQL_CHANNEL_VOLUME, higherIsBetter: true },
  { key: "channel_dpd_rate", label: "DPD Rate by Channel", unit: "percent", section: "Channel Quality", queryFn: "getChannelDelinquency", description: "30+ DPD rate per UTM source channel for approved users", sql: SQL_CHANNEL_DELINQUENCY, higherIsBetter: false },
];

// ==========================================================================
// Section ordering
// ==========================================================================

const SECTION_ORDER = [
  "Executive",
  "Spend",
  "Risk",
  "Activation",
  "Portfolio",
  "Transaction Auth",
  "App Health",
  "Referral",
  "Credit Line",
  "A/B Tests",
  "Channel Quality",
];

// ==========================================================================
// SQL syntax highlighting helpers
// ==========================================================================

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "AND", "OR", "ON", "AS", "JOIN", "LEFT",
  "INNER", "RIGHT", "OUTER", "CROSS", "GROUP", "BY", "ORDER", "HAVING",
  "LIMIT", "OFFSET", "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX",
  "ROUND", "SAFE_DIVIDE", "SAFE_CAST", "COALESCE", "NULLIF", "TRIM",
  "CASE", "WHEN", "THEN", "ELSE", "END", "IN", "NOT", "IS", "NULL",
  "BETWEEN", "LIKE", "TRUE", "FALSE", "WITH", "COUNTIF", "EXTRACT",
  "DATE_TRUNC", "DATE", "DATE_ADD", "DATE_SUB", "FORMAT_DATE",
  "INTERVAL", "DAY", "ISOWEEK", "DAYOFWEEK", "CURRENT_DATE",
  "TIMESTAMP_DIFF", "SECOND", "APPROX_QUANTILES", "ARRAY_AGG",
  "STRUCT", "PARTITION", "OVER", "ROW_NUMBER", "CAST", "STRING",
  "FLOAT64", "INT64", "ASC", "DESC", "CONCAT",
]);

function highlightSql(sql: string): React.JSX.Element[] {
  const lines = sql.split("\n");
  return lines.map((line, lineIdx) => {
    const parts: React.JSX.Element[] = [];
    // Tokenize by word boundaries, preserving whitespace and punctuation
    const tokens = line.split(/(\b\w+\b|[^a-zA-Z0-9_]+)/g);
    tokens.forEach((token, i) => {
      const upper = token.toUpperCase();
      if (SQL_KEYWORDS.has(upper)) {
        parts.push(
          <span key={`${lineIdx}-${i}`} className="text-[var(--sql-keyword)]">
            {token}
          </span>
        );
      } else if (/^@\w+/.test(token)) {
        parts.push(
          <span key={`${lineIdx}-${i}`} className="text-[var(--sql-param)]">
            {token}
          </span>
        );
      } else if (/^'\w+'$/.test(token) || /^'[^']*'$/.test(token)) {
        parts.push(
          <span key={`${lineIdx}-${i}`} className="text-[var(--sql-string)]">
            {token}
          </span>
        );
      } else if (/^\$\{TABLES\.\w+\}$/.test(token)) {
        parts.push(
          <span key={`${lineIdx}-${i}`} className="text-[var(--sql-table)]">
            {token}
          </span>
        );
      } else {
        parts.push(<span key={`${lineIdx}-${i}`}>{token}</span>);
      }
    });
    return (
      <span key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 ? "\n" : ""}
      </span>
    );
  });
}

// ==========================================================================
// Metric Card component
// ==========================================================================

function MetricDefCard({
  metric,
  isExpanded,
  onToggle,
  isDark,
}: {
  metric: MetricDef;
  isExpanded: boolean;
  onToggle: () => void;
  isDark: boolean;
}) {
  const unitBadgeColor =
    metric.unit === "percent"
      ? isDark
        ? "bg-blue-900/40 text-blue-300"
        : "bg-blue-100 text-blue-700"
      : metric.unit === "idr"
      ? isDark
        ? "bg-emerald-900/40 text-emerald-300"
        : "bg-emerald-100 text-emerald-700"
      : metric.unit === "usd"
      ? isDark
        ? "bg-amber-900/40 text-amber-300"
        : "bg-amber-100 text-amber-700"
      : isDark
      ? "bg-gray-800 text-gray-300"
      : "bg-gray-100 text-gray-700";

  return (
    <div
      className={cn(
        "rounded-lg border transition-colors",
        isDark
          ? "border-[var(--border)] bg-[var(--surface)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      )}
    >
      {/* Header row — always visible */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <code
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-mono",
            isDark
              ? "bg-[var(--surface-elevated)] text-[#7C4DFF]"
              : "bg-[var(--surface-elevated)] text-[#D00083]"
          )}
        >
          {metric.key}
        </code>
        <span className="text-sm font-medium text-[var(--text-primary)] flex-1 min-w-0 truncate">
          {metric.label}
        </span>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", unitBadgeColor)}>
          {metric.unit}
        </span>
        {metric.target !== undefined && (
          <span
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
              isDark ? "bg-yellow-900/30 text-yellow-300" : "bg-yellow-100 text-yellow-700"
            )}
          >
            Target: {metric.target}{metric.unit === "percent" ? "%" : ""}
          </span>
        )}
        <span
          className={cn(
            "shrink-0 text-[10px]",
            metric.higherIsBetter
              ? "text-emerald-500"
              : "text-red-400"
          )}
        >
          {metric.higherIsBetter ? "\u2191 higher is better" : "\u2193 lower is better"}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div
          className={cn(
            "border-t px-4 py-3 space-y-3",
            isDark ? "border-[var(--border)]" : "border-[var(--border)]"
          )}
        >
          {/* Description */}
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {metric.description}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-3 text-[11px]">
            <div>
              <span className="text-[var(--text-muted)]">Section: </span>
              <span className="font-medium text-[var(--text-primary)]">{metric.section}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)]">Query: </span>
              <code className={cn("font-mono", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")}>
                {metric.queryFn}()
              </code>
            </div>
            {metric.warningThreshold !== undefined && (
              <div>
                <span className="text-[var(--text-muted)]">Warning: </span>
                <span className="text-yellow-500 font-medium">
                  {metric.warningThreshold}{metric.unit === "percent" ? "%" : ""}
                </span>
              </div>
            )}
            {metric.dangerThreshold !== undefined && (
              <div>
                <span className="text-[var(--text-muted)]">Danger: </span>
                <span className="text-red-400 font-medium">
                  {metric.dangerThreshold}{metric.unit === "percent" ? "%" : ""}
                </span>
              </div>
            )}
          </div>

          {/* SQL block */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-1">
              SQL Query
            </p>
            <pre
              className={cn(
                "overflow-x-auto rounded-md p-3 text-[11px] leading-[1.6] font-mono",
                isDark
                  ? "bg-[#1a1625] text-[var(--text-secondary)]"
                  : "bg-[#faf5ff] text-[var(--text-secondary)]"
              )}
            >
              <code>{highlightSql(metric.sql)}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================================================
// Main page
// ==========================================================================

export default function MetricsDefinitionsPage() {
  const { isDark } = useTheme();
  const tNav = useTranslations("nav");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Derive unique identifier for each metric (key + section) to handle duplicates
  const metricId = (m: MetricDef) => `${m.section}::${m.key}`;

  const filteredMetrics = useMemo(() => {
    let results = ALL_METRICS;

    // Section filter
    if (activeSection) {
      results = results.filter((m) => m.section === activeSection);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (m) =>
          m.key.toLowerCase().includes(q) ||
          m.label.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.queryFn.toLowerCase().includes(q)
      );
    }

    return results;
  }, [searchQuery, activeSection]);

  // Group by section
  const groupedMetrics = useMemo(() => {
    const groups: { section: string; metrics: MetricDef[] }[] = [];
    const sectionMap = new Map<string, MetricDef[]>();

    for (const m of filteredMetrics) {
      if (!sectionMap.has(m.section)) {
        sectionMap.set(m.section, []);
      }
      sectionMap.get(m.section)!.push(m);
    }

    for (const section of SECTION_ORDER) {
      const metrics = sectionMap.get(section);
      if (metrics && metrics.length > 0) {
        groups.push({ section, metrics });
      }
    }

    return groups;
  }, [filteredMetrics]);

  const toggleExpanded = (id: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedKeys(new Set(filteredMetrics.map(metricId)));
  };

  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  return (
    <>
      <Header title={tNav("definitions")} />

      <style jsx global>{`
        :root {
          --sql-keyword: #d946ef;
          --sql-param: #f59e0b;
          --sql-string: #22c55e;
          --sql-table: #3b82f6;
        }
        .dark {
          --sql-keyword: #c084fc;
          --sql-param: #fbbf24;
          --sql-string: #4ade80;
          --sql-table: #60a5fa;
        }
      `}</style>

      <div className="p-4 space-y-4">
        {/* Search + controls bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 flex-1 min-w-[240px] max-w-md",
              isDark
                ? "border-[var(--border)] bg-[var(--surface)]"
                : "border-[var(--border)] bg-[var(--surface)]"
            )}
          >
            <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by key, label, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]",
                "text-[var(--text-primary)]"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <span className="text-xs">&times;</span>
              </button>
            )}
          </div>

          <button
            onClick={expandAll}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
              isDark
                ? "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
            )}
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors",
              isDark
                ? "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                : "border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
            )}
          >
            Collapse All
          </button>

          <span className="text-[11px] text-[var(--text-muted)]">
            {filteredMetrics.length} metric{filteredMetrics.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Section filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveSection(null)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
              activeSection === null
                ? isDark
                  ? "bg-[#5B22FF] text-white"
                  : "bg-[#D00083] text-white"
                : isDark
                ? "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                : "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            )}
          >
            All
          </button>
          {SECTION_ORDER.map((section) => (
            <button
              key={section}
              onClick={() => setActiveSection(activeSection === section ? null : section)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium transition-colors",
                activeSection === section
                  ? isDark
                    ? "bg-[#5B22FF] text-white"
                    : "bg-[#D00083] text-white"
                  : isDark
                  ? "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  : "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              {section}
            </button>
          ))}
        </div>

        {/* Metric cards grouped by section */}
        {groupedMetrics.map((group) => (
          <div key={group.section} className="space-y-2">
            <h2
              className={cn(
                "text-xs font-bold uppercase tracking-wider pt-2",
                isDark ? "text-[#7C4DFF]" : "text-[#D00083]"
              )}
            >
              {group.section}
              <span className="ml-2 text-[var(--text-muted)] font-normal normal-case tracking-normal">
                ({group.metrics.length})
              </span>
            </h2>
            <div className="space-y-1.5">
              {group.metrics.map((m) => {
                const id = metricId(m);
                return (
                  <MetricDefCard
                    key={id}
                    metric={m}
                    isExpanded={expandedKeys.has(id)}
                    onToggle={() => toggleExpanded(id)}
                    isDark={isDark}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {filteredMetrics.length === 0 && (
          <div className="flex items-center justify-center py-16 text-sm text-[var(--text-muted)]">
            No metrics match your search.
          </div>
        )}
      </div>
    </>
  );
}
