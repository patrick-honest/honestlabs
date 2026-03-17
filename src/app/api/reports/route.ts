import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ---------------------------------------------------------------------------
// GET /api/reports?cycle=weekly&section=executive&search=&page=1&limit=20
//
// Lists reports from the SQLite Report table via Prisma.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!prisma) {
    return NextResponse.json({ reports: [], total: 0, page: 1, limit: 20, asOf: new Date().toISOString() });
  }
  try {
    const { searchParams } = new URL(request.url);
    const cycle = searchParams.get("cycle") || undefined;
    const section = searchParams.get("section") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (cycle) where.cycle = cycle;
    if (section) where.section = section;
    if (search) {
      where.title = { contains: search };
    }

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        select: {
          id: true,
          cycle: true,
          periodStart: true,
          periodEnd: true,
          section: true,
          title: true,
          generatedAt: true,
          status: true,
        },
        orderBy: { generatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.report.count({ where }),
    ]);

    // Format dates for JSON response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatted = reports.map((r: any) => ({
      id: r.id,
      cycle: r.cycle,
      periodStart: r.periodStart.toISOString().split("T")[0],
      periodEnd: r.periodEnd.toISOString().split("T")[0],
      section: r.section,
      title: r.title,
      generatedAt: r.generatedAt.toISOString(),
      status: r.status,
    }));

    const response = NextResponse.json({
      reports: formatted,
      total,
      page,
      limit,
      asOf: new Date().toISOString(),
    });

    // Reports list is fairly static — cache for 5 min
    response.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=600, stale-while-revalidate=300",
    );
    return response;
  } catch (err) {
    console.error("[GET /api/reports]", err);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 },
    );
  }
}
