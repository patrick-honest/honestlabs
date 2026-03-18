import { NextResponse } from "next/server";
import {
  getCLITrend,
  getCLIByType,
  getCliVolumeTrend,
  getCliByRiskCategory,
  getUtilizationPrePostCli,
} from "@/services/queries/credit-line";

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
      cliTrend,
      cliByType,
      cliVolumeTrend,
      cliByRiskCategory,
      utilizationPrePostCli,
    ] = await Promise.all([
      getCLITrend(start, end),
      getCLIByType(start, end),
      getCliVolumeTrend(start, end),
      getCliByRiskCategory(start, end),
      getUtilizationPrePostCli(start, end),
    ]);

    return NextResponse.json({
      cliTrend,
      cliByType,
      cliVolumeTrend,
      cliByRiskCategory,
      utilizationPrePostCli,
    });
  } catch (error) {
    console.error("[credit-line] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit line data" },
      { status: 500 },
    );
  }
}
