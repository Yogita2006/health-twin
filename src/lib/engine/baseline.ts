import { BASELINE_MIN_READINGS, BASELINE_WINDOW, MIN_SPREAD, RANGE_SPREADS } from "./config";
import { Baseline, METRICS, Metric, MetricBaseline, Reading } from "./types";

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function spread(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

// Works out a patient's usual values from their own resting readings.
// Returns null when there are not yet enough readings.
export function computeBaseline(readings: Reading[], now: number): Baseline | null {
  const resting = readings
    .filter((r) => r.context === "resting")
    .sort((a, b) => b.ts - a.ts)
    .slice(0, BASELINE_WINDOW);

  if (resting.length < BASELINE_MIN_READINGS) return null;

  const metrics = {} as Record<Metric, MetricBaseline>;
  for (const m of METRICS) {
    const values = resting.map((r) => r[m]);
    const avg = mean(values);
    const sd = Math.max(spread(values, avg), MIN_SPREAD[m]);
    let high = avg + RANGE_SPREADS * sd;
    if (m === "spo2") high = Math.min(high, 100);
    metrics[m] = { mean: avg, sd, low: avg - RANGE_SPREADS * sd, high, n: values.length };
  }

  return {
    metrics,
    n: resting.length,
    computedAt: now,
    method: `mean and standard deviation of the last ${resting.length} resting readings`,
  };
}
