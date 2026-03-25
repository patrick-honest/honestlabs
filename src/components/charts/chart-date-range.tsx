"use client";

import { useState, useRef, useEffect } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
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
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]; // Monday first, matching global picker

function formatForDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fromDateStr(s: string): Date {
  return new Date(s + "T00:00:00");
}

/** Get days grid for a month, starting on Monday (matching global picker) */
function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) grid.push(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);
  return grid;
}

/** Dual calendar month panel with range highlighting (matches global DateRangePicker) */
function MonthCalendar({
  year,
  month,
  selectedStart,
  selectedEnd,
  onSelect,
  onPrevMonth,
  onNextMonth,
  isDark,
  label,
}: {
  year: number;
  month: number;
  selectedStart: string;
  selectedEnd: string;
  onSelect: (dateStr: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  isDark: boolean;
  label: string;
}) {
  const grid = getMonthGrid(year, month);
  const startD = selectedStart ? fromDateStr(selectedStart) : null;
  const endD = selectedEnd ? fromDateStr(selectedEnd) : null;

  return (
    <div className="w-[220px]">
      <p className={cn("text-[9px] font-bold uppercase tracking-widest mb-1.5", isDark ? "text-[#7C4DFF]/60" : "text-[#D00083]/60")}>{label}</p>
      <div className="flex items-center justify-between mb-2">
        <button onClick={onPrevMonth} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs font-semibold text-[var(--text-primary)]">
          {MONTHS[month]} {year}
        </span>
        <button onClick={onNextMonth} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DOW.map((d) => (
          <span key={d} className="text-[8px] font-medium text-[var(--text-muted)] py-0.5">{d}</span>
        ))}
        {grid.map((day, i) => {
          if (day === null) return <span key={`e-${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const date = fromDateStr(dateStr);
          const isStart = startD && date.getTime() === startD.getTime();
          const isEnd = endD && date.getTime() === endD.getTime();
          const isInRange = startD && endD && date > startD && date < endD;
          const isSelected = isStart || isEnd;

          return (
            <button
              key={day}
              onClick={() => onSelect(dateStr)}
              className={cn(
                "h-6 w-6 mx-auto rounded text-[10px] font-medium transition-colors",
                isSelected
                  ? isDark ? "bg-[#5B22FF] text-white" : "bg-[#D00083] text-white"
                  : isInRange
                    ? isDark ? "bg-[#5B22FF]/15 text-[#7C4DFF]" : "bg-[#D00083]/10 text-[#D00083]"
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
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  // Calendar view months for left and right panels
  const initStart = override?.start ? fromDateStr(override.start) : new Date(2025, 9, 1);
  const initEnd = override?.end ? fromDateStr(override.end) : new Date(2026, 2, 16);
  const [leftYear, setLeftYear] = useState(initStart.getFullYear());
  const [leftMonth, setLeftMonth] = useState(initStart.getMonth());
  const [rightYear, setRightYear] = useState(initEnd.getFullYear());
  const [rightMonth, setRightMonth] = useState(initEnd.getMonth());

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // When opening, sync calendar view months with current dates
  useEffect(() => {
    if (open) {
      const s = startDate ? fromDateStr(startDate) : new Date(2025, 9, 1);
      const e = endDate ? fromDateStr(endDate) : new Date(2026, 2, 16);
      setLeftYear(s.getFullYear());
      setLeftMonth(s.getMonth());
      setRightYear(e.getFullYear());
      setRightMonth(e.getMonth());
      setSelecting("start");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (dateStr: string) => {
    if (selecting === "start") {
      setStartDate(dateStr);
      if (dateStr > endDate) setEndDate(dateStr);
      setSelecting("end");
    } else {
      if (dateStr < startDate) {
        setStartDate(dateStr);
        setSelecting("end");
      } else {
        setEndDate(dateStr);
        setSelecting("start");
      }
    }
  };

  const apply = () => {
    if (startDate && endDate && startDate <= endDate) {
      onOverride({ start: startDate, end: endDate });
      setOpen(false);
    }
  };

  const clear = () => {
    onOverride(null);
    setOpen(false);
  };

  const applyPreset = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    // Update calendar views to show the preset range
    const s = fromDateStr(start);
    const e = fromDateStr(end);
    setLeftYear(s.getFullYear());
    setLeftMonth(s.getMonth());
    setRightYear(e.getFullYear());
    setRightMonth(e.getMonth());
  };

  // Month navigation for left calendar
  const advanceLeft = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(leftYear + 1); }
    else setLeftMonth(leftMonth + 1);
  };
  const retreatLeft = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(leftYear - 1); }
    else setLeftMonth(leftMonth - 1);
  };

  // Month navigation for right calendar
  const advanceRight = () => {
    if (rightMonth === 11) { setRightMonth(0); setRightYear(rightYear + 1); }
    else setRightMonth(rightMonth + 1);
  };
  const retreatRight = () => {
    if (rightMonth === 0) { setRightMonth(11); setRightYear(rightYear - 1); }
    else setRightMonth(rightMonth - 1);
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
        <div
          className={cn(
            "fixed z-[70] rounded-xl border shadow-2xl p-4",
            isDark
              ? "border-[var(--border)] bg-[#141226] shadow-black/50"
              : "border-[var(--border)] bg-white shadow-black/10"
          )}
          style={(() => {
            const trigger = ref.current?.getBoundingClientRect();
            if (!trigger) return {};
            const popupW = 520;
            // Try placing below and to the left of the trigger's right edge
            let left = trigger.right - popupW;
            // If it overflows left, clamp to the left side of the trigger
            if (left < 8) left = trigger.left;
            // If it overflows right, clamp to viewport
            if (left + popupW > window.innerWidth - 8) left = window.innerWidth - popupW - 8;
            return { top: trigger.bottom + 4, left };
          })()}
        >
          <div className="text-[11px] font-semibold text-[var(--text-primary)] mb-3">Custom Date Range</div>

          {/* Dual calendar display — matching global DateRangePicker */}
          <div className="flex gap-4">
            <MonthCalendar
              year={leftYear}
              month={leftMonth}
              selectedStart={startDate}
              selectedEnd={endDate}
              onSelect={handleSelect}
              onPrevMonth={retreatLeft}
              onNextMonth={advanceLeft}
              isDark={isDark}
              label="Start Date"
            />
            <div className="w-px bg-[var(--border)]" />
            <MonthCalendar
              year={rightYear}
              month={rightMonth}
              selectedStart={startDate}
              selectedEnd={endDate}
              onSelect={handleSelect}
              onPrevMonth={retreatRight}
              onNextMonth={advanceRight}
              isDark={isDark}
              label="End Date"
            />
          </div>

          {/* Selected range display */}
          <div className="flex items-center mt-3 pt-3 border-t border-[var(--border)]">
            <div className="text-xs text-[var(--text-secondary)]">
              <span className="font-medium">{startDate}</span>
              <span className="text-[var(--text-muted)] mx-1.5">&rarr;</span>
              <span className="font-medium">{endDate}</span>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-1 mt-3">
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
                onClick={() => applyPreset(preset.start, preset.end)}
                className="rounded-md px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--surface-elevated)] transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-between mt-3">
            {override && (
              <button onClick={clear} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--danger)]">
                Reset to default
              </button>
            )}
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={() => setOpen(false)}
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
