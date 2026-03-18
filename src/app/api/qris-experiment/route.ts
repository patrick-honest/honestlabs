import { NextResponse } from "next/server";
import { getQrisCohortComparison } from "@/services/queries/qris-experiment";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate") || "2026-02-09";

    const cohortComparison = await getQrisCohortComparison(startDate);

    return NextResponse.json({ cohortComparison });
  } catch (error) {
    console.error("[qris-experiment] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch QRIS experiment data" },
      { status: 500 },
    );
  }
}
