/**
 * Page-level access control configuration.
 *
 * Some pages (like Orico partner reports) are restricted to an allowlist
 * of specific users. The app owner / administrator has full access to
 * everything and can manage these lists.
 */

/** App owner with full access to all pages and admin capabilities */
export const APP_OWNER = "patrick@honestbank.com";

/**
 * Per-page allowlists.
 *
 * Key = route path prefix (matched with startsWith).
 * Value = array of allowed email addresses.
 *
 * If a route is NOT listed here, it's open to all authenticated
 * @honestbank.com / @honest.co.id users.
 *
 * The APP_OWNER always has access regardless of allowlist.
 */
export const PAGE_ALLOWLISTS: Record<string, string[]> = {};

/**
 * Check if a user has access to a given path.
 *
 * @param email - The user's email address
 * @param path  - The current route path
 * @returns true if the user can access the page
 */
export function hasPageAccess(email: string | null | undefined, path: string): boolean {
  if (!email) return false;

  // App owner has full access
  if (email.toLowerCase() === APP_OWNER.toLowerCase()) return true;

  // Find the most specific matching allowlist
  const matchingRule = Object.entries(PAGE_ALLOWLISTS)
    .filter(([prefix]) => path.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0];

  // No allowlist rule = open to all authenticated users
  if (!matchingRule) return true;

  const [, allowedEmails] = matchingRule;
  return allowedEmails.some((e) => e.toLowerCase() === email.toLowerCase());
}

/**
 * Get the allowlist for a page, or null if the page is open.
 */
export function getPageAllowlist(path: string): string[] | null {
  const matchingRule = Object.entries(PAGE_ALLOWLISTS)
    .filter(([prefix]) => path.startsWith(prefix))
    .sort((a, b) => b[0].length - a[0].length)[0];

  if (!matchingRule) return null;
  return [APP_OWNER, ...matchingRule[1]];
}
