"use client";

import { Header } from "@/components/layout/header";
import { UserSearchForm } from "@/components/search/user-search-form";
import { UserInfoCard } from "@/components/search/user-info-card";
import { useTheme } from "@/hooks/use-theme";
import { useSearchState } from "@/hooks/use-search-state";
import { IS_STATIC_EXPORT } from "@/lib/static-mode";
import { AlertCircle, SearchX, Database, Clock } from "lucide-react";

export default function SearchPage() {
  if (IS_STATIC_EXPORT) {
    return (
      <div className="flex flex-col">
        <Header title="User Search" />
        <div className="flex items-center justify-center min-h-[60vh] p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Database className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Read-Only Mode</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Live user search requires a BigQuery connection and is disabled in the public demo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Search state persists across navigation via context
  const { result, loading, searched, error, meta, search } = useSearchState();
  const { isDark } = useTheme();

  return (
    <div className="flex flex-col">
      <Header title="User Search" />

      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">User Search</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Look up a cardholder by ID, URN, CRN, LOC, or application ID
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
            <AlertCircle className="h-3 w-3" />
            <span>Phone and email can be used for search but are never stored or displayed in results (PII protection)</span>
          </div>
        </div>

        <UserSearchForm onSearch={search} isLoading={loading} />

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className={`h-8 w-8 animate-spin rounded-full border-2 border-t-transparent ${
              isDark ? "border-[#5B22FF]" : "border-[#D00083]"
            }`} />
            <span className="text-xs text-[var(--text-muted)]">Querying BigQuery...</span>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className={`rounded-xl border p-8 text-center ${
            isDark ? "border-[var(--danger)]/30 bg-[var(--danger)]/5" : "border-[var(--danger)]/30 bg-[var(--danger)]/5"
          }`}>
            <SearchX className="mx-auto h-10 w-10 text-[var(--danger)] mb-3" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {error}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Check the identifier and try again.
            </p>
          </div>
        )}

        {/* Result */}
        {!loading && result && (
          <div className="space-y-3">
            {/* Meta info */}
            {meta && (
              <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>As of: {new Date(meta.asOf).toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Database className="h-3 w-3" />
                  <span>{meta.cached ? "Served from cache" : "Live from BigQuery"}</span>
                </div>
              </div>
            )}
            <UserInfoCard user={result} />
          </div>
        )}

        {/* No results */}
        {!loading && searched && !result && !error && (
          <div className={`rounded-xl border p-8 text-center ${
            isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)] shadow-sm"
          }`}>
            <SearchX className="mx-auto h-10 w-10 text-[var(--text-muted)] mb-3" />
            <p className="text-sm font-medium text-[var(--text-primary)]">
              No results found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
