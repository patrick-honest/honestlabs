"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { ActionItems, type ActionItem } from "@/components/dashboard/action-items";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { DashboardLineChart } from "@/components/charts/line-chart";
import { HorizontalBar } from "@/components/charts/horizontal-bar";
import { SampleDataBanner } from "@/components/dashboard/sample-data-banner";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";
import { getPeriodRange } from "@/lib/period-data";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const AS_OF = "Mar 19, 2026";

const STATUS_LABELS: Record<string, string> = {
  G: "Good",
  N: "Normal",
  B: "Blocked",
  C: "Closed",
  F: "Fraud",
  D: "Delinquent",
  W: "Write-Off",
  P: "Blocked (P)",
  S: "Suspended",
};

const actionItems: ActionItem[] = [
  {
    id: "users-1",
    priority: "positive",
    action: "Account status breakdown now sourced from live DW004 data.",
    detail: "Statuses reflect the latest business date snapshot from financial_account_updates.",
  },
  {
    id: "users-2",
    priority: "monitor",
    action: "Device manufacturer mix should inform app testing priorities.",
    detail: "Ensure QA covers top 5 device manufacturers for each release cycle.",
  },
  {
    id: "users-3",
    priority: "monitor",
    action: "Geographic concentration risk — review top provinces.",
    detail: "If a single province dominates, consider diversification strategies for acquisition.",
  },
];

export default function UsersDeepDivePage() {
  const { period } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters(); // eslint-disable-line @typescript-eslint/no-unused-vars
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  const { data: apiData } = useSWR(
    `/api/users-overview?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  // --- Account status breakdown (bar chart) ---
  const statusBarData = useMemo(() => {
    if (!apiData?.statusBreakdown?.length) return null;
    return (apiData.statusBreakdown as { status: string; accounts: number }[]).map((r) => ({
      label: STATUS_LABELS[r.status] ?? r.status,
      accounts: r.accounts,
    }));
  }, [apiData]);
  const statusIsLive = !!statusBarData?.length;

  // KPI values from status breakdown
  const totalAccounts = useMemo(() => {
    if (!apiData?.statusBreakdown?.length) return 0;
    return (apiData.statusBreakdown as { accounts: number }[]).reduce((sum, r) => sum + r.accounts, 0);
  }, [apiData]);

  const activeAccounts = useMemo(() => {
    if (!apiData?.statusBreakdown?.length) return 0;
    return (apiData.statusBreakdown as { status: string; accounts: number }[])
      .filter((r) => r.status === "G" || r.status === "N")
      .reduce((sum, r) => sum + r.accounts, 0);
  }, [apiData]);

  const blockedAccounts = useMemo(() => {
    if (!apiData?.statusBreakdown?.length) return 0;
    return (apiData.statusBreakdown as { status: string; accounts: number }[])
      .filter((r) => r.status === "B" || r.status === "P" || r.status === "S")
      .reduce((sum, r) => sum + r.accounts, 0);
  }, [apiData]);

  // --- Device manufacturer breakdown (bar chart) ---
  const deviceBarData = useMemo(() => {
    if (!apiData?.deviceManufacturers?.length) return null;
    return (apiData.deviceManufacturers as { manufacturer: string; users: number }[]).map((r) => ({
      label: r.manufacturer,
      users: r.users,
    }));
  }, [apiData]);
  const deviceIsLive = !!deviceBarData?.length;

  const totalDeviceUsers = useMemo(() => {
    if (!apiData?.deviceManufacturers?.length) return 0;
    return (apiData.deviceManufacturers as { users: number }[]).reduce((sum, r) => sum + r.users, 0);
  }, [apiData]);

  // --- OS breakdown (bar chart) ---
  const osBarData = useMemo(() => {
    if (!apiData?.osBreakdown?.length) return null;
    return (apiData.osBreakdown as { os: string; users: number }[]).map((r) => ({
      label: r.os,
      users: r.users,
    }));
  }, [apiData]);
  const osIsLive = !!osBarData?.length;

  // --- Geographic distribution (horizontal bar) ---
  const geoBarData = useMemo(() => {
    if (!apiData?.geoDeepDive?.length) return null;
    const rows = apiData.geoDeepDive as { province: string; users: number }[];
    const maxVal = Math.max(...rows.map((r) => r.users));
    return rows.map((r) => ({
      label: r.province,
      value: r.users,
      maxValue: maxVal,
    }));
  }, [apiData]);
  const geoIsLive = !!geoBarData?.length;

  // --- Account growth trend (line chart) ---
  const growthTrend = useMemo(() => {
    if (!apiData?.accountGrowth?.length) return null;
    return (apiData.accountGrowth as { month: string; total_accounts: number; new_accounts: number }[]).map((r) => ({
      date: r.month,
      totalAccounts: r.total_accounts,
      newAccounts: r.new_accounts ?? 0,
    }));
  }, [apiData]);
  const growthIsLive = !!growthTrend?.length;

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI Row */}
      {statusIsLive ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            metricKey="users_total_accounts"
            label="Total Accounts"
            value={totalAccounts}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={statusIsLive}
          />
          <MetricCard
            metricKey="users_active_accounts"
            label="Active Accounts"
            value={activeAccounts}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={statusIsLive}
          />
          <MetricCard
            metricKey="users_blocked_accounts"
            label="Blocked / Suspended"
            value={blockedAccounts}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={statusIsLive}
          />
          <MetricCard
            metricKey="users_device_users"
            label="Users with Device Data"
            value={totalDeviceUsers}
            unit="count"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={deviceIsLive}
          />
        </div>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Account status KPIs require financial_account_updates (DW004)"
        />
      )}

      {/* Account Status Breakdown */}
      {statusBarData ? (
        <ChartCard
          title="Account Status Breakdown"
          subtitle="Distribution of account statuses at latest available business date"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={statusIsLive}
        >
          <DashboardBarChart
            data={statusBarData}
            bars={[{ key: "accounts", color: "#3b82f6", label: "Accounts" }]}
            xAxisKey="label"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Account status breakdown requires financial_account_updates (DW004)"
        />
      )}

      {/* Account Growth Trend */}
      {growthTrend ? (
        <ChartCard
          title="Account Growth Trend"
          subtitle="Monthly total accounts and net new accounts from DW004"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={growthIsLive}
        >
          <DashboardLineChart
            data={growthTrend}
            lines={[
              { key: "totalAccounts", color: "#3b82f6", label: "Total Accounts" },
              { key: "newAccounts", color: "#22c55e", label: "New Accounts" },
            ]}
            xAxisKey="date"
            height={300}
          />
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="mart_finexus"
          reason="Account growth trend requires financial_account_updates (DW004)"
        />
      )}

      {/* Device & OS Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {deviceBarData ? (
          <ChartCard
            title="Device Manufacturers"
            subtitle="Top 15 device manufacturers from rudderstack users"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={deviceIsLive}
          >
            <DashboardBarChart
              data={deviceBarData}
              bars={[{ key: "users", color: "#8b5cf6", label: "Users" }]}
              xAxisKey="label"
              height={300}
            />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="refined_rudderstack"
            reason="Device breakdown requires refined_rudderstack.users"
          />
        )}

        {osBarData ? (
          <ChartCard
            title="OS Distribution"
            subtitle="Operating system breakdown from rudderstack users"
            asOf={AS_OF}
            dataRange={DATA_RANGE}
            liveData={osIsLive}
          >
            <DashboardBarChart
              data={osBarData}
              bars={[{ key: "users", color: "#06b6d4", label: "Users" }]}
              xAxisKey="label"
              height={300}
            />
          </ChartCard>
        ) : (
          <SampleDataBanner
            dataset="refined_rudderstack"
            reason="OS breakdown requires refined_rudderstack.users"
          />
        )}
      </div>

      {/* Geographic Distribution */}
      {geoBarData ? (
        <ChartCard
          title="Geographic Distribution"
          subtitle="Top provinces by approved user count"
          asOf={AS_OF}
          dataRange={DATA_RANGE}
          liveData={geoIsLive}
        >
          <div className="space-y-1">
            {geoBarData.map((g) => (
              <HorizontalBar
                key={g.label}
                label={g.label}
                value={g.value}
                maxValue={g.maxValue}
                subLabel={`${g.value.toLocaleString()} users`}
              />
            ))}
          </div>
        </ChartCard>
      ) : (
        <SampleDataBanner
          dataset="refined_rudderstack"
          reason="Geographic distribution requires milestone_complete province traits"
        />
      )}

      <ActionItems section="Users" items={actionItems} />
    </div>
  );
}
