"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { UserSearchResult, SearchField } from "@/types/search";

interface SearchMeta {
  asOf: string;
  cached: boolean;
}

interface SearchStateContextValue {
  /** Last search result (persists across navigation) */
  result: UserSearchResult | null;
  /** Loading state */
  loading: boolean;
  /** Whether a search has been performed */
  searched: boolean;
  /** Error message if search failed */
  error: string | null;
  /** Metadata (asOf, cached) */
  meta: SearchMeta | null;
  /** Last search query + field */
  lastQuery: { query: string; field: SearchField } | null;
  /** Perform a search */
  search: (query: string, field: SearchField) => Promise<void>;
  /** Clear current results */
  clear: () => void;
}

const SearchStateContext = createContext<SearchStateContextValue | undefined>(undefined);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<UserSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [lastQuery, setLastQuery] = useState<{ query: string; field: SearchField } | null>(null);

  const search = useCallback(async (query: string, field: SearchField) => {
    setLoading(true);
    setSearched(true);
    setError(null);
    setResult(null);
    setMeta(null);
    setLastQuery({ query, field });

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
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setSearched(false);
    setError(null);
    setMeta(null);
    setLastQuery(null);
  }, []);

  return (
    <SearchStateContext.Provider
      value={{ result, loading, searched, error, meta, lastQuery, search, clear }}
    >
      {children}
    </SearchStateContext.Provider>
  );
}

export function useSearchState(): SearchStateContextValue {
  const ctx = useContext(SearchStateContext);
  if (!ctx) throw new Error("useSearchState must be used within SearchStateProvider");
  return ctx;
}
