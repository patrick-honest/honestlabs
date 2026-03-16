"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Search, Calendar, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportSummary, Cycle } from "@/types/reports";

const mockReports: ReportSummary[] = [
  { id: "1", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Executive Summary", title: "February 2026 Executive Summary", generatedAt: "2026-03-02T08:00:00Z" },
  { id: "2", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Acquisition", title: "February 2026 Acquisition Report", generatedAt: "2026-03-02T08:15:00Z" },
  { id: "3", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Portfolio", title: "February 2026 Portfolio Deep Dive", generatedAt: "2026-03-02T08:30:00Z" },
  { id: "4", cycle: "weekly", periodStart: "2026-03-09", periodEnd: "2026-03-15", section: "Spend", title: "Week 11 Spend Analysis", generatedAt: "2026-03-16T06:00:00Z" },
  { id: "5", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Risk", title: "February 2026 Risk Report", generatedAt: "2026-03-02T09:00:00Z" },
  { id: "6", cycle: "quarterly", periodStart: "2025-10-01", periodEnd: "2025-12-31", section: "Executive Summary", title: "Q4 2025 Executive Summary", generatedAt: "2026-01-05T08:00:00Z" },
  { id: "7", cycle: "monthly", periodStart: "2026-01-01", periodEnd: "2026-01-31", section: "Collections", title: "January 2026 Collections Report", generatedAt: "2026-02-02T08:00:00Z" },
  { id: "8", cycle: "weekly", periodStart: "2026-03-02", periodEnd: "2026-03-08", section: "Activation", title: "Week 10 Activation Tracking", generatedAt: "2026-03-09T06:00:00Z" },
];

const SECTIONS = ["All", "Executive Summary", "Acquisition", "Portfolio", "Spend", "Risk", "Activation", "Collections"];
const CYCLES: (Cycle | "all")[] = ["all", "weekly", "monthly", "quarterly", "yearly"];

const cycleBadgeColor: Record<Cycle, string> = {
  weekly: "bg-cyan-500/20 text-cyan-400",
  monthly: "bg-blue-500/20 text-blue-400",
  quarterly: "bg-purple-500/20 text-purple-400",
  yearly: "bg-amber-500/20 text-amber-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cycleFilter, setCycleFilter] = useState<Cycle | "all">("all");
  const [sectionFilter, setSectionFilter] = useState("All");

  const filtered = mockReports.filter((r) => {
    if (cycleFilter !== "all" && r.cycle !== cycleFilter) return false;
    if (sectionFilter !== "All" && r.section !== sectionFilter) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col">
      <Header title="Reports" />

      <div className="flex-1 space-y-6 p-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Reports</h2>
          <p className="mt-1 text-sm text-slate-400">
            Browse generated business review reports
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500"
            />
          </div>

          {/* Cycle filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value as Cycle | "all")}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {CYCLES.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All Cycles" : c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Section filter */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Report Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((report) => (
            <div
              key={report.id}
              className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900 p-5 transition-colors hover:border-blue-500/50 hover:bg-slate-800/80"
            >
              <div className="flex items-start justify-between">
                <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase", cycleBadgeColor[report.cycle])}>
                  {report.cycle}
                </span>
                <span className="text-[10px] text-slate-500">
                  {report.section}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                {report.title}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {formatDate(report.periodStart)} &mdash; {formatDate(report.periodEnd)}
              </p>
              <p className="mt-3 text-[10px] text-slate-500">
                Generated {formatDate(report.generatedAt)}
              </p>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
            <p className="text-sm text-slate-400">No reports match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
