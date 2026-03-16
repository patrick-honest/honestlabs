/**
 * Merchant name normalization query.
 *
 * Raw merchant names (fx_dw007_merc_name) are messy — e.g. "GOOGLE*CHROME TEMP",
 * "MCDONALD'S 30401", "DANA QR * Kios Syakir". This 5-step pipeline normalizes them:
 *
 * Step 1: Strip pure serial numbers, collapse whitespace
 * Step 2: Fast prefix match for known brands (Alfamart, Grab, Spotify, etc.)
 * Step 3: Handle non-standard formats (SPBU, Starlink, Google Play Pass, verification holds)
 * Step 4: Gateway extraction (split on *) and strip trailing serial numbers
 * Step 5: Final normalization map + title case fallback
 *
 * Source table: refined_finexus.authorized_transaction (NOT mart_finexus)
 */

import { runQuery } from "@/lib/bigquery";

export interface NormalizedMerchant {
  normalized: string;
  original_frequency: number;
}

export interface MerchantSpend {
  merchant_name: string;
  txn_count: number;
  total_spend_idr: number;
  avg_spend_idr: number;
  unique_customers: number;
}

/**
 * Get top N merchants by transaction count or spend, with normalized names.
 * Uses the 5-step normalization pipeline.
 */
export async function getTopMerchants(
  startDate: string,
  endDate: string,
  limit: number = 20,
  orderBy: "txn_count" | "total_spend" = "txn_count"
): Promise<MerchantSpend[]> {
  const orderCol = orderBy === "txn_count" ? "txn_count" : "total_spend_idr";

  const sql = `
    WITH raw_txns AS (
      SELECT
        fx_dw007_merc_name,
        f9_dw007_mcc,
        fx_dw007_txn_typ,
        fx_dw007_rte_dest,
        F9_DW007_AMT_REQ,
        px_dw007_urn
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\`
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ NOT IN ('PM', 'BE', 'RF')
        AND f9_dw007_ori_amt > 0
    ),
    -- Step 1: Strip pure serial numbers, collapse whitespace
    step1 AS (
      SELECT *,
        CASE
          WHEN REGEXP_CONTAINS(fx_dw007_merc_name, r'^[\\d\\s\\-_/]+$') THEN 'Unknown Merchant'
          ELSE REGEXP_REPLACE(TRIM(fx_dw007_merc_name), r'\\s{2,}', ' ')
        END AS cleaned
      FROM raw_txns
    ),
    -- Step 2: Fast prefix match for known brands
    step2 AS (
      SELECT *,
        CASE
          WHEN cleaned = 'Unknown Merchant' THEN 'Unknown Merchant'
          WHEN REGEXP_CONTAINS(UPPER(cleaned), r'^(ALFAMRT|AIRBNB|CANVA|FACEBK|GRAB|IDM|INDOMARET|METAPAY|NAME-CHEAP\\.COM|OCULUS|SPOTIFY)[ \\*]')
          THEN CASE REGEXP_EXTRACT(UPPER(cleaned), r'^(ALFAMRT|AIRBNB|CANVA|FACEBK|GRAB|IDM|INDOMARET|METAPAY|NAME-CHEAP\\.COM|OCULUS|SPOTIFY)')
            WHEN 'ALFAMRT' THEN 'Alfamart' WHEN 'AIRBNB' THEN 'Airbnb' WHEN 'CANVA' THEN 'Canva'
            WHEN 'FACEBK' THEN 'Facebook' WHEN 'GRAB' THEN 'Grab' WHEN 'IDM' THEN 'Indomaret'
            WHEN 'INDOMARET' THEN 'Indomaret' WHEN 'METAPAY' THEN 'Meta'
            WHEN 'NAME-CHEAP.COM' THEN 'name-cheap.com' WHEN 'OCULUS' THEN 'Oculus' WHEN 'SPOTIFY' THEN 'Spotify'
          END
          ELSE NULL
        END AS prefix_result
      FROM step1
    ),
    -- Step 3: Non-ordinary formats
    step3 AS (
      SELECT *,
        CASE
          WHEN prefix_result IS NOT NULL THEN prefix_result
          WHEN REGEXP_CONTAINS(cleaned, r'SPBU [0-9.]+,[\\w.]+') THEN 'SPBU Pertamina'
          WHEN REGEXP_CONTAINS(cleaned, r'XDT\\*XDT\\*DLO\\*STARLINK-S') THEN 'Starlink'
          WHEN REGEXP_CONTAINS(cleaned, r'GOOGLE\\s*\\*\\s*PLAY PASS') THEN 'Google Play Pass'
          ELSE REGEXP_REPLACE(
            REGEXP_REPLACE(cleaned, r'\\s*\\*\\s*[A-Z]?[0-9-]+', ''),
            r'\\s*\\*\\s*(ANDROID TEMP|CHROME TEMP|PENDING|TEMPORARY HOLD)', ' (Verification)'
          )
        END AS step3_result
      FROM step2
    ),
    -- Step 4: Gateway extraction & serial stripping
    step4 AS (
      SELECT *,
        CASE
          WHEN step3_result IN ('Alfamart','Airbnb','Canva','Facebook','Grab','Indomaret','Meta','Oculus','Spotify','Unknown Merchant','SPBU Pertamina','Starlink','Google Play Pass')
          THEN step3_result
          ELSE TRIM(REGEXP_REPLACE(
            IF(REGEXP_CONTAINS(step3_result, r'\\*'),
              REGEXP_EXTRACT(step3_result, r'^.+\\s*\\*\\s*(.+)'),
              step3_result),
            r'\\s*\\**\\s*[\\d-]{5,}$', ''
          ), ' .')
        END AS step4_result
      FROM step3
    ),
    -- Step 5: Final normalization map + title case fallback
    normalized AS (
      SELECT *,
        COALESCE(
          CASE LOWER(step4_result)
            WHEN 'seven-eleven' THEN '7-Eleven' WHEN '7-eleven' THEN '7-Eleven' WHEN '7eleven' THEN '7-Eleven'
            WHEN 'agoda.com' THEN 'Agoda' WHEN 'gopayid' THEN 'GoPay' WHEN 'gopay-gojek' THEN 'GoPay'
            WHEN 'spotifyid' THEN 'Spotify' WHEN 'starbucks coffee' THEN 'Starbucks'
            WHEN 'py-vcb-starbucks' THEN 'Starbucks' WHEN 'chatgpt subscr' THEN 'ChatGPT'
            WHEN 'subscriptiongrab' THEN 'Grab' WHEN "mcdonald's" THEN "McDonald's"
            WHEN 'mcdonalds' THEN "McDonald's" WHEN "mcdonalds dt" THEN "McDonald's"
            WHEN "mcdonald's dt" THEN "McDonald's" WHEN "kiosk mcd" THEN "McDonald's"
            WHEN 'googleads' THEN 'Google Ads' WHEN 'google google' THEN 'Google'
            WHEN 'google svcsgns' THEN 'Google' WHEN 'google youtube' THEN 'YouTube'
            WHEN 'nintendo cb' THEN 'Nintendo' WHEN 'nintendo cd' THEN 'Nintendo'
            WHEN 'microsoft-g' THEN 'Microsoft' WHEN 'microsoft g' THEN 'Microsoft'
            WHEN 'circle k,bal' THEN 'Circle K' WHEN 'circle k #' THEN 'Circle K'
            WHEN 'bolt.eu/r/' THEN 'Bolt' WHEN 'bolt.eu/o/' THEN 'Bolt'
            WHEN 'linkedinpre' THEN 'LinkedIn' WHEN 'linkedin pre' THEN 'LinkedIn'
            WHEN 'linkedin job' THEN 'LinkedIn' WHEN 'linkedin sn' THEN 'LinkedIn'
            ELSE NULL
          END,
          (SELECT STRING_AGG(
            CASE
              WHEN LENGTH(word) BETWEEN 2 AND 3 AND REGEXP_CONTAINS(word, r'^[A-Z]+$') THEN word
              ELSE CONCAT(UPPER(SUBSTR(word, 1, 1)), LOWER(SUBSTR(word, 2)))
            END, ' ' ORDER BY pos)
          FROM UNNEST(SPLIT(step4_result, ' ')) AS word WITH OFFSET AS pos)
        ) AS merchant_name
      FROM step4
    )
    SELECT
      merchant_name,
      COUNT(*) AS txn_count,
      ROUND(SUM(F9_DW007_AMT_REQ / 100)) AS total_spend_idr,
      ROUND(AVG(F9_DW007_AMT_REQ / 100)) AS avg_spend_idr,
      COUNT(DISTINCT px_dw007_urn) AS unique_customers
    FROM normalized
    WHERE merchant_name != 'Unknown Merchant'
    GROUP BY merchant_name
    ORDER BY ${orderCol} DESC
    LIMIT @limit
  `;

  return runQuery<MerchantSpend>(sql, { startDate, endDate, limit });
}

/**
 * Get top N QRIS-only merchants (txn_typ = 'RA' AND rte_dest = 'L')
 */
export async function getTopQrisMerchants(
  startDate: string,
  endDate: string,
  limit: number = 20
): Promise<MerchantSpend[]> {
  const sql = `
    WITH raw_txns AS (
      SELECT
        fx_dw007_merc_name,
        F9_DW007_AMT_REQ,
        px_dw007_urn
      FROM \`storage-58f5a02c.mart_finexus.authorized_transaction\`
      WHERE f9_dw007_dt BETWEEN @startDate AND @endDate
        AND (fx_dw007_stat IS NULL OR TRIM(fx_dw007_stat) = '' OR fx_dw007_stat = ' ')
        AND fx_dw007_txn_typ = 'RA'
        AND fx_dw007_rte_dest = 'L'
        AND f9_dw007_ori_amt > 0
    ),
    step1 AS (
      SELECT *,
        CASE
          WHEN REGEXP_CONTAINS(fx_dw007_merc_name, r'^[\\d\\s\\-_/]+$') THEN 'Unknown Merchant'
          ELSE REGEXP_REPLACE(TRIM(fx_dw007_merc_name), r'\\s{2,}', ' ')
        END AS cleaned
      FROM raw_txns
    ),
    normalized AS (
      SELECT *,
        COALESCE(
          CASE
            WHEN cleaned = 'Unknown Merchant' THEN 'Unknown Merchant'
            WHEN REGEXP_CONTAINS(UPPER(cleaned), r'^ALFAMRT') THEN 'Alfamart'
            WHEN REGEXP_CONTAINS(UPPER(cleaned), r'^INDOMARET') THEN 'Indomaret'
            WHEN REGEXP_CONTAINS(UPPER(cleaned), r'^IDM') THEN 'Indomaret'
            WHEN REGEXP_CONTAINS(UPPER(cleaned), r'^GRAB') THEN 'Grab'
            WHEN REGEXP_CONTAINS(cleaned, r'SPBU') THEN 'SPBU Pertamina'
            ELSE NULL
          END,
          TRIM(REGEXP_REPLACE(
            IF(REGEXP_CONTAINS(cleaned, r'\\*'),
              REGEXP_EXTRACT(cleaned, r'^.+\\s*\\*\\s*(.+)'),
              cleaned),
            r'\\s*\\**\\s*[\\d-]{5,}$', ''
          ), ' .')
        ) AS merchant_name
      FROM step1
    )
    SELECT
      merchant_name,
      COUNT(*) AS txn_count,
      ROUND(SUM(F9_DW007_AMT_REQ / 100)) AS total_spend_idr,
      ROUND(AVG(F9_DW007_AMT_REQ / 100)) AS avg_spend_idr,
      COUNT(DISTINCT px_dw007_urn) AS unique_customers
    FROM normalized
    WHERE merchant_name != 'Unknown Merchant'
    GROUP BY merchant_name
    ORDER BY txn_count DESC
    LIMIT @limit
  `;

  return runQuery<MerchantSpend>(sql, { startDate, endDate, limit });
}
