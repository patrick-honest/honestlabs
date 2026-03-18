import { NextResponse } from "next/server";
import {
  getActivationRateTrend,
  getDaysToFirstTransaction,
  getActivationByProductType,
  getPinSetRateTrend,
} from "@/services/queries/activation-deep-dive";

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
      activationRateTrend,
      daysToFirstTransaction,
      activationByProductType,
      pinSetRateTrend,
    ] = await Promise.all([
      getActivationRateTrend(start, end),
      getDaysToFirstTransaction(start, end),
      getActivationByProductType(start, end),
      getPinSetRateTrend(start, end),
    ]);

    return NextResponse.json({
      activationRateTrend,
      daysToFirstTransaction,
      activationByProductType,
      pinSetRateTrend,
    });
  } catch (error) {
    console.error("[activation] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch activation data" },
      { status: 500 },
    );
  }
}
