"use client";

// Analytics for one patient, kept deliberately small: one line saying whether
// anything needs attention, a card for each measurement, a single chart of
// the selected measurement, and beside it how much of the time each
// measurement stayed in range, with the recent alerts.
import { ReactNode, useState } from "react";
import { useAlerts } from "@/hooks/useTwin";
import { useBaseline, useDailySummaries } from "@/hooks/useHistory";
import { HudPanel, SHORT_LABEL, StatusTag } from "@/components/hud/Hud";
import DailyChart from "@/components/panels/DailyChart";
import { DailySummary, dayKey } from "@/lib/engine/daily";
import { Baseline, METRICS, METRIC_INFO, Metric, Status } from "@/lib/engine/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIODS = [7, 14, 30];

function average(days: DailySummary[], metric: Metric): number | null {
  const count = days.reduce((n, d) => n + d.count, 0);
  return count ? days.reduce((n, d) => n + d.metrics[metric].sum, 0) / count : null;
}

// Where the period's average sits against the personal usual range.
function standing(value: number | null, baseline: Baseline | null, metric: Metric): { status: Status; label: string } {
  if (value === null) return { status: "no_data", label: "No data" };
  if (!baseline) return { status: "no_data", label: "No baseline yet" };
  const usual = baseline.metrics[metric];
  if (value > usual.high) return { status: "watch", label: "Above usual" };
  if (value < usual.low) return { status: "watch", label: "Below usual" };
  return { status: "within", label: "In usual range" };
}

// "+1.4 bpm" or "No change", comparing this period with the one before.
function changeText(now: number | null, before: number | null, metric: Metric): string {
  if (now === null || before === null) return "No earlier data";
  const info = METRIC_INFO[metric];
  const diff = now - before;
  if (Math.abs(diff) < (info.decimals ? 0.05 : 0.5)) return "No change";
  return `${diff > 0 ? "+" : "-"}${Math.abs(diff).toFixed(info.decimals || 1)} ${info.unit}`;
}

interface Props {
  patientId: string;
  // The patient gets a button here to recalculate their baseline; a doctor does not.
  baselineAction?: ReactNode;
}

export default function AnalyticsView({ patientId, baselineAction }: Props) {
  const [period, setPeriod] = useState(7);
  const [metric, setMetric] = useState<Metric>("hr");
  const { summaries, ready } = useDailySummaries(patientId, period * 2);
  const baseline = useBaseline(patientId);
  const alerts = useAlerts(patientId, 50);

  // The period ends today. The period before it is the same length.
  const now = Date.now();
  const start = dayKey(now - (period - 1) * DAY_MS);
  const earlier = dayKey(now - (2 * period - 1) * DAY_MS);
  const current = summaries.filter((d) => d.day >= start);
  const before = summaries.filter((d) => d.day >= earlier && d.day < start);
  const periodAlerts = alerts.filter((a) => a.ts >= now - period * DAY_MS);
  const alertCount = periodAlerts.length;


  const cards = METRICS.map((m) => {
    const value = average(current, m);
    return { metric: m, value, place: standing(value, baseline, m), change: changeText(value, average(before, m), m) };
  });
  const attention = cards.filter((c) => c.place.status === "watch");

  const info = METRIC_INFO[metric];
  const readings = current.reduce((n, d) => n + d.count, 0);
  const outside = current.reduce((n, d) => n + d.metrics[metric].outside, 0);
  const usual = baseline ? baseline.metrics[metric] : null;
  const figures = [
    { label: "Usual range", value: usual ? `${usual.low.toFixed(info.decimals)} to ${usual.high.toFixed(info.decimals)} ${info.unit}` : "Not set yet" },
    { label: "Outside range", value: readings ? `${((outside / readings) * 100).toFixed(1)}% of readings` : "No data" },
    { label: "Alerts", value: String(alertCount) },
  ];

  const periodChips = (
    <span className="hud-chips">
      {PERIODS.map((p) => (
        <button key={p} onClick={() => setPeriod(p)} className={p === period ? "hud-chip hud-chip-on" : "hud-chip"}>
          {p} days
        </button>
      ))}
    </span>
  );

  if (!ready) return <p className="hud-empty">Loading...</p>;

  if (current.length === 0) {
    return (
      <HudPanel index="01" title="Summary" sub={`Last ${period} days`} right={periodChips}>
        <p className="hud-empty">No readings in this period. Load sample data from Overview, or send readings from Wearable.</p>
      </HudPanel>
    );
  }

  return (
    <div className="hud-stack">
      <p className={attention.length ? "hud-notice hud-plain" : "hud-success hud-plain"}>
        {attention.length === 0
          ? `All six measurements averaged within their usual range over the last ${period} days.`
          : `Outside the usual range over the last ${period} days: ${attention.map((c) => `${METRIC_INFO[c.metric].label} (${c.place.label.toLowerCase()})`).join(", ")}.`}
      </p>

      <HudPanel index="01" title="Summary" sub={`Average over the last ${period} days / Change on the ${period} days before`} right={periodChips}>
        <div className="hud-summary">
          {cards.map((card) => (
            <button
              key={card.metric}
              onClick={() => setMetric(card.metric)}
              className={card.metric === metric ? "hud-summary-card hud-summary-on" : "hud-summary-card"}
              aria-pressed={card.metric === metric}
            >
              <span className="hud-label">{SHORT_LABEL[card.metric]}</span>
              <p className="hud-summary-value">
                {card.value === null ? "--" : card.value.toFixed(METRIC_INFO[card.metric].decimals)} <span className="hud-unit">{METRIC_INFO[card.metric].unit}</span>
              </p>
              <span className="hud-summary-change">{card.change}</span>
              <StatusTag status={card.place.status} label={card.place.label} />
            </button>
          ))}
        </div>
      </HudPanel>

      <div className="hud-two">
        <HudPanel index="02" title={`${info.label} trend`} sub={`Daily average with each day's range / ${info.unit}`} right={baselineAction}>
          <div className="hud-figures">
            {figures.map((figure) => (
              <div key={figure.label}>
                <span className="hud-label">{figure.label}</span>
                <p>{figure.value}</p>
              </div>
            ))}
          </div>
          <DailyChart summaries={current} metric={metric} baseline={baseline} />
        </HudPanel>

        <HudPanel index="03" title="Time in range" sub="Share of readings inside the usual range / All measurements">
          {METRICS.map((m) => {
            const out = current.reduce((n, d) => n + d.metrics[m].outside, 0);
            const inRange = readings ? (1 - out / readings) * 100 : 0;
            return (
              <div key={m} className="hud-gauge-row">
                <div className="hud-gauge-top">
                  <span>{METRIC_INFO[m].label}</span>
                  <b>{inRange.toFixed(1)}%</b>
                </div>
                <div className="hud-bar">
                  <i style={{ width: `${inRange}%` }} />
                </div>
              </div>
            );
          })}

          <p className="hud-label" style={{ margin: "18px 0 0" }}>
            Alerts in the last {period} days
          </p>
          <div className="hud-note">
            {periodAlerts.length === 0 ? (
              <p className="hud-text hud-plain">No alerts.</p>
            ) : (
              periodAlerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="hud-alert">
                  <span className="hud-label">{new Date(alert.ts).toLocaleString()}</span>
                  <br />
                  {alert.message}
                </div>
              ))
            )}
          </div>
        </HudPanel>
      </div>
    </div>
  );
}
