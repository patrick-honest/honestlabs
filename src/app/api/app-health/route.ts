import { NextResponse } from "next/server";
import {
  getActiveUsers,
  getTopScreens,
  getSessionMetrics,
} from "@/services/queries/app-health";

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

    const [
      activeUsers,
      topScreens,
      sessionMetrics,
    ] = await Promise.all([
      getActiveUsers(start, end),
      getTopScreens(start, end),
      getSessionMetrics(start, end),
    ]);

    return NextResponse.json({
      activeUsers,
      topScreens,
      sessionMetrics,
    });
  } catch (error) {
    console.error("[app-health] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch app health data" },
      { status: 500 },
    );
  }
}
