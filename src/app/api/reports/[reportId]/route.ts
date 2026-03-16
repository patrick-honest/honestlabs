import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// GET /api/reports/[reportId]
//
// Returns full report data from the SQLite Report table.
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;

    const report = await prisma.report.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 },
      );
    }

    // Parse JSON fields stored as text
    const data = report.data ? JSON.parse(report.data) : null;
    const trends = report.trends ? JSON.parse(report.trends) : [];

    return NextResponse.json({
      id: report.id,
      cycle: report.cycle,
      periodStart: report.periodStart.toISOString().split("T")[0],
      periodEnd: report.periodEnd.toISOString().split("T")[0],
      section: report.section,
      title: report.title,
      data,
      trends,
      generatedAt: report.generatedAt.toISOString(),
      status: report.status,
      asOf: report.generatedAt.toISOString(),
      dataRange: {
        start: report.periodStart.toISOString().split("T")[0],
        end: report.periodEnd.toISOString().split("T")[0],
      },
    });
  } catch (err) {
    console.error("[GET /api/reports/:reportId]", err);
    return NextResponse.json(
      { error: "Failed to fetch report" },
      { status: 500 },
    );
  }
}
