"use client";

// Recent readings for one metric as a line, drawn over a band that shows the
// range the latest reading was compared with.
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { METRICS, METRIC_INFO, Metric, Reading, TwinState } from "@/lib/engine/types";

const INK = "#e2e8f0"; // primary text
const MUTED = "#94a3b8"; // axis and secondary text
const GRID = "rgba(148, 163, 184, 0.15)";
const SERIES = "#22d3ee";
const BAND = "rgba(34, 211, 238, 0.10)";

const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function TrendChart({ readings, state }: { readings: Reading[]; state: TwinState | null }) {
  const [metric, setMetric] = useState<Metric>("hr");
  const info = METRIC_INFO[metric];
  const range = state ? state.metrics[metric] : null;

  const data = readings.map((r) => ({ ts: r.ts, value: r[metric] }));
  const values = data.map((d) => d.value);

  // Fit the axis to both the data and the range band, with a little headroom.
  const lowest = Math.min(...values, range ? range.low : Infinity);
  const highest = Math.max(...values, range ? range.high : -Infinity);
  const pad = Math.max((highest - lowest) * 0.15, info.decimals ? 0.2 : 2);
  const domain: [number, number] = [Number((lowest - pad).toFixed(1)), Number((highest + pad).toFixed(1))];

  return (
    <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">
          {info.label} ({info.unit}), last {data.length} readings
        </p>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`rounded-md border px-2.5 py-1 text-xs ${
                m === metric ? "border-cyan-400 bg-cyan-400/15 text-cyan-100" : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              {METRIC_INFO[m].label}
            </button>
          ))}
        </div>
      </div>

      {data.length < 2 ? (
        <p className="py-10 text-center text-sm text-slate-500">Send at least two readings to see a trend.</p>
      ) : (
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              {range && <ReferenceArea y1={range.low} y2={range.high} fill={BAND} stroke="none" ifOverflow="extendDomain" />}
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={clock}
                tick={{ fill: MUTED, fontSize: 12 }}
                stroke={GRID}
                minTickGap={60}
              />
              <YAxis domain={domain} tick={{ fill: MUTED, fontSize: 12 }} stroke={GRID} width={48} />
              <Tooltip
                cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(34,211,238,0.3)", borderRadius: 8, color: INK }}
                labelStyle={{ color: MUTED }}
                itemStyle={{ color: INK }}
                labelFormatter={(label) => clock(Number(label))}
                formatter={(value) => [`${Number(value).toFixed(info.decimals)} ${info.unit}`, info.label]}
              />
              <Line type="monotone" dataKey="value" stroke={SERIES} strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="mt-2 text-xs text-slate-500">
        {range
          ? `Shaded band: ${range.basis === "personal" ? "your usual range" : "the default reference range"}, ${range.low.toFixed(info.decimals)} to ${range.high.toFixed(info.decimals)} ${info.unit}.`
          : "The shaded band appears once the twin has data."}
      </p>
    </div>
  );
}
