"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { DashboardBarChart } from "@/components/charts/bar-chart";
import { usePeriod, useDateParams } from "@/hooks/use-period";
import { useFilters } from "@/hooks/use-filters";
import { useTheme } from "@/hooks/use-theme";
import { getPeriodRange } from "@/lib/period-data";
import { ActiveFiltersBanner } from "@/components/dashboard/active-filters-banner";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ==========================================================================
// Mock Data — Users Overview
// ==========================================================================

const AS_OF = "Mar 17, 2026";

const mockAccountStatuses = [
  { status: "G", accounts: 366000 },
  { status: "N", accounts: 81000 },
  { status: "W", accounts: 74000 },
  { status: "P", accounts: 17000 },
  { status: "S", accounts: 5000 },
  { status: "C", accounts: 4000 },
];

const STATUS_LABELS: Record<string, string> = {
  G: "Good Standing",
  N: "New",
  W: "Warning",
  P: "Past Due",
  S: "Suspended",
  C: "Closed",
};

const mockDevices = [
  { manufacturer: "Samsung", os: "Android", users: 6200 },
  { manufacturer: "Xiaomi", os: "Android", users: 5000 },
  { manufacturer: "OPPO", os: "Android", users: 3500 },
  { manufacturer: "Vivo", os: "Android", users: 3000 },
  { manufacturer: "Infinix", os: "Android", users: 2300 },
  { manufacturer: "Realme", os: "Android", users: 1800 },
  { manufacturer: "Apple", os: "iOS", users: 1500 },
  { manufacturer: "Huawei", os: "Android", users: 900 },
  { manufacturer: "POCO", os: "Android", users: 750 },
  { manufacturer: "Nothing", os: "Android", users: 350 },
];

const mockVerification = [
  { reason: "DECISION_TO_SKIP", users: 188000 },
  { reason: "VIDEO_VERIFIED", users: 145000 },
  { reason: "VIDEO_FAILED", users: 12000 },
  { reason: "EXPIRED", users: 8500 },
];

const mockGeographic = [
  { province: "DKI Jakarta", users: 8200 },
  { province: "Jawa Barat", users: 5400 },
  { province: "Jawa Timur", users: 3100 },
  { province: "Banten", users: 2800 },
  { province: "Jawa Tengah", users: 2200 },
  { province: "Sumatera Utara", users: 1500 },
  { province: "Sulawesi Selatan", users: 1100 },
  { province: "Bali", users: 950 },
  { province: "Kalimantan Timur", users: 820 },
  { province: "Sumatera Selatan", users: 680 },
  { province: "DI Yogyakarta", users: 620 },
  { province: "Riau", users: 540 },
  { province: "Lampung", users: 480 },
  { province: "Kalimantan Selatan", users: 410 },
  { province: "Sumatera Barat", users: 380 },
];

const mockProfessions = [
  { profession: "Private Employee", users: 12500 },
  { profession: "Entrepreneur", users: 4200 },
  { profession: "Civil Servant", users: 2800 },
  { profession: "Professional", users: 2100 },
  { profession: "Freelancer", users: 1600 },
  { profession: "Student", users: 900 },
  { profession: "Housewife", users: 450 },
  { profession: "Other", users: 1200 },
];

const mockEducation = [
  { education: "S1 (Bachelor)", users: 15200 },
  { education: "SMA (High School)", users: 5800 },
  { education: "D3 (Diploma)", users: 2400 },
  { education: "S2 (Master)", users: 1800 },
  { education: "SMP (Junior High)", users: 350 },
  { education: "S3 (Doctorate)", users: 200 },
];

const mockIncome = [
  { income: "3-5 Juta", users: 4800 },
  { income: "5-10 Juta", users: 8200 },
  { income: "10-15 Juta", users: 6100 },
  { income: "15-25 Juta", users: 3500 },
  { income: "25-50 Juta", users: 1800 },
  { income: ">50 Juta", users: 650 },
  { income: "<3 Juta", users: 700 },
];

// ==========================================================================
// Component
// ==========================================================================

export default function UsersDeepDivePage() {
  const { period, dateRange } = usePeriod();
  const { dateParams } = useDateParams();
  const { filters } = useFilters();
  const { isDark } = useTheme();
  const DATA_RANGE = useMemo(() => getPeriodRange(period), [period]);

  // Fetch real data from BigQuery — dateParams changes when user adjusts time selector
  const { data: apiData } = useSWR(
    `/api/users-overview?${dateParams}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300_000 },
  );

  // ---------- Account Status ----------
  const accountStatusData = useMemo(() => {
    const raw = apiData?.accountStatuses?.length
      ? (apiData.accountStatuses as { status: string; accounts: number }[])
      : mockAccountStatuses;
    return raw.map((r) => ({
      status: STATUS_LABELS[r.status] || r.status,
      accounts: Number(r.accounts),
    }));
  }, [apiData]);

  const totalAccounts = useMemo(
    () => accountStatusData.reduce((s, r) => s + r.accounts, 0),
    [accountStatusData],
  );

  const activeAccounts = useMemo(
    () =>
      accountStatusData
        .filter((r) => r.status === "Good Standing" || r.status === "New")
        .reduce((s, r) => s + r.accounts, 0),
    [accountStatusData],
  );

  const activeRate = useMemo(
    () => (totalAccounts > 0 ? (activeAccounts / totalAccounts) * 100 : 0),
    [activeAccounts, totalAccounts],
  );

  // ---------- Devices ----------
  const deviceData = useMemo(() => {
    if (apiData?.devices?.length) {
      return (apiData.devices as { manufacturer: string; os: string; users: number }[]).map(
        (r) => ({ manufacturer: r.manufacturer || "Unknown", users: Number(r.users) }),
      );
    }
    return mockDevices.map((r) => ({ manufacturer: r.manufacturer, users: r.users }));
  }, [apiData]);

  // ---------- Verification ----------
  const verificationData = useMemo(() => {
    if (apiData?.verification?.length) {
      return (apiData.verification as { reason: string; users: number }[]).map((r) => ({
        reason: r.reason,
        users: Number(r.users),
      }));
    }
    return mockVerification;
  }, [apiData]);

  const videoVerifiedCount = useMemo(
    () =>
      verificationData.find((r) => r.reason === "VIDEO_VERIFIED")?.users ?? 145000,
    [verificationData],
  );

  const decisionToSkipCount = useMemo(
    () =>
      verificationData.find((r) => r.reason === "DECISION_TO_SKIP")?.users ?? 188000,
    [verificationData],
  );

  // ---------- Geographic ----------
  const geoData = useMemo(() => {
    if (apiData?.geographic?.length) {
      return (apiData.geographic as { province: string; users: number }[]).map((r) => ({
        province: r.province || "Unknown",
        users: Number(r.users),
      }));
    }
    return mockGeographic;
  }, [apiData]);

  // ---------- Demographics ----------
  const professionData = useMemo(() => {
    if (apiData?.demographics?.length) {
      const agg = new Map<string, number>();
      for (const r of apiData.demographics as { profession: string; users: number }[]) {
        const key = r.profession || "Unknown";
        agg.set(key, (agg.get(key) || 0) + Number(r.users));
      }
      return [...agg.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([profession, users]) => ({ profession, users }));
    }
    return mockProfessions;
  }, [apiData]);

  const educationData = useMemo(() => {
    if (apiData?.demographics?.length) {
      const agg = new Map<string, number>();
      for (const r of apiData.demographics as { education: string; users: number }[]) {
        const key = r.education || "Unknown";
        agg.set(key, (agg.get(key) || 0) + Number(r.users));
      }
      return [...agg.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([education, users]) => ({ education, users }));
    }
    return mockEducation;
  }, [apiData]);

  const incomeData = useMemo(() => {
    if (apiData?.demographics?.length) {
      const agg = new Map<string, number>();
      for (const r of apiData.demographics as { income: string; users: number }[]) {
        const key = r.income || "Unknown";
        agg.set(key, (agg.get(key) || 0) + Number(r.users));
      }
      return [...agg.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([income, users]) => ({ income, users }));
    }
    return mockIncome;
  }, [apiData]);

  const isLiveData = !!apiData?.accountStatuses?.length;
  const displayAsOf = isLiveData && apiData?.asOf
    ? new Date(apiData.asOf).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : AS_OF;

  return (
    <div className="space-y-6">
      <ActiveFiltersBanner />

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          metricKey="users_total_accounts"
          label="Total Accounts"
          value={totalAccounts}
          prevValue={530000}
          unit="count"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
        />
        <MetricCard
          metricKey="users_active_rate"
          label="Active Rate"
          value={Math.round(activeRate * 100) / 100}
          prevValue={80.5}
          unit="percent"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
          higherIsBetter={true}
        />
        <MetricCard
          metricKey="users_video_verified"
          label="Video Verified"
          value={videoVerifiedCount}
          prevValue={138000}
          unit="count"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
        />
        <MetricCard
          metricKey="users_decision_skip"
          label="Decision to Skip"
          value={decisionToSkipCount}
          prevValue={180000}
          unit="count"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
        />
      </div>

      {/* Account Status Distribution */}
      <ChartCard
        title="Account Status Distribution"
        subtitle="Current account statuses from latest DW004 snapshot"
        asOf={displayAsOf}
        dataRange={DATA_RANGE}
      >
        <DashboardBarChart
          data={accountStatusData}
          bars={[
            { key: "accounts", color: isDark ? "#7C4DFF" : "#D00083", label: "Accounts" },
          ]}
          xAxisKey="status"
          height={300}
        />
      </ChartCard>

      {/* Two-column: Devices + Geographic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Device Breakdown */}
        <ChartCard
          title="Device Breakdown"
          subtitle="Top device manufacturers among decided applicants"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={deviceData}
            bars={[
              { key: "users", color: "#3b82f6", label: "Users" },
            ]}
            xAxisKey="manufacturer"
            height={300}
          />
        </ChartCard>

        {/* Geographic Distribution */}
        <ChartCard
          title="Geographic Distribution"
          subtitle="Top provinces by decided applicants"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={geoData}
            bars={[
              { key: "users", color: "#06b6d4", label: "Users" },
            ]}
            xAxisKey="province"
            height={300}
          />
        </ChartCard>
      </div>

      {/* Verification Breakdown */}
      <ChartCard
        title="Verification Breakdown"
        subtitle="Video call verification outcomes"
        asOf={displayAsOf}
        dataRange={DATA_RANGE}
      >
        <DashboardBarChart
          data={verificationData}
          bars={[
            { key: "users", color: "#8b5cf6", label: "Users" },
          ]}
          xAxisKey="reason"
          height={280}
        />
      </ChartCard>

      {/* Demographics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profession */}
        <ChartCard
          title="Top Professions"
          subtitle="Self-reported profession of applicants"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={professionData}
            bars={[
              { key: "users", color: "#22c55e", label: "Users" },
            ]}
            xAxisKey="profession"
            height={300}
          />
        </ChartCard>

        {/* Education */}
        <ChartCard
          title="Education Level"
          subtitle="Highest education attained"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={educationData}
            bars={[
              { key: "users", color: "#f59e0b", label: "Users" },
            ]}
            xAxisKey="education"
            height={300}
          />
        </ChartCard>

        {/* Income */}
        <ChartCard
          title="Monthly Income"
          subtitle="Self-reported income bracket"
          asOf={displayAsOf}
          dataRange={DATA_RANGE}
        >
          <DashboardBarChart
            data={incomeData}
            bars={[
              { key: "users", color: "#ef4444", label: "Users" },
            ]}
            xAxisKey="income"
            height={300}
          />
        </ChartCard>
      </div>
    </div>
  );
}
