import { NextRequest, NextResponse } from "next/server";
import { searchUserById } from "@/services/queries/user-search";

// ---------------------------------------------------------------------------
// GET /api/search?userId=<uuid>
//
// Always hits BigQuery live — single-user queries are cheap.
// PII masking is applied inside searchUserById before data leaves the server.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId || userId.trim().length === 0) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 },
      );
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId.trim())) {
      return NextResponse.json(
        { error: "userId must be a valid UUID" },
        { status: 400 },
      );
    }

    const result = await searchUserById(userId.trim());

    if (!result) {
      return NextResponse.json(
        { error: "User not found", userId },
        { status: 404 },
      );
    }

    return NextResponse.json({
      user: result,
      asOf: new Date().toISOString(),
      dataRange: { start: "live", end: "live" },
    });
  } catch (err) {
    console.error("[GET /api/search]", err);
    return NextResponse.json(
      { error: "Failed to search user", details: String(err) },
      { status: 500 },
    );
  }
}
