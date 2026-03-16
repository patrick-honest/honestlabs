"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

export interface DateRangeOverride {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

interface ChartDateRangeProps {
  override: DateRangeOverride | null;
  onOverride: (range: DateRangeOverride | null) => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatForInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatForDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Simple calendar grid
function MiniCalendar({
  value,
  onChange,
  isDark,
}: {
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
}) {
  const d = value ? new Date(value + "T00:00:00") : new Date(2026, 2, 16);
  const [viewYear, setViewYear] = useState(d.getFullYear());
  const [viewMonth, setViewMonth] = useState(d.getMonth());

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const selectedDate = value ? new Date(value + "T00:00:00") : null;

  return (
    <div className="w-[220px]">
      <div className="flex items-center justify-between mb-2">
        <button onClick={prevMonth} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] px-1">
          &lsaquo;
        </button>
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button onClick={nextMonth} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] px-1">
          &rsaquo;
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <span key={d} className="text-[9px] font-medium text-[var(--text-muted)] py-0.5">{d}</span>
        ))}
        {days.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} />;
          const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSelected = selectedDate &&
            selectedDate.getFullYear() === viewYear &&
            selectedDate.getMonth() === viewMonth &&
            selectedDate.getDate() === day;
          return (
            <button
              key={day}
              onClick={() => onChange(dateStr)}
              className={cn(
                "h-6 w-6 mx-auto rounded text-[10px] font-medium transition-colors",
                isSelected
                  ? isDark
                    ? "bg-[#5B22FF] text-white"
                    : "bg-[#D00083] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-elevated)]"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ChartDateRange({ override, onOverride }: ChartDateRangeProps) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState(override?.start ?? "2025-10-01");
  const [endDate, setEndDate] = useState(override?.end ?? "2026-03-16");
  const [showCalendar, setShowCalendar] = useState<"start" | "end" | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCalendar(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const apply = () => {
    if (startDate && endDate && startDate <= endDate) {
      onOverride({ start: startDate, end: endDate });
      setOpen(false);
      setShowCalendar(null);
    }
  };

  const clear = () => {
    onOverride(null);
    setOpen(false);
    setShowCalendar(null);
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors",
          override
            ? isDark
              ? "bg-[#5B22FF]/15 text-[#7C4DFF] border border-[#5B22FF]/30"
              : "bg-[#D00083]/10 text-[#D00083] border border-[#D00083]/30"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        )}
        title="Custom date range"
      >
        <CalendarDays className="h-3 w-3" />
        {override ? (
          <>
            <span>{formatForDisplay(override.start)} – {formatForDisplay(override.end)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); clear(); }}
              className="ml-0.5 hover:text-[var(--danger)]"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </>
        ) : (
          <span>Custom range</span>
        )}
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 top-full z-[70] mt-1 rounded-xl border shadow-2xl p-3 min-w-[280px]",
          isDark
            ? "border-[var(--border)] bg-[#141226] shadow-black/50"
            : "border-[var(--border)] bg-white shadow-black/10"
        )}>
          <div className="text-[11px] font-semibold text-[var(--text-primary)] mb-2">Custom Date Range</div>

          {/* Start date */}
          <div className="mb-2">
            <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">Start</label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1 text-xs outline-none",
                  isDark
                    ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                )}
              />
              <button
                onClick={() => setShowCalendar(showCalendar === "start" ? null : "start")}
                className={cn(
                  "rounded-md border px-2 py-1 transition-colors",
                  showCalendar === "start"
                    ? isDark ? "border-[#5B22FF] bg-[#5B22FF]/15 text-[#7C4DFF]" : "border-[#D00083] bg-[#D00083]/10 text-[#D00083]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                )}
              >
                <CalendarDays className="h-3 w-3" />
              </button>
            </div>
            {showCalendar === "start" && (
              <div className="mt-1.5">
                <MiniCalendar value={startDate} onChange={(v) => { setStartDate(v); setShowCalendar(null); }} isDark={isDark} />
              </div>
            )}
          </div>

          {/* End date */}
          <div className="mb-3">
            <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">End</label>
            <div className="flex gap-1.5">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={cn(
                  "flex-1 rounded-md border px-2 py-1 text-xs outline-none",
                  isDark
                    ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]"
                )}
              />
              <button
                onClick={() => setShowCalendar(showCalendar === "end" ? null : "end")}
                className={cn(
                  "rounded-md border px-2 py-1 transition-colors",
                  showCalendar === "end"
                    ? isDark ? "border-[#5B22FF] bg-[#5B22FF]/15 text-[#7C4DFF]" : "border-[#D00083] bg-[#D00083]/10 text-[#D00083]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                )}
              >
                <CalendarDays className="h-3 w-3" />
              </button>
            </div>
            {showCalendar === "end" && (
              <div className="mt-1.5">
                <MiniCalendar value={endDate} onChange={(v) => { setEndDate(v); setShowCalendar(null); }} isDark={isDark} />
              </div>
            )}
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1 mb-3">
            {[
              { label: "Last 7d", start: "2026-03-09", end: "2026-03-16" },
              { label: "Last 30d", start: "2026-02-14", end: "2026-03-16" },
              { label: "Last 90d", start: "2025-12-16", end: "2026-03-16" },
              { label: "YTD", start: "2026-01-01", end: "2026-03-16" },
              { label: "Last 6mo", start: "2025-09-16", end: "2026-03-16" },
              { label: "Last 1yr", start: "2025-03-16", end: "2026-03-16" },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setStartDate(preset.start);
                  setEndDate(preset.end);
                }}
                className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            {override && (
              <button onClick={clear} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)]">
                Reset to default
              </button>
            )}
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={() => { setOpen(false); setShowCalendar(null); }}
                className="rounded-md px-3 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={apply}
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-medium text-white",
                  isDark ? "bg-[#5B22FF]" : "bg-[#D00083]"
                )}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
