"use client";

import { useCallback } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { usePeriod } from "@/hooks/use-period";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const AS_OF = "Mar 15, 2026";
const DATA_RANGE = { start: "Mar 10, 2026", end: "Mar 16, 2026" };

// Mock data
const ticketVolumeTrend = [
  { date: "Oct", tickets: 2800 },
  { date: "Nov", tickets: 3100 },
  { date: "Dec", tickets: 3600 },
  { date: "Jan", tickets: 3200 },
  { date: "Feb", tickets: 2900 },
  { date: "Mar", tickets: 2750 },
];

const avgFirstResponseTime = [
  { date: "Oct", minutes: 12.5 },
  { date: "Nov", minutes: 11.8 },
  { date: "Dec", minutes: 14.2 },
  { date: "Jan", minutes: 10.5 },
  { date: "Feb", minutes: 9.8 },
  { date: "Mar", minutes: 8.5 },
];

const avgResolutionTime = [
  { date: "Oct", hours: 4.8 },
  { date: "Nov", hours: 4.5 },
  { date: "Dec", hours: 5.2 },
  { date: "Jan", hours: 4.1 },
  { date: "Feb", hours: 3.8 },
  { date: "Mar", hours: 3.5 },
];

const topContactReasons = [
  { reason: "Card Activation Issues", count: 520 },
  { reason: "Transaction Disputes", count: 480 },
  { reason: "Payment Problems", count: 390 },
  { reason: "Account Inquiry", count: 350 },
  { reason: "Card Replacement", count: 280 },
  { reason: "Credit Limit Request", count: 220 },
  { reason: "PIN Reset", count: 180 },
  { reason: "Other", count: 330 },
];

const channelMix = [
  { name: "Chat", value: 1450, color: "#3b82f6" },
  { name: "Call", value: 850, color: "#8b5cf6" },
  { name: "Email", value: 450, color: "#06b6d4" },
];

const botVsHuman = [
  { date: "Oct", bot: 1100, human: 1700 },
  { date: "Nov", bot: 1350, human: 1750 },
  { date: "Dec", bot: 1500, human: 2100 },
  { date: "Jan", bot: 1450, human: 1750 },
  { date: "Feb", bot: 1400, human: 1500 },
  { date: "Mar", bot: 1380, human: 1370 },
];

const actionItems: ActionItem[] = [
  {
    id: "cs-1",
    priority: "positive",
    action: "Avg first response time improved to 8.5 minutes.",
    detail: "Down from 12.5 min in Oct. Resolution time also improved to 3.5 hours. Bot handling nearly 50% of volume.",
  },
  {
    id: "cs-2",
    priority: "monitor",
    action: "Card activation issues are top contact reason.",
    detail: "520 tickets this period. Investigate if activation UX changes can reduce inbound volume.",
  },
  {
    id: "cs-3",
    priority: "monitor",
    action: "Transaction disputes at 480 tickets.",
    detail: "Second highest contact reason. Review dispute patterns for potential fraud signals or merchant issues.",
  },
  {
    id: "cs-4",
    priority: "positive",
    action: "Bot resolution now handling 50% of volume.",
    detail: "Up from 39% in Oct. Continue investing in bot capabilities to further reduce human agent load.",
  },
];

export default function CustomerServicePage() {
  const { periodLabel } = usePeriod();

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Customer Service Deep Dive</h1>
        <p className="text-sm text-slate-400 mt-1">{periodLabel} &mdash; Freshworks Data</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="cs_ticket_volume"
          label="Ticket Volume"
          value={2750}
          prevValue={2900}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          sparklineData={ticketVolumeTrend.map((d) => d.tickets)}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cs_first_response"
          label="Avg First Response (min)"
          value={8.5}
          prevValue={9.8}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cs_resolution_time"
          label="Avg Resolution (hrs)"
          value={3.5}
          prevValue={3.8}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cs_bot_rate"
          label="Bot Resolution Rate"
          value={50.2}
          prevValue={48.3}
          unit="percent"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          target={60}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Ticket volume trend */}
      <ChartCard
        title="Ticket Volume Trend"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardLineChart
          data={ticketVolumeTrend}
          lines={[{ key: "tickets", color: "#3b82f6", label: "Tickets" }]}
          height={280}
        />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Avg First Response Time"
          subtitle="Minutes to first agent response"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={avgFirstResponseTime}
            lines={[{ key: "minutes", color: "#22c55e", label: "Minutes" }]}
            height={260}
          />
        </ChartCard>

        <ChartCard
          title="Avg Resolution Time"
          subtitle="Hours to ticket resolution"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={avgResolutionTime}
            lines={[{ key: "hours", color: "#f59e0b", label: "Hours" }]}
            height={260}
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top contact reasons */}
        <ChartCard
          title="Top Contact Reasons"
          subtitle="category_contact_reason from Freshworks"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardBarChart
            data={topContactReasons}
            bars={[{ key: "count", color: "#3b82f6", label: "Tickets" }]}
            xAxisKey="reason"
            height={320}
          />
        </ChartCard>

        {/* Channel mix */}
        <ChartCard
          title="Channel Mix"
          subtitle="Chat vs Call vs Email"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={channelMix}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {channelMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#f1f5f9",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Bot vs Human */}
      <ChartCard
        title="Bot vs Human Resolution"
        subtitle="Ticket resolution split over time"
        asOf={AS_OF}
        dataRange={DATA_RANGE}
        onRefresh={handleRefresh}
      >
        <DashboardBarChart
          data={botVsHuman}
          bars={[
            { key: "bot", color: "#06b6d4", label: "Bot" },
            { key: "human", color: "#8b5cf6", label: "Human" },
          ]}
          stacked
          height={280}
        />
      </ChartCard>

      <ActionItems section="Customer Service" items={actionItems} />
    </div>
  );
}
