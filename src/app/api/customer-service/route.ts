import { NextResponse } from "next/server";
import {
  getTicketVolumeTrend,
  getTicketsByCategory,
  getResolutionMetrics,
  getTicketsByPriority,
  getTicketsByStatus,
} from "@/services/queries/customer-service-deep-dive";

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
      ticketVolumeTrend,
      ticketsByCategory,
      resolutionMetrics,
      ticketsByPriority,
      ticketsByStatus,
    ] = await Promise.all([
      getTicketVolumeTrend(start, end),
      getTicketsByCategory(start, end),
      getResolutionMetrics(start, end),
      getTicketsByPriority(start, end),
      getTicketsByStatus(start, end),
    ]);

    return NextResponse.json({
      ticketVolumeTrend,
      ticketsByCategory,
      resolutionMetrics,
      ticketsByPriority,
      ticketsByStatus,
    });
  } catch (error) {
    console.error("[customer-service] Query failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer service data" },
      { status: 500 },
    );
  }
}
