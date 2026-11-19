// Makes a believable set of SYNTHETIC history for a new patient, so that the
// twin, the charts and the baseline have something to show straight away.
// Every value is invented from a seed and is labelled "simulated".
import { DailySummary, dayKey } from "./daily";
import { METRICS, METRIC_INFO, Metric, Reading } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
export const SAMPLE_DAYS = 14;
export const SAMPLE_READINGS = 40;

// A small repeatable random number generator: the same seed gives the same numbers.
function generator(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How much each measurement wobbles from one reading to the next.
const WOBBLE: Record<Metric, number> = { hr: 2, sys: 3, dia: 2, spo2: 0.3, tempC: 0.1, rr: 1 };

export function makeSampleHistory(now: number, seed: string): { readings: Reading[]; dailies: DailySummary[] } {
  const random = generator(seed);
  // Bell-curve noise around zero.
  const noise = () => Math.sqrt(-2 * Math.log(random() || 1e-9)) * Math.cos(2 * Math.PI * random());
  const round = (value: number, m: Metric) => Number(value.toFixed(METRIC_INFO[m].decimals));

  // This person's usual resting values, picked once from the seed.
  const usual: Record<Metric, number> = {
    hr: 68 + random() * 10,
    sys: 112 + random() * 10,
    dia: 72 + random() * 8,
    spo2: 97.6 + random() * 0.8,
    tempC: 36.6 + random() * 0.2,
    rr: 14 + random() * 2,
  };
  const value = (m: Metric, shift: number) => {
    const v = round(usual[m] + shift + noise() * WOBBLE[m], m);
    return m === "spo2" ? Math.min(100, v) : v;
  };

  // The most recent readings: one every 30 seconds, ending now.
  const readings: Reading[] = [];
  for (let i = SAMPLE_READINGS - 1; i >= 0; i--) {
    readings.push({
      ts: now - i * 30000,
      source: "simulated",
      context: "resting",
      hr: value("hr", 0),
      sys: value("sys", 0),
      dia: value("dia", 0),
      spo2: value("spo2", 0),
      tempC: value("tempC", 0),
      rr: value("rr", 0),
    });
  }

  // One summary for each earlier day, each a little different from the last.
  const dailies: DailySummary[] = [];
  for (let d = SAMPLE_DAYS - 1; d >= 1; d--) {
    const middle = now - d * DAY_MS;
    const count = 60 + Math.floor(random() * 60);
    const metrics = {} as DailySummary["metrics"];
    for (const m of METRICS) {
      const shift = noise() * WOBBLE[m] * 0.6; // that day's drift
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < count; i++) {
        const v = value(m, shift);
        sum += v;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      metrics[m] = { sum: Number(sum.toFixed(1)), min, max, outside: 0 };
    }
    dailies.push({
      day: dayKey(middle),
      count,
      restingCount: count,
      simulatedCount: count,
      metrics,
      firstTs: middle - 2 * 60 * 60 * 1000,
      lastTs: middle + 2 * 60 * 60 * 1000,
    });
  }

  return { readings, dailies };
}
