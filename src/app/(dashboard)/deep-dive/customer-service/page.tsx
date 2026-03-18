"use client";

import { useCallback, useMemo } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { ChartInsights, type ChartInsight } from "@/components/dashboard/chart-insights";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { usePeriod } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { applyFilterToData, applyFilterToMetric } from "@/lib/filter-utils";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange, getPeriodInsightLabels, scaleTrendData, scaleMetricValue } from "@/lib/period-data";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const AS_OF = "Mar 15, 2026";

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



// --- Sample data: Service Level (Freshworks) ---
const callsAnswered45sTrend = [
  { date: "Oct", pct: 97.2 },
  { date: "Nov", pct: 97.8 },
  { date: "Dec", pct: 96.5 },
  { date: "Jan", pct: 98.1 },
  { date: "Feb", pct: 98.6 },
  { date: "Mar", pct: 99.0 },
];

// --- Sample data: Cost to Serve (mart_finance + Freshworks) ---
const costToServeTrend = [
  { date: "Oct", usd: 1.71 },
  { date: "Nov", usd: 1.58 },
  { date: "Dec", usd: 1.45 },
  { date: "Jan", usd: 1.32 },
  { date: "Feb", usd: 1.19 },
  { date: "Mar", usd: 1.09 },
];

const csCostBreakdown = [
  { date: "Oct", systemCost: 48, salary: 78 },
  { date: "Nov", systemCost: 47, salary: 77 },
  { date: "Dec", systemCost: 49, salary: 77 },
  { date: "Jan", systemCost: 46, salary: 76 },
  { date: "Feb", systemCost: 47, salary: 75 },
  { date: "Mar", systemCost: 48, salary: 74 },
];

// --- Sample data: Churn (mart_finance) ---
const voluntaryChurnTrend = [
  { date: "Oct", pct: 0.22 },
  { date: "Nov", pct: 0.19 },
  { date: "Dec", pct: 0.16 },
  { date: "Jan", pct: 0.14 },
  { date: "Feb", pct: 0.11 },
  { date: "Mar", pct: 0.08 },
];

// --- Sample data: Google Play Rating ---
const appRatingTrend = [
  { date: "Oct", rating: 4.60 },
  { date: "Nov", rating: 4.62 },
  { date: "Dec", rating: 4.58 },
  { date: "Jan", rating: 4.65 },
  { date: "Feb", rating: 4.68 },
  { date: "Mar", rating: 4.70 },
];

export default function CustomerServicePage() {
  const { period, periodLabel, timeRangeMultiplier } = usePeriod();
  const { filters } = useFilters();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);
  const p = useMemo(() => getPeriodInsightLabels(period), [period]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
  }, []);

  const pTicketVolume = useMemo(() => applyFilterToData(scaleTrendData(ticketVolumeTrend, period), filters), [period, filters]);
  const pFirstResponse = useMemo(() => applyFilterToData(scaleTrendData(avgFirstResponseTime, period), filters), [period, filters]);
  const pResolutionTime = useMemo(() => applyFilterToData(scaleTrendData(avgResolutionTime, period), filters), [period, filters]);
  const pTopReasons = useMemo(() => applyFilterToData(scaleTrendData(topContactReasons, period, "reason"), filters), [period, filters]);
  const pBotVsHuman = useMemo(() => applyFilterToData(scaleTrendData(botVsHuman, period), filters), [period, filters]);

  // Sample data (not yet connected)
  const pCalls45s = useMemo(() => applyFilterToData(scaleTrendData(callsAnswered45sTrend, period), filters), [period, filters]);
  const pCostToServe = useMemo(() => applyFilterToData(scaleTrendData(costToServeTrend, period), filters), [period, filters]);
  const pCsCost = useMemo(() => applyFilterToData(scaleTrendData(csCostBreakdown, period), filters), [period, filters]);
  const pChurn = useMemo(() => applyFilterToData(scaleTrendData(voluntaryChurnTrend, period), filters), [period, filters]);
  const pAppRating = useMemo(() => applyFilterToData(scaleTrendData(appRatingTrend, period), filters), [period, filters]);

  const ticketVolumeInsights: ChartInsight[] = useMemo(() => [
    { text: `Volume declined 23.61% from Dec peak (3,600) to ${p.lastLabel} (2,750), likely reflecting fewer new card activations post-holiday.`, type: "positive" },
    { text: "Dec spike of 3,600 tickets aligns with holiday spending surge and higher dispute/fraud activity.", type: "neutral" },
    { text: `${p.lastLabel} volume (2,750) is the lowest in ${p.span} — monitor whether this is sustainable or masks unresolved issues.`, type: "neutral" },
    { text: "Declining volume may partly reflect bot deflection improvements absorbing tickets before they reach agents.", type: "hypothesis" },
  ], [p]);

  const firstResponseInsights: ChartInsight[] = useMemo(() => [
    { text: `Response time improved 32% from ${p.firstLabel} (12.5 min) to ${p.lastLabel} (8.5 min), well below the 10-min SLA target.`, type: "positive" },
    { text: "Dec spike to 14.2 min coincides with peak ticket volume — staffing did not scale with seasonal demand.", type: "negative" },
    { text: `Jan-${p.lastLabel} steady decline suggests the Freshworks bot auto-reply rollout (Jan launch) is absorbing initial triage.`, type: "hypothesis" },
    { text: "Faster first response strongly correlates with higher CSAT — each 1-min reduction is associated with ~2pt CSAT lift in industry benchmarks.", type: "neutral" },
  ], [p]);

  const resolutionTimeInsights: ChartInsight[] = useMemo(() => [
    { text: `Resolution time dropped 27.08% from ${p.firstLabel} (4.8 hrs) to ${p.lastLabel} (3.5 hrs), on track for the 3-hr target by Q3.`, type: "positive" },
    { text: "Dec regression to 5.2 hrs mirrors the first-response spike — holiday complexity (disputes, fraud) extends resolution.", type: "negative" },
    { text: "Improving resolution time alongside rising bot share suggests bots handle simpler tickets, leaving agents with harder cases.", type: "hypothesis" },
    { text: "Current 3.5-hr average meets internal SLA (4 hrs) with 12.5% headroom.", type: "positive" },
  ], [p]);

  const topContactReasonsInsights: ChartInsight[] = useMemo(() => [
    { text: "Card Activation Issues at 520 tickets (18.91% of total) is the #1 reason — strong candidate for self-service deflection.", type: "negative" },
    { text: "Transaction Disputes (480) and Payment Problems (390) together account for 31.64% of volume, typical for a credit card issuer.", type: "neutral" },
    { text: "PIN Reset (180) is a high-automation opportunity — a fully automated OTP-based reset flow could eliminate most of these tickets.", type: "hypothesis" },
    { text: "\"Other\" at 330 tickets (12%) warrants sub-category tagging to surface hidden patterns.", type: "neutral" },
    { text: "Activation issues may stem from Finexus Cardworks card-status sync delays — cross-reference with CW activation timestamps.", type: "hypothesis" },
  ], [p]);

  const channelMixInsights: ChartInsight[] = useMemo(() => [
    { text: "Chat dominates at 52.73% (1,450 tickets), consistent with the digital-first customer base of a mobile credit card.", type: "positive" },
    { text: "Call volume at 30.91% (850) remains high — each call costs ~3-5x more than a chat interaction.", type: "negative" },
    { text: "Email at 16.36% (450) has the longest resolution time; migrating email users to chat could reduce overall resolution hours.", type: "neutral" },
    { text: "Pushing activation and PIN-reset flows into in-app self-service could shift 15-20% of call volume to zero-cost channels.", type: "hypothesis" },
  ], [p]);

  const botVsHumanInsights: ChartInsight[] = useMemo(() => [
    { text: `Bot resolution share grew from 39.29% (${p.firstLabel}) to 50.18% (${p.lastLabel}) — the first month bots resolved more tickets than humans.`, type: "positive" },
    { text: "At ~1,380 bot-resolved tickets/month, estimated cost savings vs. human agents are IDR 40-60M monthly.", type: "positive" },
    { text: `Human volume dropped from 1,700 to 1,370 (−19.41%), enabling headcount reallocation without layoffs.`, type: "neutral" },
    { text: "As bot share exceeds 50%, monitor CSAT for bot-handled tickets — quality degradation risk increases beyond 55-60% bot share.", type: "hypothesis" },
    { text: "Dec outlier (2,100 human) shows bots couldn't absorb the holiday spike — build seasonal escalation playbooks.", type: "negative" },
  ], [p]);

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

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="cs_ticket_volume"
          label="Ticket Volume"
          value={applyFilterToMetric(scaleMetricValue(2750, period, false, timeRangeMultiplier), filters, false)}
          prevValue={applyFilterToMetric(scaleMetricValue(2900, period, false, timeRangeMultiplier), filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          sparklineData={pTicketVolume.map((d) => d.tickets)}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cs_first_response"
          label="Avg First Response (min)"
          value={applyFilterToMetric(8.5, filters, false)}
          prevValue={applyFilterToMetric(9.8, filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cs_resolution_time"
          label="Avg Resolution (hrs)"
          value={applyFilterToMetric(3.5, filters, false)}
          prevValue={applyFilterToMetric(3.8, filters, false)}
          unit="count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          higherIsBetter={false}
          onRefresh={handleRefresh}
        />
        <MetricCard
          metricKey="cs_bot_rate"
          label="Bot Resolution Rate"
          value={applyFilterToMetric(scaleMetricValue(50.2, period, true), filters, true)}
          prevValue={applyFilterToMetric(scaleMetricValue(48.3, period, true), filters, true)}
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
          data={pTicketVolume}
          lines={[{ key: "tickets", color: "#3b82f6", label: "Tickets" }]}
          height={280}
        />
        <ChartInsights insights={ticketVolumeInsights} />
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
            data={pFirstResponse}
            lines={[{ key: "minutes", color: "#22c55e", label: "Minutes" }]}
            height={260}
          />
          <ChartInsights insights={firstResponseInsights} />
        </ChartCard>

        <ChartCard
          title="Avg Resolution Time"
          subtitle="Hours to ticket resolution"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pResolutionTime}
            lines={[{ key: "hours", color: "#f59e0b", label: "Hours" }]}
            height={260}
          />
          <ChartInsights insights={resolutionTimeInsights} />
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
            data={pTopReasons}
            bars={[{ key: "count", color: "#3b82f6", label: "Tickets" }]}
            xAxisKey="reason"
            height={320}
          />
          <ChartInsights insights={topContactReasonsInsights} />
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
          <ChartInsights insights={channelMixInsights} />
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
          data={pBotVsHuman}
          bars={[
            { key: "bot", color: "#06b6d4", label: "Bot" },
            { key: "human", color: "#8b5cf6", label: "Human" },
          ]}
          stacked
          height={280}
        />
        <ChartInsights insights={botVsHumanInsights} />
      </ChartCard>

      {/* ── Sample Data Sections: Orico metrics not yet connected ── */}

      {/* 1. Service Level Metrics (Freshworks) */}
      <SampleDataBanner
        dataset="Freshworks API"
        reason="Call center SLA metrics require Freshworks API integration"
      >
        <ChartCard
          title="Calls Answered Within 45 Seconds"
          subtitle="Service level target: 97%+"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pCalls45s}
            lines={[{ key: "pct", color: "#22c55e", label: "% Answered ≤45s" }]}
            height={260}
          />
          <ChartInsights
            insights={[
              { text: `Service level improved from 97.2% (${p.firstLabel}) to 99.0% (${p.lastLabel}), consistently above the 97% target.`, type: "positive" },
              { text: "Dec dip to 96.5% coincides with peak ticket volume — staffing gaps during holidays.", type: "negative" },
              { text: "Sustained 98%+ since Jan suggests workforce scheduling improvements are holding.", type: "positive" },
            ]}
          />
        </ChartCard>
      </SampleDataBanner>

      {/* 2. Cost to Serve (mart_finance + Freshworks) */}
      <SampleDataBanner
        dataset="mart_finance + Freshworks"
        reason="Cost to serve metrics require both mart_finance access and Freshworks API integration"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Cost to Serve per Active Customer"
            subtitle="USD per active customer per month"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardLineChart
              data={pCostToServe}
              lines={[{ key: "usd", color: "#f59e0b", label: "USD / Customer" }]}
              height={260}
            />
            <ChartInsights
              insights={[
                { text: `Cost to serve declined 36.3% from $1.71 (${p.firstLabel}) to $1.09 (${p.lastLabel}) as bot adoption scaled.`, type: "positive" },
                { text: "Below the $1.50 industry benchmark for digital-first card issuers since Jan.", type: "positive" },
                { text: "Further reductions depend on shifting remaining call volume to self-service channels.", type: "hypothesis" },
              ]}
            />
          </ChartCard>

          <ChartCard
            title="CS & Collection System Cost + Salary"
            subtitle="Monthly cost in $K USD"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            onRefresh={handleRefresh}
          >
            <DashboardBarChart
              data={pCsCost}
              bars={[
                { key: "systemCost", color: "#06b6d4", label: "System Cost ($K)" },
                { key: "salary", color: "#8b5cf6", label: "Salary ($K)" },
              ]}
              stacked
              height={260}
            />
            <ChartInsights
              insights={[
                { text: `Total monthly cost ~$122K (${p.lastLabel}), down from $126K (${p.firstLabel}) — 3.2% reduction.`, type: "positive" },
                { text: "Salary makes up ~60% of total cost; system costs are relatively fixed at ~$47K/mo.", type: "neutral" },
                { text: "Bot-driven ticket deflection should enable salary savings as headcount naturally attrites.", type: "hypothesis" },
              ]}
            />
          </ChartCard>
        </div>
      </SampleDataBanner>

      {/* 3. Churn Metrics (mart_finance) */}
      <SampleDataBanner
        dataset="mart_finance"
        reason="Customer churn data requires mart_finance access"
      >
        <ChartCard
          title="Voluntary Churn Rate"
          subtitle="Monthly voluntary card closures as % of active base"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pChurn}
            lines={[{ key: "pct", color: "#ef4444", label: "Churn %" }]}
            height={260}
          />
          <ChartInsights
            insights={[
              { text: `Voluntary churn declined from 0.22% (${p.firstLabel}) to 0.08% (${p.lastLabel}) — well below the 0.25% industry average.`, type: "positive" },
              { text: "Steady downward trend suggests improving customer satisfaction and engagement.", type: "positive" },
              { text: "Correlation with bot resolution rate: higher bot quality may reduce churn-driving frustration.", type: "hypothesis" },
            ]}
          />
        </ChartCard>
      </SampleDataBanner>

      {/* 4. Google Play Store Rating */}
      <SampleDataBanner
        dataset="Google Play Console"
        reason="App store rating data requires Google Play Console API integration"
      >
        <ChartCard
          title="Google Play Store Rating"
          subtitle="Average user rating on Play Store"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          onRefresh={handleRefresh}
        >
          <DashboardLineChart
            data={pAppRating}
            lines={[{ key: "rating", color: "#3b82f6", label: "Rating" }]}
            height={260}
          />
          <ChartInsights
            insights={[
              { text: `Rating improved from 4.60 (${p.firstLabel}) to 4.70 (${p.lastLabel}), approaching the 4.7+ tier that boosts Play Store visibility.`, type: "positive" },
              { text: "Dec dip to 4.58 likely reflects holiday-period payment issues and slower support response.", type: "negative" },
              { text: "Sustained improvement correlates with faster resolution times and increased bot effectiveness.", type: "hypothesis" },
            ]}
          />
        </ChartCard>
      </SampleDataBanner>

      <ActionItems section="Customer Service" items={actionItems} />
    </div>
  );
}
