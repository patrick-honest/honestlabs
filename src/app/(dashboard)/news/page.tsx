"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

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

const mockNews: NewsItem[] = [
  {
    id: "1",
    title: "Bank Indonesia Maintains 7-Day Reverse Repo Rate at 5.75%",
    source: "Bloomberg",
    date: "Mar 14, 2026",
    summary:
      "BI kept its benchmark rate unchanged for the third consecutive month, citing stable inflation and supportive domestic demand. This maintains favorable conditions for consumer credit growth.",
    relevance: "high",
    category: "BI Policy",
    url: "https://www.bloomberg.com/news/articles/2026-03-14/bank-indonesia-rate-decision",
  },
  {
    id: "2",
    title: "OJK Finalizes New Consumer Lending Guidelines for Digital Banks",
    source: "Bisnis Indonesia",
    date: "Mar 13, 2026",
    summary:
      "The Financial Services Authority released updated guidelines requiring enhanced affordability checks and stricter maximum debt-to-income ratios for digital lending products. Implementation deadline Q3 2026.",
    relevance: "high",
    category: "OJK Regulation",
    url: "https://www.bisnis.com/ojk-consumer-lending-guidelines-2026",
  },
  {
    id: "3",
    title: "QRIS Transaction Volume Grows 45% YoY in February",
    source: "Kontan",
    date: "Mar 12, 2026",
    summary:
      "QRIS adoption continues to accelerate with merchant acceptance points surpassing 35 million nationwide. Average ticket size stable at Rp 85,000.",
    relevance: "high",
    category: "QRIS/Payments",
    url: "https://www.kontan.co.id/qris-transaction-volume-february-2026",
  },
  {
    id: "4",
    title: "Indonesian Consumer Confidence Index Rises to 128.5",
    source: "Reuters",
    date: "Mar 11, 2026",
    summary:
      "Consumer confidence reached its highest level in 18 months, driven by stable employment outlook and rising household incomes. Positive signal for card spending volumes.",
    relevance: "medium",
    category: "Consumer Trends",
    url: "https://www.reuters.com/markets/indonesia-consumer-confidence-march-2026",
  },
  {
    id: "5",
    title: "BCA and Mandiri Report Strong Credit Card Portfolio Growth",
    source: "Jakarta Post",
    date: "Mar 10, 2026",
    summary:
      "Major banks reported double-digit credit card receivables growth in FY2025, with spend volumes up 22% YoY. Industry-wide asset quality remains stable.",
    relevance: "medium",
    category: "Market Analysis",
    url: "https://www.thejakartapost.com/business/bca-mandiri-credit-card-growth-2025",
  },
  {
    id: "6",
    title: "Government Extends Cashback Incentive for Digital Payment Adoption",
    source: "Detik Finance",
    date: "Mar 9, 2026",
    summary:
      "The government extended its digital payment cashback program through Q4 2026, allocating Rp 2.5T in incentives to boost financial inclusion.",
    relevance: "medium",
    category: "QRIS/Payments",
    url: "https://finance.detik.com/digital-payment-cashback-incentive-2026",
  },
  {
    id: "7",
    title: "Rupiah Stable at 16,050 per USD Despite Regional Volatility",
    source: "CNBC Indonesia",
    date: "Mar 8, 2026",
    summary:
      "The Rupiah remained relatively stable against the dollar despite regional FX volatility, supported by BI intervention and strong trade surplus.",
    relevance: "low",
    category: "Market Analysis",
    url: "https://www.cnbcindonesia.com/market/rupiah-stable-march-2026",
  },
  {
    id: "8",
    title: "E-commerce Growth Slows to 15% YoY in Q1 2026",
    source: "Tech in Asia",
    date: "Mar 7, 2026",
    summary:
      "Online retail growth moderating from pandemic highs but still representing a significant and growing share of total retail. Implications for online card spend mix.",
    relevance: "low",
    category: "Consumer Trends",
    url: "https://www.techinasia.com/indonesia-ecommerce-growth-q1-2026",
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

  const filtered = mockNews.filter((item) => {
    if (relevanceFilter !== "all" && item.relevance !== relevanceFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Market News</h1>
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
          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "block rounded-xl border p-4 border-l-4 transition-colors cursor-pointer group",
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
                    isDark
                      ? "text-[var(--text-primary)] group-hover:text-[#7C4DFF]"
                      : "text-[var(--text-primary)] group-hover:text-[#D00083]"
                  )}>
                    {item.title}
                    <ExternalLink className="inline-block h-3 w-3 ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
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
            </a>
          );
        })}
      </div>
    </div>
  );
}
