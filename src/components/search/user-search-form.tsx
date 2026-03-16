"use client";

import { useState, type FormEvent } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserSearchFormProps {
  onSearch: (userId: string) => void;
  isLoading?: boolean;
}

export function UserSearchForm({ onSearch, isLoading = false }: UserSearchFormProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter user_id (UUID format)"
          className={cn(
            "w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500",
            "outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          )}
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !query.trim()}
        className={cn(
          "flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-colors",
          "hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Search
          </>
        )}
      </button>
    </form>
  );
}
