/**
 * Detect if we're running in static export mode (GitHub Pages).
 * This is set at build time and baked into the client bundle.
 */
export const IS_STATIC_EXPORT =
  process.env.NEXT_PUBLIC_STATIC_EXPORT === "true";

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
