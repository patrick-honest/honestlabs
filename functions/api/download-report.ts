/**
 * GET /api/download-report?report=dashboard&lang=en&currency=IDR&period=2024-12-29
 *
 * Serves a pre-generated PDF report file with Content-Disposition: attachment.
 */

import * as fs from "fs";
import * as path from "path";

interface FnContext {
  request: Request;
  env: Record<string, unknown>;
}

const VALID_LANGS = new Set(["en", "id", "ja"]);
const VALID_CURRENCIES = new Set(["IDR", "USD"]);

export async function onRequest(context: FnContext): Promise<Response> {
  const url = new URL(context.request.url);
  const report = url.searchParams.get("report");
  const lang = url.searchParams.get("lang") ?? "en";
  const currency = url.searchParams.get("currency") ?? "IDR";
  const period = url.searchParams.get("period"); // date string like 2024-12-29

  if (!report) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: report" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!VALID_LANGS.has(lang)) {
    return new Response(
      JSON.stringify({ error: `Invalid lang: ${lang}. Must be en, id, or ja.` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!VALID_CURRENCIES.has(currency.toUpperCase())) {
    return new Response(
      JSON.stringify({ error: `Invalid currency: ${currency}. Must be IDR or USD.` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Sanitize report name to prevent path traversal
  const sanitizedReport = report.replace(/[^a-z0-9-]/gi, "");
  const sanitizedPeriod = period?.replace(/[^0-9-]/g, "") ?? "";

  // Build filename
  const filename = sanitizedPeriod
    ? `${sanitizedPeriod}_${sanitizedReport}_${currency.toUpperCase()}_${lang}.pdf`
    : `${sanitizedReport}_${currency.toUpperCase()}_${lang}.pdf`;

  // Try pdf_reports/ directory first
  const pdfDir = path.resolve(process.cwd(), "pdf_reports");
  let filePath = path.join(pdfDir, filename);

  // If period-prefixed file not found, try to find latest matching file
  if (!fs.existsSync(filePath) && !sanitizedPeriod) {
    try {
      const files = fs.readdirSync(pdfDir)
        .filter(f => f.endsWith(`_${sanitizedReport}_${currency.toUpperCase()}_${lang}.pdf`))
        .sort()
        .reverse();
      if (files.length > 0) {
        filePath = path.join(pdfDir, files[0]);
      }
    } catch {
      // Directory may not exist
    }
  }

  if (!fs.existsSync(filePath)) {
    return new Response(
      JSON.stringify({
        error: "Report not found",
        message: `No PDF found for report=${sanitizedReport}, lang=${lang}, currency=${currency}, period=${sanitizedPeriod || "latest"}`,
        filename,
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const buffer = fs.readFileSync(filePath);

  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
