// ---------------------------------------------------------------------------
// PDF Layout Engine — assembles a complete PDF report using jsPDF
// ---------------------------------------------------------------------------

import * as fs from "fs";
import * as path from "path";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { registerFontWithJsPDF } from "./font-loader";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PAGE_W = 215.9; // Letter width mm
const PAGE_H = 279.4; // Letter height mm
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;
const CHART_HEIGHT_MM = 120;
const CHART_GAP = 12;
const IDR_USD_RATE = 16_000;

const BRAND_PRIMARY: [number, number, number] = [91, 34, 255];

// Logo dimensions: original 984x208 px, scale to ~40mm wide
const LOGO_WIDTH_MM = 40;
const LOGO_HEIGHT_MM = (208 / 984) * LOGO_WIDTH_MM; // ~8.5mm proportional

let _logoBase64: string | null = null;
function getLogoBase64(): string {
  if (!_logoBase64) {
    const logoPath = path.resolve(__dirname, "../../public/honest-logo.png");
    const buf = fs.readFileSync(logoPath);
    _logoBase64 = buf.toString("base64");
  }
  return _logoBase64;
}

// ---------------------------------------------------------------------------
// Locale labels
// ---------------------------------------------------------------------------
const LABELS: Record<string, Record<string, string>> = {
  en: {
    confidential: "CONFIDENTIAL",
    generated: "Generated",
    page: "Page",
    of: "of",
    footer: "Honest Bank · Business Reviews · Data sourced from BigQuery",
    metric: "Metric",
    value: "Value",
    change: "Change",
    keyInsights: "Key Insights",
    noData: "No data available",
    prevPeriod: "Previous Period",
  },
  id: {
    confidential: "RAHASIA",
    generated: "Dibuat",
    page: "Halaman",
    of: "dari",
    footer: "Honest Bank · Business Reviews · Sumber data: BigQuery",
    metric: "Metrik",
    value: "Nilai",
    change: "Perubahan",
    keyInsights: "Wawasan Utama",
    noData: "Data tidak tersedia",
    prevPeriod: "Periode Sebelumnya",
  },
  ja: {
    confidential: "機密",
    generated: "作成日",
    page: "ページ",
    of: "/",
    footer: "Honest Bank · Business Reviews · データソース: BigQuery",
    metric: "指標",
    value: "値",
    change: "変動",
    keyInsights: "主な洞察",
    noData: "データなし",
    prevPeriod: "前期間",
  },
};

const LOCALE_MAP: Record<string, string> = { en: "en-GB", id: "id-ID", ja: "ja-JP" };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface KpiItem {
  label: string;
  value: number;
  unit: "count" | "percent" | "currency";
  change?: number | null;
}

export interface ChartImage {
  title: string;
  pngBuffer: Buffer;
}

export interface TableData {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface PdfBuildOptions {
  reportTitle: string;
  periodStart: string;
  periodEnd: string;
  cycle: string;
  locale: string;
  currency: "IDR" | "USD";
  kpis: KpiItem[];
  insights: string[];
  charts: ChartImage[];
  tables: TableData[];
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
function formatDate(iso: string, locale: string): string {
  const d = new Date(iso + (iso.length === 7 ? "-01" : ""));
  return d.toLocaleDateString(LOCALE_MAP[locale] ?? "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatKpiValue(value: number, unit: string, currency: string): string {
  if (unit === "percent") return `${value.toFixed(2)}%`;
  if (unit === "currency") {
    const v = currency === "USD" ? value / IDR_USD_RATE : value;
    const prefix = currency === "USD" ? "$" : "Rp ";
    if (Math.abs(v) >= 1e12) return `${prefix}${(v / 1e12).toFixed(2)}T`;
    if (Math.abs(v) >= 1e9) return `${prefix}${(v / 1e9).toFixed(2)}B`;
    if (Math.abs(v) >= 1e6) return `${prefix}${(v / 1e6).toFixed(2)}M`;
    if (Math.abs(v) >= 1e3) return `${prefix}${(v / 1e3).toFixed(1)}K`;
    return `${prefix}${v.toFixed(currency === "USD" ? 2 : 0)}`;
  }
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
}

// ---------------------------------------------------------------------------
// PDF Builder
// ---------------------------------------------------------------------------
export function buildPdf(opts: PdfBuildOptions): Buffer {
  const labels = LABELS[opts.locale] ?? LABELS.en;
  const isJapanese = opts.locale === "ja";

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "letter",
  });

  // Register Noto Sans JP font
  registerFontWithJsPDF(doc);

  const setFont = (style: "normal" | "bold" = "normal") => {
    if (isJapanese) {
      doc.setFont("NotoSansJP", "normal");
    } else {
      doc.setFont("helvetica", style);
    }
  };

  const now = new Date().toISOString();
  let y = MARGIN;

  // ========================================================================
  // Cover page
  // ========================================================================
  // Brand logo
  try {
    const logoData = `data:image/png;base64,${getLogoBase64()}`;
    doc.addImage(logoData, "PNG", MARGIN, y, LOGO_WIDTH_MM, LOGO_HEIGHT_MM);
  } catch {
    // Fallback to text if logo fails to load
    setFont("bold");
    doc.setFontSize(28);
    doc.setTextColor(...BRAND_PRIMARY);
    doc.text("honest", MARGIN, y + 4);
  }
  // "BUSINESS REVIEWS" subtitle below the logo
  setFont("bold");
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_PRIMARY);
  doc.text("BUSINESS REVIEWS", MARGIN, y + LOGO_HEIGHT_MM + 4);

  // Confidential badge (top-right corner, aligned with logo)
  doc.setFontSize(8);
  doc.setTextColor(180, 0, 0);
  setFont("bold");
  doc.text(labels.confidential, PAGE_W - MARGIN, y + 4, { align: "right" });
  y += LOGO_HEIGHT_MM + 12;

  // Report title
  setFont("bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 30, 30);
  const titleLines = doc.splitTextToSize(opts.reportTitle, CONTENT_W);
  doc.text(titleLines, MARGIN, y);
  y += titleLines.length * 9 + 4;

  // Period & meta
  setFont("normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${opts.cycle.charAt(0).toUpperCase() + opts.cycle.slice(1)} Report`,
    MARGIN,
    y,
  );
  y += 5;
  doc.text(
    `${formatDate(opts.periodStart, opts.locale)} – ${formatDate(opts.periodEnd, opts.locale)}`,
    MARGIN,
    y,
  );
  y += 5;
  doc.text(`Currency: ${opts.currency}`, MARGIN, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(`${labels.generated}: ${formatDate(now, opts.locale)}`, MARGIN, y);
  y += 15;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 10;

  // ========================================================================
  // KPI Summary Grid (2 columns)
  // ========================================================================
  if (opts.kpis.length > 0) {
    setFont("bold");
    doc.setFontSize(13);
    doc.setTextColor(...BRAND_PRIMARY);
    doc.text("KPI Summary", MARGIN, y);
    y += 8;

    const kpiRows = opts.kpis.map((kpi) => {
      const changeStr =
        kpi.change === null || kpi.change === undefined || kpi.change === 0
          ? "—"
          : `${kpi.change > 0 ? "+" : ""}${kpi.change.toFixed(1)}%`;
      const arrow =
        kpi.change === null || kpi.change === undefined || kpi.change === 0
          ? ""
          : kpi.change > 0
            ? "▲"
            : "▼";
      return [kpi.label, formatKpiValue(kpi.value, kpi.unit, opts.currency), `${arrow} ${changeStr}`];
    });

    autoTable(doc, {
      startY: y,
      head: [[labels.metric, labels.value, labels.change]],
      body: kpiRows,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      headStyles: {
        fillColor: BRAND_PRIMARY,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
        font: isJapanese ? "NotoSansJP" : "helvetica",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [40, 40, 40],
        font: isJapanese ? "NotoSansJP" : "helvetica",
      },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 45, halign: "right", fontStyle: "bold" },
        2: { cellWidth: 35, halign: "center" },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ========================================================================
  // Insights
  // ========================================================================
  if (opts.insights.length > 0) {
    if (y > PAGE_H - 60) {
      doc.addPage();
      y = MARGIN;
    }

    setFont("bold");
    doc.setFontSize(11);
    doc.setTextColor(...BRAND_PRIMARY);
    doc.text(labels.keyInsights, MARGIN, y);
    y += 6;

    setFont("normal");
    doc.setFontSize(8.5);
    doc.setTextColor(50, 50, 50);

    for (const insight of opts.insights) {
      if (y > PAGE_H - 30) {
        doc.addPage();
        y = MARGIN;
      }
      const lines = doc.splitTextToSize(`• ${insight}`, CONTENT_W - 5);
      doc.text(lines, MARGIN + 2, y);
      y += lines.length * 3.8 + 2;
    }
    y += 6;
  }

  // ========================================================================
  // Charts — 2 per page with page-break protection
  // ========================================================================
  let chartsOnPage = 0;

  for (const chart of opts.charts) {
    const neededSpace = CHART_HEIGHT_MM + 14; // title + image + gap

    if (y + neededSpace > PAGE_H - 20 || chartsOnPage >= 2) {
      doc.addPage();
      y = MARGIN;
      chartsOnPage = 0;
    }

    // Chart title
    setFont("bold");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(chart.title, MARGIN, y);
    y += 5;

    // Embed chart PNG
    try {
      const imgData = `data:image/png;base64,${chart.pngBuffer.toString("base64")}`;
      // Maintain aspect ratio: 700x300 px → fit to content width
      const imgW = CONTENT_W;
      const imgH = (300 / 700) * CONTENT_W; // ~77mm
      doc.addImage(imgData, "PNG", MARGIN, y, imgW, imgH);
      y += imgH + CHART_GAP;
    } catch {
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`[Chart rendering failed: ${chart.title}]`, MARGIN, y + 5);
      y += 15;
    }

    chartsOnPage++;
  }

  // ========================================================================
  // Tables for categorical data
  // ========================================================================
  for (const table of opts.tables) {
    if (y + 40 > PAGE_H - 20) {
      doc.addPage();
      y = MARGIN;
    }

    setFont("bold");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(table.title, MARGIN, y);
    y += 5;

    autoTable(doc, {
      startY: y,
      head: [table.headers],
      body: table.rows,
      margin: { left: MARGIN, right: MARGIN },
      tableWidth: CONTENT_W,
      theme: "striped",
      headStyles: {
        fillColor: BRAND_PRIMARY,
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
        font: isJapanese ? "NotoSansJP" : "helvetica",
        overflow: "linebreak",
      },
      bodyStyles: {
        fontSize: 7,
        textColor: [40, 40, 40],
        font: isJapanese ? "NotoSansJP" : "helvetica",
        overflow: "linebreak",
      },
      alternateRowStyles: { fillColor: [248, 248, 252] },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ========================================================================
  // Footer & page numbers
  // ========================================================================
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, PAGE_H - 16, PAGE_W - MARGIN, PAGE_H - 16);

    // Footer text
    setFont("normal");
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.text(labels.footer, MARGIN, PAGE_H - 12);

    // Page number
    doc.setFontSize(7);
    doc.text(
      `${labels.page} ${i} ${labels.of} ${pageCount}`,
      PAGE_W / 2,
      PAGE_H - 8,
      { align: "center" },
    );

    // Timestamp
    doc.text(formatDate(now, opts.locale), PAGE_W - MARGIN, PAGE_H - 12, {
      align: "right",
    });
  }

  // Return as Buffer
  return Buffer.from(doc.output("arraybuffer"));
}
