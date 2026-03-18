"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]; // Monday first

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onApply: (start: Date, end: Date) => void;
  children: React.ReactNode; // trigger element
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fromDateStr(s: string): Date {
  return new Date(s + "T00:00:00");
}

/** Get days grid for a month, starting on Monday */
function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  // Shift so Monday=0, Sunday=6
  const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) grid.push(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);
  return grid;
}

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

export function DateRangePicker({ startDate, endDate, onApply, children }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [startStr, setStartStr] = useState(toDateStr(startDate));
  const [endStr, setEndStr] = useState(toDateStr(endDate));
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [leftYear, setLeftYear] = useState(startDate.getFullYear());
  const [leftMonth, setLeftMonth] = useState(startDate.getMonth() - 1 < 0 ? 11 : startDate.getMonth() - 1);
  const [rightYear, setRightYear] = useState(startDate.getFullYear());
  const [rightMonth, setRightMonth] = useState(startDate.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  // Sync when props change
  useEffect(() => {
    setStartStr(toDateStr(startDate));
    setEndStr(toDateStr(endDate));
  }, [startDate, endDate]);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSelect = (dateStr: string) => {
    if (selecting === "start") {
      setStartStr(dateStr);
      if (dateStr > endStr) setEndStr(dateStr);
      setSelecting("end");
    } else {
      if (dateStr < startStr) {
        setStartStr(dateStr);
        setSelecting("end");
      } else {
        setEndStr(dateStr);
        setSelecting("start");
      }
    }
  };

  const handleApply = () => {
    onApply(fromDateStr(startStr), fromDateStr(endStr));
    setOpen(false);
  };

  const advanceLeft = () => {
    if (leftMonth === 11) { setLeftMonth(0); setLeftYear(leftYear + 1); }
    else setLeftMonth(leftMonth + 1);
  };
  const retreatLeft = () => {
    if (leftMonth === 0) { setLeftMonth(11); setLeftYear(leftYear - 1); }
    else setLeftMonth(leftMonth - 1);
  };
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
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 cursor-pointer">
        {children}
      </button>

      {open && (
        <div className={cn(
          "absolute left-0 top-full z-[80] mt-2 rounded-xl border shadow-2xl p-4",
          isDark
            ? "border-[var(--border)] bg-[#141226] shadow-black/50"
            : "border-[var(--border)] bg-white shadow-black/10"
        )}>
          {/* Two calendars side by side */}
          <div className="flex gap-4">
            <MonthCalendar
              year={leftYear}
              month={leftMonth}
              selectedStart={startStr}
              selectedEnd={endStr}
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
              selectedStart={startStr}
              selectedEnd={endStr}
              onSelect={handleSelect}
              onPrevMonth={retreatRight}
              onNextMonth={advanceRight}
              isDark={isDark}
              label="End Date"
            />
          </div>

          {/* Selected range display + actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
            <div className="text-xs text-[var(--text-secondary)]">
              <span className="font-medium">{startStr}</span>
              <span className="text-[var(--text-muted)] mx-1.5">→</span>
              <span className="font-medium">{endStr}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                className={cn(
                  "rounded-md px-3 py-1 text-xs font-medium text-white",
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
