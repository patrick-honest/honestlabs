import { NextRequest, NextResponse } from "next/server";
import { getChannelQuality } from "@/services/queries/channel-quality";

// ---------------------------------------------------------------------------
// GET /api/channel-quality?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//
// Returns real BigQuery channel quality data.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2025-01-01";
    const endDate = searchParams.get("endDate") || "2026-03-16";

    const data = await getChannelQuality(
      new Date(startDate),
      new Date(endDate),
    );

    const response = NextResponse.json({
      channels: data,
      asOf: new Date().toISOString(),
      dataRange: { start: startDate, end: endDate },
    });

    response.headers.set(
      "Cache-Control",
      "public, max-age=300, s-maxage=900, stale-while-revalidate=600",
    );
    return response;
  } catch (err) {
    console.error("[GET /api/channel-quality]", err);
    return NextResponse.json(
      { error: "Failed to fetch channel quality data", details: String(err) },
      { status: 500 },
    );
  }
}
