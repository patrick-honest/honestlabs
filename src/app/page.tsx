"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { IS_STATIC_EXPORT, isStaticAuthenticated } from "@/lib/static-mode";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    if (IS_STATIC_EXPORT && !isStaticAuthenticated()) {
      router.replace("/login");
    } else {
      router.replace("/dashboard");
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <p className="text-[var(--text-muted)] text-sm animate-pulse">Loading...</p>
    </div>
  );
}
