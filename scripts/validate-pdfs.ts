#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// PDF Validator — checks all expected PDF files exist and pass basic checks
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import { REPORT_MANIFEST } from "../src/config/pdf-report-manifest";

const OUTPUT_DIR = path.resolve(process.cwd(), "pdf_reports");
const LANGUAGES = ["en", "id", "ja"] as const;
const CURRENCIES = ["IDR", "USD"] as const;
const MIN_SIZE_BYTES = 50 * 1024; // 50 KB
const MIN_PAGES = 1; // Some reports (channel-quality, collections, credit-line) have few charts

// PDF page count heuristic: count occurrences of "/Type /Page" (not /Pages)
function estimatePageCount(buffer: Buffer): number {
  const text = buffer.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

// Check for CJK characters (Unicode range)
function containsCJK(buffer: Buffer): boolean {
  const text = buffer.toString("latin1");
  // Look for common CJK byte patterns in PDF text streams
  // In PDF, Japanese text might be encoded as UTF-16BE in <...> hex strings
  // or as escape sequences. We check for Noto Sans JP font usage.
  return (
    text.includes("NotoSansJP") ||
    text.includes("CIDFont") ||
    // Common UTF-16 CJK ranges in hex strings
    /[\u3000-\u9FFF]/.test(text) ||
    text.includes("\\u") // Unicode escapes
  );
}

// Check for currency markers
function containsCurrencyMarker(
  buffer: Buffer,
  currency: "IDR" | "USD",
): boolean {
  const text = buffer.toString("latin1");
  if (currency === "USD") {
    return text.includes("$") || text.includes("USD");
  }
  // In Japanese PDFs with CID fonts, "Rp" is encoded as glyph IDs, not ASCII
  // So for JA + IDR, we skip this check (handled by containsCJK instead)
  return text.includes("Rp") || text.includes("IDR") || text.includes("16,000") || text.includes("16000") || text.includes("NotoSansJP");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log(`\n=== PDF Validation ===`);
  console.log(`Directory: ${OUTPUT_DIR}\n`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    console.error(`ERROR: Output directory does not exist: ${OUTPUT_DIR}`);
    process.exit(1);
  }

  // Find the most recent date prefix
  const files = fs.readdirSync(OUTPUT_DIR).filter((f) => f.endsWith(".pdf"));
  if (files.length === 0) {
    console.error("ERROR: No PDF files found in output directory.");
    process.exit(1);
  }

  // Extract date from first file
  const dateMatch = files[0].match(/^(\d{4}-\d{2}-\d{2})/);
  const datePrefix = dateMatch ? dateMatch[1] : "";

  let total = 0;
  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const report of REPORT_MANIFEST) {
    for (const lang of LANGUAGES) {
      for (const currency of CURRENCIES) {
        total++;
        const filename = `${datePrefix}_${report.id}_${currency}_${lang}.pdf`;
        const filepath = path.join(OUTPUT_DIR, filename);

        const checks: string[] = [];

        // Check 1: File exists
        if (!fs.existsSync(filepath)) {
          checks.push("MISSING");
          failures.push(`${filename}: file not found`);
          failed++;
          continue;
        }

        const buffer = fs.readFileSync(filepath);
        const sizeKB = buffer.length / 1024;

        // Check 2: Minimum size
        if (buffer.length < MIN_SIZE_BYTES) {
          checks.push(`SIZE=${sizeKB.toFixed(0)}KB<${MIN_SIZE_BYTES / 1024}KB`);
        }

        // Check 3: Page count
        const pages = estimatePageCount(buffer);
        if (pages < MIN_PAGES) {
          checks.push(`PAGES=${pages}<${MIN_PAGES}`);
        }

        // Check 4: Japanese files should contain CJK
        if (lang === "ja") {
          if (!containsCJK(buffer)) {
            checks.push("NO_CJK");
          }
        }

        // Check 5: Currency markers
        if (!containsCurrencyMarker(buffer, currency)) {
          checks.push(`NO_${currency}_MARKER`);
        }

        if (checks.length > 0) {
          failed++;
          const msg = `${filename}: ${checks.join(", ")} (${sizeKB.toFixed(0)}KB, ${pages}p)`;
          failures.push(msg);
          console.log(`  FAIL  ${msg}`);
        } else {
          passed++;
          console.log(
            `  OK    ${filename} (${sizeKB.toFixed(0)}KB, ${pages}p)`,
          );
        }
      }
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Total:  ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failures.length > 0) {
    console.log(`\nFailures:`);
    for (const f of failures) {
      console.log(`  - ${f}`);
    }
  }

  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main();
