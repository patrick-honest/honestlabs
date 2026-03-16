"use client";

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
    colorClass: "text-red-400",
    bgClass: "bg-red-500/10",
  },
  monitor: {
    icon: AlertTriangle,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
  },
  positive: {
    icon: CheckCircle2,
    colorClass: "text-emerald-400",
    bgClass: "bg-emerald-500/10",
  },
};

export function ActionItems({ section, items, className }: ActionItemsProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("rounded-xl border border-slate-800 bg-slate-900 p-4", className)}>
      <h3 className="text-sm font-semibold text-white mb-3">
        Action Items &mdash; {section}
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
              <p className="text-sm text-slate-300">
                <span className="font-semibold text-white">{item.action}</span>{" "}
                {item.detail}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
