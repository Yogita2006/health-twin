import { Metric, Region } from "./types";

// Every number the engine uses is here, so it can be explained and changed in one place.
// The ranges are commonly cited adult reference values used as display defaults.
// They are NOT clinical thresholds and this prototype does not diagnose.

export const RESTING_DEFAULTS: Record<Metric, { low: number; high: number }> = {
  hr: { low: 60, high: 100 },
  sys: { low: 90, high: 120 },
  dia: { low: 60, high: 80 },
  spo2: { low: 95, high: 100 },
  tempC: { low: 36.1, high: 37.2 },
  rr: { low: 12, high: 20 },
};

// Wider ranges used when the reading was taken during activity (assumed values).
export const ACTIVE_DEFAULTS: Record<Metric, { low: number; high: number }> = {
  hr: { low: 60, high: 170 },
  sys: { low: 90, high: 180 },
  dia: { low: 55, high: 95 },
  spo2: { low: 93, high: 100 },
  tempC: { low: 36.1, high: 38.0 },
  rr: { low: 12, high: 40 },
};

// A personal baseline needs at least this many resting readings...
export const BASELINE_MIN_READINGS = 20;
// ...and uses at most this many of the most recent ones.
export const BASELINE_WINDOW = 50;

// Synthetic data can be unrealistically steady. A minimum spread stops
// the usual range from collapsing to almost nothing.
export const MIN_SPREAD: Record<Metric, number> = {
  hr: 2,
  sys: 3,
  dia: 2.5,
  spo2: 0.5,
  tempC: 0.15,
  rr: 1,
};

// Usual range = mean plus or minus this many spreads.
export const RANGE_SPREADS = 2;
// Beyond the usual range but within this many spreads: "watch". Beyond it: "outside".
export const OUTSIDE_SPREADS = 4;
// An alert is raised after this many consecutive resting readings are "outside".
export const ALERT_AFTER = 2;

// Which metrics drive which body region.
export const REGION_METRICS: Record<Region, Metric[]> = {
  heart: ["hr", "sys", "dia"],
  lungs: ["spo2", "rr"],
  body: ["tempC"],
  brain: [],
  skeleton: [],
};
