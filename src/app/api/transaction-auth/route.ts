import { NextResponse } from "next/server";
import {
  getAuthApprovalRateTrend,
  getDeclineByReasonCode,
  getAuthByChannel,
  getAuthVolumeByDay,
} from "@/services/queries/transaction-auth";

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

    const [approvalRateTrend, declineByReason, authByChannel, volumeByDay] =
      await Promise.all([
        getAuthApprovalRateTrend(start, end),
        getDeclineByReasonCode(start, end),
        getAuthByChannel(start, end),
        getAuthVolumeByDay(start, end),
      ]);

    return NextResponse.json({
      approvalRateTrend,
      declineByReason,
      authByChannel,
      volumeByDay,
    });
  } catch (error) {
    console.error("[transaction-auth] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction auth data" },
      { status: 500 },
    );
  }
}
