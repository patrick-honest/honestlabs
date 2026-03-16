import { NextRequest, NextResponse } from "next/server";
import {
  generateExecutiveReport,
  generateSectionReport,
  generateAllReports,
} from "@/services/report-generator";
import type { Cycle } from "@/lib/dates";

// ---------------------------------------------------------------------------
// POST /api/reports/generate
//
// Body: { cycle: string, section?: string, periodStart?: string }
// Triggers report generation and stores results in both SQLite (Report table)
// and the cache layer.
// ---------------------------------------------------------------------------

const VALID_CYCLES = new Set<string>(["weekly", "monthly", "quarterly", "yearly"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const cycle = body.cycle as string;
    const section = body.section as string | undefined;
    const periodStart = body.periodStart as string | undefined;

    if (!cycle || !VALID_CYCLES.has(cycle)) {
      return NextResponse.json(
        { error: `cycle is required and must be one of: ${[...VALID_CYCLES].join(", ")}` },
        { status: 400 },
      );
    }

    const startDate = periodStart ? new Date(periodStart) : undefined;

    let reportId: string;

    if (section) {
      if (section === "executive") {
        const report = await generateExecutiveReport(cycle as Cycle, startDate);
        reportId = report.id;
      } else {
        const report = await generateSectionReport(section, cycle as Cycle, startDate);
        reportId = report.id;
      }
    } else {
      // Generate all sections
      const reports = await generateAllReports(cycle as Cycle, startDate);
      reportId = reports[0]?.id || "none";
    }

    return NextResponse.json({
      success: true,
      reportId,
      asOf: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[POST /api/reports/generate]", err);
    return NextResponse.json(
      { error: "Failed to generate report", details: String(err) },
      { status: 500 },
    );
  }
}
