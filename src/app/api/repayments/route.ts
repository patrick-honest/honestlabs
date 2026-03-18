import { NextResponse } from "next/server";
import {
  getRepaymentVolumeTrend,
  getRepaymentByVendor,
  getRepaymentTimeliness,
  getRepaymentToBalanceRatio,
} from "@/services/queries/repayments-deep-dive";

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

    const [volumeTrend, byVendor, timeliness, balanceRatio] =
      await Promise.all([
        getRepaymentVolumeTrend(start, end),
        getRepaymentByVendor(start, end),
        getRepaymentTimeliness(end),
        getRepaymentToBalanceRatio(start, end),
      ]);

    return NextResponse.json({
      volumeTrend,
      byVendor,
      timeliness,
      balanceRatio,
    });
  } catch (error) {
    console.error("[repayments] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch repayments data" },
      { status: 500 },
    );
  }
}
