"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X, FileDown, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { useLanguage, type Locale } from "@/hooks/use-language";
import { useCurrency } from "@/hooks/use-currency";
import { usePeriod } from "@/hooks/use-period";
import { useToast } from "@/components/ui/toast";
import type { Currency } from "@/types/reports";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PdfDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;       // e.g. "spend-analysis", "acquisition"
  reportTitle: string;     // Display name
  defaultStartDate: string;
  defaultEndDate: string;
  defaultPeriod: string;   // "weekly" | "monthly" | "quarterly"
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "English (EN)" },
  { value: "id", label: "Bahasa Indonesia (ID)" },
  { value: "ja", label: "日本語 (JP)" },
];

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "IDR", label: "IDR (Rupiah)" },
  { value: "USD", label: "USD (US Dollar)" },
];

const CONTENT_OPTIONS = [
  { value: "charts", label: "Charts Only" },
  { value: "full", label: "Full Report (Charts + Tables + Insights)" },
] as const;

type ContentMode = (typeof CONTENT_OPTIONS)[number]["value"];

// ---------------------------------------------------------------------------
// API base URL for PDF generation
// ---------------------------------------------------------------------------

const PDF_API_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:3099"
    : "";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfDownloadModal({
  isOpen,
  onClose,
  reportId,
  reportTitle,
  defaultStartDate,
  defaultEndDate,
  defaultPeriod,
}: PdfDownloadModalProps) {
  const { isDark } = useTheme();
  const { locale } = useLanguage();
  const { currency } = useCurrency();
  const { period } = usePeriod();
  const { showToast, updateToast, dismissToast } = useToast();
  const backdropRef = useRef<HTMLDivElement>(null);

  // Form state — pre-populated from user context
  const [lang, setLang] = useState<Locale>(locale);
  const [cur, setCur] = useState<Currency>(currency);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [includeInsights, setIncludeInsights] = useState(true);
  const [contentMode, setContentMode] = useState<ContentMode>("full");
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync defaults when modal opens
  useEffect(() => {
    if (isOpen) {
      setLang(locale);
      setCur(currency);
      setStartDate(defaultStartDate);
      setEndDate(defaultEndDate);
      setIncludeInsights(true);
      setContentMode("full");
      setIsGenerating(false);
    }
  }, [isOpen, locale, currency, defaultStartDate, defaultEndDate]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Build filename
  const filename = `${endDate}_${reportId}_${cur}_${lang}.pdf`;

  // Handle generate + download
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    onClose();

    const toastId = showToast(
      "Generating PDF report... This may take a moment.",
      "loading",
      0,
    );

    try {
      const params = new URLSearchParams({
        report: reportId,
        lang,
        currency: cur,
        startDate,
        endDate,
        period: defaultPeriod || period,
        includeInsights: includeInsights ? "true" : "false",
        contentMode,
      });

      const resp = await fetch(`${PDF_API_BASE}/api/generate-pdf?${params}`);

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Server returned ${resp.status}: ${errText.slice(0, 200)}`);
      }

      // Get blob and trigger download
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      updateToast(toastId, `Report downloaded: ${filename}`, "success", 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateToast(
        toastId,
        `PDF generation failed: ${msg}`,
        "error",
        8000,
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    reportId, lang, cur, startDate, endDate, defaultPeriod, period,
    includeInsights, contentMode, filename, onClose, showToast, updateToast,
  ]);

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9990] flex items-center justify-center"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-xl border shadow-2xl",
          "bg-[var(--surface)] border-[var(--border)]",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FileDown className={cn("h-5 w-5", isDark ? "text-[#7C4DFF]" : "text-[#5B22FF]")} />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Download PDF Report
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-5">
          {/* Report name (readonly) */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Report
            </label>
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {reportTitle}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Language
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Locale)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                "bg-[var(--background)] border-[var(--border)] text-[var(--text-primary)]",
                isDark ? "focus:border-[#5B22FF]" : "focus:border-[#D00083]",
              )}
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Currency
            </label>
            <select
              value={cur}
              onChange={(e) => setCur(e.target.value as Currency)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                "bg-[var(--background)] border-[var(--border)] text-[var(--text-primary)]",
                isDark ? "focus:border-[#5B22FF]" : "focus:border-[#D00083]",
              )}
            >
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                  "bg-[var(--background)] border-[var(--border)] text-[var(--text-primary)]",
                  isDark ? "focus:border-[#5B22FF]" : "focus:border-[#D00083]",
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                  "bg-[var(--background)] border-[var(--border)] text-[var(--text-primary)]",
                  isDark ? "focus:border-[#5B22FF]" : "focus:border-[#D00083]",
                )}
              />
            </div>
          </div>

          {/* Include AI Analysis toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                includeInsights
                  ? "bg-[#5B22FF]"
                  : isDark
                    ? "bg-[var(--border)]"
                    : "bg-gray-300",
              )}
              onClick={() => setIncludeInsights(!includeInsights)}
            >
              <div
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                  includeInsights && "translate-x-4",
                )}
              />
            </div>
            <span className="text-sm text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">
              Include AI Analysis
            </span>
          </label>

          {/* Content mode */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Content
            </label>
            <select
              value={contentMode}
              onChange={(e) => setContentMode(e.target.value as ContentMode)}
              className={cn(
                "w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                "bg-[var(--background)] border-[var(--border)] text-[var(--text-primary)]",
                isDark ? "focus:border-[#5B22FF]" : "focus:border-[#D00083]",
              )}
            >
              {CONTENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filename preview */}
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--background)] px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
              Filename
            </p>
            <p className="text-xs font-mono text-[var(--text-secondary)] break-all">
              {filename}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            onClick={onClose}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              "hover:bg-[var(--surface-elevated)]",
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={cn(
              "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors",
              "bg-[#5B22FF] hover:bg-[#4A1AE0]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Generate & Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
