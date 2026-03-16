"use client";

import { useState, useRef, useEffect } from "react";
import { Filter, Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type BreakdownDimension = "risk_category" | "cohort" | "card_type" | "product_type";

export interface BreakdownOption {
  value: string;
  label: string;
}

export interface BreakdownConfig {
  dimension: BreakdownDimension;
  label: string;
  options: BreakdownOption[];
}

const BREAKDOWN_CONFIGS: BreakdownConfig[] = [
  {
    dimension: "risk_category",
    label: "Credit Risk",
    options: [
      { value: "current", label: "Current (0 DPD)" },
      { value: "dpd_1_30", label: "1-30 DPD" },
      { value: "dpd_31_60", label: "31-60 DPD" },
      { value: "dpd_61_90", label: "61-90 DPD" },
      { value: "dpd_90_plus", label: "90+ DPD" },
    ],
  },
  {
    dimension: "cohort",
    label: "Cohort",
    options: Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2025, 3 + i); // Start from Apr 2025
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return { value: val, label: d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) };
    }),
  },
  {
    dimension: "card_type",
    label: "Card Type",
    options: [
      { value: "physical", label: "Physical Card" },
      { value: "virtual", label: "Virtual Card" },
      { value: "nfc", label: "NFC-Enabled" },
    ],
  },
  {
    dimension: "product_type",
    label: "Product Type",
    options: [
      { value: "rp1", label: "RP1 (Prepaid)" },
      { value: "reg_fee", label: "Registration Fee Card" },
      { value: "regular", label: "Regular Card" },
    ],
  },
];

export interface ActiveBreakdowns {
  [dimension: string]: string[]; // dimension -> selected values
}

interface BreakdownFilterProps {
  active: ActiveBreakdowns;
  onChange: (breakdowns: ActiveBreakdowns) => void;
  availableDimensions?: BreakdownDimension[];
  className?: string;
}

export function BreakdownFilter({
  active,
  onChange,
  availableDimensions,
  className,
}: BreakdownFilterProps) {
  const [open, setOpen] = useState(false);
  const [activeDimension, setActiveDimension] = useState<BreakdownDimension | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const configs = availableDimensions
    ? BREAKDOWN_CONFIGS.filter((c) => availableDimensions.includes(c.dimension))
    : BREAKDOWN_CONFIGS;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveDimension(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const totalSelected = Object.values(active).reduce((sum, arr) => sum + arr.length, 0);

  function toggleValue(dimension: BreakdownDimension, value: string) {
    const current = active[dimension] || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    const updated = { ...active };
    if (next.length === 0) {
      delete updated[dimension];
    } else {
      updated[dimension] = next;
    }
    onChange(updated);
  }

  function clearAll() {
    onChange({});
    setOpen(false);
  }

  function clearDimension(dimension: string) {
    const updated = { ...active };
    delete updated[dimension];
    onChange(updated);
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); setActiveDimension(null); }}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
          totalSelected > 0
            ? "bg-[#5B22FF]/20 text-[#7C4DFF] border border-[#5B22FF]/30"
            : "bg-[#1E1B3A] text-[#6B6394] hover:text-[#F0EEFF] border border-transparent"
        )}
      >
        <Filter className="h-3 w-3" />
        <span>Breakdown</span>
        {totalSelected > 0 && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#5B22FF] text-[10px] text-white">
            {totalSelected}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {/* Active filter pills */}
      {totalSelected > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {Object.entries(active).map(([dim, values]) => {
            const config = BREAKDOWN_CONFIGS.find((c) => c.dimension === dim);
            return values.map((val) => {
              const opt = config?.options.find((o) => o.value === val);
              return (
                <span
                  key={`${dim}-${val}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[#5B22FF]/10 px-2 py-0.5 text-[10px] text-[#7C4DFF]"
                >
                  <span className="text-[#6B6394]">{config?.label}:</span> {opt?.label ?? val}
                  <button
                    onClick={() => toggleValue(dim as BreakdownDimension, val)}
                    className="hover:text-[#FF6B6B]"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              );
            });
          })}
          <button
            onClick={clearAll}
            className="text-[10px] text-[#6B6394] hover:text-[#FF6B6B] underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-[#2D2955] bg-[#141226] shadow-2xl shadow-black/40">
          <div className="flex">
            {/* Dimension list */}
            <div className="w-28 border-r border-[#2D2955] py-1">
              {configs.map((config) => {
                const count = (active[config.dimension] || []).length;
                return (
                  <button
                    key={config.dimension}
                    onClick={() => setActiveDimension(config.dimension)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-xs transition-colors",
                      activeDimension === config.dimension
                        ? "bg-[#5B22FF]/10 text-[#7C4DFF]"
                        : "text-[#9B94C4] hover:bg-[#1E1B3A]"
                    )}
                  >
                    <span>{config.label}</span>
                    {count > 0 && (
                      <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#5B22FF] px-1 text-[10px] text-white">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Options list */}
            <div className="flex-1 py-1 max-h-60 overflow-y-auto">
              {activeDimension ? (
                <>
                  {configs
                    .find((c) => c.dimension === activeDimension)
                    ?.options.map((opt) => {
                      const selected = (active[activeDimension] || []).includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          onClick={() => toggleValue(activeDimension, opt.value)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                            selected
                              ? "text-[#7C4DFF]"
                              : "text-[#9B94C4] hover:bg-[#1E1B3A]"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              selected
                                ? "border-[#5B22FF] bg-[#5B22FF]"
                                : "border-[#2D2955]"
                            )}
                          >
                            {selected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  {(active[activeDimension]?.length ?? 0) > 0 && (
                    <button
                      onClick={() => clearDimension(activeDimension)}
                      className="w-full px-3 py-1.5 text-[10px] text-[#6B6394] hover:text-[#FF6B6B] text-left"
                    >
                      Clear {configs.find(c => c.dimension === activeDimension)?.label}
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-20 text-[10px] text-[#6B6394]">
                  Select a dimension
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
