"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useTranslations } from "next-intl";

type Relevance = "high" | "medium" | "low";
type Category = "BI Policy" | "OJK Regulation" | "Consumer Trends" | "QRIS/Payments" | "Market Analysis";

interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  summary: string;
  relevance: Relevance;
  category: Category;
  url: string;
}

// Market intelligence summaries — curated analysis, not linked to external articles
const mockNews: NewsItem[] = [
  {
    id: "1",
    title: "Bank Indonesia Maintains 7-Day Reverse Repo Rate at 5.75%",
    source: "BI",
    date: "Mar 14, 2026",
    summary:
      "BI kept its benchmark rate unchanged for the third consecutive month, citing stable inflation and supportive domestic demand. This maintains favorable conditions for consumer credit growth.",
    relevance: "high",
    category: "BI Policy",
    url: "https://www.bi.go.id/en/publikasi/ruang-media/news-release/default.aspx",
  },
  {
    id: "2",
    title: "OJK Finalizes New Consumer Lending Guidelines for Digital Banks",
    source: "OJK",
    date: "Mar 13, 2026",
    summary:
      "The Financial Services Authority released updated guidelines requiring enhanced affordability checks and stricter maximum debt-to-income ratios for digital lending products. Implementation deadline Q3 2026.",
    relevance: "high",
    category: "OJK Regulation",
    url: "https://www.ojk.go.id/en/regulasi/default.aspx",
  },
  {
    id: "3",
    title: "QRIS Transaction Volume Grows 45% YoY in February",
    source: "BI",
    date: "Mar 12, 2026",
    summary:
      "QRIS adoption continues to accelerate with merchant acceptance points surpassing 35 million nationwide. Average ticket size stable at Rp 85,000.",
    relevance: "high",
    category: "QRIS/Payments",
    url: "https://www.bi.go.id/en/fungsi-utama/sistem-pembayaran/default.aspx",
  },
  {
    id: "4",
    title: "Indonesian Consumer Confidence Index Rises to 128.5",
    source: "BI",
    date: "Mar 11, 2026",
    summary:
      "Consumer confidence reached its highest level in 18 months, driven by stable employment outlook and rising household incomes. Positive signal for card spending volumes.",
    relevance: "medium",
    category: "Consumer Trends",
    url: "https://www.bi.go.id/en/publikasi/laporan/default.aspx",
  },
  {
    id: "5",
    title: "Major Banks Report Strong Credit Card Portfolio Growth in FY2025",
    source: "Industry",
    date: "Mar 10, 2026",
    summary:
      "Major banks reported double-digit credit card receivables growth in FY2025, with spend volumes up 22% YoY. Industry-wide asset quality remains stable.",
    relevance: "medium",
    category: "Market Analysis",
    url: "",
  },
  {
    id: "6",
    title: "Government Extends Cashback Incentive for Digital Payment Adoption",
    source: "Government",
    date: "Mar 9, 2026",
    summary:
      "The government extended its digital payment cashback program through Q4 2026, allocating Rp 2.5T in incentives to boost financial inclusion.",
    relevance: "medium",
    category: "QRIS/Payments",
    url: "",
  },
  {
    id: "7",
    title: "Rupiah Stable at 16,050 per USD Despite Regional Volatility",
    source: "BI",
    date: "Mar 8, 2026",
    summary:
      "The Rupiah remained relatively stable against the dollar despite regional FX volatility, supported by BI intervention and strong trade surplus.",
    relevance: "low",
    category: "Market Analysis",
    url: "https://www.bi.go.id/en/statistik/informasi-kurs/default.aspx",
  },
  {
    id: "8",
    title: "E-commerce Growth Moderates to 15% YoY in Q1 2026",
    source: "Industry",
    date: "Mar 7, 2026",
    summary:
      "Online retail growth moderating from pandemic highs but still representing a significant and growing share of total retail. Implications for online card spend mix.",
    relevance: "low",
    category: "Consumer Trends",
    url: "",
  },
];

function getRelevanceColors(relevance: Relevance, isDark: boolean) {
  const map: Record<Relevance, { badge: { dark: string; light: string }; border: string }> = {
    high: {
      badge: { dark: "bg-red-500/20 text-red-400", light: "bg-red-100 text-red-700" },
      border: "border-l-red-500",
    },
    medium: {
      badge: { dark: "bg-amber-500/20 text-amber-400", light: "bg-amber-100 text-amber-700" },
      border: "border-l-amber-500",
    },
    low: {
      badge: { dark: "bg-gray-500/20 text-gray-400", light: "bg-gray-200 text-gray-600" },
      border: isDark ? "border-l-gray-600" : "border-l-gray-400",
    },
  };
  return {
    badge: isDark ? map[relevance].badge.dark : map[relevance].badge.light,
    border: map[relevance].border,
  };
}

const categories: Category[] = [
  "BI Policy",
  "OJK Regulation",
  "Consumer Trends",
  "QRIS/Payments",
  "Market Analysis",
];

export default function NewsPage() {
  const [relevanceFilter, setRelevanceFilter] = useState<Relevance | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const { isDark } = useTheme();
  const tNav = useTranslations("nav");

  const filtered = mockNews.filter((item) => {
    if (relevanceFilter !== "all" && item.relevance !== relevanceFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">{tNav("marketNews")}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Curated news relevant to Honest Bank credit card operations
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Relevance filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Relevance:</span>
          <div className="flex gap-1 bg-[var(--surface-elevated)] rounded-lg p-0.5">
            {(["all", "high", "medium", "low"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setRelevanceFilter(level)}
                className={cn(
                  "px-3 py-1 text-xs rounded-md font-medium transition-colors",
                  relevanceFilter === level
                    ? isDark
                      ? "bg-[#5B22FF] text-white"
                      : "bg-[#D00083] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">Category:</span>
          <div className="flex gap-1 bg-[var(--surface-elevated)] rounded-lg p-0.5 overflow-x-auto">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-3 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                categoryFilter === "all"
                  ? isDark
                    ? "bg-[#5B22FF] text-white"
                    : "bg-[#D00083] text-white"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "px-3 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                  categoryFilter === cat
                    ? isDark
                      ? "bg-[#5B22FF] text-white"
                      : "bg-[#D00083] text-white"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* News cards */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-[var(--text-muted)] text-sm py-8 text-center">
            No news articles match the selected filters.
          </p>
        )}
        {filtered.map((item) => {
          const colors = getRelevanceColors(item.relevance, isDark);
          const hasLink = item.url && item.url.length > 0;
          const Wrapper = hasLink ? "a" : "div";
          const wrapperProps = hasLink
            ? { href: item.url, target: "_blank" as const, rel: "noopener noreferrer" }
            : {};
          return (
            <Wrapper
              key={item.id}
              {...wrapperProps}
              className={cn(
                "block rounded-xl border p-4 border-l-4 transition-colors group",
                hasLink && "cursor-pointer",
                isDark
                  ? "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)] hover:border-[var(--border)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-elevated)] hover:border-[var(--border)]",
                colors.border
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className={cn(
                    "text-sm font-semibold leading-snug transition-colors",
                    hasLink && (isDark
                      ? "group-hover:text-[#7C4DFF]"
                      : "group-hover:text-[#D00083]"),
                    "text-[var(--text-primary)]"
                  )}>
                    {item.title}
                    {hasLink && <ExternalLink className="inline-block h-3 w-3 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-[var(--text-muted)]">{item.source}</span>
                    <span className="text-xs text-[var(--text-muted)]">&middot;</span>
                    <span className="text-xs text-[var(--text-muted)]">{item.date}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", colors.badge)}>
                      {item.relevance}
                    </span>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-medium",
                      isDark
                        ? "bg-[var(--surface-elevated)] text-[var(--text-muted)]"
                        : "bg-[var(--surface-elevated)] text-[var(--text-muted)]"
                    )}>
                      {item.category}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
                {item.summary}
              </p>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
