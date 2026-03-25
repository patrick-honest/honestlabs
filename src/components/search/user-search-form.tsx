"use client";

import { useState, useMemo, type FormEvent } from "react";
import { Search, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useTranslations } from "next-intl";
import type { SearchField } from "@/types/search";

interface UserSearchFormProps {
  onSearch: (query: string, field: SearchField) => void;
  isLoading?: boolean;
}

const SEARCH_FIELD_DEFS: { value: SearchField; labelKey: string; placeholderKey: string; isPii?: boolean }[] = [
  { value: "user_id", labelKey: "userId", placeholderKey: "userIdPlaceholder" },
  { value: "urn", labelKey: "urn", placeholderKey: "urnPlaceholder" },
  { value: "crn", labelKey: "crn", placeholderKey: "crnPlaceholder" },
  { value: "loc", labelKey: "locAcct", placeholderKey: "locPlaceholder" },
  { value: "anonymous_id", labelKey: "anonId", placeholderKey: "anonPlaceholder" },
  { value: "application_id", labelKey: "appId", placeholderKey: "appIdPlaceholder" },
  { value: "phone", labelKey: "phone", placeholderKey: "phonePlaceholder", isPii: true },
  { value: "email", labelKey: "email", placeholderKey: "emailPlaceholder", isPii: true },
];

export function UserSearchForm({ onSearch, isLoading = false }: UserSearchFormProps) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState<SearchField>("user_id");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { isDark } = useTheme();
  const tForm = useTranslations("searchForm");
  const tCommon = useTranslations("common");

  const searchFields = useMemo(
    () =>
      SEARCH_FIELD_DEFS.map((def) => ({
        value: def.value,
        label: tForm(def.labelKey),
        placeholder: tForm(def.placeholderKey),
        isPii: def.isPii,
      })),
    [tForm]
  );

  const currentField = searchFields.find((f) => f.value === field)!;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed, field);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      {/* Field selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors min-w-[150px]",
            isDark
              ? "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[#2D2955]"
              : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--border)]"
          )}
        >
          <span className="flex-1 text-left">{currentField.label}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", dropdownOpen && "rotate-180")} />
        </button>

        {dropdownOpen && (
          <div className={cn(
            "absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border shadow-2xl",
            isDark
              ? "border-[var(--border)] bg-[#141226] shadow-black/40"
              : "border-[var(--border)] bg-white shadow-black/10"
          )}>
            {searchFields.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  setField(f.value);
                  setDropdownOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                  field === f.value
                    ? isDark ? "text-[#7C4DFF] bg-[#5B22FF]/10" : "text-[#D00083] bg-[#D00083]/10"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                )}
              >
                <span>{f.label}</span>
                {f.isPii && (
                  <span className="ml-auto text-[10px] text-[var(--text-muted)] rounded-full bg-[var(--warning)]/20 px-1.5 py-0.5">
                    {tForm("pii")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type={currentField.isPii ? "password" : "text"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={currentField.placeholder}
          className={cn(
            "w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm",
            "outline-none transition-colors",
            isDark
              ? "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#5B22FF] focus:ring-1 focus:ring-[#5B22FF]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D00083] focus:ring-1 focus:ring-[#D00083]"
          )}
          disabled={isLoading}
          autoComplete="off"
        />
        {currentField.isPii && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--warning)]">
            {tForm("piiNotStored")}
          </span>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isLoading || !query.trim()}
        className={cn(
          "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors",
          isDark
            ? "bg-[#5B22FF] hover:bg-[#4A11E0] disabled:cursor-not-allowed disabled:opacity-50"
            : "bg-[#D00083] hover:bg-[#7C0B67] disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {tForm("searching")}
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            {tCommon("search")}
          </>
        )}
      </button>
    </form>
  );
}
