/**
 * Merchant Category Code (MCC) lookup utilities.
 *
 * Data sourced from Oleksios/Merchant-Category-Codes (GitHub) with
 * Indonesian translations for high-frequency codes used in Indonesian
 * credit card transactions, plus Japanese translations for top MCCs.
 *
 * Field mapping: f9_dw007_mcc (Finexus Cardworks DW007) → MCC code
 *
 * Usage:
 *   import { getMcc, getMccDescription, getMccGroup } from "@/data/mcc-lookup";
 *   const desc = getMccDescription("5812", "id");  // "Restoran"
 *   const desc = getMccDescription("5812", "ja");  // "レストラン"
 *   const desc = getMccDescription("5812", "en");  // "Restaurants"
 */

import mccData from "./mcc-codes.json";

export type MccLang = "id" | "en" | "ja";

export interface MccEntry {
  mcc: string;
  group_code: string;
  group_en: string;
  group_id: string;
  group_ja: string;
  description_en: string;
  description_full_en: string;
  description_id: string;
  description_ja: string;
}

// Build lookup map for O(1) access
const mccMap = new Map<string, MccEntry>();
for (const entry of mccData as MccEntry[]) {
  mccMap.set(entry.mcc, entry);
  // Also index without leading zeros (e.g., "742" → "0742")
  const stripped = entry.mcc.replace(/^0+/, "");
  if (stripped !== entry.mcc) {
    mccMap.set(stripped, entry);
  }
}

/** Get full MCC entry by code */
export function getMcc(code: string): MccEntry | undefined {
  return mccMap.get(code.padStart(4, "0")) ?? mccMap.get(code);
}

/** Get MCC description in preferred language. Fallback: JA→EN, ID→EN */
export function getMccDescription(code: string, lang: MccLang = "id"): string {
  const entry = getMcc(code);
  if (!entry) return `MCC ${code}`;
  if (lang === "ja" && entry.description_ja) return entry.description_ja;
  if (lang === "id" && entry.description_id) return entry.description_id;
  return entry.description_en;
}

/** Get MCC group/category in preferred language */
export function getMccGroup(code: string, lang: MccLang = "id"): string {
  const entry = getMcc(code);
  if (!entry) return lang === "ja" ? "その他" : "Lainnya";
  if (lang === "ja" && entry.group_ja) return entry.group_ja;
  if (lang === "id") return entry.group_id;
  return entry.group_en;
}

/** Get MCC group code (e.g., "ROS", "MS", "ES") */
export function getMccGroupCode(code: string): string {
  return getMcc(code)?.group_code ?? "NC";
}

/** Get all unique group categories */
export function getMccGroups(lang: MccLang = "id"): { code: string; name: string }[] {
  const seen = new Set<string>();
  const groups: { code: string; name: string }[] = [];
  for (const entry of mccData as MccEntry[]) {
    if (!seen.has(entry.group_code)) {
      seen.add(entry.group_code);
      groups.push({
        code: entry.group_code,
        name: lang === "ja"
          ? ((entry as MccEntry).group_ja || entry.group_en)
          : lang === "id"
            ? entry.group_id
            : entry.group_en,
      });
    }
  }
  return groups;
}

/** Convert app locale to MCC lookup lang */
export function localeToMccLang(locale: string): MccLang {
  if (locale === "ja") return "ja";
  if (locale === "id") return "id";
  return "en";
}

/** Total number of MCC codes */
export const MCC_COUNT = mccMap.size;

/**
 * BigQuery SQL snippet for joining MCC descriptions.
 * Usage: paste this as a CTE or create as a view in BigQuery.
 */
export const MCC_BIGQUERY_SQL = `
-- Create a temporary MCC lookup table in BigQuery
-- Upload mcc-codes.json to GCS or use this inline
CREATE TEMP TABLE mcc_lookup AS
SELECT
  mcc,
  group_code,
  group_en,
  group_id,
  group_ja,
  description_en,
  description_id,
  description_ja
FROM UNNEST([
  -- Top Indonesian credit card MCCs
  STRUCT('5411' AS mcc, 'ROS' AS group_code, 'Retail Outlet Services' AS group_en, 'Layanan Gerai Ritel' AS group_id, '小売店サービス' AS group_ja, 'Grocery Stores, Supermarkets' AS description_en, 'Toko Kelontong & Supermarket' AS description_id, '食料品店・スーパーマーケット' AS description_ja),
  STRUCT('5812', 'MS', 'Miscellaneous Stores', 'Toko Lain-lain', '各種店舗', 'Restaurants', 'Restoran', 'レストラン'),
  STRUCT('5814', 'MS', 'Miscellaneous Stores', 'Toko Lain-lain', '各種店舗', 'Fast Food Restaurants', 'Restoran Cepat Saji', 'ファストフードレストラン'),
  STRUCT('5541', 'CV', 'Cars and vehicles', 'Mobil & Kendaraan', '自動車・車両', 'Service Stations', 'SPBU / Pom Bensin', 'ガソリンスタンド'),
  STRUCT('5912', 'MS', 'Miscellaneous Stores', 'Toko Lain-lain', '各種店舗', 'Drug Stores and Pharmacies', 'Apotek & Toko Obat', '薬局・ドラッグストア'),
  STRUCT('5732', 'MS', 'Miscellaneous Stores', 'Toko Lain-lain', '各種店舗', 'Electronics Stores', 'Toko Elektronik', '家電量販店'),
  STRUCT('4121', 'TS', 'Transportation Services', 'Layanan Transportasi', '運輸サービス', 'Taxicabs and Rideshares', 'Taksi dan Layanan Antar-Jemput', 'タクシー・ライドシェア'),
  STRUCT('5977', 'MS', 'Miscellaneous Stores', 'Toko Lain-lain', '各種店舗', 'Cosmetic Stores', 'Toko Kosmetik', '化粧品店'),
  STRUCT('5311', 'ROS', 'Retail Outlet Services', 'Layanan Gerai Ritel', '小売店サービス', 'Department Stores', 'Department Store', '百貨店'),
  STRUCT('7011', 'HR', 'Hotels / Resorts', 'Hotel & Resor', 'ホテル・リゾート', 'Hotels and Motels', 'Hotel & Motel', 'ホテル・モーテル')
  -- ... full list loaded from mcc-codes.json
]);

-- Example: Join with transaction data
-- SELECT
--   t.*,
--   m.description_id AS merchant_category_id,
--   m.description_en AS merchant_category_en,
--   m.description_ja AS merchant_category_ja,
--   m.group_id AS merchant_group_id
-- FROM \`honest-data-warehouse.cardworks_dw.authorized_transaction\` t
-- LEFT JOIN mcc_lookup m ON CAST(t.f9_dw007_mcc AS STRING) = m.mcc
`;
