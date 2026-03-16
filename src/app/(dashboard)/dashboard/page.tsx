"use client";

import { Header } from "@/components/layout/header";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { TrendBullets } from "@/components/dashboard/trend-bullets";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardAreaChart } from "@/components/charts/area-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { Newspaper } from "lucide-react";
import type { KpiMetric } from "@/types/reports";

// ---------- Mock Data ----------

const mockKpis: KpiMetric[] = [
  { metric: "eligible_to_spend", label: "Eligible to Spend", value: 60_240, prevValue: 58_100, unit: "count", changePercent: 3.7, direction: "up" },
  { metric: "transactors", label: "Transactors", value: 25_380, prevValue: 24_200, unit: "count", changePercent: 4.9, direction: "up" },
  { metric: "spend_active_rate", label: "Spend Active Rate", value: 42.1, prevValue: 41.6, unit: "percent", changePercent: 1.2, direction: "up" },
  { metric: "total_spend", label: "Total Spend", value: 78_500_000_000, prevValue: 72_000_000_000, unit: "idr", changePercent: 9.0, direction: "up" },
  { metric: "avg_spend_txn", label: "Avg Spend / Txn", value: 148_500, prevValue: 152_000, unit: "idr", changePercent: -2.3, direction: "down" },
  { metric: "activation_rate", label: "New Customer Activation", value: 67.3, prevValue: 63.8, unit: "percent", changePercent: 5.5, direction: "up" },
  { metric: "approval_rate", label: "Approval Rate", value: 34.2, prevValue: 35.1, unit: "percent", changePercent: -2.6, direction: "down" },
  { metric: "total_applications", label: "Total Applications", value: 12_450, prevValue: 11_800, unit: "count", changePercent: 5.5, direction: "up" },
];

const mockSparklines: Record<string, { value: number }[]> = {
  eligible_to_spend: [{ value: 52000 }, { value: 54000 }, { value: 55200 }, { value: 56800 }, { value: 57500 }, { value: 58100 }, { value: 59400 }, { value: 60240 }],
  transactors: [{ value: 21000 }, { value: 22100 }, { value: 22800 }, { value: 23400 }, { value: 23900 }, { value: 24200 }, { value: 24800 }, { value: 25380 }],
  spend_active_rate: [{ value: 38.5 }, { value: 39.2 }, { value: 39.8 }, { value: 40.1 }, { value: 40.9 }, { value: 41.6 }, { value: 41.8 }, { value: 42.1 }],
  total_spend: [{ value: 58e9 }, { value: 62e9 }, { value: 65e9 }, { value: 67e9 }, { value: 70e9 }, { value: 72e9 }, { value: 75e9 }, { value: 78.5e9 }],
  avg_spend_txn: [{ value: 160000 }, { value: 157000 }, { value: 155000 }, { value: 154000 }, { value: 153000 }, { value: 152000 }, { value: 150000 }, { value: 148500 }],
  activation_rate: [{ value: 58.0 }, { value: 59.5 }, { value: 61.0 }, { value: 62.3 }, { value: 63.0 }, { value: 63.8 }, { value: 65.5 }, { value: 67.3 }],
  approval_rate: [{ value: 37.0 }, { value: 36.5 }, { value: 36.2 }, { value: 35.8 }, { value: 35.5 }, { value: 35.1 }, { value: 34.6 }, { value: 34.2 }],
  total_applications: [{ value: 9800 }, { value: 10200 }, { value: 10500 }, { value: 10900 }, { value: 11200 }, { value: 11800 }, { value: 12100 }, { value: 12450 }],
};

const spendActiveRateData = [
  { date: "Aug", rate: 38.5 },
  { date: "Sep", rate: 39.2 },
  { date: "Oct", rate: 39.8 },
  { date: "Nov", rate: 40.9 },
  { date: "Dec", rate: 41.6 },
  { date: "Jan", rate: 41.8 },
  { date: "Feb", rate: 42.1 },
];

const spendByCategoryData = [
  { date: "Aug", online: 18e9, offline: 22e9, qris: 8e9 },
  { date: "Sep", online: 20e9, offline: 23e9, qris: 9e9 },
  { date: "Oct", online: 21e9, offline: 24e9, qris: 10e9 },
  { date: "Nov", online: 23e9, offline: 25e9, qris: 11e9 },
  { date: "Dec", online: 26e9, offline: 27e9, qris: 12e9 },
  { date: "Jan", online: 24e9, offline: 26e9, qris: 13e9 },
  { date: "Feb", online: 25e9, offline: 27e9, qris: 14e9 },
];

const decisionFunnelData = [
  { stage: "Applications", count: 12450 },
  { stage: "KYC Passed", count: 8900 },
  { stage: "Approved", count: 4260 },
  { stage: "Card Issued", count: 3980 },
  { stage: "Activated", count: 2680 },
  { stage: "First Txn", count: 2150 },
];

const dpdDistributionData = [
  { bucket: "Current", count: 42500 },
  { bucket: "1-30 DPD", count: 8200 },
  { bucket: "31-60 DPD", count: 2100 },
  { bucket: "61-90 DPD", count: 850 },
  { bucket: "91-120 DPD", count: 420 },
  { bucket: "120+ DPD", count: 310 },
];

const trendBullets = [
  { text: "Spend active rate reached an all-time high of 42.1%, up 1.2% MoM driven by QRIS adoption.", sentiment: "positive" as const },
  { text: "New customer activation rate improved to 67.3% following streamlined onboarding flow launch.", sentiment: "positive" as const },
  { text: "Average spend per transaction declined 2.3% MoM as micro-transactions via QRIS increased share.", sentiment: "neutral" as const },
  { text: "Approval rate slipped to 34.2%, reflecting tighter risk policy on higher-risk segments.", sentiment: "negative" as const },
  { text: "Total applications grew 5.5% MoM, with digital channels contributing 78% of volume.", sentiment: "positive" as const },
];

const newsHeadlines = [
  { title: "Bank Indonesia holds rates steady at 5.75%", date: "Mar 15, 2026", source: "Reuters" },
  { title: "Indonesian credit card spending up 12% YoY in Feb", date: "Mar 14, 2026", source: "CNBC Indonesia" },
  { title: "OJK announces new digital lending guidelines for 2026", date: "Mar 12, 2026", source: "Kontan" },
];

// ---------- Page ----------

export default function DashboardPage() {
  return (
    <div className="flex flex-col">
      <Header title="Dashboard" />

      <div className="flex-1 space-y-6 p-6">
        {/* Hero */}
        <div>
          <h2 className="text-2xl font-bold text-white">Honest Business Review</h2>
          <p className="mt-1 text-sm text-slate-400">
            Executive summary for the current reporting period
          </p>
        </div>

        {/* KPI Grid */}
        <KpiGrid kpis={mockKpis} sparklines={mockSparklines} />

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Spend Active Rate Trend
            </h3>
            <DashboardLineChart
              data={spendActiveRateData}
              lines={[{ key: "rate", color: "#3b82f6", label: "Spend Active %" }]}
              valueType="percent"
              height={260}
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Spend by Channel
            </h3>
            <DashboardAreaChart
              data={spendByCategoryData}
              areas={[
                { key: "online", color: "#3b82f6", label: "Online" },
                { key: "offline", color: "#8b5cf6", label: "Offline" },
                { key: "qris", color: "#06b6d4", label: "QRIS" },
              ]}
              height={260}
            />
          </div>
        </div>

        {/* Trends */}
        <TrendBullets bullets={trendBullets} />

        {/* Second Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
              Decision Funnel
            </h3>
            <DashboardBarChart
              data={decisionFunnelData}
              bars={[{ key: "count", color: "#3b82f6", label: "Count" }]}
              xAxisKey="stage"
              height={260}
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-300">
              DPD Distribution
            </h3>
            <DashboardBarChart
              data={dpdDistributionData}
              bars={[{ key: "count", color: "#f59e0b", label: "Accounts" }]}
              xAxisKey="bucket"
              height={260}
            />
          </div>
        </div>

        {/* Market News */}
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Market News
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {newsHeadlines.map((headline, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-slate-800/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {headline.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {headline.source}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-500">
                  {headline.date}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
