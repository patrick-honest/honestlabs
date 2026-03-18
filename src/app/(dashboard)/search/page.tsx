"use client";

import { Header } from "@/components/layout/header";
import { UserSearchForm } from "@/components/search/user-search-form";
import { UserInfoCard } from "@/components/search/user-info-card";
import { useTheme } from "@/hooks/use-theme";
import { useSearchState } from "@/hooks/use-search-state";
import { IS_STATIC_EXPORT } from "@/lib/static-mode";
import { cn } from "@/lib/utils";
import { AlertCircle, SearchX, Database, Clock, Bookmark, BookmarkPlus, X, User } from "lucide-react";

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

  const {
    result, loading, searched, error, meta, search,
    savedUsers, saveCurrentUser, removeSavedUser, loadSavedUser,
  } = useSearchState();
  const { isDark } = useTheme();

  const isCurrentSaved = result ? savedUsers.some((u) => u.user_id === result.user_id) : false;

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

        {/* Saved users bar */}
        {savedUsers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider shrink-0",
              isDark ? "text-[#7C4DFF]/60" : "text-[#D00083]/60"
            )}>
              <Bookmark className="h-3 w-3" />
              Saved
            </span>
            {savedUsers.map((saved) => (
              <div
                key={saved.user_id}
                className={cn(
                  "group inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer",
                  result?.user_id === saved.user_id
                    ? isDark
                      ? "border-[#5B22FF] bg-[#5B22FF]/15 text-[#7C4DFF]"
                      : "border-[#D00083] bg-[#D00083]/10 text-[#D00083]"
                    : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                <button
                  onClick={() => loadSavedUser(saved.user_id)}
                  className="flex items-center gap-1"
                >
                  <User className="h-3 w-3" />
                  <span>{saved.label}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeSavedUser(saved.user_id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-muted)] hover:text-[var(--danger)]"
                  aria-label="Remove saved user"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

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
            {/* Meta info + Save button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-[10px] text-[var(--text-muted)]">
                {meta && (
                  <>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>As of: {new Date(meta.asOf).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      <span>{meta.cached ? "Served from cache" : "Live from BigQuery"}</span>
                    </div>
                  </>
                )}
              </div>

              {/* + Save Result button */}
              {!isCurrentSaved ? (
                <button
                  onClick={saveCurrentUser}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    isDark
                      ? "border-[#5B22FF]/40 text-[#7C4DFF] hover:bg-[#5B22FF]/15"
                      : "border-[#D00083]/40 text-[#D00083] hover:bg-[#D00083]/10"
                  )}
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  <span>Save Result</span>
                </button>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  <Bookmark className="h-3.5 w-3.5" />
                  Saved
                </span>
              )}
            </div>

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
