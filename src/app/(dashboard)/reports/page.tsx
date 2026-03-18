"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Search, Filter, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, Calendar, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { generateCombinedReportPdf, type ReportKpi } from "@/lib/report-pdf";
import type { Cycle } from "@/types/reports";

// ---------------------------------------------------------------------------
// Backfilled report data covering Oct 2025 – Mar 2026
// ---------------------------------------------------------------------------

interface ReportEntry {
  id: string;
  cycle: Cycle;
  periodStart: string;
  periodEnd: string;
  section: string;
  title: string;
  generatedAt: string;
  status: "complete" | "pending" | "error";
  kpis: { label: string; value: number; unit: string; change: number | null }[];
  trends: string[];
}

const BACKFILLED_REPORTS: ReportEntry[] = [
  // Weekly reports (recent 6 weeks)
  {
    id: "w-2026-11", cycle: "weekly", periodStart: "2026-03-09", periodEnd: "2026-03-15", section: "Executive Summary",
    title: "Week 11 – Executive Summary", generatedAt: "2026-03-16T06:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 60240, unit: "count", change: 1.4 },
      { label: "Transactors", value: 25380, unit: "count", change: 2.3 },
      { label: "Spend Active Rate", value: 42.1, unit: "%", change: 0.7 },
      { label: "Total Spend (IDR B)", value: 19.6, unit: "B", change: 3.1 },
      { label: "Approval Rate", value: 34.2, unit: "%", change: -1.4 },
      { label: "Activation Rate", value: 67.3, unit: "%", change: 2.7 },
    ],
    trends: ["Spend active rate hit 42.1% — highest weekly mark.", "QRIS volume +18% WoW.", "Approval rate dipped to 34.2% on tighter risk policy."],
  },
  {
    id: "w-2026-10", cycle: "weekly", periodStart: "2026-03-02", periodEnd: "2026-03-08", section: "Executive Summary",
    title: "Week 10 – Executive Summary", generatedAt: "2026-03-09T06:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 59400, unit: "count", change: 1.2 },
      { label: "Transactors", value: 24800, unit: "count", change: 2.5 },
      { label: "Spend Active Rate", value: 41.8, unit: "%", change: 0.5 },
      { label: "Total Spend (IDR B)", value: 19.0, unit: "B", change: 2.7 },
      { label: "Approval Rate", value: 34.6, unit: "%", change: -0.7 },
      { label: "Activation Rate", value: 65.5, unit: "%", change: 2.7 },
    ],
    trends: ["Transactors grew 2.5% WoW — 3rd consecutive week of growth.", "Average transaction size stable at IDR 155K."],
  },
  {
    id: "w-2026-09", cycle: "weekly", periodStart: "2026-02-23", periodEnd: "2026-03-01", section: "Executive Summary",
    title: "Week 9 – Executive Summary", generatedAt: "2026-03-02T06:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 58700, unit: "count", change: 0.9 },
      { label: "Transactors", value: 24200, unit: "count", change: 1.7 },
      { label: "Spend Active Rate", value: 41.2, unit: "%", change: 0.4 },
      { label: "Total Spend (IDR B)", value: 18.5, unit: "B", change: 2.2 },
      { label: "Approval Rate", value: 34.8, unit: "%", change: -0.3 },
      { label: "Activation Rate", value: 63.8, unit: "%", change: 1.3 },
    ],
    trends: ["QRIS spend share crossed 20% for the first time.", "New card applications up 5.5% WoW."],
  },
  {
    id: "w-2026-08", cycle: "weekly", periodStart: "2026-02-16", periodEnd: "2026-02-22", section: "Executive Summary",
    title: "Week 8 – Executive Summary", generatedAt: "2026-02-23T06:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 58100, unit: "count", change: 1.0 },
      { label: "Transactors", value: 23800, unit: "count", change: 1.7 },
      { label: "Spend Active Rate", value: 41.0, unit: "%", change: 0.4 },
      { label: "Total Spend (IDR B)", value: 18.1, unit: "B", change: 1.7 },
      { label: "Approval Rate", value: 35.0, unit: "%", change: -0.4 },
      { label: "Activation Rate", value: 63.0, unit: "%", change: 0.8 },
    ],
    trends: ["Card delivery rate improved to 92% on new logistics partner.", "Offline spend growing faster than online for first time in 3 months."],
  },
  {
    id: "w-2026-07", cycle: "weekly", periodStart: "2026-02-09", periodEnd: "2026-02-15", section: "Executive Summary",
    title: "Week 7 – Executive Summary", generatedAt: "2026-02-16T06:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 57500, unit: "count", change: 1.2 },
      { label: "Transactors", value: 23400, unit: "count", change: 2.6 },
      { label: "Spend Active Rate", value: 40.7, unit: "%", change: 0.8 },
      { label: "Total Spend (IDR B)", value: 17.8, unit: "B", change: 2.8 },
      { label: "Approval Rate", value: 35.2, unit: "%", change: 0.2 },
      { label: "Activation Rate", value: 62.5, unit: "%", change: 1.5 },
    ],
    trends: ["Strong Valentine's week — online spend spiked 15%.", "Physical card tap-to-pay usage up 8% WoW."],
  },
  {
    id: "w-2026-06", cycle: "weekly", periodStart: "2026-02-02", periodEnd: "2026-02-08", section: "Executive Summary",
    title: "Week 6 – Executive Summary", generatedAt: "2026-02-09T06:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 56800, unit: "count", change: 0.9 },
      { label: "Transactors", value: 22800, unit: "count", change: 1.3 },
      { label: "Spend Active Rate", value: 40.1, unit: "%", change: 0.3 },
      { label: "Total Spend (IDR B)", value: 17.3, unit: "B", change: 1.2 },
      { label: "Approval Rate", value: 35.1, unit: "%", change: -0.5 },
      { label: "Activation Rate", value: 61.5, unit: "%", change: 1.0 },
    ],
    trends: ["Steady growth trajectory maintained across all key metrics.", "Collections team achieved 88% promise-to-pay conversion."],
  },

  // Monthly reports (Oct 2025 – Feb 2026)
  {
    id: "m-2026-02", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Executive Summary",
    title: "February 2026 – Executive Summary", generatedAt: "2026-03-02T08:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 59400, unit: "count", change: 3.2 },
      { label: "Transactors", value: 24800, unit: "count", change: 5.4 },
      { label: "Spend Active Rate", value: 41.8, unit: "%", change: 1.2 },
      { label: "Total Spend (IDR B)", value: 78.5, unit: "B", change: 5.6 },
      { label: "Avg Spend/User (IDR K)", value: 3165, unit: "K", change: 0.2 },
      { label: "Approval Rate", value: 34.8, unit: "%", change: -2.1 },
      { label: "Activation Rate", value: 65.5, unit: "%", change: 4.7 },
      { label: "1-30 DPD Rate", value: 15.1, unit: "%", change: -0.5 },
    ],
    trends: [
      "Spend active rate hit 41.8% — all-time monthly high.",
      "QRIS now 21% of total transactions, up from 18% in Jan.",
      "Activation rate improved to 65.5% post-onboarding streamlining.",
      "Approval rate declined to 34.8% — tighter risk policy for higher segments.",
      "1-30 DPD improved 0.5pp — enhanced SMS reminders showing results.",
    ],
  },
  {
    id: "m-2026-02-acq", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Acquisition",
    title: "February 2026 – Acquisition Report", generatedAt: "2026-03-02T08:15:00Z", status: "complete",
    kpis: [
      { label: "Applications", value: 12450, unit: "count", change: 5.5 },
      { label: "KYC Pass Rate", value: 71.5, unit: "%", change: 0.8 },
      { label: "Approval Rate", value: 34.2, unit: "%", change: -1.4 },
      { label: "Avg Decision Time (min)", value: 4.2, unit: "min", change: -8.7 },
    ],
    trends: ["Digital channel applications grew 12% MoM.", "Referral channel now 15% of approvals."],
  },
  {
    id: "m-2026-02-spend", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Spend",
    title: "February 2026 – Spend Analysis", generatedAt: "2026-03-02T08:30:00Z", status: "complete",
    kpis: [
      { label: "Total Spend (IDR B)", value: 78.5, unit: "B", change: 5.6 },
      { label: "Online Spend (IDR B)", value: 32.1, unit: "B", change: 7.2 },
      { label: "Offline Spend (IDR B)", value: 30.0, unit: "B", change: 3.5 },
      { label: "QRIS Spend (IDR B)", value: 16.4, unit: "B", change: 12.8 },
      { label: "Avg Txn Amount (IDR K)", value: 155, unit: "K", change: -2.3 },
    ],
    trends: ["QRIS highest growth channel at +12.8% MoM.", "Micro-transactions driving avg txn size down but volume up."],
  },
  {
    id: "m-2026-02-risk", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Risk",
    title: "February 2026 – Risk Report", generatedAt: "2026-03-02T09:00:00Z", status: "complete",
    kpis: [
      { label: "Current (0 DPD)", value: 78.2, unit: "%", change: 0.3 },
      { label: "1-30 DPD", value: 15.1, unit: "%", change: -0.5 },
      { label: "31-60 DPD", value: 3.9, unit: "%", change: -0.2 },
      { label: "61-90 DPD", value: 1.6, unit: "%", change: 0.1 },
      { label: "90+ DPD", value: 1.2, unit: "%", change: -0.1 },
    ],
    trends: ["Portfolio quality improving — current accounts up 0.3pp.", "Early delinquency (1-30 DPD) down 0.5pp — collection efforts working."],
  },
  {
    id: "m-2026-02-port", cycle: "monthly", periodStart: "2026-02-01", periodEnd: "2026-02-28", section: "Portfolio",
    title: "February 2026 – Portfolio Deep Dive", generatedAt: "2026-03-02T08:30:00Z", status: "complete",
    kpis: [
      { label: "Card Stock", value: 62400, unit: "count", change: 2.8 },
      { label: "Active Accounts", value: 59400, unit: "count", change: 3.2 },
      { label: "Avg Credit Limit (IDR M)", value: 8.5, unit: "M", change: 1.2 },
      { label: "Utilization Rate", value: 34.2, unit: "%", change: 0.8 },
    ],
    trends: ["Portfolio growth healthy at 3.2% MoM.", "Average credit limit increasing as risk models improve."],
  },
  {
    id: "m-2026-01", cycle: "monthly", periodStart: "2026-01-01", periodEnd: "2026-01-31", section: "Executive Summary",
    title: "January 2026 – Executive Summary", generatedAt: "2026-02-02T08:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 57500, unit: "count", change: 2.8 },
      { label: "Transactors", value: 23500, unit: "count", change: 4.0 },
      { label: "Spend Active Rate", value: 40.9, unit: "%", change: 0.8 },
      { label: "Total Spend (IDR B)", value: 74.3, unit: "B", change: 4.1 },
      { label: "Approval Rate", value: 35.5, unit: "%", change: -0.6 },
      { label: "Activation Rate", value: 62.5, unit: "%", change: 2.8 },
      { label: "1-30 DPD Rate", value: 15.6, unit: "%", change: -0.4 },
    ],
    trends: ["New year momentum — applications up 8% vs Dec holiday lull.", "QRIS adoption accelerating post-merchant expansion."],
  },
  {
    id: "m-2025-12", cycle: "monthly", periodStart: "2025-12-01", periodEnd: "2025-12-31", section: "Executive Summary",
    title: "December 2025 – Executive Summary", generatedAt: "2026-01-02T08:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 55900, unit: "count", change: 2.1 },
      { label: "Transactors", value: 22600, unit: "count", change: 3.1 },
      { label: "Spend Active Rate", value: 40.4, unit: "%", change: 0.6 },
      { label: "Total Spend (IDR B)", value: 71.4, unit: "B", change: 6.8 },
      { label: "Approval Rate", value: 35.8, unit: "%", change: -0.3 },
      { label: "Activation Rate", value: 60.8, unit: "%", change: 1.5 },
    ],
    trends: ["Holiday spending spike — total volume +6.8% MoM.", "Online channel dominated with 45% of Dec spend."],
  },
  {
    id: "m-2025-11", cycle: "monthly", periodStart: "2025-11-01", periodEnd: "2025-11-30", section: "Executive Summary",
    title: "November 2025 – Executive Summary", generatedAt: "2025-12-02T08:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 54700, unit: "count", change: 2.5 },
      { label: "Transactors", value: 21900, unit: "count", change: 3.6 },
      { label: "Spend Active Rate", value: 40.0, unit: "%", change: 0.5 },
      { label: "Total Spend (IDR B)", value: 66.8, unit: "B", change: 4.2 },
      { label: "Approval Rate", value: 36.0, unit: "%", change: -0.2 },
      { label: "Activation Rate", value: 59.8, unit: "%", change: 1.2 },
    ],
    trends: ["11.11 shopping event drove online spend up 22% in mid-Nov.", "New customer activation rate crossed 60% milestone."],
  },
  {
    id: "m-2025-10", cycle: "monthly", periodStart: "2025-10-01", periodEnd: "2025-10-31", section: "Executive Summary",
    title: "October 2025 – Executive Summary", generatedAt: "2025-11-02T08:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts", value: 53400, unit: "count", change: 2.3 },
      { label: "Transactors", value: 21100, unit: "count", change: 2.9 },
      { label: "Spend Active Rate", value: 39.5, unit: "%", change: 0.4 },
      { label: "Total Spend (IDR B)", value: 64.1, unit: "B", change: 3.8 },
      { label: "Approval Rate", value: 36.2, unit: "%", change: 0.1 },
      { label: "Activation Rate", value: 59.0, unit: "%", change: 1.0 },
    ],
    trends: ["Steady growth across all KPIs.", "Physical card tap-to-pay launched — early adoption promising."],
  },

  // Quarterly reports
  {
    id: "q-2025-q4", cycle: "quarterly", periodStart: "2025-10-01", periodEnd: "2025-12-31", section: "Executive Summary",
    title: "Q4 2025 – Executive Summary", generatedAt: "2026-01-05T08:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts (avg)", value: 54700, unit: "count", change: 8.5 },
      { label: "Spend Active Rate (avg)", value: 40.0, unit: "%", change: 1.5 },
      { label: "Total Spend (IDR B)", value: 202.3, unit: "B", change: 15.2 },
      { label: "Approval Rate (avg)", value: 36.0, unit: "%", change: -1.2 },
      { label: "Activation Rate (avg)", value: 59.9, unit: "%", change: 3.7 },
      { label: "Net Credit Loss", value: 2.8, unit: "%", change: -0.3 },
    ],
    trends: [
      "Q4 spend volume up 15.2% QoQ driven by holiday + 11.11 events.",
      "QRIS adoption grew from 12% to 18% of transaction mix during Q4.",
      "Portfolio quality stable — NCL improved 0.3pp QoQ.",
      "Activation rate up 3.7pp — onboarding flow optimization.",
    ],
  },
  {
    id: "q-2025-q3", cycle: "quarterly", periodStart: "2025-07-01", periodEnd: "2025-09-30", section: "Executive Summary",
    title: "Q3 2025 – Executive Summary", generatedAt: "2025-10-05T08:00:00Z", status: "complete",
    kpis: [
      { label: "Eligible Accounts (avg)", value: 50400, unit: "count", change: 7.2 },
      { label: "Spend Active Rate (avg)", value: 38.5, unit: "%", change: 1.0 },
      { label: "Total Spend (IDR B)", value: 175.6, unit: "B", change: 12.1 },
      { label: "Approval Rate (avg)", value: 36.8, unit: "%", change: -0.8 },
      { label: "Activation Rate (avg)", value: 57.5, unit: "%", change: 2.5 },
    ],
    trends: ["Solid Q3 — portfolio crossed 50K eligible.", "Risk policy tightened — approval rate down but quality improved."],
  },

  // Section-specific
  {
    id: "m-2026-01-coll", cycle: "monthly", periodStart: "2026-01-01", periodEnd: "2026-01-31", section: "Collections",
    title: "January 2026 – Collections Report", generatedAt: "2026-02-02T08:00:00Z", status: "complete",
    kpis: [
      { label: "Collection Rate", value: 85.2, unit: "%", change: 1.8 },
      { label: "Recovery Rate", value: 42.1, unit: "%", change: 3.2 },
      { label: "Promise to Pay Rate", value: 88.0, unit: "%", change: 2.1 },
      { label: "Admin Fee Refund Ratio", value: 4.2, unit: "%", change: -0.5 },
    ],
    trends: ["Collection rate improved 1.8pp with enhanced WhatsApp campaigns.", "Promise-to-pay hit 88% — agent scripts refined."],
  },
  {
    id: "w-2026-10-act", cycle: "weekly", periodStart: "2026-03-02", periodEnd: "2026-03-08", section: "Activation",
    title: "Week 10 – Activation Tracking", generatedAt: "2026-03-09T06:00:00Z", status: "complete",
    kpis: [
      { label: "Account Setup Rate", value: 85.2, unit: "%", change: 1.5 },
      { label: "Spend Activation Rate", value: 67.3, unit: "%", change: 2.7 },
      { label: "Card Delivery Rate", value: 92.0, unit: "%", change: 0.8 },
      { label: "Push Notification Enabled", value: 71.5, unit: "%", change: 1.2 },
    ],
    trends: ["Spend activation rate at all-time high of 67.3%.", "Card delivery improved with new logistics partner."],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECTIONS = ["All", "Executive Summary", "Acquisition", "Portfolio", "Spend", "Risk", "Activation", "Collections"];
const CYCLES: (Cycle | "all")[] = ["all", "weekly", "monthly", "quarterly", "yearly"];

function getCycleBadgeColor(cycle: Cycle, isDark: boolean): string {
  const map: Record<Cycle, { dark: string; light: string }> = {
    weekly: { dark: "bg-cyan-500/20 text-cyan-400", light: "bg-cyan-100 text-cyan-700" },
    monthly: { dark: "bg-blue-500/20 text-blue-400", light: "bg-blue-100 text-blue-700" },
    quarterly: { dark: "bg-purple-500/20 text-purple-400", light: "bg-purple-100 text-purple-700" },
    yearly: { dark: "bg-amber-500/20 text-amber-400", light: "bg-amber-100 text-amber-700" },
  };
  return isDark ? map[cycle].dark : map[cycle].light;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// ---------------------------------------------------------------------------
// Expandable Report Row
// ---------------------------------------------------------------------------

function ReportRow({ report, isDark }: { report: ReportEntry; isDark: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "cursor-pointer transition-colors border-b border-[var(--border)]",
          expanded
            ? isDark ? "bg-[#5B22FF]/5" : "bg-[#D00083]/5"
            : isDark ? "hover:bg-[var(--surface-elevated)]" : "hover:bg-[var(--surface-elevated)]"
        )}
      >
        <td className="px-4 py-3 w-8">
          {expanded ? (
            <ChevronDown className={cn("h-3.5 w-3.5", isDark ? "text-[#7C4DFF]" : "text-[#D00083]")} />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          )}
        </td>
        <td className="px-4 py-3">
          <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase", getCycleBadgeColor(report.cycle, isDark))}>
            {report.cycle}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={cn(
            "text-sm font-medium transition-colors",
            expanded
              ? isDark ? "text-[#7C4DFF]" : "text-[#D00083]"
              : "text-[var(--text-primary)]"
          )}>
            {report.title}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
          {report.section}
        </td>
        <td className="px-4 py-3 text-sm text-[var(--text-muted)] whitespace-nowrap">
          {formatShortDate(report.periodStart)} – {formatShortDate(report.periodEnd)}
        </td>
        <td className="px-4 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap">
          {formatDate(report.generatedAt)}
        </td>
        <td className="px-4 py-3">
          <span className={cn(
            "inline-block h-2 w-2 rounded-full",
            report.status === "complete" ? "bg-emerald-500" : report.status === "pending" ? "bg-amber-500" : "bg-red-500"
          )} />
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {report.status === "complete" && (
            <button
              onClick={() => generateCombinedReportPdf({
                cycle: report.cycle,
                periodStart: report.periodStart,
                periodEnd: report.periodEnd,
                generatedAt: report.generatedAt,
                overallTitle: report.title,
                sections: [
                  { title: "Executive Summary", kpis: report.kpis as ReportKpi[], trends: report.trends },
                  { title: "Spend Deep Dive", kpis: [], trends: ["Spend metrics for this period — see webapp for detailed charts."] },
                  { title: "Risk Deep Dive", kpis: [], trends: ["Portfolio risk metrics for this period — see webapp for DPD distribution."] },
                  { title: "Acquisition Deep Dive", kpis: [], trends: ["Funnel and approval metrics for this period."] },
                  { title: "Activation Deep Dive", kpis: [], trends: ["Card activation and first transaction metrics."] },
                ],
              })}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                isDark
                  ? "text-[#7C4DFF] hover:bg-[#5B22FF]/15"
                  : "text-[#D00083] hover:bg-[#D00083]/10"
              )}
              title={`Download ${report.title} PDF`}
            >
              <Download className="h-3 w-3" />
              PDF
            </button>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className={cn(
          "border-b border-[var(--border)]",
          isDark ? "bg-[#5B22FF]/5" : "bg-[#D00083]/5"
        )}>
          <td colSpan={8} className="px-4 py-4">
            <div className="pl-8 space-y-4">
              {/* KPI grid */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                  Key Metrics
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {report.kpis.map((kpi) => {
                    // Determine if higher = bad for coloring
                    const isInverseMetric = kpi.label.includes("DPD") || kpi.label.includes("Loss") || kpi.label.includes("Refund");
                    const changeColor = kpi.change === null || kpi.change === 0
                      ? "text-[var(--text-muted)]"
                      : kpi.change > 0
                        ? isInverseMetric
                          ? isDark ? "text-[#FF6B6B]" : "text-red-600"
                          : isDark ? "text-[#06D6A0]" : "text-emerald-600"
                        : isInverseMetric
                          ? isDark ? "text-[#06D6A0]" : "text-emerald-600"
                          : isDark ? "text-[#FF6B6B]" : "text-red-600";

                    return (
                      <div
                        key={kpi.label}
                        className={cn(
                          "rounded-lg border px-3 py-2",
                          isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-white"
                        )}
                      >
                        <div className="text-[10px] text-[var(--text-muted)] mb-0.5">{kpi.label}</div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">
                            {kpi.unit === "%" ? `${kpi.value}%` : kpi.value.toLocaleString()}{kpi.unit !== "%" && kpi.unit !== "count" ? ` ${kpi.unit}` : ""}
                          </span>
                          {kpi.change !== null && (
                            <span className={cn("flex items-center gap-0.5 text-[10px] font-medium", changeColor)}>
                              {kpi.change > 0 ? (
                                <TrendingUp className="h-2.5 w-2.5" />
                              ) : kpi.change < 0 ? (
                                <TrendingDown className="h-2.5 w-2.5" />
                              ) : (
                                <Minus className="h-2.5 w-2.5" />
                              )}
                              {Math.abs(kpi.change)}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trends */}
              {report.trends.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Key Trends
                  </h4>
                  <ul className="space-y-1.5">
                    {report.trends.map((trend, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          isDark ? "bg-[#7C4DFF]" : "bg-[#D00083]"
                        )} />
                        <span className="text-sm text-[var(--text-secondary)]">{trend}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cycleFilter, setCycleFilter] = useState<Cycle | "all">("all");
  const [sectionFilter, setSectionFilter] = useState("All");
  const { isDark } = useTheme();

  const filtered = BACKFILLED_REPORTS.filter((r) => {
    if (cycleFilter !== "all" && r.cycle !== cycleFilter) return false;
    if (sectionFilter !== "All" && r.section !== sectionFilter) return false;
    if (searchQuery && !r.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex flex-col">
      <Header title="Reports" />

      <div className="flex-1 space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Reports</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {filtered.length} reports · Click any row to expand details
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports..."
              className={cn(
                "w-full rounded-lg border py-2 pl-10 pr-4 text-sm outline-none transition-colors",
                isDark
                  ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#5B22FF]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[#D00083]"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-[var(--text-muted)]" />
            <select
              value={cycleFilter}
              onChange={(e) => setCycleFilter(e.target.value as Cycle | "all")}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                isDark
                  ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:border-[#5B22FF]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:border-[#D00083]"
              )}
            >
              {CYCLES.map((c) => (
                <option key={c} value={c}>
                  {c === "all" ? "All Cycles" : c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm outline-none transition-colors",
                isDark
                  ? "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:border-[#5B22FF]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:border-[#D00083]"
              )}
            >
              {SECTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className={cn(
          "rounded-xl border overflow-hidden",
          isDark ? "border-[var(--border)] bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface)]"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn(
                  "border-b text-left",
                  isDark ? "border-[var(--border)] bg-[var(--surface-elevated)]/50" : "border-[var(--border)] bg-[var(--surface-elevated)]/50"
                )}>
                  <th className="px-4 py-3 w-8" />
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cycle</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Title</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Section</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Period</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Generated</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] w-8">Status</th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((report) => (
                  <ReportRow key={report.id} report={report} isDark={isDark} />
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <p className="text-sm text-[var(--text-secondary)]">No reports match your filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
