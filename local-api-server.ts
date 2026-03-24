/**
 * Local API server for development.
 * Proxies the same /api/* endpoints that Cloudflare Pages Functions serve.
 * Uses gcloud ADC for BigQuery authentication (no secrets needed).
 *
 * Usage: npx tsx local-api-server.ts
 */
import http from "http";
import { URL } from "url";

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
};

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
    res.end(JSON.stringify({ error: "Not found", endpoints: Object.keys(handlers) }));
    return;
  }

  const endpoint = pathParts[1];
  const handlerLoader = handlers[endpoint];

  if (!handlerLoader) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Unknown endpoint: ${endpoint}`, endpoints: Object.keys(handlers) }));
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
  console.log(`   Endpoints: ${Object.keys(handlers).map(e => `/api/${e}`).join(", ")}\n`);
});
