"use client";

// One point per day: the day's average as a line, the day's lowest-to-highest
// spread as a band behind it, and the personal usual range as dashed lines.
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { HUD } from "@/components/hud/Hud";
import { DailySummary, dailyAverage } from "@/lib/engine/daily";
import { Baseline, METRIC_INFO, Metric } from "@/lib/engine/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-11-14" becomes "14 Nov".
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return `${Number(date)} ${MONTHS[Number(month) - 1] ?? ""}`;
}

export default function DailyChart({ summaries, metric, baseline }: { summaries: DailySummary[]; metric: Metric; baseline: Baseline | null }) {
  const info = METRIC_INFO[metric];
  const usual = baseline ? baseline.metrics[metric] : null;
  const show = (value: number) => `${value.toFixed(info.decimals)} ${info.unit}`;

  if (summaries.length === 0) {
    return <p className="hud-empty">No daily history yet. Send readings from the virtual wearable to start it.</p>;
  }

  const data = summaries.map((s) => ({
    day: shortDay(s.day),
    average: Number(dailyAverage(s, metric).toFixed(2)),
    range: [s.metrics[metric].min, s.metrics[metric].max],
  }));

  // Fit the axis to the data and the usual range, with a little headroom.
  const lowest = Math.min(...summaries.map((s) => s.metrics[metric].min), usual ? usual.low : Infinity);
  const highest = Math.max(...summaries.map((s) => s.metrics[metric].max), usual ? usual.high : -Infinity);
  const pad = Math.max((highest - lowest) * 0.15, info.decimals ? 0.2 : 2);
  const domain: [number, number] = [Number((lowest - pad).toFixed(1)), Number((highest + pad).toFixed(1))];

  return (
    <div>
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={HUD.grid} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: HUD.muted, fontSize: 12 }} stroke={HUD.line} minTickGap={24} padding={{ left: 24, right: 24 }} />
            <YAxis domain={domain} tick={{ fill: HUD.muted, fontSize: 12 }} stroke={HUD.line} width={48} />
            <Tooltip
              cursor={{ stroke: HUD.muted, strokeDasharray: "3 3" }}
              contentStyle={{ background: HUD.tooltip, border: `1px solid ${HUD.line}`, borderRadius: 3, color: HUD.ink }}
              labelStyle={{ color: HUD.muted }}
              itemStyle={{ color: HUD.ink }}
              formatter={(value, name) => [
                Array.isArray(value) ? `${show(Number(value[0]))} to ${show(Number(value[1]))}` : show(Number(value)),
                String(name),
              ]}
            />
            {usual && <ReferenceLine y={usual.low} stroke={HUD.muted} strokeDasharray="5 5" ifOverflow="extendDomain" />}
            {usual && <ReferenceLine y={usual.high} stroke={HUD.muted} strokeDasharray="5 5" ifOverflow="extendDomain" />}
            <Area type="monotone" dataKey="range" name="Lowest to highest" stroke="none" fill={HUD.band} isAnimationActive={false} activeDot={false} />
            <Line type="monotone" dataKey="average" name="Daily average" stroke={HUD.accent} strokeWidth={2} dot={{ r: 4, fill: HUD.accent }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="hud-legend">
        <span className="hud-label" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 20, height: 2, background: HUD.accent }} aria-hidden="true" />
          Daily average
        </span>
        <span className="hud-label" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-block", width: 20, height: 10, background: HUD.band }} aria-hidden="true" />
          Lowest to highest that day
        </span>
        {usual && (
          <span className="hud-label" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-block", width: 20, borderTop: `1px dashed ${HUD.muted}` }} aria-hidden="true" />
            Your usual resting range ({usual.low.toFixed(info.decimals)} to {usual.high.toFixed(info.decimals)} {info.unit})
          </span>
        )}
      </div>
    </div>
  );
}
