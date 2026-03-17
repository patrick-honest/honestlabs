/**
 * Detect if we're running without authentication.
 *
 * Two modes trigger this:
 *  - NEXT_PUBLIC_STATIC_EXPORT=true  → GitHub Pages static export
 *  - NEXT_PUBLIC_DEMO_MODE=true      → Vercel/hosted demo (no Google OAuth)
 *
 * When active, a mock session is injected and access control is bypassed.
 */
export const IS_STATIC_EXPORT =
  process.env.NEXT_PUBLIC_STATIC_EXPORT === "true" ||
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/**
 * Mock session data used in static export mode.
 * Simulates a logged-in viewer with read-only access.
 */
export const STATIC_SESSION = {
  user: {
    name: "Viewer",
    email: "viewer@honestbank.com",
    image: null,
  },
  expires: "2099-12-31T23:59:59.999Z",
};
