// ---------------------------------------------------------------------------
// Server-side Chart Renderer — uses chartjs-node-canvas to produce PNG buffers
// ---------------------------------------------------------------------------

import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration, ChartDataset } from "chart.js";
import { getFontPath } from "./font-loader";
import { COLOR_PALETTE, BRAND_COLORS } from "../../src/config/pdf-report-manifest";
import type { ChartDef, ChartLineDef } from "../../src/config/pdf-report-manifest";

// ---------------------------------------------------------------------------
// Canvas singleton (700 x 300 px)
// ---------------------------------------------------------------------------
const CHART_WIDTH = 700;
const CHART_HEIGHT = 300;

let _canvas: ChartJSNodeCanvas | null = null;

function getCanvas(): ChartJSNodeCanvas {
  if (!_canvas) {
    _canvas = new ChartJSNodeCanvas({
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      backgroundColour: "#ffffff",
      chartCallback: (ChartJS) => {
        // Register the Noto Sans JP font for CJK support
        ChartJS.defaults.font.family = "NotoSansJP, Helvetica, Arial, sans-serif";
        ChartJS.defaults.font.size = 11;
        ChartJS.defaults.color = "#333333";
      },
    });
    // Register font with canvas
    _canvas.registerFont(getFontPath(), {
      family: "NotoSansJP",
    });
  }
  return _canvas;
}

// ---------------------------------------------------------------------------
// Locale-aware date formatting
// ---------------------------------------------------------------------------
const LOCALE_MAP: Record<string, string> = {
  en: "en-GB",
  id: "id-ID",
  ja: "ja-JP",
};

function formatDateLabel(value: string, locale: string): string {
  const d = new Date(value + (value.length === 7 ? "-01" : ""));
  if (isNaN(d.getTime())) return value;
  const loc = LOCALE_MAP[locale] ?? "en-GB";
  return d.toLocaleDateString(loc, { day: "2-digit", month: "short" });
}

// ---------------------------------------------------------------------------
// Tick filtering — ensures at least 8 labels show on x-axis
// ---------------------------------------------------------------------------
function filterTicks(labels: string[], minVisible: number = 8): (string | null)[] {
  if (labels.length <= minVisible) return labels;
  const step = Math.max(1, Math.floor(labels.length / minVisible));
  return labels.map((l, i) =>
    i % step === 0 || i === labels.length - 1 ? l : null,
  );
}

// ---------------------------------------------------------------------------
// Render line chart
// ---------------------------------------------------------------------------
export interface LineChartOptions {
  data: Record<string, unknown>[];
  prevData?: Record<string, unknown>[];
  config: ChartDef;
  locale?: string;
  currency?: "IDR" | "USD";
}

export async function renderLineChart(opts: LineChartOptions): Promise<Buffer> {
  const { data, prevData, config, locale = "en" } = opts;
  const lines = config.lines ?? [];
  const xAxisKey = config.xAxisKey;

  const rawLabels = data.map((row) => String(row[xAxisKey] ?? ""));
  const displayLabels = rawLabels.map((l) => formatDateLabel(l, locale));

  const datasets: ChartDataset<"line">[] = [];

  // Current period lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    datasets.push({
      label: line.labelKey.split(".").pop() ?? line.dataKey,
      data: data.map((row) => {
        const v = row[line.dataKey];
        return typeof v === "number" ? v : Number(v) || 0;
      }),
      borderColor: line.color ?? COLOR_PALETTE[i % COLOR_PALETTE.length],
      backgroundColor: "transparent",
      borderWidth: 2,
      pointRadius: data.length > 20 ? 0 : 3,
      pointHoverRadius: 4,
      tension: 0.3,
    });
  }

  // Previous period overlay (gray dashed)
  if (config.showPrevPeriod && prevData && prevData.length > 0 && lines.length > 0) {
    const primaryLine = lines[0];
    datasets.push({
      label: `${primaryLine.labelKey.split(".").pop() ?? primaryLine.dataKey} (prev)`,
      data: prevData.map((row) => {
        const v = row[primaryLine.dataKey];
        return typeof v === "number" ? v : Number(v) || 0;
      }),
      borderColor: BRAND_COLORS.gray,
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderDash: [6, 3],
      pointRadius: 0,
      tension: 0.3,
    });
  }

  const chartConfig: ChartConfiguration<"line"> = {
    type: "line",
    data: {
      labels: displayLabels,
      datasets,
    },
    options: {
      responsive: false,
      animation: false as never,
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: "bottom",
          labels: { boxWidth: 12, padding: 10 },
        },
        title: { display: false },
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: Math.max(8, Math.min(data.length, 16)),
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: config.valueType === "percent",
          grid: { color: "#f0f0f0" },
          ticks: {
            callback: (value) => {
              const num = Number(value);
              if (config.valueType === "percent") return `${num}%`;
              if (config.valueType === "currency") {
                if (opts.currency === "USD") {
                  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
                  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
                  if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(0)}K`;
                  return `$${num.toFixed(0)}`;
                }
                if (Math.abs(num) >= 1e12) return `Rp ${(num / 1e12).toFixed(1)}T`;
                if (Math.abs(num) >= 1e9) return `Rp ${(num / 1e9).toFixed(1)}B`;
                if (Math.abs(num) >= 1e6) return `Rp ${(num / 1e6).toFixed(1)}M`;
                return `Rp ${(num / 1e3).toFixed(0)}K`;
              }
              if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
              if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
              return String(num);
            },
          },
        },
      },
    },
  };

  return getCanvas().renderToBuffer(chartConfig as ChartConfiguration);
}

// ---------------------------------------------------------------------------
// Render bar chart
// ---------------------------------------------------------------------------
export interface BarChartOptions {
  data: Record<string, unknown>[];
  config: ChartDef;
  locale?: string;
  currency?: "IDR" | "USD";
}

export async function renderBarChart(opts: BarChartOptions): Promise<Buffer> {
  const { data, config, locale = "en" } = opts;
  const lines = config.lines ?? [];
  const xAxisKey = config.xAxisKey;

  const rawLabels = data.map((row) => String(row[xAxisKey] ?? ""));
  // For bar charts, truncate long labels
  const displayLabels = rawLabels.map((l) =>
    l.length > 20 ? l.slice(0, 18) + "..." : l,
  );

  const datasets: ChartDataset<"bar">[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    datasets.push({
      label: line.labelKey.split(".").pop() ?? line.dataKey,
      data: data.map((row) => {
        const v = row[line.dataKey];
        return typeof v === "number" ? v : Number(v) || 0;
      }),
      backgroundColor: line.color ?? COLOR_PALETTE[i % COLOR_PALETTE.length],
      borderWidth: 0,
      barPercentage: 0.7,
    });
  }

  // If no lines defined, try to auto-detect numeric columns (for tables rendered as bars)
  if (lines.length === 0 && data.length > 0) {
    const sample = data[0];
    const numericKeys = Object.keys(sample).filter(
      (k) => k !== xAxisKey && typeof sample[k] === "number",
    );
    for (let i = 0; i < Math.min(numericKeys.length, 3); i++) {
      datasets.push({
        label: numericKeys[i],
        data: data.map((row) => Number(row[numericKeys[i]]) || 0),
        backgroundColor: COLOR_PALETTE[i % COLOR_PALETTE.length],
        borderWidth: 0,
        barPercentage: 0.7,
      });
    }
  }

  const isHorizontal = data.length > 8;

  const chartConfig: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: displayLabels,
      datasets,
    },
    options: {
      indexAxis: isHorizontal ? "y" : "x",
      responsive: false,
      animation: false as never,
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: "bottom",
          labels: { boxWidth: 12, padding: 10 },
        },
        title: { display: false },
      },
      scales: {
        x: {
          grid: { display: isHorizontal },
          ticks: {
            maxRotation: isHorizontal ? 0 : 45,
            callback: isHorizontal
              ? (value) => {
                  const num = Number(value);
                  if (config.valueType === "currency") {
                    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
                    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
                    return `${(num / 1e3).toFixed(0)}K`;
                  }
                  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
                  if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
                  return String(num);
                }
              : undefined,
          },
        },
        y: {
          grid: { display: !isHorizontal, color: "#f0f0f0" },
          beginAtZero: true,
        },
      },
    },
  };

  return getCanvas().renderToBuffer(chartConfig as ChartConfiguration);
}
