"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

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
  },
];

const relevanceColors: Record<Relevance, { badge: string; border: string }> = {
  high: { badge: "bg-red-500/20 text-red-400", border: "border-l-red-500" },
  medium: { badge: "bg-amber-500/20 text-amber-400", border: "border-l-amber-500" },
  low: { badge: "bg-slate-500/20 text-slate-400", border: "border-l-slate-600" },
};

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

  const filtered = mockNews.filter((item) => {
    if (relevanceFilter !== "all" && item.relevance !== relevanceFilter) return false;
    if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-white">Market News</h1>
        <p className="text-sm text-slate-400 mt-1">
          Curated news relevant to Honest Bank credit card operations
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Relevance filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Relevance:</span>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            {(["all", "high", "medium", "low"] as const).map((level) => (
              <button
                key={level}
                onClick={() => setRelevanceFilter(level)}
                className={cn(
                  "px-3 py-1 text-xs rounded-md font-medium transition-colors",
                  relevanceFilter === level
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                {level === "all" ? "All" : level.charAt(0).toUpperCase() + level.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Category:</span>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5 overflow-x-auto">
            <button
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "px-3 py-1 text-xs rounded-md font-medium transition-colors whitespace-nowrap",
                categoryFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
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
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-white"
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
          <p className="text-slate-500 text-sm py-8 text-center">
            No news articles match the selected filters.
          </p>
        )}
        {filtered.map((item) => {
          const colors = relevanceColors[item.relevance];
          return (
            <article
              key={item.id}
              className={cn(
                "rounded-xl border border-slate-800 bg-slate-900 p-4 border-l-4",
                colors.border
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-white leading-snug">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-slate-500">{item.source}</span>
                    <span className="text-xs text-slate-600">&middot;</span>
                    <span className="text-xs text-slate-500">{item.date}</span>
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", colors.badge)}>
                      {item.relevance}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                      {item.category}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                {item.summary}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
