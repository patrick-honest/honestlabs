"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { hasPageAccess, APP_OWNER } from "@/lib/access-control";
import { IS_STATIC_EXPORT } from "@/lib/static-mode";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Wraps a page and checks if the current user is on the allowlist.
 * If not, shows a "Request Access" screen instead of the page content.
 * In static export mode, all pages are accessible (read-only public demo).
 */
export function PageGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");

  // Static export mode — bypass access control
  if (IS_STATIC_EXPORT) return <>{children}</>;

  // While loading session, show nothing (avoids flash)
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-[var(--text-muted)] text-sm">{tCommon("loading")}</div>
      </div>
    );
  }

  const email = session?.user?.email;
  const allowed = hasPageAccess(email, pathname);

  if (!allowed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-md w-full text-center space-y-6">
          {/* Lock icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Lock className="w-8 h-8 text-red-500 dark:text-red-400" />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {tAuth("accessRestricted")}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {tAuth("accessMessage", { email: email || "unknown" })}
            </p>
          </div>

          {/* Request access */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left">
            <p className="text-sm text-[var(--text-secondary)] font-medium mb-1">
              {tAuth("needAccess")}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {tAuth("contactAdmin")}{" "}
              <a
                href={`mailto:${APP_OWNER}?subject=Access request: ${pathname}`}
                className="text-blue-500 hover:underline font-medium"
              >
                {APP_OWNER}
              </a>
            </p>
          </div>

          {/* Go back */}
          <a
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-colors"
          >
            {tAuth("goToDashboard")}
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
