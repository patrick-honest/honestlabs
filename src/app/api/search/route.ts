import { NextRequest, NextResponse } from "next/server";
import { searchUserById, resolveToUserId } from "@/services/queries/user-search";
import { getCached, setCached } from "@/lib/cache";

// ---------------------------------------------------------------------------
// GET /api/search?field=<field>&query=<value>
// Also supports legacy: ?userId=<uuid>
//
// Supported fields: user_id, loc, crn, urn, anonymous_id, application_id, phone, email
// Checks SQLite cache first (2h TTL), falls back to BigQuery live.
// PII masking is applied inside searchUserById before data leaves the server.
// ---------------------------------------------------------------------------

const VALID_FIELDS = new Set([
  "user_id", "loc", "crn", "urn", "anonymous_id", "application_id", "phone", "email",
]);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Support both new format (?field=&query=) and legacy (?userId=)
    let field = searchParams.get("field") || "user_id";
    let query = searchParams.get("query") || searchParams.get("userId") || "";

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "query parameter is required" },
        { status: 400 },
      );
    }

    query = query.trim();
    field = field.trim().toLowerCase();

    if (!VALID_FIELDS.has(field)) {
      return NextResponse.json(
        { error: `Invalid field: ${field}. Supported: ${[...VALID_FIELDS].join(", ")}` },
        { status: 400 },
      );
    }

    // UUID format validation for user_id field
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (field === "user_id" && !uuidRegex.test(query)) {
      return NextResponse.json(
        { error: "user_id must be a valid UUID" },
        { status: 400 },
      );
    }

    // Build cache key from field + query
    const cacheKeyStr = `search:${field}:${query}`;
    const forceRefresh = searchParams.get("refresh") === "true";

    // Check cache first (2h TTL for user lookups) — skip if refresh=true
    const cached = !forceRefresh ? getCached<{ user: unknown }>(cacheKeyStr) : null;
    if (cached) {
      const response = NextResponse.json({
        user: cached.data.user,
        asOf: cached.updatedAt,
        dataRange: { start: "cached", end: "cached" },
        cached: true,
      });
      response.headers.set("Cache-Control", "private, max-age=120");
      return response;
    }

    // Resolve to user_id if needed
    let userId: string;
    if (field === "user_id") {
      userId = query;
    } else {
      const resolved = await resolveToUserId(field, query);
      if (!resolved) {
        return NextResponse.json(
          { error: "No user found for the given identifier", field, query },
          { status: 404 },
        );
      }
      userId = resolved;
    }

    const result = await searchUserById(userId);

    if (!result) {
      return NextResponse.json(
        { error: "User not found", userId },
        { status: 404 },
      );
    }

    // Cache the result for 2 hours
    setCached(cacheKeyStr, { user: result }, 2);

    const response = NextResponse.json({
      user: result,
      asOf: new Date().toISOString(),
      dataRange: { start: "live", end: "live" },
      cached: false,
    });
    response.headers.set("Cache-Control", "private, max-age=120");
    return response;
  } catch (err) {
    console.error("[GET /api/search]", err);
    return NextResponse.json(
      { error: "Failed to search user", details: String(err) },
      { status: 500 },
    );
  }
}
