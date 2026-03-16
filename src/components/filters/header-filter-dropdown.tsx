"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

export interface FilterOption {
  readonly value: string;
  readonly label: string;
  readonly group?: string;
}

interface HeaderFilterDropdownProps {
  label: string;
  options: readonly FilterOption[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}

export function HeaderFilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: HeaderFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
          hasSelection
            ? isDark
              ? "bg-[#5B22FF]/20 text-[#7C4DFF] border border-[#5B22FF]/30"
              : "bg-[#D00083]/15 text-[#D00083] border border-[#D00083]/30"
            : isDark
              ? "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              : "bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        )}
      >
        <span>{label}</span>
        {hasSelection && (
          <span className={cn(
            "flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] text-white",
            isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
          )}>
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className={cn(
          "absolute left-0 top-full z-[70] mt-1 w-56 rounded-xl border shadow-2xl",
          isDark
            ? "border-[var(--border)] bg-[#141226] shadow-black/40"
            : "border-[var(--border)] bg-white shadow-black/10"
        )}>
          <div className="py-1 max-h-60 overflow-y-auto">
            {options.map((opt, idx) => {
              const isSelected = selected.includes(opt.value);
              const showGroupHeader =
                opt.group && (idx === 0 || options[idx - 1].group !== opt.group);
              return (
                <div key={opt.value}>
                  {showGroupHeader && (
                    <div className={cn(
                      "px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider",
                      idx > 0 && "border-t border-[var(--border)] mt-1",
                      "text-[var(--text-muted)]"
                    )}>
                      {opt.group}
                    </div>
                  )}
                  <button
                    onClick={() => onToggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-xs transition-colors",
                      isSelected
                        ? isDark ? "text-[#7C4DFF]" : "text-[#D00083]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border shrink-0",
                        isSelected
                          ? isDark ? "border-[#5B22FF] bg-[#5B22FF]" : "border-[#D00083] bg-[#D00083]"
                          : "border-[var(--border)]"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <span>{opt.label}</span>
                  </button>
                </div>
              );
            })}
          </div>
          {hasSelection && (
            <div className="border-t border-[var(--border)] px-3 py-2">
              <button
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)]"
              >
                <X className="h-3 w-3" />
                Clear {label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
