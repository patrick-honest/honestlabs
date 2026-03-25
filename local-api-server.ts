/**
 * Local API server for development.
 * Proxies the same /api/* endpoints that Cloudflare Pages Functions serve.
 * Uses gcloud ADC for BigQuery authentication (no secrets needed).
 *
 * Usage: npx tsx local-api-server.ts
 */
import http from "http";
import { URL } from "url";
import * as fs from "fs";
import * as path from "path";

const PORT = 3099;

// Dynamically import each API handler
const handlers: Record<string, () => Promise<{ onRequest: (ctx: { request: Request; env: Record<string, unknown> }) => Promise<Response> }>> = {
  "acquisition": () => import("./functions/api/acquisition"),
  "activation": () => import("./functions/api/activation"),
  "billing-cycle": () => import("./functions/api/billing-cycle"),
  "cards-overview": () => import("./functions/api/cards-overview"),
  "channel-quality": () => import("./functions/api/channel-quality"),
  "collections": () => import("./functions/api/collections"),
  "credit-line": () => import("./functions/api/credit-line"),
  "customer-service": () => import("./functions/api/customer-service"),
  "kpis": () => import("./functions/api/kpis"),
  "points-program": () => import("./functions/api/points-program"),
  "portfolio": () => import("./functions/api/portfolio"),
  "qris-experiment": () => import("./functions/api/qris-experiment"),
  "referral": () => import("./functions/api/referral"),
  "repayments": () => import("./functions/api/repayments"),
  "risk": () => import("./functions/api/risk"),
  "search": () => import("./functions/api/search"),
  "spend-analysis": () => import("./functions/api/spend-analysis"),
  "transaction-auth": () => import("./functions/api/transaction-auth"),
  "users-overview": () => import("./functions/api/users-overview"),
  "vintage": () => import("./functions/api/vintage"),
};

// ---------------------------------------------------------------------------
// PDF generation handler (reuses scripts/pdf pipeline)
// ---------------------------------------------------------------------------

async function handleGeneratePdf(url: URL, res: http.ServerResponse): Promise<void> {
  const report = url.searchParams.get("report") ?? "dashboard";
  const lang = (url.searchParams.get("lang") ?? "en") as "en" | "id" | "ja";
  const currency = (url.searchParams.get("currency") ?? "IDR") as "IDR" | "USD";
  const startDate = url.searchParams.get("startDate") ?? "";
  const endDate = url.searchParams.get("endDate") ?? "";
  const period = url.searchParams.get("period") ?? "weekly";
  const includeInsights = url.searchParams.get("includeInsights") !== "false";
  const contentMode = url.searchParams.get("contentMode") ?? "full";

  if (!startDate || !endDate) {
    res.writeHead(400, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({ error: "startDate and endDate are required" }));
    return;
  }

  console.log(`[PDF] Generating: report=${report} lang=${lang} currency=${currency} ${startDate}..${endDate}`);

  try {
    // Dynamic imports to avoid loading heavy deps at server startup
    const { REPORT_MANIFEST } = await import("./src/config/pdf-report-manifest");
    const { fetchWithPrevPeriod } = await import("./scripts/pdf/data-fetcher");
    const { renderLineChart, renderBarChart } = await import("./scripts/pdf/chart-renderer");
    const { buildPdf } = await import("./scripts/pdf/pdf-layout");
    const { generateInsights } = await import("./scripts/pdf/insights-generator");

    // Find the report definition
    const reportDef = REPORT_MANIFEST.find((r) => r.id === report);
    if (!reportDef) {
      res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({
        error: `Unknown report: ${report}`,
        available: REPORT_MANIFEST.map((r) => r.id),
      }));
      return;
    }

    // Compute previous period dates (shift by same duration)
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const durationMs = endMs - startMs;
    const prevEnd = new Date(startMs - 86400000); // day before start
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    const prevStartStr = prevStart.toISOString().slice(0, 10);
    const prevEndStr = prevEnd.toISOString().slice(0, 10);

    // Fetch data
    const apiData = await fetchWithPrevPeriod(
      reportDef.apiEndpoint,
      { start: startDate, end: endDate },
      { start: prevStartStr, end: prevEndStr },
      period,
    );

    // Load i18n messages
    const msgPath = path.resolve(process.cwd(), "messages", `${lang}.json`);
    const messages: Record<string, unknown> = fs.existsSync(msgPath)
      ? JSON.parse(fs.readFileSync(msgPath, "utf-8"))
      : {};

    const resolveI18n = (key: string): string => {
      const parts = key.split(".");
      let cur: unknown = messages;
      for (const p of parts) {
        if (cur == null || typeof cur !== "object") return key.split(".").pop() ?? key;
        cur = (cur as Record<string, unknown>)[p];
      }
      return typeof cur === "string" ? cur : key.split(".").pop() ?? key;
    };

    const getByPath = (obj: unknown, dotPath: string): unknown => {
      const parts = dotPath.split(".");
      let c = obj;
      for (const p of parts) {
        if (c == null || typeof c !== "object") return undefined;
        const idx = Number(p);
        if (!isNaN(idx) && Array.isArray(c)) { c = c[idx]; } else { c = (c as Record<string, unknown>)[p]; }
      }
      return c;
    };

    const getDataArray = (response: Record<string, unknown>, dataKey: string): Record<string, unknown>[] => {
      const val = getByPath(response, dataKey);
      return Array.isArray(val) ? val as Record<string, unknown>[] : [];
    };

    const reportTitle = resolveI18n(reportDef.titleKey);

    // Build KPIs
    type KpiItem = { label: string; value: number; unit: "count" | "percent" | "currency"; change?: number | null };
    let kpis: KpiItem[];

    if (report === "qris-experiment") {
      // Special QRIS handling
      const cohort = apiData.current.cohortComparison as Record<string, unknown>[] | undefined;
      kpis = [];
      if (Array.isArray(cohort)) {
        const test = cohort.find((r) => String(r.grp).toLowerCase().includes("test")) as Record<string, number> | undefined;
        const control = cohort.find((r) => String(r.grp).toLowerCase().includes("control")) as Record<string, number> | undefined;
        if (test) {
          kpis.push({ label: resolveI18n("pdf.metrics.testCohortSize"), value: test.cohort_size ?? test.users ?? 0, unit: "count", change: null });
          if (control) {
            kpis.push({ label: resolveI18n("pdf.metrics.controlCohortSize"), value: control.cohort_size ?? control.users ?? 0, unit: "count", change: null });
          }
          if (test.spend_active_rate != null) {
            const cSar = control?.spend_active_rate ?? 0;
            kpis.push({ label: "SAR (Test)", value: test.spend_active_rate, unit: "percent", change: cSar > 0 ? ((test.spend_active_rate - cSar) / cSar * 100) : null });
          }
          const ts = test.total_spend_idr ?? 0;
          const cs = control?.total_spend_idr ?? 0;
          if (ts > 0) kpis.push({ label: "Total Spend (Test)", value: ts, unit: "currency", change: cs > 0 ? ((ts - cs) / cs * 100) : null });
        }
      }
    } else {
      kpis = reportDef.metrics.map((m) => {
        const rawValue = Number(getByPath(apiData.current, m.dataPath) ?? 0);
        return { label: resolveI18n(m.labelKey), value: rawValue, unit: m.unit, change: null };
      });

      // Dashboard KPIs have change from API
      if (report === "dashboard" && Array.isArray(apiData.current.kpis)) {
        const apiKpis = apiData.current.kpis as { changePercent: number | null }[];
        for (let i = 0; i < Math.min(kpis.length, apiKpis.length); i++) {
          kpis[i].change = apiKpis[i].changePercent;
        }
      }
    }

    // Generate insights (if requested)
    const insights = includeInsights
      ? generateInsights(report, apiData.current, apiData.previous, lang, currency)
      : [];

    // Render charts
    type ChartImage = { title: string; pngBuffer: Buffer };
    type TableData = { title: string; headers: string[]; rows: string[][] };
    const chartImages: ChartImage[] = [];
    const tables: TableData[] = [];

    for (const chartDef of reportDef.charts) {
      let data = getDataArray(apiData.current, chartDef.dataKey);
      if (data.length === 0) continue;

      if (chartDef.id === "qris-top-merchants") data = data.slice(0, 25);

      if (chartDef.type === "table") {
        if (contentMode === "charts") continue; // skip tables in charts-only mode
        const headers = Object.keys(data[0]);
        const rows = data.map((row) =>
          headers.map((k) => {
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
        tables.push({ title: resolveI18n(chartDef.titleKey), headers, rows });
        continue;
      }

      const chartTitle = resolveI18n(chartDef.titleKey);

      try {
        let pngBuffer: Buffer;
        if (chartDef.type === "line") {
          const prevData = chartDef.showPrevPeriod ? getDataArray(apiData.previous, chartDef.dataKey) : undefined;
          pngBuffer = await renderLineChart({ data, prevData, config: chartDef, locale: lang, currency });
        } else {
          pngBuffer = await renderBarChart({ data, config: chartDef, locale: lang, currency });
        }
        chartImages.push({ title: chartTitle, pngBuffer });
      } catch (chartErr) {
        console.error(`  [PDF] Chart ${chartDef.id} failed:`, chartErr);
      }
    }

    // Build PDF
    const pdfBuffer = buildPdf({
      reportTitle,
      periodStart: startDate,
      periodEnd: endDate,
      cycle: period,
      locale: lang,
      currency,
      kpis,
      insights,
      charts: chartImages,
      tables: contentMode === "charts" ? [] : tables,
    });

    // Return PDF
    const filename = `${endDate}_${report}_${currency}_${lang}.pdf`;
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": pdfBuffer.length.toString(),
      "Access-Control-Allow-Origin": "*",
    });
    res.end(pdfBuffer);

    console.log(`[PDF] Done: ${filename} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);
  } catch (error) {
    console.error("[PDF] Generation error:", error);
    res.writeHead(500, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
    res.end(JSON.stringify({
      error: "PDF generation failed",
      message: error instanceof Error ? error.message : String(error),
    }));
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathParts = url.pathname.split("/").filter(Boolean);

  // Expect /api/<endpoint>
  if (pathParts[0] !== "api" || !pathParts[1]) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found", endpoints: [...Object.keys(handlers), "generate-pdf"] }));
    return;
  }

  const endpoint = pathParts[1];

  // Special handler for PDF generation
  if (endpoint === "generate-pdf") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}${url.search}`);
    await handleGeneratePdf(url, res);
    return;
  }

  const handlerLoader = handlers[endpoint];

  if (!handlerLoader) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Unknown endpoint: ${endpoint}`, endpoints: [...Object.keys(handlers), "generate-pdf"] }));
    return;
  }

  try {
    console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}${url.search}`);
    const mod = await handlerLoader();
    const request = new Request(`http://localhost:${PORT}${req.url}`, { method: req.method || "GET" });

    // Empty env — ADC fallback in bigquery-auth.ts will use gcloud CLI
    const env = {};
    const response = await mod.onRequest({ request, env });

    const body = await response.text();
    res.writeHead(response.status, {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(body);
  } catch (error) {
    console.error(`[ERROR] ${endpoint}:`, error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: `Handler error: ${endpoint}`,
      message: error instanceof Error ? error.message : String(error),
    }));
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Local API server running at http://localhost:${PORT}`);
  console.log(`   Using gcloud ADC for BigQuery auth`);
  console.log(`   Endpoints: ${[...Object.keys(handlers), "generate-pdf"].map(e => `/api/${e}`).join(", ")}\n`);
});
