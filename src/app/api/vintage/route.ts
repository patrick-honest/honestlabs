import { NextResponse } from "next/server";
import { getVintageCohorts } from "@/services/queries/vintage";

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

    const vintageCohorts = await getVintageCohorts(start, end);

    return NextResponse.json({
      vintageCohorts,
    });
  } catch (error) {
    console.error("[vintage] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch vintage data" },
      { status: 500 },
    );
  }
}
