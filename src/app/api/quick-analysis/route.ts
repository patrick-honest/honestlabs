import { NextResponse } from "next/server";
import { getTimeSeriesForMetric, SUPPORTED_METRICS } from "@/services/queries/quick-analysis";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const metricKey = searchParams.get("metricKey");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate query params are required" },
        { status: 400 },
      );
    }

    if (!metricKey) {
      return NextResponse.json(
        { error: `metricKey query param is required. Supported: ${SUPPORTED_METRICS.join(", ")}` },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const timeSeries = await getTimeSeriesForMetric(metricKey, start, end);

    return NextResponse.json({
      metricKey,
      timeSeries,
    });
  } catch (error) {
    console.error("[quick-analysis] Query failed:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch quick analysis data";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
