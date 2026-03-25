"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  IS_STATIC_EXPORT,
  STATIC_SESSION,
  isStaticAuthenticated,
} from "@/lib/static-mode";

/**
 * Auth provider wrapper.
 *
 * In static export mode, session is controlled by localStorage login state.
 * If not authenticated, no session is provided (login page will handle it).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!IS_STATIC_EXPORT);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (IS_STATIC_EXPORT) {
      setAuthed(isStaticAuthenticated());
      setReady(true);
    }
  }, []);

  // Listen for login/logout events from other components
  useEffect(() => {
    if (!IS_STATIC_EXPORT) return;
    const handler = () => setAuthed(isStaticAuthenticated());
    window.addEventListener("static-auth-change", handler);
    return () => window.removeEventListener("static-auth-change", handler);
  }, []);

  if (!ready) return null;

  if (IS_STATIC_EXPORT) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = authed ? (STATIC_SESSION as any) : undefined;
    return <SessionProvider session={session}>{children}</SessionProvider>;
  }

  return <SessionProvider>{children}</SessionProvider>;
}
