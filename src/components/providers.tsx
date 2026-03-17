"use client";

import { SessionProvider } from "next-auth/react";
import { IS_STATIC_EXPORT, STATIC_SESSION } from "@/lib/static-mode";

/**
 * Auth provider wrapper.
 *
 * In static export mode (GitHub Pages), we pass a pre-filled mock session
 * so useSession() returns "authenticated" everywhere without a NextAuth backend.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (IS_STATIC_EXPORT) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <SessionProvider session={STATIC_SESSION as any}>{children}</SessionProvider>;
  }
  return <SessionProvider>{children}</SessionProvider>;
}
