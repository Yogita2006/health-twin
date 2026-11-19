import { METRICS, Metric, Reading, TwinState } from "./types";

// Daily summaries: one small document per patient per day. Each reading is
// folded into that day's document as it arrives, so a month of history is
// 30 documents to read instead of thousands of readings.

// The most readings one patient may send in a day. It protects the free
// database quota from a streaming session that is left running.
export const DAILY_READING_LIMIT = 600;

// Days are cut at midnight in this time zone.
export const SUMMARY_TIME_ZONE = "Asia/Kolkata";

export interface DailyMetric {
  sum: number; // sum of all values, so average = sum / count
  min: number;
  max: number;
  outside: number; // readings whose status for this metric was "outside"
}

export interface DailySummary {
  day: string; // "2026-11-14"
  count: number; // readings that day
  restingCount: number;
  simulatedCount: number;
  metrics: Record<Metric, DailyMetric>;
  firstTs: number;
  lastTs: number;
}

// Turns a timestamp into the calendar day it falls on, such as "2026-11-14".
export function dayKey(ts: number, timeZone: string = SUMMARY_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ts));
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}

// Adds one reading to a day's summary and returns the new summary.
// "state" is the twin state the engine produced for this reading.
export function addToDaily(previous: DailySummary | null, reading: Reading, state: TwinState): DailySummary {
  const metrics = {} as Record<Metric, DailyMetric>;
  for (const m of METRICS) {
    const value = reading[m];
    const before = previous ? previous.metrics[m] : null;
    const isOutside = state.metrics[m].status === "outside" ? 1 : 0;
    metrics[m] = {
      sum: (before ? before.sum : 0) + value,
      min: before ? Math.min(before.min, value) : value,
      max: before ? Math.max(before.max, value) : value,
      outside: (before ? before.outside : 0) + isOutside,
    };
  }

  return {
    day: previous ? previous.day : dayKey(reading.ts),
    count: (previous ? previous.count : 0) + 1,
    restingCount: (previous ? previous.restingCount : 0) + (reading.context === "resting" ? 1 : 0),
    simulatedCount: (previous ? previous.simulatedCount : 0) + (reading.source === "simulated" ? 1 : 0),
    metrics,
    firstTs: previous ? previous.firstTs : reading.ts,
    lastTs: reading.ts,
  };
}

export function dailyAverage(summary: DailySummary, metric: Metric): number {
  return summary.count > 0 ? summary.metrics[metric].sum / summary.count : 0;
}
