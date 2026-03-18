"use client";

import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { useTranslations } from "next-intl";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { QrCode, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { usePeriod } from "@/hooks/use-period";

// ── Print styles ─────────────────────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  @page {
    size: A4 portrait;
    margin: 0.5in 0.5in 0.7in 0.5in;
    @bottom-center {
      content: "QRIS Experiment Report — Page " counter(page) " of " counter(pages);
      font-size: 7pt;
      color: #888;
    }
  }

  /* Hide UI chrome */
  nav, header, [data-print-hide], .no-print { display: none !important; }

  /* Fix layout containers */
  html, body { height: auto !important; overflow: visible !important; }
  body > div, main, [class*="overflow"] {
    height: auto !important;
    overflow: visible !important;
    position: static !important;
  }
  .flex.h-screen { height: auto !important; display: block !important; }

  /* Typography */
  body {
    background: white !important;
    color: #1a1a1a !important;
    font-size: 9pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Reset backgrounds for readability */
  div:not([class*="recharts"]):not([style*="gradient"]),
  main, section, article, td, th, tr, p, span, h1, h2, h3 {
    background: white !important;
  }

  /* Keep hero gradient and colored elements */
  [data-print-hero] {
    background: linear-gradient(135deg, #059669 0%, #10B981 40%, #047857 100%) !important;
    color: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    page-break-after: avoid;
  }
  [data-print-hero] * { color: white !important; }
  [data-print-hero] .text-white\\/70, [data-print-hero] .text-white\\/80,
  [data-print-hero] .text-white\\/60, [data-print-hero] .text-white\\/50,
  [data-print-hero] .text-white\\/30 { opacity: 0.7 !important; }

  /* Preserve chart colors */
  svg, svg *, .recharts-surface, .recharts-surface * {
    color: inherit !important;
    fill: inherit !important;
    stroke: inherit !important;
  }

  /* Page break control */
  .chart-card-wrapper { page-break-inside: avoid; margin-bottom: 12pt; }
  h1, h2, h3, h4 { page-break-after: avoid; }

  /* Print-visible elements */
  [data-print-only] { display: block !important; }
}

/* Hidden by default, shown only in print */
[data-print-only] { display: none; }
`;

const AS_OF = "2026-03-15";

// -- Action items --
const actionItems: ActionItem[] = [
  {
    id: "qris-1",
    priority: "positive",
    action: "QRIS drives higher overall engagement.",
    detail: "QRIS users transact 2.1x more frequently and spend 45% more overall than non-QRIS users. The higher transaction frequency more than compensates for lower per-txn interchange.",
  },
  {
    id: "qris-2",
    priority: "positive",
    action: "Revenue per user is 2.5x higher for QRIS adopters.",
    detail: "Even accounting for the lower 0.7% QRIS MDR vs 1.5% card interchange, total revenue generated per QRIS user is IDR 24.8K/month vs IDR 10.2K/month for non-QRIS users.",
  },
  {
    id: "qris-3",
    priority: "positive",
    action: "Multi-channel usage is a strong signal.",
    detail: "78% of QRIS users also use their card online and offline, compared to only 35% of non-QRIS users. QRIS activation unlocks broader card utility.",
  },
  {
    id: "qris-4",
    priority: "monitor",
    action: "Monitor QRIS-only users carefully.",
    detail: "A small subset (~8%) of QRIS users only transact via QR. These users generate the lowest interchange. Consider targeted campaigns to encourage card usage alongside QRIS.",
  },
  {
    id: "qris-5",
    priority: "monitor",
    action: "Grocery dominance suggests expansion opportunity.",
    detail: "Grocery/Supermarket is the #1 QRIS category by far. Explore merchant partnerships in underpenetrated categories like electronics and fashion to grow QRIS volume.",
  },
  {
    id: "qris-6",
    priority: "urgent",
    action: "Recommend: Make QRIS generally available.",
    detail: "Data strongly supports graduating QRIS from experiment to permanent feature. Adoption is growing 2-3% weekly, engagement lift is clear, and profitability per user is materially higher.",
  },
];

// ==========================================================================
// Sub-components
// ==========================================================================

function StatBox({
  label,
  value,
  subtext,
  large,
}: {
  label: string;
  value: string;
  subtext?: string;
  large?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-secondary)]">{label}</p>
      <p className={cn("font-bold text-[var(--text-primary)]", large ? "text-3xl mt-1" : "text-xl mt-0.5")}>{value}</p>
      {subtext && <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtext}</p>}
    </div>
  );
}

function ComparisonRow({
  label,
  qrisValue,
  nonQrisValue,
  format = "number",
  higherIsBetter = true,
  currency = "IDR" as "IDR" | "USD",
}: {
  label: string;
  qrisValue: number;
  nonQrisValue: number;
  format?: "number" | "idr" | "percent" | "decimal";
  higherIsBetter?: boolean;
  currency?: "IDR" | "USD";
}) {
  // kept for future use when real data is connected
  return null;
}

// ==========================================================================
// Main Page
// ==========================================================================

export default function QrisExperimentPage() {
  const { periodLabel } = usePeriod();
  const { isDark } = useTheme();
  const tNav = useTranslations("nav");

  // Print styles injection
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div className="flex flex-col">
      <Header title={tNav("qrisExperiment")} />

      <div className="flex-1 space-y-6 p-6">

        {/* Print-only header with logo and metadata */}
        <div data-print-only className="mb-4 pb-3 border-b-2 border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">Honest Bank — QRIS Experiment Report</h1>
              <p className="text-xs text-gray-500 mt-0.5">Business Reviews | {periodLabel} | Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <p>Confidential — Internal Use Only</p>
              <p>Data as of {AS_OF}</p>
            </div>
          </div>
        </div>

        <ActiveFiltersBanner />

        {/* Hero Banner (kept for layout) */}
        <div
          data-print-hero
          className="relative overflow-hidden rounded-2xl p-6"
          style={{
            background: isDark
              ? "linear-gradient(135deg, #5B22FF 0%, #7C4DFF 40%, #3D1299 100%)"
              : "linear-gradient(135deg, #059669 0%, #10B981 40%, #047857 100%)",
          }}
        >
          <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5 blur-2xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm">
                  <QrCode className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">QRIS Experiment Report</h2>
                  <p className="text-sm text-white/70">Quick Response Code Indonesian Standard &middot; {periodLabel}</p>
                </div>
              </div>

              <p className="text-sm text-white/80 max-w-2xl leading-relaxed mt-2">
                QRIS has been running as an experiment since November 2025. This report analyzes whether
                enabling QR payments on Honest credit cards increases overall engagement and spend enough
                to justify the lower interchange revenue per transaction.
              </p>
            </div>

            {/* Verdict Badge */}
            <div className="shrink-0">
              <div className="flex flex-col items-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 px-8 py-5">
                <CheckCircle2 className="h-8 w-8 text-[#06D6A0] mb-2" />
                <span className="text-xs font-semibold uppercase tracking-widest text-white/60 mb-1">Verdict</span>
                <span className="text-lg font-bold text-[#06D6A0]">RECOMMENDED</span>
                <span className="text-[11px] text-white/50 mt-1 text-center">
                  Graduate to permanent feature
                </span>
              </div>
            </div>
          </div>
        </div>

        <SampleDataBanner
          dataset="mart_finexus"
          reason="QRIS experiment data requires authorized_transaction (DW007) with QRIS filters (txn_typ='RA', rte_dest='L')"
        />

        <ActionItems section="QRIS Experiment" items={actionItems} />

        {/* Footer note */}
        <div className="rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] px-6 py-4">
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-semibold text-[var(--text-secondary)]">Methodology:</span>{" "}
            QRIS transactions are identified by <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw007_txn_typ = &apos;RA&apos;</code> and{" "}
            <code className={cn("px-1 rounded", isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10")}>fx_dw007_rte_dest = &apos;L&apos;</code>.
            Spend data is based on <strong>authorized transactions</strong>. Interchange estimates use 0.7% MDR for QRIS and ~1.5% weighted average for card transactions.
            &quot;QRIS Users&quot; are customers who have made at least one QRIS transaction during the experiment period.
            All spend figures include both QRIS and non-QRIS transactions for each user segment.
            Mar* data is partial (through {AS_OF}).
          </p>
        </div>
      </div>
    </div>
  );
}
