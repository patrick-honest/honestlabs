// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MetricPoint {
  /** ISO date string for the period (e.g. week_start) */
  date: string;
  /** Numeric value for the metric */
  value: number;
}

// ---------------------------------------------------------------------------
// Trend Analyzer
// ---------------------------------------------------------------------------

/**
 * Compares current-period metric values against previous-period values and
 * produces 3-5 human-readable bullet-point insights.
 *
 * Detects:
 * - Overall % change between periods
 * - Directional trend (up / down / flat)
 * - Consecutive week streaks (growth or decline)
 * - Threshold crossings (e.g. breaking above/below a round number)
 */
export function analyzeTrends(
  current: MetricPoint[],
  previous: MetricPoint[],
  metricName: string,
): string[] {
  const bullets: string[] = [];

  if (current.length === 0) {
    return [`No data available for ${metricName} in the current period.`];
  }

  // --- 1. Overall period-over-period change ---
  const currentAvg = avg(current.map((p) => p.value));
  const previousAvg =
    previous.length > 0 ? avg(previous.map((p) => p.value)) : null;

  if (previousAvg !== null && previousAvg !== 0) {
    const pctChange = ((currentAvg - previousAvg) / Math.abs(previousAvg)) * 100;
    const direction = pctChange > 0 ? "up" : pctChange < 0 ? "down" : "flat";
    const absPct = Math.abs(pctChange).toFixed(1);

    if (Math.abs(pctChange) < 1) {
      bullets.push(
        `${metricName} is essentially flat compared to the previous period (${absPct}% change).`,
      );
    } else {
      bullets.push(
        `${metricName} is ${direction} ${absPct}% compared to the previous period (${fmt(currentAvg)} vs ${fmt(previousAvg)}).`,
      );
    }
  } else {
    bullets.push(
      `${metricName} averaged ${fmt(currentAvg)} in the current period (no prior period for comparison).`,
    );
  }

  // --- 2. Latest week direction ---
  if (current.length >= 2) {
    const latest = current[current.length - 1].value;
    const prior = current[current.length - 2].value;
    const weekPct =
      prior !== 0 ? ((latest - prior) / Math.abs(prior)) * 100 : 0;
    const weekDir = weekPct > 0 ? "increased" : weekPct < 0 ? "decreased" : "unchanged";

    if (Math.abs(weekPct) >= 1) {
      bullets.push(
        `Most recent week ${weekDir} ${Math.abs(weekPct).toFixed(1)}% week-over-week (${fmt(prior)} to ${fmt(latest)}).`,
      );
    }
  }

  // --- 3. Consecutive streaks ---
  const streak = computeStreak(current);
  if (streak.length >= 3) {
    const streakDir = streak.direction === "up" ? "growth" : "decline";
    bullets.push(
      `${metricName} has shown ${streak.length} consecutive weeks of ${streakDir}.`,
    );
  }

  // --- 4. Threshold crossings ---
  const thresholdBullet = detectThresholdCrossing(current, metricName);
  if (thresholdBullet) {
    bullets.push(thresholdBullet);
  }

  // --- 5. Min/max in period ---
  if (current.length >= 3) {
    const values = current.map((p) => p.value);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const maxWeek = current.find((p) => p.value === maxVal)!.date;
    const minWeek = current.find((p) => p.value === minVal)!.date;

    if (maxVal !== minVal) {
      bullets.push(
        `Period high of ${fmt(maxVal)} (week of ${maxWeek}), low of ${fmt(minVal)} (week of ${minWeek}).`,
      );
    }
  }

  // Return 3-5 bullets
  return bullets.slice(0, 5).length >= 3
    ? bullets.slice(0, 5)
    : padBullets(bullets, current, metricName);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2);
}

function computeStreak(points: MetricPoint[]): {
  length: number;
  direction: "up" | "down";
} {
  if (points.length < 2) return { length: 0, direction: "up" };

  let streakLen = 1;
  const lastDir =
    points[points.length - 1].value >= points[points.length - 2].value
      ? "up"
      : "down";

  for (let i = points.length - 2; i >= 1; i--) {
    const dir = points[i].value >= points[i - 1].value ? "up" : "down";
    if (dir === lastDir) {
      streakLen++;
    } else {
      break;
    }
  }

  return { length: streakLen, direction: lastDir };
}

function detectThresholdCrossing(
  points: MetricPoint[],
  metricName: string,
): string | null {
  if (points.length < 2) return null;

  const latest = points[points.length - 1].value;
  const prior = points[points.length - 2].value;

  // Determine meaningful round-number thresholds based on magnitude
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(Math.abs(latest), 1))));
  const threshold = Math.round(latest / magnitude) * magnitude;

  // Check if we crossed the threshold
  if (
    threshold !== 0 &&
    ((prior < threshold && latest >= threshold) ||
      (prior >= threshold && latest < threshold))
  ) {
    const crossDir = latest >= threshold ? "above" : "below";
    return `${metricName} crossed ${crossDir} the ${fmt(threshold)} mark.`;
  }

  return null;
}

function padBullets(
  bullets: string[],
  current: MetricPoint[],
  metricName: string,
): string[] {
  const padded = [...bullets];

  if (padded.length < 3 && current.length > 0) {
    const latest = current[current.length - 1];
    padded.push(`Latest value for ${metricName}: ${fmt(latest.value)} (week of ${latest.date}).`);
  }

  if (padded.length < 3) {
    padded.push(`${current.length} data point(s) available for ${metricName} in this period.`);
  }

  if (padded.length < 3) {
    padded.push(`Monitoring ${metricName} for further trend development.`);
  }

  return padded.slice(0, 5);
}
