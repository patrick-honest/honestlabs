"use client";

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type ActionPriority = "urgent" | "monitor" | "positive";

export interface ActionItem {
  id: string;
  priority: ActionPriority;
  action: string;
  detail: string;
}

interface ActionItemsProps {
  section: string;
  items: ActionItem[];
  className?: string;
}

const priorityConfig: Record<
  ActionPriority,
  { icon: typeof AlertCircle; colorClass: string; bgClass: string }
> = {
  urgent: {
    icon: AlertCircle,
    colorClass: "text-[var(--danger)]",
    bgClass: "bg-[var(--danger)]/10",
  },
  monitor: {
    icon: AlertTriangle,
    colorClass: "text-[var(--warning)]",
    bgClass: "bg-[var(--warning)]/10",
  },
  positive: {
    icon: CheckCircle2,
    colorClass: "text-[var(--success)]",
    bgClass: "bg-[var(--success)]/10",
  },
};

export function ActionItems({ section, items, className }: ActionItemsProps) {
  const tMetrics = useTranslations("metrics");
  if (items.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors", className)}>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        {tMetrics("actionItems")} &mdash; {section}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => {
          const config = priorityConfig[item.priority];
          const Icon = config.icon;
          return (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-3 rounded-lg px-3 py-2",
                config.bgClass
              )}
            >
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config.colorClass)} />
              <p className="text-sm text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">{item.action}</span>{" "}
                {item.detail}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
