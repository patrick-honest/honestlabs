"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { HorizontalBar } from "@/components/charts/horizontal-bar";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { getPeriodRange, getPeriodInsightLabels } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const AS_OF = "Mar 19, 2026";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CustomerServicePage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const p = useMemo(() => getPeriodInsightLabels(period), [period]);
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const actionItems: ActionItem[] = useMemo(() => [
    {
      id: "cs-1",
      priority: "positive",
      action: "Avg first response time improved to 8.5 minutes.",
      detail: `Down from 12.5 min in ${p.firstLabel}. Resolution time also improved to 3.5 hours. Bot handling nearly 50% of volume.`,
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
      detail: `Up from 39% in ${p.firstLabel}. Continue investing in bot capabilities to further reduce human agent load.`,
    },
  ], [p]);

  // --- SWR fetch ---
  const { data: csData } = useSWR(
    `/api/customer-service?${dateParams}`,
    fetcher,
    { fallbackData: null, revalidateOnFocus: false },
  );

  const isLive = !!csData?.weeklyTicketTrend?.length;

  // --- Transform weekly trend ---
  const weeklyTrend = useMemo(() => {
    if (!csData?.weeklyTicketTrend?.length) return null;
    return (csData.weeklyTicketTrend as {
      week_start: string;
      ticket_count: number;
      resolved_count: number;
      avg_first_response_hrs: number;
      avg_resolution_hrs: number;
    }[]).map(r => ({
      date: r.week_start.slice(5), // "MM-DD"
      ticket_count: r.ticket_count,
      resolved_count: r.resolved_count,
      resolved_pct: r.ticket_count > 0
        ? Math.round((r.resolved_count / r.ticket_count) * 10000) / 100
        : 0,
      avg_first_response_hrs: r.avg_first_response_hrs,
      avg_resolution_hrs: r.avg_resolution_hrs,
    }));
  }, [csData]);

  // --- Transform contact reasons ---
  const contactReasons = useMemo(() => {
    if (!csData?.topContactReasons?.length) return null;
    return csData.topContactReasons as {
      reason: string;
      ticket_count: number;
    }[];
  }, [csData]);

  // --- KPI values from latest week ---
  const latestWeek = weeklyTrend?.[weeklyTrend.length - 1] ?? null;
  const prevWeek = weeklyTrend && weeklyTrend.length >= 2
    ? weeklyTrend[weeklyTrend.length - 2]
    : null;

  // --- Totals across all weeks for KPI cards ---
  const totals = useMemo(() => {
    if (!weeklyTrend) return null;
    const totalTickets = weeklyTrend.reduce((s, r) => s + r.ticket_count, 0);
    const totalResolved = weeklyTrend.reduce((s, r) => s + r.resolved_count, 0);
    const resolvedPct = totalTickets > 0
      ? Math.round((totalResolved / totalTickets) * 10000) / 100
      : 0;
    const avgFrt = weeklyTrend.reduce((s, r) => s + (r.avg_first_response_hrs ?? 0), 0) / weeklyTrend.length;
    const avgRes = weeklyTrend.reduce((s, r) => s + (r.avg_resolution_hrs ?? 0), 0) / weeklyTrend.length;
    return {
      totalTickets,
      resolvedPct,
      avgFirstResponseHrs: Math.round(avgFrt * 100) / 100,
      avgResolutionHrs: Math.round(avgRes * 100) / 100,
    };
  }, [weeklyTrend]);

  const maxReasonCount = contactReasons?.[0]?.ticket_count ?? 1;

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {totals && weeklyTrend ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              metricKey="cs_total_tickets"
              label="Total Tickets"
              value={totals.totalTickets}
              prevValue={null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={isLive}
            />
            <MetricCard
              metricKey="cs_resolved_pct"
              label="Resolved %"
              value={totals.resolvedPct}
              prevValue={null}
              unit="percent"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={isLive}
            />
            <MetricCard
              metricKey="cs_avg_frt"
              label="Avg First Response (hrs)"
              value={totals.avgFirstResponseHrs}
              prevValue={null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              higherIsBetter={false}
              liveData={isLive}
            />
            <MetricCard
              metricKey="cs_avg_resolution"
              label="Avg Resolution (hrs)"
              value={totals.avgResolutionHrs}
              prevValue={null}
              unit="count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              higherIsBetter={false}
              liveData={isLive}
            />
          </div>

          {/* Ticket Volume Trend */}
          <ChartCard
            title="Ticket Volume Trend"
            subtitle="Weekly ticket count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={isLive}
          >
            <DashboardBarChart
              data={weeklyTrend}
              bars={[{ key: "ticket_count", color: "#3b82f6", label: "Tickets" }]}
              xAxisKey="date"
              height={300}
            />
          </ChartCard>

          {/* Response & Resolution Time Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard
              title="Avg First Response Time"
              subtitle="Hours to first agent response, by week"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={isLive}
            >
              <DashboardLineChart
                data={weeklyTrend}
                lines={[{ key: "avg_first_response_hrs", color: "#f59e0b", label: "First Response (hrs)" }]}
                xAxisKey="date"
                height={280}
              />
            </ChartCard>

            <ChartCard
              title="Avg Resolution Time"
              subtitle="Hours to ticket resolution, by week"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={isLive}
            >
              <DashboardLineChart
                data={weeklyTrend}
                lines={[{ key: "avg_resolution_hrs", color: "#ef4444", label: "Resolution (hrs)" }]}
                xAxisKey="date"
                height={280}
              />
            </ChartCard>
          </div>

          {/* Top Contact Reasons */}
          {contactReasons ? (
            <ChartCard
              title="Top Contact Reasons"
              subtitle="Top 15 contact reason categories by ticket count"
              asOf={AS_OF}
              dataRange={DATA_RANGE}
              liveData={isLive}
            >
              <div className="space-y-0.5">
                {contactReasons.map((r) => (
                  <HorizontalBar
                    key={r.reason}
                    label={r.reason}
                    value={r.ticket_count}
                    maxValue={maxReasonCount}
                    subLabel={`${r.ticket_count} tickets`}
                  />
                ))}
              </div>
            </ChartCard>
          ) : null}
        </>
      ) : (
        <SampleDataBanner
          dataset="mart_freshworks"
          reason="Customer service data requires freshdesk_ticket_summary"
        />
      )}

      <ActionItems section="Customer Service" items={actionItems} />
    </div>
  );
}
