#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// PDF Report Generator — orchestrator
// Generates PDF reports for all 19 report pages across 3 languages and 2 currencies.
// Usage: npx tsx scripts/generate-pdfs.ts [--cycle weekly] [--date YYYY-MM-DD]
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import {
  REPORT_MANIFEST,
  type ChartDef,
  type ReportDef,
} from "../src/config/pdf-report-manifest";
import {
  getLastFullWeek,
  getPreviousWeek,
  fetchWithPrevPeriod,
  clearCache,
} from "./pdf/data-fetcher";
import { renderLineChart, renderBarChart } from "./pdf/chart-renderer";
import {
  buildPdf,
  type KpiItem,
  type ChartImage,
  type TableData,
} from "./pdf/pdf-layout";
import { generateInsights } from "./pdf/insights-generator";

// ---------------------------------------------------------------------------
// QRIS experiment special handling
// ---------------------------------------------------------------------------

/** Build KPIs from QRIS experiment test-vs-control data */
function buildQrisKpis(
  apiData: Record<string, unknown>,
  messages: Record<string, unknown>,
  currency: "IDR" | "USD",
): KpiItem[] {
  const cohort = apiData.cohortComparison as Record<string, unknown>[] | undefined;
  if (!Array.isArray(cohort)) return [];

  const test = cohort.find((r) => String(r.grp).toLowerCase().includes("test")) as Record<string, number> | undefined;
  const control = cohort.find((r) => String(r.grp).toLowerCase().includes("control")) as Record<string, number> | undefined;
  if (!test) return [];

  const kpis: KpiItem[] = [];

  // Test cohort size
  kpis.push({
    label: resolveI18n(messages, "pdf.metrics.testCohortSize"),
    value: test.cohort_size ?? test.users ?? 0,
    unit: "count",
    change: null,
  });

  // Control cohort size
  if (control) {
    kpis.push({
      label: resolveI18n(messages, "pdf.metrics.controlCohortSize"),
      value: control.cohort_size ?? control.users ?? 0,
      unit: "count",
      change: null,
    });
  }

  // SAR
  if (test.spend_active_rate != null) {
    const testSar = test.spend_active_rate;
    const controlSar = control?.spend_active_rate ?? 0;
    kpis.push({
      label: "SAR (Test)",
      value: testSar,
      unit: "percent",
      change: controlSar > 0 ? ((testSar - controlSar) / controlSar * 100) : null,
    });
  }

  // Total Spend
  const testSpend = test.total_spend_idr ?? 0;
  const controlSpend = control?.total_spend_idr ?? 0;
  if (testSpend > 0) {
    kpis.push({
      label: "Total Spend (Test)",
      value: testSpend,
      unit: "currency",
      change: controlSpend > 0 ? ((testSpend - controlSpend) / controlSpend * 100) : null,
    });
  }

  // Total Transactions
  const testTxns = test.total_transactions ?? 0;
  const controlTxns = control?.total_transactions ?? 0;
  if (testTxns > 0) {
    kpis.push({
      label: "Transactions (Test)",
      value: testTxns,
      unit: "count",
      change: controlTxns > 0 ? ((testTxns - controlTxns) / controlTxns * 100) : null,
    });
  }

  return kpis;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const LANGUAGES = ["en", "id", "ja"] as const;
const CURRENCIES = ["IDR", "USD"] as const;
const OUTPUT_DIR = path.resolve(process.cwd(), "pdf_reports");
const IDR_USD_RATE = 16_000;

// ---------------------------------------------------------------------------
// Args parsing
// ---------------------------------------------------------------------------
function parseArgs(): { cycle: string; date?: string } {
  const args = process.argv.slice(2);
  let cycle = "weekly";
  let date: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--cycle" && args[i + 1]) {
      cycle = args[i + 1];
      i++;
    } else if (args[i] === "--date" && args[i + 1]) {
      date = args[i + 1];
      i++;
    }
  }
  return { cycle, date };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate a dot-separated path into an object */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    // Handle array indices like "kpis.0.value"
    const idx = Number(p);
    if (!isNaN(idx) && Array.isArray(cur)) {
      cur = cur[idx];
    } else {
      cur = (cur as Record<string, unknown>)[p];
    }
  }
  return cur;
}

/** Get a data array from the API response using the chart's dataKey */
function getDataArray(
  response: Record<string, unknown>,
  dataKey: string,
): Record<string, unknown>[] {
  const val = getByPath(response, dataKey);
  if (Array.isArray(val)) return val as Record<string, unknown>[];
  return [];
}

/** Build table from data array */
function buildTableData(
  data: Record<string, unknown>[],
  title: string,
  xAxisKey: string,
): TableData | null {
  if (data.length === 0) return null;

  const sample = data[0];
  const allKeys = Object.keys(sample);
  const headers = allKeys;
  const rows = data.map((row) =>
    allKeys.map((k) => {
      const v = row[k];
      if (v == null) return "—";
      if (typeof v === "number") {
        if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
        if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
        if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
        return v.toLocaleString();
      }
      return String(v);
    }),
  );

  return { title, headers, rows };
}

/** Load i18n message and resolve a dot path */
function loadMessages(lang: string): Record<string, unknown> {
  const msgPath = path.resolve(
    process.cwd(),
    "messages",
    `${lang}.json`,
  );
  if (fs.existsSync(msgPath)) {
    return JSON.parse(fs.readFileSync(msgPath, "utf-8"));
  }
  return {};
}

function resolveI18n(
  messages: Record<string, unknown>,
  key: string,
): string {
  const val = getByPath(messages, key);
  return typeof val === "string" ? val : key.split(".").pop() ?? key;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const { cycle, date } = parseArgs();
  const refDate = date ? new Date(date + "T12:00:00Z") : undefined;
  const current = getLastFullWeek(refDate);
  const previous = getPreviousWeek(refDate);

  console.log(`\n=== Honest PDF Report Generator ===`);
  console.log(`Cycle:    ${cycle}`);
  console.log(`Period:   ${current.start} to ${current.end}`);
  console.log(`Previous: ${previous.start} to ${previous.end}`);
  console.log(`Output:   ${OUTPUT_DIR}\n`);

  // Ensure output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Load i18n messages for all languages
  const messagesMap = new Map<string, Record<string, unknown>>();
  for (const lang of LANGUAGES) {
    messagesMap.set(lang, loadMessages(lang));
  }

  let totalFiles = 0;
  let errorCount = 0;

  for (const report of REPORT_MANIFEST) {
    console.log(`\n--- ${report.id} ---`);

    // Fetch data (cached, serves all lang/currency variants)
    let apiData: {
      current: Record<string, unknown>;
      previous: Record<string, unknown>;
    };
    try {
      apiData = await fetchWithPrevPeriod(
        report.apiEndpoint,
        current,
        previous,
        cycle,
      );
      console.log(`  Fetched data from ${report.apiEndpoint}`);
    } catch (err) {
      console.error(`  ERROR fetching ${report.apiEndpoint}:`, err);
      errorCount++;
      continue;
    }

    for (const lang of LANGUAGES) {
      for (const currency of CURRENCIES) {
        try {
          const messages = messagesMap.get(lang)!;
          const reportTitle = resolveI18n(messages, report.titleKey);

          // Build KPIs — special handling for QRIS experiment
          let kpis: KpiItem[];
          if (report.id === "qris-experiment") {
            kpis = buildQrisKpis(apiData.current, messages, currency);
          } else {
            kpis = report.metrics.map((m) => {
              const rawValue = Number(getByPath(apiData.current, m.dataPath) ?? 0);
              return {
                label: resolveI18n(messages, m.labelKey),
                value: rawValue,
                unit: m.unit,
                change: null, // computed from prev period KPIs if available
              };
            });
          }

          // For dashboard KPIs, extract change from the KPI objects themselves
          if (report.id === "dashboard" && Array.isArray(apiData.current.kpis)) {
            const apiKpis = apiData.current.kpis as {
              value: number;
              changePercent: number | null;
              label: string;
              unit: string;
            }[];
            for (let i = 0; i < Math.min(kpis.length, apiKpis.length); i++) {
              kpis[i].change = apiKpis[i].changePercent;
            }
          }

          // Generate insights
          const insights = generateInsights(
            report.id,
            apiData.current,
            apiData.previous,
            lang as "en" | "id" | "ja",
            currency,
          );

          // Render charts
          const chartImages: ChartImage[] = [];
          const tables: TableData[] = [];

          for (const chartDef of report.charts) {
            let data = getDataArray(apiData.current, chartDef.dataKey);
            if (data.length === 0) continue;

            // Limit top QRIS merchants to 25 rows
            if (chartDef.id === "qris-top-merchants") {
              data = data.slice(0, 25);
            }

            if (chartDef.type === "table") {
              const tableTitle = resolveI18n(messages, chartDef.titleKey);
              const table = buildTableData(data, tableTitle, chartDef.xAxisKey);
              if (table) tables.push(table);
              continue;
            }

            const chartTitle = resolveI18n(messages, chartDef.titleKey);

            try {
              let pngBuffer: Buffer;
              if (chartDef.type === "line") {
                const prevData = chartDef.showPrevPeriod
                  ? getDataArray(apiData.previous, chartDef.dataKey)
                  : undefined;
                pngBuffer = await renderLineChart({
                  data,
                  prevData,
                  config: chartDef,
                  locale: lang,
                  currency,
                });
              } else {
                pngBuffer = await renderBarChart({
                  data,
                  config: chartDef,
                  locale: lang,
                  currency,
                });
              }

              chartImages.push({ title: chartTitle, pngBuffer });
            } catch (chartErr) {
              console.error(
                `  WARNING: Chart ${chartDef.id} failed:`,
                chartErr,
              );
            }
          }

          // Build PDF
          const pdfBuffer = buildPdf({
            reportTitle,
            periodStart: current.start,
            periodEnd: current.end,
            cycle,
            locale: lang,
            currency,
            kpis,
            insights,
            charts: chartImages,
            tables,
          });

          // Save
          const filename = `${current.end}_${report.id}_${currency}_${lang}.pdf`;
          const filepath = path.join(OUTPUT_DIR, filename);
          fs.writeFileSync(filepath, pdfBuffer);
          console.log(`  ✓ ${filename} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);
          totalFiles++;
        } catch (err) {
          console.error(
            `  ERROR building ${report.id}/${lang}/${currency}:`,
            err,
          );
          errorCount++;
        }
      }
    }
  }

  // Clear caches
  clearCache();

  console.log(`\n=== Summary ===`);
  console.log(`Generated: ${totalFiles} PDF files`);
  console.log(`Errors:    ${errorCount}`);
  console.log(`Output:    ${OUTPUT_DIR}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
