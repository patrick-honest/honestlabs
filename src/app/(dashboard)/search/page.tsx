"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { UserSearchForm } from "@/components/search/user-search-form";
import { UserInfoCard } from "@/components/search/user-info-card";
import { useTheme } from "@/hooks/use-theme";
import { AlertCircle, SearchX, Database, Clock } from "lucide-react";
import type { UserSearchResult, SearchField } from "@/types/search";

export default function SearchPage() {
  const [result, setResult] = useState<UserSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ asOf: string; cached: boolean } | null>(null);
  const { isDark } = useTheme();

  const handleSearch = async (query: string, field: SearchField) => {
    setLoading(true);
    setSearched(true);
    setError(null);
    setResult(null);
    setMeta(null);

    try {
      const params = new URLSearchParams({ field, query });
      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Search failed (${res.status})`);
        return;
      }

      setResult(data.user);
      setMeta({ asOf: data.asOf, cached: data.cached });
    } catch (err) {
      setError(`Network error: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

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

        <UserSearchForm onSearch={handleSearch} isLoading={loading} />

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
