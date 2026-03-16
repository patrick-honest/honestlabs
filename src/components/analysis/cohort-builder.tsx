"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import {
  CARD_TYPE_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
  COHORT_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  TRANSACTION_CHANNEL_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
  MERCHANT_CATEGORY_OPTIONS,
  AMOUNT_RANGE_OPTIONS,
  RECURRING_TYPE_OPTIONS,
  RISK_CATEGORY_OPTIONS,
  DECISIONING_MODEL_OPTIONS,
} from "@/hooks/use-filters";

// ── Types ─────────────────────────────────────────────────────────────

export interface CohortFilters {
  cardType: string[];
  productType: string[];
  cohort: string[];
  transactionType: string[];
  transactionChannel: string[];
  transactionStatus: string[];
  merchantCategory: string[];
  amountRange: string[];
  recurringType: string[];
  riskCategory: string[];
  decisioningModel: string[];
}

export const EMPTY_COHORT: CohortFilters = {
  cardType: [],
  productType: [],
  cohort: [],
  transactionType: [],
  transactionChannel: [],
  transactionStatus: [],
  merchantCategory: [],
  amountRange: [],
  recurringType: [],
  riskCategory: [],
  decisioningModel: [],
};

interface FilterCategory {
  key: keyof CohortFilters;
  label: string;
  group: string;
  options: readonly { readonly value: string; readonly label: string; readonly group?: string }[];
}

const FILTER_CATEGORIES: FilterCategory[] = [
  { key: "cardType", label: "Card Type", group: "Account", options: CARD_TYPE_OPTIONS },
  { key: "productType", label: "Product", group: "Account", options: PRODUCT_TYPE_OPTIONS },
  { key: "cohort", label: "Cohort", group: "Account", options: COHORT_OPTIONS },
  { key: "transactionType", label: "Txn Type", group: "Transactions", options: TRANSACTION_TYPE_OPTIONS },
  { key: "transactionChannel", label: "Channel", group: "Transactions", options: TRANSACTION_CHANNEL_OPTIONS },
  { key: "transactionStatus", label: "Status", group: "Transactions", options: TRANSACTION_STATUS_OPTIONS },
  { key: "merchantCategory", label: "Merchant", group: "Transactions", options: MERCHANT_CATEGORY_OPTIONS },
  { key: "amountRange", label: "Amount", group: "Transactions", options: AMOUNT_RANGE_OPTIONS },
  { key: "recurringType", label: "Recurring", group: "Transactions", options: RECURRING_TYPE_OPTIONS },
  { key: "riskCategory", label: "Risk Category", group: "Risk", options: RISK_CATEGORY_OPTIONS },
  { key: "decisioningModel", label: "Model Cohort", group: "Risk", options: DECISIONING_MODEL_OPTIONS },
];

// ── Multi-select dropdown ──────────────────────────────────────────────

function FilterDropdown({
  category,
  selected,
  onToggle,
  onClear,
  accentColor,
  accentBg,
}: {
  category: FilterCategory;
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  accentColor: string;
  accentBg: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasSelection = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors border",
          hasSelection
            ? `${accentBg} ${accentColor} border-current/30`
            : "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent"
        )}
      >
        <span>{category.label}</span>
        {hasSelection && (
          <span
            className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] text-white"
            style={{ backgroundColor: accentColor.includes("#") ? undefined : "var(--accent)" }}
          >
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border shadow-2xl",
            isDark
              ? "border-[var(--border)] bg-[#141226] shadow-black/40"
              : "border-[var(--border)] bg-white shadow-black/10"
          )}
        >
          <div className="py-1 max-h-48 overflow-y-auto">
            {category.options.map((opt, idx) => {
              const isSelected = selected.includes(opt.value);
              const showGroupHeader =
                opt.group && (idx === 0 || category.options[idx - 1]?.group !== opt.group);
              return (
                <div key={opt.value}>
                  {showGroupHeader && (
                    <div
                      className={cn(
                        "px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]",
                        idx > 0 && "border-t border-[var(--border)] mt-1"
                      )}
                    >
                      {opt.group}
                    </div>
                  )}
                  <button
                    onClick={() => onToggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                      isSelected
                        ? accentColor
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-3.5 w-3.5 items-center justify-center rounded border shrink-0",
                        isSelected
                          ? "border-current bg-current"
                          : "border-[var(--border)]"
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <span className="truncate">{opt.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
          {hasSelection && (
            <div className="border-t border-[var(--border)] px-3 py-1.5">
              <button
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Cohort Builder Panel ────────────────────────────────────────────────

interface CohortBuilderProps {
  label: string;
  color: string;         // e.g., "#3b82f6"
  bgColor: string;       // e.g., "bg-blue-500/10"
  textColor: string;     // e.g., "text-blue-400"
  cohort: CohortFilters;
  onChange: (c: CohortFilters) => void;
}

export function CohortBuilder({
  label,
  color,
  bgColor,
  textColor,
  cohort,
  onChange,
}: CohortBuilderProps) {
  const { isDark } = useTheme();

  const toggleValue = useCallback(
    (key: keyof CohortFilters, value: string) => {
      const current = cohort[key];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      onChange({ ...cohort, [key]: next });
    },
    [cohort, onChange]
  );

  const clearKey = useCallback(
    (key: keyof CohortFilters) => {
      onChange({ ...cohort, [key]: [] });
    },
    [cohort, onChange]
  );

  const clearAll = useCallback(() => {
    onChange({ ...EMPTY_COHORT });
  }, [onChange]);

  const activeCount = Object.values(cohort).reduce((sum, arr) => sum + arr.length, 0);

  const groups = ["Account", "Transactions", "Risk"];

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-colors",
        isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
          <h3 className={cn("text-sm font-semibold", textColor)}>{label}</h3>
          {activeCount > 0 && (
            <span
              className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)] underline"
          >
            Reset all
          </button>
        )}
      </div>

      {groups.map((group) => {
        const cats = FILTER_CATEGORIES.filter((c) => c.group === group);
        return (
          <div key={group} className="mb-2 last:mb-0">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-1 block">
              {group}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {cats.map((cat) => (
                <FilterDropdown
                  key={cat.key}
                  category={cat}
                  selected={cohort[cat.key]}
                  onToggle={(v) => toggleValue(cat.key, v)}
                  onClear={() => clearKey(cat.key)}
                  accentColor={textColor}
                  accentBg={bgColor}
                />
              ))}
            </div>
          </div>
        );
      })}

      {activeCount === 0 && (
        <p className="text-[11px] text-[var(--text-muted)] italic mt-2">
          No filters — includes all customers
        </p>
      )}
    </div>
  );
}
