"use client";

function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function HorizontalBar({
  label,
  value,
  maxValue,
  subLabel,
}: {
  label: string;
  value: number;
  maxValue: number;
  subLabel: string;
}) {
  const pct = Math.max((value / maxValue) * 100, 2);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-[160px] shrink-0 text-right">
        <span className="text-xs text-[var(--text-primary)] font-medium">{label}</span>
      </div>
      <div className="flex-1 relative h-7 rounded-md bg-[var(--surface-elevated)] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-md"
          style={{
            width: `${pct}%`,
            background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-light) 100%)",
          }}
        />
        <div className="absolute inset-0 flex items-center px-2">
          <span className="text-[11px] font-semibold text-white drop-shadow-sm">
            {fmtNum(value)}
          </span>
        </div>
      </div>
      <div className="w-[100px] shrink-0">
        <span className="text-[11px] text-[var(--text-muted)]">{subLabel}</span>
      </div>
    </div>
  );
}
