"use client";

// Recent readings for one metric as a line, drawn over a band that shows the
// range the latest reading was compared with. The readings are spaced evenly,
// one step per reading, so a pause between two sessions does not stretch the line.
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HUD, SHORT_LABEL } from "@/components/hud/Hud";
import { METRICS, METRIC_INFO, Metric, Reading, TwinState } from "@/lib/engine/types";

const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function TrendChart({ readings, state }: { readings: Reading[]; state: TwinState | null }) {
  const [metric, setMetric] = useState<Metric>("hr");
  const info = METRIC_INFO[metric];
  const range = state ? state.metrics[metric] : null;

  const data = readings.map((r, step) => ({ step, value: r[metric] }));
  const values = data.map((d) => d.value);
  const last = data.length - 1;
  const timeAt = (step: number) => (readings[step] ? clock(readings[step].ts) : "");

  // Fit the axis to both the data and the range band, with a little headroom.
  const lowest = Math.min(...values, range ? range.low : Infinity);
  const highest = Math.max(...values, range ? range.high : -Infinity);
  const pad = Math.max((highest - lowest) * 0.15, info.decimals ? 0.2 : 2);
  const domain: [number, number] = [Number((lowest - pad).toFixed(1)), Number((highest + pad).toFixed(1))];

  return (
    <div className="hud-fill">
      <div className="hud-chips">
        {METRICS.map((m) => (
          <button key={m} onClick={() => setMetric(m)} className={m === metric ? "hud-chip hud-chip-on" : "hud-chip"}>
            {SHORT_LABEL[m]}
          </button>
        ))}
      </div>

      {data.length < 2 ? (
        <p className="hud-empty">Send at least two readings to see a trend.</p>
      ) : (
        <div className="hud-chart-fill">
          <div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                <CartesianGrid stroke={HUD.grid} vertical={false} />
                {range && <ReferenceArea y1={range.low} y2={range.high} fill={HUD.band} stroke="none" ifOverflow="extendDomain" />}
                <XAxis
                  dataKey="step"
                  type="number"
                  domain={[0, last]}
                  ticks={[0, Math.round(last / 2), last]}
                  tickFormatter={(step) => timeAt(Number(step))}
                  tick={{ fill: HUD.muted, fontSize: 11 }}
                  stroke={HUD.line}
                />
                <YAxis domain={domain} tick={{ fill: HUD.muted, fontSize: 11 }} stroke={HUD.line} width={48} />
                <Tooltip
                  cursor={{ stroke: HUD.muted, strokeDasharray: "3 3" }}
                  contentStyle={{ background: HUD.tooltip, border: `1px solid ${HUD.line}`, borderRadius: 3, color: HUD.ink }}
                  labelStyle={{ color: HUD.muted }}
                  itemStyle={{ color: HUD.ink }}
                  labelFormatter={(label) => timeAt(Number(label))}
                  formatter={(value) => [`${Number(value).toFixed(info.decimals)} ${info.unit}`, info.label]}
                />
                <Line type="linear" dataKey="value" stroke={HUD.accent} strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <p className="hud-label hud-note">
        {info.label} ({info.unit}) / One step per reading /{" "}
        {range
          ? `Band = ${range.basis === "personal" ? "your usual range" : "default reference range"}, ${range.low.toFixed(info.decimals)} to ${range.high.toFixed(info.decimals)}`
          : "Band appears once the twin has data"}
      </p>
    </div>
  );
}
