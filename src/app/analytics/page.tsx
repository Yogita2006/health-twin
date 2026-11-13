"use client";

// Analytics: how the patient's readings have looked day by day, and the
// personal baseline that every new reading is compared with.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useTwinState } from "@/hooks/useTwin";
import { useBaseline, useDailySummaries } from "@/hooks/useHistory";
import { HudLoading, HudPanel, HudShell, SHORT_LABEL } from "@/components/hud/Hud";
import DailyChart, { shortDay } from "@/components/panels/DailyChart";
import { dailyAverage } from "@/lib/engine/daily";
import { BASELINE_MIN_READINGS } from "@/lib/engine/config";
import { METRICS, METRIC_INFO, Metric } from "@/lib/engine/types";

const RANGES = [7, 14, 30];

export default function AnalyticsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState<Metric>("hr");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const uid = user ? user.uid : null;
  const { state } = useTwinState(uid);
  const { summaries, ready } = useDailySummaries(uid, days);
  const baseline = useBaseline(uid);

  // Nobody reaches this page without signing in.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <HudLoading />;

  const info = METRIC_INFO[metric];
  const totalReadings = summaries.reduce((sum, s) => sum + s.count, 0);
  const totalOutside = summaries.reduce((sum, s) => sum + s.metrics[metric].outside, 0);
  const newestFirst = [...summaries].reverse();

  async function recalculate() {
    if (!user) return;
    setBusy(true);
    setNote("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/baseline", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      setNote(result.ok ? result.message : result.error);
    } catch {
      setNote("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <HudShell active="analytics" state={state}>
      <div className="hud-stack">
        <HudPanel
          index="01"
          title="Daily history"
          sub={`${summaries.length} ${summaries.length === 1 ? "day" : "days"} with data / ${totalReadings} readings / ${totalOutside} outside range for ${info.label.toLowerCase()}`}
        >
          <div className="hud-toolbar">
            <div className="hud-chips">
              {METRICS.map((m) => (
                <button key={m} onClick={() => setMetric(m)} className={m === metric ? "hud-chip hud-chip-on" : "hud-chip"}>
                  {SHORT_LABEL[m]}
                </button>
              ))}
            </div>
            <div className="hud-chips">
              {RANGES.map((r) => (
                <button key={r} onClick={() => setDays(r)} className={r === days ? "hud-chip hud-chip-on" : "hud-chip"}>
                  {r} days
                </button>
              ))}
            </div>
          </div>
          <p className="hud-text hud-plain">
            {info.label} ({info.unit}) by day
          </p>
          {ready ? <DailyChart summaries={summaries} metric={metric} baseline={baseline} /> : <p className="hud-empty">Loading history...</p>}
        </HudPanel>

        {newestFirst.length > 0 && (
          <HudPanel index="02" title="Daily summary" sub={`${info.label} / Newest day first`}>
            <div className="hud-table-wrap">
              <table className="hud-table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Readings</th>
                    <th>Average</th>
                    <th>Lowest</th>
                    <th>Highest</th>
                    <th>Outside range</th>
                  </tr>
                </thead>
                <tbody>
                  {newestFirst.map((s) => (
                    <tr key={s.day}>
                      <td>{shortDay(s.day)}</td>
                      <td>{s.count}</td>
                      <td className="strong">{dailyAverage(s, metric).toFixed(info.decimals)}</td>
                      <td>{s.metrics[metric].min.toFixed(info.decimals)}</td>
                      <td>{s.metrics[metric].max.toFixed(info.decimals)}</td>
                      <td className={s.metrics[metric].outside > 0 ? "out" : undefined}>{s.metrics[metric].outside}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </HudPanel>
        )}

        <HudPanel
          index="03"
          title="Personal baseline"
          sub={baseline ? `From your last ${baseline.n} resting readings / ${new Date(baseline.computedAt).toLocaleString()}` : `Not established / Needs ${BASELINE_MIN_READINGS} resting readings`}
          right={
            <button onClick={recalculate} disabled={busy} className="hud-btn">
              {busy ? "Recalculating" : "Recalculate"}
            </button>
          }
        >
          {note && <p className="hud-text hud-plain">{note}</p>}
          {!baseline && <p className="hud-text hud-plain">Until a baseline exists, readings are compared with default reference ranges.</p>}
          {baseline && (
            <div className="hud-cards hud-note">
              {METRICS.map((m) => {
                const mi = METRIC_INFO[m];
                const b = baseline.metrics[m];
                return (
                  <div key={m} className="hud-metric" style={{ marginTop: 0 }}>
                    <div className="hud-metric-top">
                      <span>{mi.label}</span>
                    </div>
                    <p className="hud-metric-value">
                      {b.mean.toFixed(mi.decimals)} <span className="hud-unit">{mi.unit} usual</span>
                    </p>
                    <span className="hud-label">
                      Range: {b.low.toFixed(mi.decimals)} to {b.high.toFixed(mi.decimals)} {mi.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </HudPanel>
      </div>
    </HudShell>
  );
}
