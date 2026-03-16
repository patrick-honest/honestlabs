"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";

export interface ChartInsight {
  text: string;
  type: "positive" | "negative" | "neutral" | "hypothesis";
}

interface ChartInsightsProps {
  insights: ChartInsight[];
  className?: string;
}

export function ChartInsights({ insights, className }: ChartInsightsProps) {
  const { isDark } = useTheme();

  const dotColors: Record<ChartInsight["type"], string> = {
    positive: isDark ? "bg-[#06D6A0]" : "bg-[#059669]",
    negative: isDark ? "bg-[#FF6B6B]" : "bg-[#DC2626]",
    neutral: isDark ? "bg-[#7C4DFF]" : "bg-[#D00083]",
    hypothesis: isDark ? "bg-[#FFD166]" : "bg-[#F5A623]",
  };

  const textColor: Record<ChartInsight["type"], string> = {
    positive: isDark ? "text-[#06D6A0]" : "text-[#059669]",
    negative: isDark ? "text-[#FF6B6B]" : "text-[#DC2626]",
    neutral: "text-[var(--text-secondary)]",
    hypothesis: isDark ? "text-[#FFD166]" : "text-[#D4900A]",
  };

  return (
    <div className={cn("mt-3 space-y-1.5", className)}>
      {insights.map((insight, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", dotColors[insight.type])} />
          <p className={cn("text-xs leading-relaxed", textColor[insight.type])}>
            {insight.type === "hypothesis" && (
              <span className="font-semibold">[Hypothesis] </span>
            )}
            {insight.text}
          </p>
        </div>
      ))}
    </div>
  );
}
