import { NextResponse } from "next/server";
import {
  getChannelBreakdown,
  getDeclineBreakdown,
  getQrisOnlyMerchantGrowth,
  getMixedMerchantQrisVolume,
} from "@/services/queries/spend-analysis";

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

    const [channelBreakdown, declineBreakdown, qrisMerchantGrowth, mixedMerchantVolume] =
      await Promise.all([
        getChannelBreakdown(start, end),
        getDeclineBreakdown(start, end),
        getQrisOnlyMerchantGrowth(),
        getMixedMerchantQrisVolume(start, end),
      ]);

    return NextResponse.json({
      channelBreakdown,
      declineBreakdown,
      qrisMerchantGrowth,
      mixedMerchantVolume,
    });
  } catch (error) {
    console.error("[spend-analysis] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch spend analysis data" },
      { status: 500 },
    );
  }
}
