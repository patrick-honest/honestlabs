"use client";

import { Lock, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface SampleDataBannerProps {
  /** Which dataset is blocked */
  dataset?: string;
  /** Short reason */
  reason?: string;
  /** Optional Slack channel or link for requesting access */
  requestUrl?: string;
  /** Inline variant (smaller, for wrapping individual sections) vs full-width */
  variant?: "full" | "inline";
  /** Additional class names */
  className?: string;
  children?: React.ReactNode;
}

/**
 * A very prominent "SAMPLE DATA" warning banner that wraps sections
 * which cannot display real data due to missing BigQuery dataset access.
 *
 * Designed to be impossible to ignore — with animated gradient border,
 * warning colors, and a clear call-to-action to grant access.
 */
export function SampleDataBanner({
  dataset = "mart_finance",
  reason = "Financial data (revenue, costs, balance sheet) cannot be automated",
  requestUrl,
  variant = "full",
  className,
  children,
}: SampleDataBannerProps) {
  const tSample = useTranslations("sampleBanner");
  const isInline = variant === "inline";

  return (
    <div className={cn("relative", className)}>
      {/* Animated gradient border */}
      <div
        className={cn(
          "rounded-xl overflow-hidden",
          "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500",
          "p-[2px]",
          "animate-[shimmer_3s_ease-in-out_infinite]"
        )}
        style={{
          backgroundSize: "200% 100%",
          animation: "shimmer 3s ease-in-out infinite",
        }}
      >
        <div className="rounded-[10px] bg-amber-50 dark:bg-amber-950/40">
          {/* Warning header */}
          <div
            className={cn(
              "flex items-center gap-3 px-4 border-b border-amber-200 dark:border-amber-800",
              isInline ? "py-2.5" : "py-3"
            )}
          >
            <div className="flex items-center gap-2 flex-1">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 dark:bg-amber-500/30 flex-shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-black tracking-wide text-amber-700 dark:text-amber-300",
                    isInline ? "text-xs" : "text-sm"
                  )}>
                    ⚠ {tSample("sampleDataWarning")}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider border border-amber-500/30">
                    {tSample("demoOnly")}
                  </span>
                </div>
                <p className={cn(
                  "text-amber-600/80 dark:text-amber-400/70 mt-0.5",
                  isInline ? "text-[10px]" : "text-xs"
                )}>
                  {reason} because the <code className="px-1 py-0.5 rounded bg-amber-200/50 dark:bg-amber-800/50 font-mono font-bold text-amber-800 dark:text-amber-200">{dataset}</code> dataset
                  {tSample("notAccessible")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Lock className="w-4 h-4 text-amber-500/60 dark:text-amber-400/50" />
              {requestUrl ? (
                <a
                  href={requestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
                >
                  {tSample("requestAccess")} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span className="px-3 py-1.5 rounded-lg bg-amber-600/20 dark:bg-amber-600/30 text-amber-700 dark:text-amber-300 text-xs font-semibold border border-amber-500/30">
                  {tSample("accessRequired")}
                </span>
              )}
            </div>
          </div>

          {/* Content area with watermark overlay */}
          {children && (
            <div className="relative">
              {/* Diagonal watermark */}
              <div
                className="absolute inset-0 pointer-events-none z-10 overflow-hidden opacity-[0.07] dark:opacity-[0.12]"
                aria-hidden
              >
                <div
                  className="absolute inset-0 flex flex-wrap items-center justify-center gap-16"
                  style={{ transform: "rotate(-25deg)", transformOrigin: "center center" }}
                >
                  {Array.from({ length: 20 }).map((_, i) => (
                    <span
                      key={i}
                      className="text-amber-900 dark:text-amber-300 font-black text-4xl whitespace-nowrap select-none"
                    >
                      SAMPLE DATA
                    </span>
                  ))}
                </div>
              </div>

              {/* Actual content */}
              <div className="relative z-0 p-1">
                {children}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS for shimmer animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes shimmer {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
          `,
        }}
      />
    </div>
  );
}

/**
 * Smaller badge to mark individual metrics as sample data
 */
export function SampleDataBadge({ className }: { className?: string }) {
  const tSample = useTranslations("sampleBanner");
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
      "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30",
      className
    )}>
      <AlertTriangle className="w-2.5 h-2.5" />
      {tSample("sample")}
    </span>
  );
}
