"use client";

// Virtual wearable: stands in for a real device. It makes up plausible readings
// and sends them to the ingest API, exactly as a real wearable would later.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useTwinState } from "@/hooks/useTwin";
import { HudLoading, HudPanel, HudShell, StatusTag } from "@/components/hud/Hud";
import { Context, METRICS, METRIC_INFO } from "@/lib/engine/types";

const INTERVAL_MS = 5000;

// Random number that clusters around 0 (a bell curve).
function noise(): number {
  const a = Math.random() || 1e-9;
  const b = Math.random();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

const round = (value: number, decimals = 0) => Number(value.toFixed(decimals));

function makeReading(context: Context, drift: number) {
  const active = context === "active";
  return {
    context,
    source: "simulated" as const,
    hr: round((active ? 122 : 75) + noise() * (active ? 5 : 2) + drift),
    sys: round((active ? 140 : 118) + noise() * 3),
    dia: round((active ? 80 : 76) + noise() * 2),
    spo2: Math.min(100, round(98 + noise() * 0.4, 1)),
    tempC: round((active ? 37.1 : 36.7) + noise() * 0.1, 1),
    rr: round((active ? 26 : 15) + noise() * 1),
  };
}

export default function WearablePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [running, setRunning] = useState(false);
  const [context, setContext] = useState<Context>("resting");
  const [rising, setRising] = useState(false);
  const [sent, setSent] = useState(0);
  const [last, setLast] = useState("Nothing sent yet.");
  const [lastReading, setLastReading] = useState<ReturnType<typeof makeReading> | null>(null);
  const { state } = useTwinState(user ? user.uid : null);

  // Refs hold the latest settings so the timer always reads current values.
  const contextRef = useRef(context);
  const risingRef = useRef(rising);
  const driftRef = useRef(0);
  useEffect(() => {
    contextRef.current = context;
    risingRef.current = rising;
  }, [context, rising]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  async function sendOne() {
    if (!user) return;

    // "Rising heart rate" adds 4 bpm per reading, up to +40, to show the twin reacting.
    driftRef.current = risingRef.current ? Math.min(driftRef.current + 4, 40) : 0;
    const reading = makeReading(contextRef.current, driftRef.current);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(reading),
      });
      const result = await response.json();

      if (!response.ok) {
        setLast(`Rejected (${response.status}): ${result.error} ${(result.details ?? []).join("; ")}`);
        return;
      }
      setSent((n) => n + 1);
      setLastReading(reading);
      setLast(
        `Sent heart rate ${reading.hr}, pressure ${reading.sys}/${reading.dia}, SpO2 ${reading.spo2}. ` +
          `Heart region: ${result.regions.heart}. Resting readings stored: ${result.restingCount}.` +
          (result.baselineUpdated ? " Personal baseline updated." : "") +
          (result.alerts ? " An alert was raised." : "")
      );
    } catch (err) {
      console.error(err);
      setLast("Could not reach the server.");
    }
  }

  // While running, send one reading straight away and then one every few seconds.
  useEffect(() => {
    if (!running || !user) return;
    const first = setTimeout(sendOne, 300);
    const timer = setInterval(sendOne, INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
    // sendOne reads its settings from refs, so it is safe to leave out here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, user]);

  if (loading || !user) return <HudLoading />;

  const chip = (on: boolean) => (on ? "hud-chip hud-chip-on" : "hud-chip");

  return (
    <HudShell active="wearable" state={state}>
      <p className="hud-notice">Simulated device. Every reading sent from this page is synthetic and is labelled as simulated.</p>

      <div className="hud-two">
        <HudPanel index="01" title="Virtual wearable" sub="Stands in for a real device / Sends to the ingest API" right={<StatusTag status={running ? "within" : "no_data"} label={running ? "Streaming" : "Idle"} />}>
          <p className="hud-label hud-plain">Activity context</p>
          <div className="hud-chips hud-note">
            <button className={chip(context === "resting")} onClick={() => setContext("resting")}>
              Resting
            </button>
            <button className={chip(context === "active")} onClick={() => setContext("active")}>
              Active
            </button>
          </div>

          <p className="hud-label" style={{ margin: "16px 0 0" }}>
            Scenario
          </p>
          <div className="hud-chips hud-note">
            <button className={chip(!rising)} onClick={() => setRising(false)}>
              Steady
            </button>
            <button className={chip(rising)} onClick={() => setRising(true)}>
              Rising heart rate
            </button>
          </div>

          <div className="hud-actions">
            <button onClick={() => setRunning((r) => !r)} className={running ? "hud-btn hud-btn-large hud-btn-danger" : "hud-btn hud-btn-large hud-btn-solid"}>
              {running ? "Stop streaming" : "Start streaming"}
            </button>
            <button onClick={sendOne} disabled={running} className="hud-btn hud-btn-large">
              Send one reading
            </button>
          </div>

          <p className="hud-label hud-note" style={{ marginTop: 16 }}>
            Stop streaming when you are not demonstrating / Each reading uses part of the free daily database quota
          </p>
        </HudPanel>

        <div className="hud-stack">
          <HudPanel index="02" title="Transmission" sub={running ? `One reading every ${INTERVAL_MS / 1000} seconds` : "Not streaming"}>
            <span className="hud-label">Readings sent this session</span>
            <p className="hud-big">{sent}</p>
            <p className="hud-text hud-plain">{last}</p>
          </HudPanel>

          <HudPanel index="03" title="Last reading sent" sub="Synthetic values / As received by the server">
            {lastReading ? (
              <div className="hud-cards">
                {METRICS.map((m) => (
                  <div key={m} className="hud-metric" style={{ marginTop: 0 }}>
                    <div className="hud-metric-top">
                      <span>{METRIC_INFO[m].label}</span>
                    </div>
                    <p className="hud-metric-value">
                      {lastReading[m].toFixed(METRIC_INFO[m].decimals)} <span className="hud-unit">{METRIC_INFO[m].unit}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="hud-text hud-plain">Nothing sent yet.</p>
            )}
          </HudPanel>
        </div>
      </div>
    </HudShell>
  );
}
