import { NextResponse } from "next/server";
import {
  getCollectionsActivityTrend,
  getCollectionsStatusBreakdown,
  getDpdCureRate,
  getWriteOffTrend,
} from "@/services/queries/collections-deep-dive";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate query params are required" },
        { status: 400 },
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const [activityTrend, statusBreakdown, cureRate, writeOffTrend] =
      await Promise.all([
        getCollectionsActivityTrend(start, end),
        getCollectionsStatusBreakdown(end),
        getDpdCureRate(start, end),
        getWriteOffTrend(start, end),
      ]);

    return NextResponse.json({
      activityTrend,
      statusBreakdown,
      cureRate,
      writeOffTrend,
    });
  } catch (error) {
    console.error("[collections] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch collections data" },
      { status: 500 },
    );
  }
}
