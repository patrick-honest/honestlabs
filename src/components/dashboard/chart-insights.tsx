"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { TrendingUp, TrendingDown, Info, Lightbulb } from "lucide-react";

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

  const iconConfig: Record<ChartInsight["type"], { Icon: typeof TrendingUp; color: string; bg: string }> = {
    positive: {
      Icon: TrendingUp,
      color: isDark ? "text-[#06D6A0]" : "text-emerald-600",
      bg: isDark ? "bg-[#06D6A0]/10" : "bg-emerald-50",
    },
    negative: {
      Icon: TrendingDown,
      color: isDark ? "text-[#FF6B6B]" : "text-red-600",
      bg: isDark ? "bg-[#FF6B6B]/10" : "bg-red-50",
    },
    neutral: {
      Icon: Info,
      color: isDark ? "text-[#7C4DFF]" : "text-[#D00083]",
      bg: isDark ? "bg-[#7C4DFF]/10" : "bg-[#D00083]/5",
    },
    hypothesis: {
      Icon: Lightbulb,
      color: isDark ? "text-[#FFD166]" : "text-amber-600",
      bg: isDark ? "bg-[#FFD166]/10" : "bg-amber-50",
    },
  };

  return (
    <div className={cn("mt-3 space-y-1.5", className)}>
      {insights.map((insight, i) => {
        const { Icon, color, bg } = iconConfig[insight.type];
        return (
          <div key={i} className="flex items-start gap-2">
            <div className={cn("flex items-center justify-center shrink-0 mt-0.5 h-4 w-4 rounded", bg)}>
              <Icon className={cn("h-2.5 w-2.5", color)} />
            </div>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              {insight.type === "hypothesis" && (
                <span className={cn("font-semibold", color)}>Hypothesis: </span>
              )}
              {insight.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
