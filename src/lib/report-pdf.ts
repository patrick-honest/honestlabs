import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ---------------------------------------------------------------------------
// Report PDF Generator
// ---------------------------------------------------------------------------

export interface ReportKpi {
  label: string;
  value: number;
  unit: string;
  change: number | null;
}

export interface ReportSection {
  id: string;
  section: string;
  title: string;
  kpis: ReportKpi[];
  trends: string[];
}

export interface ReportData {
  id: string;
  cycle: string;
  periodStart: string;
  periodEnd: string;
  section: string;
  title: string;
  generatedAt: string;
  kpis: ReportKpi[];
  trends: string[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatKpiValue(value: number, unit: string): string {
  if (unit === "%") return `${value}%`;
  if (unit === "B") return `IDR ${value}B`;
  if (unit === "M") return `IDR ${value}M`;
  if (value >= 1_000_000_000) return `IDR ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

// ── Render a single section into the PDF ──
function renderSection(
  doc: jsPDF,
  section: { title: string; kpis: ReportKpi[]; trends: string[] },
  margin: number,
  contentWidth: number,
  startY: number,
): number {
  let y = startY;
  const pageWidth = doc.internal.pageSize.getWidth();

  // Section title
  doc.setFontSize(13);
  doc.setTextColor(91, 34, 255);
  doc.setFont("helvetica", "bold");
  doc.text(section.title, margin, y);
  y += 2;
  doc.setDrawColor(91, 34, 255);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + 50, y);
  y += 6;

  // KPI table
  if (section.kpis.length > 0) {
    const kpiRows = section.kpis.map((kpi) => {
      const changeStr =
        kpi.change === null || kpi.change === 0
          ? "—"
          : `${kpi.change > 0 ? "+" : ""}${kpi.change}%`;
      const direction =
        kpi.change === null || kpi.change === 0
          ? ""
          : kpi.change > 0 ? "▲" : "▼";
      return [kpi.label, formatKpiValue(kpi.value, kpi.unit), `${direction} ${changeStr}`];
    });

    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value", "Change"]],
      body: kpiRows,
      margin: { left: margin, right: margin },
      theme: "grid",
      headStyles: {
        fillColor: [91, 34, 255],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 45, halign: "right", fontStyle: "bold" },
        2: { cellWidth: 35, halign: "center" },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Trends
  if (section.trends.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text("Key Observations", margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);

    for (const trend of section.trends) {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.text("•", margin, y);
      const lines = doc.splitTextToSize(trend, contentWidth - 8);
      doc.text(lines, margin + 5, y);
      y += lines.length * 3.8 + 1.5;
    }
  }

  return y + 4;
}

/**
 * Generate a single-section report PDF.
 */
export function generateReportPdf(report: ReportData): void {
  generateCombinedReportPdf({
    cycle: report.cycle,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    generatedAt: report.generatedAt,
    overallTitle: report.title,
    sections: [{
      title: report.section,
      kpis: report.kpis,
      trends: report.trends,
    }],
  });
}

/**
 * Generate a combined PDF with multiple sections (for past reports).
 */
export function generateCombinedReportPdf(opts: {
  cycle: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  overallTitle: string;
  sections: { title: string; kpis: ReportKpi[]; trends: string[] }[];
}): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Logo header ──
  doc.setFontSize(20);
  doc.setTextColor(91, 34, 255);
  doc.setFont("helvetica", "bold");
  doc.text("honest", margin, y + 1);
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.text("CONFIDENTIAL", pageWidth - margin, y, { align: "right" });
  doc.text(
    `Generated: ${formatDate(opts.generatedAt)}`,
    pageWidth - margin,
    y + 3.5,
    { align: "right" }
  );
  y += 10;

  // ── Report title ──
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.text(opts.overallTitle, margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${opts.cycle.charAt(0).toUpperCase() + opts.cycle.slice(1)} · ${formatDate(opts.periodStart)} – ${formatDate(opts.periodEnd)}`,
    margin,
    y
  );
  y += 8;

  // ── Divider ──
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Render each section ──
  for (let i = 0; i < opts.sections.length; i++) {
    const section = opts.sections[i];

    // Start new page for sections after the first (if we're already past half the page)
    if (i > 0 && y > 150) {
      doc.addPage();
      y = margin;
    } else if (i > 0) {
      y += 4;
    }

    y = renderSection(doc, section, margin, contentWidth, y);
  }

  // ── Footer ──
  if (y > 255) {
    doc.addPage();
    y = margin;
  }
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text("Honest Bank · Data sourced from BigQuery (storage-58f5a02c) · Product type: Regular (default)", margin, y);

  // ── Page numbers ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  // ── Save ──
  const filename = `honest-${opts.cycle}-${opts.periodStart}-report.pdf`;
  doc.save(filename);
}
