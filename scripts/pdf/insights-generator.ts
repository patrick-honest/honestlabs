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
  hypothesis: (metric: string, hypothesis: string) => string;
  nextStep: (action: string) => string;
  qrisSpendLift: (pct: string) => string;
  rpuDelta: (pct: string) => string;
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
    hypothesis: (m, h) => `\u26A1 Hypothesis: ${m} shift is likely driven by ${h}.`,
    nextStep: (a) => `\u2192 Next step: ${a}`,
    qrisSpendLift: (pct) => `QRIS test cohort shows ${pct} incremental spend lift versus control.`,
    rpuDelta: (pct) => `Revenue per user (RPU) delta between test and control is ${pct}.`,
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
    hypothesis: (m, h) => `\u26A1 Hipotesis: Perubahan ${m} kemungkinan disebabkan oleh ${h}.`,
    nextStep: (a) => `\u2192 Langkah selanjutnya: ${a}`,
    qrisSpendLift: (pct) => `Kohort uji QRIS menunjukkan peningkatan spend ${pct} dibanding kontrol.`,
    rpuDelta: (pct) => `Selisih pendapatan per pengguna (RPU) antara uji dan kontrol adalah ${pct}.`,
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
    hypothesis: (m, h) => `\u26A1 仮説: ${m}の変動は${h}に起因する可能性があります。`,
    nextStep: (a) => `\u2192 次のステップ: ${a}`,
    qrisSpendLift: (pct) => `QRISテストコホートはコントロールに対して${pct}の増分支出リフトを示しています。`,
    rpuDelta: (pct) => `テストとコントロール間のユーザーあたり収益(RPU)差は${pct}です。`,
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
        // Add hypothesis for significant changes
        if (Math.abs(kpi.changePercent) > 5) {
          const hypothesis = kpi.label.toLowerCase().includes("spend")
            ? "seasonal consumer activity shifts or campaign effects"
            : kpi.label.toLowerCase().includes("approval")
              ? "changes in credit policy thresholds or applicant quality mix"
              : "underlying portfolio composition changes";
          insights.push(t.hypothesis(kpi.label, hypothesis));
          const step = kpi.changePercent > 0
            ? `Validate ${kpi.label} uplift sustainability by checking cohort-level trends.`
            : `Investigate ${kpi.label} decline root cause in next standup and consider intervention.`;
          insights.push(t.nextStep(step));
        }
      }
    }

    // Delinquency alert
    const dpd = kpis.find((k) => k.label.includes("DPD") || k.label.includes("Delinquent"));
    if (dpd && dpd.value > 3) {
      insights.push(t.riskAlert(`DPD 30+ rate at ${dpd.value.toFixed(1)}% — above target threshold.`));
      insights.push(t.nextStep("Escalate to collections team and review early-stage intervention triggers."));
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
        if (Math.abs(sarChange) > 5) {
          insights.push(t.hypothesis("Spend Active Rate", "activation campaign timing or onboarding funnel improvements"));
          insights.push(t.nextStep("Cross-reference SAR movement with recent campaign launches and cohort activation dates."));
        }
      }

      const spendChange = pctChange(latest.total_spend_idr ?? 0, previous.total_spend_idr ?? 0);
      if (spendChange != null) {
        insights.push(
          spendChange > 0
            ? t.trendUp("Total Spend", fmtPct(spendChange))
            : t.trendDown("Total Spend", fmtPct(spendChange)),
        );
        if (Math.abs(spendChange) > 5) {
          insights.push(t.hypothesis("Total Spend", "merchant promotional activity or credit limit adjustment effects"));
          insights.push(t.nextStep("Segment spend lift by merchant category to isolate organic vs. campaign-driven growth."));
        }
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
        insights.push(t.nextStep("Monitor interchange margin on QRIS vs. POS transactions to assess profitability impact."));
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
        insights.push(t.hypothesis("Delinquency Rate", "recent cohort vintage underperformance or macro employment shifts"));
        insights.push(t.nextStep("Trigger vintage-level drill-down and tighten early-warning collection outreach for DPD 1-15 bucket."));
      } else if (rate < 2) {
        insights.push(t.opportunity(`Delinquency rate at ${rate.toFixed(1)}% — portfolio quality is strong.`));
        insights.push(t.nextStep("Consider selective credit limit increases for low-risk segments to drive spend growth."));
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
        if (change > 0) {
          insights.push(t.nextStep("Run roll-rate analysis to distinguish flow vs. stock deterioration."));
        }
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
          if (Math.abs(change) > 5) {
            insights.push(t.hypothesis("Approval Rate", "credit policy parameter adjustment or applicant channel mix shift"));
            insights.push(t.nextStep("Review score-band approval distribution and check for recent policy rule changes."));
          }
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
        if (parseFloat(overallConversion) < 30) {
          insights.push(t.nextStep("Investigate funnel drop-off stages — consider UX improvements at the highest-loss step."));
        }
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
          if (latest.utilization_pct > 70) {
            insights.push(t.nextStep("High utilization may signal credit stress — monitor DPD transition rates for these accounts."));
          } else if (latest.utilization_pct < 20) {
            insights.push(t.nextStep("Low utilization suggests engagement opportunity — consider targeted spend campaigns."));
          }
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
          if (Math.abs(change) > 5) {
            insights.push(t.hypothesis("Active Accounts", change > 0 ? "new cohort onboarding acceleration" : "increased dormancy or account closures"));
          }
        }
      }
    }
    return insights;
  },
  "qris-experiment": (data, _prev, t, currency) => {
    const insights: string[] = [];

    // Cohort comparison metrics
    const cohort = data.cohortComparison as Record<string, unknown>[];
    if (Array.isArray(cohort) && cohort.length >= 2) {
      const test = cohort.find((r) => String(r.grp).toLowerCase().includes("test")) as Record<string, number> | undefined;
      const control = cohort.find((r) => String(r.grp).toLowerCase().includes("control")) as Record<string, number> | undefined;

      if (test && control) {
        // Spend lift
        const testSpend = test.total_spend_idr ?? test.avg_spend_idr ?? 0;
        const controlSpend = control.total_spend_idr ?? control.avg_spend_idr ?? 0;
        if (controlSpend > 0) {
          const spendLift = ((testSpend - controlSpend) / controlSpend * 100);
          insights.push(t.qrisSpendLift(fmtPct(spendLift)));
        }

        // RPU differential
        const testRpu = test.rpu_idr ?? test.revenue_per_user_idr ?? 0;
        const controlRpu = control.rpu_idr ?? control.revenue_per_user_idr ?? 0;
        if (controlRpu > 0) {
          const rpuDelta = ((testRpu - controlRpu) / controlRpu * 100);
          insights.push(t.rpuDelta(fmtPct(rpuDelta)));
        }

        // QRIS adoption rate
        const testSize = test.cohort_size ?? test.users ?? 0;
        const qrisUsers = test.qris_active_users ?? test.qris_users ?? 0;
        if (testSize > 0 && qrisUsers > 0) {
          const adoptionRate = (qrisUsers / testSize * 100).toFixed(1);
          insights.push(t.qrisAdoption(`${adoptionRate}% of test cohort adopted QRIS`));
        }

        // Interchange cannibalization hypothesis
        const testInterchange = test.interchange_revenue_idr ?? 0;
        const controlInterchange = control.interchange_revenue_idr ?? 0;
        if (controlInterchange > 0 && testInterchange < controlInterchange * 0.95) {
          insights.push(t.hypothesis("Interchange Revenue", "QRIS lower interchange rate cannibalizing POS-based card swipe revenue"));
          insights.push(t.nextStep("Quantify net revenue impact: QRIS incremental spend revenue minus interchange margin erosion."));
        } else {
          insights.push(t.opportunity("QRIS incremental spend is additive without significant interchange cannibalization."));
        }

        // Graduation criteria suggestion
        insights.push(t.nextStep("Graduation criteria: confirm >5% incremental spend lift and positive net revenue at p<0.05 significance before full rollout."));
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
          // Add prescriptive follow-up for significant shifts
          if (Math.abs(change) > 5) {
            insights.push(t.hypothesis(metricLabel, "operational or market-driven factor change"));
            insights.push(t.nextStep(`Drill into ${metricLabel} by segment to isolate driver and determine if action is needed.`));
          }
        }
      }
      if (insights.length >= 4) break;
    }
    if (insights.length >= 4) break;
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
