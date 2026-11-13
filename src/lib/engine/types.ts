// Shared shapes for the twin engine. Everything the engine reads or writes is defined here.

export type Metric = "hr" | "sys" | "dia" | "spo2" | "tempC" | "rr";
export type Context = "resting" | "active" | "sleep";
export type Source = "simulated" | "manual" | "device";
export type Status = "within" | "watch" | "outside" | "no_data";
export type Region = "heart" | "lungs" | "body" | "brain" | "skeleton";

export const METRICS: Metric[] = ["hr", "sys", "dia", "spo2", "tempC", "rr"];

export const METRIC_INFO: Record<Metric, { label: string; unit: string; decimals: number }> = {
  hr: { label: "Heart rate", unit: "bpm", decimals: 0 },
  sys: { label: "Systolic pressure", unit: "mmHg", decimals: 0 },
  dia: { label: "Diastolic pressure", unit: "mmHg", decimals: 0 },
  spo2: { label: "SpO2", unit: "%", decimals: 1 },
  tempC: { label: "Temperature", unit: "°C", decimals: 1 },
  rr: { label: "Respiratory rate", unit: "/min", decimals: 0 },
};

// One set of measurements taken at one moment.
export interface Reading {
  ts: number; // milliseconds since 1970, set by the server
  source: Source;
  context: Context;
  hr: number;
  sys: number;
  dia: number;
  spo2: number;
  tempC: number;
  rr: number;
}

// A patient's usual values for one metric.
export interface MetricBaseline {
  mean: number;
  sd: number;
  low: number;
  high: number;
  n: number;
}

export interface Baseline {
  metrics: Record<Metric, MetricBaseline>;
  n: number; // resting readings used
  computedAt: number;
  method: string;
}

// How one metric looks right now.
export interface MetricState {
  value: number;
  deviation: number; // how many spreads from the mean
  status: Status;
  low: number;
  high: number;
  basis: "personal" | "default"; // which range it was compared with
}

// The digital twin: one document per patient, rewritten on every reading.
export interface TwinState {
  updatedAt: number;
  source: Source;
  context: Context;
  metrics: Record<Metric, MetricState>;
  regions: Record<Region, Status>;
  streak: Record<Metric, number>; // consecutive resting readings outside range
  restingCount: number;
  baselineEstablished: boolean;
}

export interface Alert {
  ts: number;
  metric: Metric;
  value: number;
  low: number;
  high: number;
  direction: "above" | "below";
  message: string;
  acknowledgedBy: string | null;
}
