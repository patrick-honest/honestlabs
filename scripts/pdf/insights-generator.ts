// ---------------------------------------------------------------------------
// Insights Generator — produces 3-5 localized insight bullets per report
// ---------------------------------------------------------------------------

const IDR_USD_RATE = 16_000;

type Lang = "en" | "id" | "ja";
type Currency = "IDR" | "USD";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctChange(current: number, previous: number): number | null {
  if (!previous || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function fmtNum(v: number): string {
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toLocaleString();
}

function fmtCurrency(v: number, currency: Currency): string {
  const val = currency === "USD" ? v / IDR_USD_RATE : v;
  const prefix = currency === "USD" ? "$" : "Rp ";
  if (Math.abs(val) >= 1e9) return `${prefix}${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `${prefix}${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `${prefix}${(val / 1e3).toFixed(0)}K`;
  return `${prefix}${val.toFixed(currency === "USD" ? 2 : 0)}`;
}

function lastItem<T>(arr: unknown): T | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[arr.length - 1] as T;
}

function prevItem<T>(arr: unknown): T | undefined {
  if (!Array.isArray(arr) || arr.length < 2) return undefined;
  return arr[arr.length - 2] as T;
}

function safeGet(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/** Check if current month is Ramadan/Eid season (roughly March-May) */
function isRamadanSeason(): boolean {
  const month = new Date().getMonth(); // 0-indexed
  return month >= 2 && month <= 4; // March, April, May
}

// ---------------------------------------------------------------------------
// Translation templates
// ---------------------------------------------------------------------------
interface InsightTemplates {
  trendUp: (metric: string, change: string) => string;
  trendDown: (metric: string, change: string) => string;
  stableMetric: (metric: string, value: string) => string;
  riskAlert: (message: string) => string;
  opportunity: (message: string) => string;
  ramadanNote: () => string;
  qrisAdoption: (detail: string) => string;
  ojkContext: (detail: string) => string;
}

const TEMPLATES: Record<Lang, InsightTemplates> = {
  en: {
    trendUp: (m, c) => `${m} increased ${c} week-over-week, signaling positive momentum.`,
    trendDown: (m, c) => `${m} decreased ${c} week-over-week — warrants monitoring.`,
    stableMetric: (m, v) => `${m} remained stable at ${v}.`,
    riskAlert: (msg) => `Risk alert: ${msg}`,
    opportunity: (msg) => `Opportunity: ${msg}`,
    ramadanNote: () =>
      "Ramadan/Eid seasonality may influence spending patterns, transaction volumes, and repayment timing this period.",
    qrisAdoption: (d) => `QRIS adoption continues expanding across Indonesian merchants — ${d}.`,
    ojkContext: (d) => `In line with OJK's financial inclusion mandate, ${d}.`,
  },
  id: {
    trendUp: (m, c) => `${m} meningkat ${c} dari minggu sebelumnya, menunjukkan momentum positif.`,
    trendDown: (m, c) => `${m} menurun ${c} dari minggu sebelumnya — perlu dipantau.`,
    stableMetric: (m, v) => `${m} stabil di ${v}.`,
    riskAlert: (msg) => `Peringatan risiko: ${msg}`,
    opportunity: (msg) => `Peluang: ${msg}`,
    ramadanNote: () =>
      "Musim Ramadan/Idulfitri dapat memengaruhi pola pengeluaran, volume transaksi, dan waktu pembayaran periode ini.",
    qrisAdoption: (d) => `Adopsi QRIS terus berkembang di merchant Indonesia — ${d}.`,
    ojkContext: (d) => `Sejalan dengan mandat inklusi keuangan OJK, ${d}.`,
  },
  ja: {
    trendUp: (m, c) => `${m}は前週比${c}増加し、好調な勢いを示しています。`,
    trendDown: (m, c) => `${m}は前週比${c}減少しました — 継続的な監視が必要です。`,
    stableMetric: (m, v) => `${m}は${v}で安定しています。`,
    riskAlert: (msg) => `リスク警告: ${msg}`,
    opportunity: (msg) => `機会: ${msg}`,
    ramadanNote: () =>
      "ラマダン/断食明け大祭のシーズンは、消費パターン、取引量、返済タイミングに影響する可能性があります。",
    qrisAdoption: (d) => `QRISの導入はインドネシア全土の加盟店で拡大を続けています — ${d}。`,
    ojkContext: (d) => `OJKの金融包摂方針に沿い、${d}。`,
  },
};

// ---------------------------------------------------------------------------
// Report-specific insight generators
// ---------------------------------------------------------------------------
type InsightFn = (
  data: Record<string, unknown>,
  prevData: Record<string, unknown>,
  t: InsightTemplates,
  currency: Currency,
) => string[];

const GENERATORS: Record<string, InsightFn> = {
  dashboard: (data, prev, t, currency) => {
    const insights: string[] = [];
    const kpis = data.kpis as { value: number; label: string; unit: string; changePercent: number | null }[] | undefined;
    if (!kpis) return insights;

    for (const kpi of kpis.slice(0, 3)) {
      if (kpi.changePercent != null && kpi.changePercent !== 0) {
        if (kpi.changePercent > 0) {
          insights.push(t.trendUp(kpi.label, fmtPct(kpi.changePercent)));
        } else {
          insights.push(t.trendDown(kpi.label, fmtPct(kpi.changePercent)));
        }
      }
    }

    // Delinquency alert
    const dpd = kpis.find((k) => k.label.includes("DPD") || k.label.includes("Delinquent"));
    if (dpd && dpd.value > 3) {
      insights.push(t.riskAlert(`DPD 30+ rate at ${dpd.value.toFixed(1)}% — above target threshold.`));
    }

    return insights;
  },

  "spend-analysis": (data, prev, t, currency) => {
    const insights: string[] = [];
    const trend = data.weeklySpendTrend as Record<string, unknown>[];
    if (!Array.isArray(trend)) return insights;

    const latest = lastItem<Record<string, number>>(trend);
    const previous = prevItem<Record<string, number>>(trend);

    if (latest && previous) {
      const sarChange = pctChange(latest.spend_active_rate ?? 0, previous.spend_active_rate ?? 0);
      if (sarChange != null) {
        if (sarChange > 0) {
          insights.push(t.trendUp("Spend Active Rate", fmtPct(sarChange)));
        } else {
          insights.push(t.trendDown("Spend Active Rate", fmtPct(sarChange)));
        }
      }

      const spendChange = pctChange(latest.total_spend_idr ?? 0, previous.total_spend_idr ?? 0);
      if (spendChange != null) {
        insights.push(
          spendChange > 0
            ? t.trendUp("Total Spend", fmtPct(spendChange))
            : t.trendDown("Total Spend", fmtPct(spendChange)),
        );
      }
    }

    // QRIS growth
    if (latest) {
      const qrisShare =
        (latest.qris_spend_idr ?? 0) /
        Math.max(latest.total_spend_idr ?? 1, 1) *
        100;
      if (qrisShare > 5) {
        insights.push(
          t.qrisAdoption(`QRIS now represents ${qrisShare.toFixed(1)}% of total spend`),
        );
      }
    }

    return insights;
  },

  risk: (data, prev, t, currency) => {
    const insights: string[] = [];
    const dpdTrend = data.dpdTrend as Record<string, unknown>[];
    if (!Array.isArray(dpdTrend)) return insights;

    const latest = lastItem<Record<string, number>>(dpdTrend);
    const previous = prevItem<Record<string, number>>(dpdTrend);

    if (latest) {
      const rate = latest.delinquency_rate_30plus ?? 0;
      if (rate > 5) {
        insights.push(t.riskAlert(`30+ DPD delinquency rate at ${rate.toFixed(1)}%, elevated above benchmark.`));
      } else if (rate < 2) {
        insights.push(t.opportunity(`Delinquency rate at ${rate.toFixed(1)}% — portfolio quality is strong.`));
      }
    }

    if (latest && previous) {
      const change = pctChange(
        latest.delinquency_rate_30plus ?? 0,
        previous.delinquency_rate_30plus ?? 0,
      );
      if (change != null && Math.abs(change) > 5) {
        insights.push(
          change > 0
            ? t.trendUp("Delinquency Rate", fmtPct(change))
            : t.trendDown("Delinquency Rate", fmtPct(change)),
        );
      }
    }

    return insights;
  },

  acquisition: (data, prev, t, currency) => {
    const insights: string[] = [];
    const trend = data.approvalRateTrend as Record<string, unknown>[];
    if (Array.isArray(trend)) {
      const latest = lastItem<Record<string, number>>(trend);
      const previous = prevItem<Record<string, number>>(trend);
      if (latest && previous) {
        const change = pctChange(latest.approval_rate ?? 0, previous.approval_rate ?? 0);
        if (change != null) {
          insights.push(
            change > 0
              ? t.trendUp("Approval Rate", fmtPct(change))
              : t.trendDown("Approval Rate", fmtPct(change)),
          );
        }
      }
      if (latest) {
        insights.push(t.stableMetric("Current Approval Rate", `${(latest.approval_rate ?? 0).toFixed(1)}%`));
      }
    }
    const funnel = data.funnel as Record<string, unknown>[];
    if (Array.isArray(funnel) && funnel.length > 0) {
      const first = funnel[0] as Record<string, number>;
      const last = funnel[funnel.length - 1] as Record<string, number>;
      if (first.count && last.count) {
        const overallConversion = ((last.count / first.count) * 100).toFixed(1);
        insights.push(t.stableMetric("End-to-end Funnel Conversion", `${overallConversion}%`));
      }
    }
    return insights;
  },

  portfolio: (data, prev, t, currency) => {
    const insights: string[] = [];
    const snap = data.snapshot as Record<string, unknown>[];
    if (Array.isArray(snap)) {
      const latest = lastItem<Record<string, number>>(snap);
      const previous = prevItem<Record<string, number>>(snap);
      if (latest) {
        insights.push(t.stableMetric("Active Accounts", fmtNum(latest.active_accounts ?? 0)));
        if (latest.utilization_pct != null) {
          insights.push(t.stableMetric("Portfolio Utilization", `${latest.utilization_pct.toFixed(1)}%`));
        }
      }
      if (latest && previous) {
        const change = pctChange(latest.active_accounts ?? 0, previous.active_accounts ?? 0);
        if (change != null && Math.abs(change) > 1) {
          insights.push(
            change > 0
              ? t.trendUp("Active Accounts", fmtPct(change))
              : t.trendDown("Active Accounts", fmtPct(change)),
          );
        }
      }
    }
    return insights;
  },
};

// ---------------------------------------------------------------------------
// Fallback generator for reports without specific logic
// ---------------------------------------------------------------------------
function genericInsights(
  data: Record<string, unknown>,
  prevData: Record<string, unknown>,
  t: InsightTemplates,
  currency: Currency,
): string[] {
  const insights: string[] = [];

  // Walk top-level arrays and compare last two values
  for (const [key, val] of Object.entries(data)) {
    if (!Array.isArray(val) || val.length < 2) continue;
    const latest = val[val.length - 1] as Record<string, number>;
    const previous = val[val.length - 2] as Record<string, number>;
    if (!latest || !previous) continue;

    // Find numeric fields to compare
    for (const field of Object.keys(latest)) {
      if (typeof latest[field] !== "number" || typeof previous[field] !== "number") continue;
      if (field.includes("date") || field.includes("week") || field.includes("month")) continue;
      if (field.includes("rate") || field.includes("pct")) {
        const change = latest[field] - previous[field];
        if (Math.abs(change) > 1) {
          const metricLabel = field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          insights.push(
            change > 0
              ? t.trendUp(metricLabel, `${change.toFixed(1)}pp`)
              : t.trendDown(metricLabel, `${Math.abs(change).toFixed(1)}pp`),
          );
        }
      }
      if (insights.length >= 3) break;
    }
    if (insights.length >= 3) break;
  }

  return insights;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------
export function generateInsights(
  reportId: string,
  data: Record<string, unknown>,
  prevData: Record<string, unknown>,
  lang: Lang,
  currency: Currency,
): string[] {
  const t = TEMPLATES[lang] ?? TEMPLATES.en;
  const generator = GENERATORS[reportId] ?? genericInsights;

  const insights = generator(data, prevData, t, currency);

  // Add Ramadan context if applicable
  if (isRamadanSeason() && insights.length < 5) {
    insights.push(t.ramadanNote());
  }

  // Add OJK context for certain reports
  if (
    (reportId === "portfolio" || reportId === "acquisition" || reportId === "users-overview") &&
    insights.length < 5
  ) {
    insights.push(
      t.ojkContext(
        lang === "en"
          ? "credit card portfolio growth supports digital banking access goals"
          : lang === "id"
            ? "pertumbuhan portofolio kartu kredit mendukung tujuan akses perbankan digital"
            : "クレジットカードポートフォリオの成長はデジタルバンキングアクセス目標を支援しています",
      ),
    );
  }

  // Ensure 3-5 insights
  return insights.slice(0, 5);
}
