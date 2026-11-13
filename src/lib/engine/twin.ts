import { ACTIVE_DEFAULTS, ALERT_AFTER, OUTSIDE_SPREADS, RANGE_SPREADS, REGION_METRICS, RESTING_DEFAULTS } from "./config";
import { Alert, Baseline, METRICS, METRIC_INFO, Metric, MetricState, Reading, Region, Status, TwinState } from "./types";

const SEVERITY: Record<Status, number> = { no_data: 0, within: 1, watch: 2, outside: 3 };

// Compares one value with a range and says how far outside it is.
function evaluate(value: number, mean: number, sd: number, low: number, high: number, basis: "personal" | "default"): MetricState {
  const deviation = sd > 0 ? (value - mean) / sd : 0;
  const size = Math.abs(deviation);
  let status: Status = "within";
  if (value < low || value > high) status = size > OUTSIDE_SPREADS ? "outside" : "watch";
  return { value, deviation, status, low, high, basis };
}

// A default range has no mean or spread, so derive them from its edges.
function fromDefault(value: number, range: { low: number; high: number }): MetricState {
  const mean = (range.low + range.high) / 2;
  const sd = (range.high - range.low) / (2 * RANGE_SPREADS);
  return evaluate(value, mean, sd, range.low, range.high, "default");
}

function worst(statuses: Status[]): Status {
  return statuses.reduce<Status>((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "no_data");
}

function round(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

export interface TwinUpdate {
  state: TwinState;
  alerts: Alert[];
}

// The heart of the project. Given the previous twin state, a new reading and the
// patient's baseline, work out the new state and any alerts. It has no side effects:
// it reads nothing and saves nothing, which is what makes it easy to test.
export function updateTwin(previous: TwinState | null, reading: Reading, baseline: Baseline | null): TwinUpdate {
  const resting = reading.context !== "active";
  const metrics = {} as Record<Metric, MetricState>;

  for (const m of METRICS) {
    const value = reading[m];
    if (!resting) {
      metrics[m] = fromDefault(value, ACTIVE_DEFAULTS[m]);
    } else if (baseline) {
      const b = baseline.metrics[m];
      metrics[m] = evaluate(value, b.mean, b.sd, b.low, b.high, "personal");
    } else {
      metrics[m] = fromDefault(value, RESTING_DEFAULTS[m]);
    }
  }

  // A region takes the most severe status among the metrics that drive it.
  const regions = {} as Record<Region, Status>;
  for (const region of Object.keys(REGION_METRICS) as Region[]) {
    regions[region] = worst(REGION_METRICS[region].map((m) => metrics[m].status));
  }

  // Count consecutive resting readings outside range, and alert when the count
  // first reaches ALERT_AFTER. Active readings leave the count unchanged.
  const streak = {} as Record<Metric, number>;
  const alerts: Alert[] = [];
  for (const m of METRICS) {
    const before = previous?.streak?.[m] ?? 0;
    if (!resting) {
      streak[m] = before;
      continue;
    }
    streak[m] = metrics[m].status === "outside" ? before + 1 : 0;

    if (streak[m] === ALERT_AFTER) {
      const info = METRIC_INFO[m];
      const s = metrics[m];
      const direction = s.value > s.high ? "above" : "below";
      const rangeName = s.basis === "personal" ? "your usual range" : "the default reference range";
      alerts.push({
        ts: reading.ts,
        metric: m,
        value: s.value,
        low: s.low,
        high: s.high,
        direction,
        message:
          `${info.label} has been ${direction} ${rangeName} ` +
          `(${round(s.low, info.decimals)} to ${round(s.high, info.decimals)} ${info.unit}) ` +
          `for ${ALERT_AFTER} readings in a row. This is information, not a diagnosis.`,
        acknowledgedBy: null,
      });
    }
  }

  const restingCount = (previous?.restingCount ?? 0) + (reading.context === "resting" ? 1 : 0);

  return {
    state: {
      updatedAt: reading.ts,
      source: reading.source,
      context: reading.context,
      metrics,
      regions,
      streak,
      restingCount,
      baselineEstablished: baseline !== null,
    },
    alerts,
  };
}
