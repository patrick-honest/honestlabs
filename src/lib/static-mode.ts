/**
 * Detect if we're running without a NextAuth backend.
 *
 * Two modes trigger this:
 *  - NEXT_PUBLIC_STATIC_EXPORT=true  → Cloudflare Pages / GitHub Pages static export
 *  - NEXT_PUBLIC_DEMO_MODE=true      → Vercel/hosted demo (no Google OAuth)
 *
 * When active, authentication is handled client-side via localStorage.
 */
export const IS_STATIC_EXPORT =
  process.env.NEXT_PUBLIC_STATIC_EXPORT === "true" ||
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** Key used to persist login state in localStorage */
export const AUTH_STORAGE_KEY = "honestinfo_authenticated";

/**
 * Mock session data used after successful client-side login.
 */
export const STATIC_SESSION = {
  user: {
    name: "User",
    email: "user@honestbank.com",
    image: null,
  },
  expires: "2099-12-31T23:59:59.999Z",
};

/** Hardcoded credentials for static export login */
export const STATIC_CREDENTIALS = {
  username: "User",
  password: "HonestInfo123",
};

/**
 * Check if the user is authenticated in static export mode.
 */
export function isStaticAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

/**
 * Set authentication state in static export mode.
 */
export function setStaticAuthenticated(value: boolean): void {
  if (typeof window === "undefined") return;
  if (value) {
    localStorage.setItem(AUTH_STORAGE_KEY, "true");
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}
