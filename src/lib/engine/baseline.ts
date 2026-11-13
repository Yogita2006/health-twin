import { BASELINE_MIN_READINGS, BASELINE_WINDOW, MIN_SPREAD, RANGE_SPREADS } from "./config";
import { Baseline, METRICS, Metric, MetricBaseline, Reading } from "./types";

// The middle value of a list. Unlike the average, it barely moves when a
// minority of the readings are unusual (for example a short spell of raised
// heart rate), so a brief episode does not redefine what is "usual".
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// A robust measure of spread: the typical distance from the middle value,
// scaled so that for ordinary data it matches the standard deviation.
function spread(values: number[], middle: number): number {
  if (values.length < 2) return 0;
  return 1.4826 * median(values.map((v) => Math.abs(v - middle)));
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
    const avg = median(values);
    const sd = Math.max(spread(values, avg), MIN_SPREAD[m]);
    let high = avg + RANGE_SPREADS * sd;
    if (m === "spo2") high = Math.min(high, 100);
    metrics[m] = { mean: avg, sd, low: avg - RANGE_SPREADS * sd, high, n: values.length };
  }

  return {
    metrics,
    n: resting.length,
    computedAt: now,
    method: `median and robust spread (MAD) of the last ${resting.length} resting readings`,
  };
}
