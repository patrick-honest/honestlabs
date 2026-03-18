import { NextResponse } from "next/server";
import {
  getReferralFunnel,
  getReferralByChannel,
  getReferralFunnelTrend,
  getReferralApprovalRate,
  getReferralsPerUser,
} from "@/services/queries/referral";

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
      referralFunnel,
      referralByChannel,
      referralFunnelTrend,
      referralApprovalRate,
      referralsPerUser,
    ] = await Promise.all([
      getReferralFunnel(start, end),
      getReferralByChannel(start, end),
      getReferralFunnelTrend(start, end),
      getReferralApprovalRate(start, end),
      getReferralsPerUser(start, end),
    ]);

    return NextResponse.json({
      referralFunnel,
      referralByChannel,
      referralFunnelTrend,
      referralApprovalRate,
      referralsPerUser,
    });
  } catch (error) {
    console.error("[referral] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch referral data" },
      { status: 500 },
    );
  }
}
