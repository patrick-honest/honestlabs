"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { UserSearchResult, SearchField } from "@/types/search";

interface SearchMeta {
  asOf: string;
  cached: boolean;
}

export interface SavedUser {
  user_id: string;
  label: string; // short display label (e.g. LOC or last 8 of UUID)
  savedAt: number; // timestamp for ordering
}

const MAX_SAVED = 10;
const STORAGE_KEY = "honest_saved_users";

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
  /** Saved users list (max 10, persists in localStorage) */
  savedUsers: SavedUser[];
  /** Save the current result */
  saveCurrentUser: () => void;
  /** Remove a saved user */
  removeSavedUser: (userId: string) => void;
  /** Load a saved user by searching for their user_id */
  loadSavedUser: (userId: string) => void;
}

const SearchStateContext = createContext<SearchStateContextValue | undefined>(undefined);

function loadSavedFromStorage(): SavedUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSaved(users: SavedUser[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  } catch {
    // ignore quota errors
  }
}

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<UserSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [lastQuery, setLastQuery] = useState<{ query: string; field: SearchField } | null>(null);
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>([]);

  // Load saved users from localStorage on mount
  useEffect(() => {
    setSavedUsers(loadSavedFromStorage());
  }, []);

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

  const saveCurrentUser = useCallback(() => {
    if (!result) return;
    const userId = result.user_id;

    setSavedUsers((prev) => {
      // Don't duplicate
      if (prev.some((u) => u.user_id === userId)) return prev;

      const label = result.loc_acct
        ? `LOC ${result.loc_acct}`
        : userId.slice(-8);

      const next = [
        { user_id: userId, label, savedAt: Date.now() },
        ...prev,
      ].slice(0, MAX_SAVED);

      persistSaved(next);
      return next;
    });
  }, [result]);

  const removeSavedUser = useCallback((userId: string) => {
    setSavedUsers((prev) => {
      const next = prev.filter((u) => u.user_id !== userId);
      persistSaved(next);
      return next;
    });
  }, []);

  const loadSavedUser = useCallback((userId: string) => {
    search(userId, "user_id");
  }, [search]);

  return (
    <SearchStateContext.Provider
      value={{
        result, loading, searched, error, meta, lastQuery,
        search, clear,
        savedUsers, saveCurrentUser, removeSavedUser, loadSavedUser,
      }}
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
