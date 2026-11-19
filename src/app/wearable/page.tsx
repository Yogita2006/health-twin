"use client";

// Virtual wearable: stands in for a real device. It makes up plausible readings
// and sends them to the ingest API, exactly as a real wearable would later.
// Each scenario pushes the measurements of one organ gradually out of range,
// so the twin can be seen reacting.
import { Fragment, useEffect, useRef, useState, FormEvent } from "react";
import { useRequireRole } from "@/lib/auth/useRequireRole";
import { useTwinState } from "@/hooks/useTwin";
import { HudLoading, HudPanel, HudShell, StatusTag } from "@/components/hud/Hud";
import { Context, METRICS, METRIC_INFO } from "@/lib/engine/types";

const INTERVAL_MS = 5000;
// Streaming stops by itself after this many readings (10 minutes), so a tab
// left open cannot use up the free database quota.
const MAX_STREAM = 120;
// A scenario reaches its full effect after this many readings.
const RAMP = 10;

type Scenario = "steady" | "heartRate" | "bloodPressure" | "lowOxygen" | "fastBreathing" | "fever";

// The scenarios, grouped by the organ whose readings they change.
const SCENARIOS: { organ: string; items: { id: Scenario; label: string }[] }[] = [
  { organ: "Normal", items: [{ id: "steady", label: "Steady" }] },
  {
    organ: "Heart",
    items: [
      { id: "heartRate", label: "Rising heart rate" },
      { id: "bloodPressure", label: "Rising blood pressure" },
    ],
  },
  {
    organ: "Lungs",
    items: [
      { id: "lowOxygen", label: "Falling oxygen" },
      { id: "fastBreathing", label: "Fast breathing" },
    ],
  },
  { organ: "Whole body", items: [{ id: "fever", label: "Rising temperature" }] },
];

// Random number that clusters around 0 (a bell curve).
function noise(): number {
  const a = Math.random() || 1e-9;
  const b = Math.random();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

const round = (value: number, decimals = 0) => Number(value.toFixed(decimals));

// "step" counts the readings sent since the scenario was chosen.
function makeReading(context: Context, scenario: Scenario, step: number) {
  const active = context === "active";
  const k = Math.min(step, RAMP) / RAMP; // 0 at the start, 1 at full effect
  const on = (wanted: Scenario, amount: number) => (scenario === wanted ? amount * k : 0);

  return {
    context,
    source: "simulated" as const,
    hr: round((active ? 122 : 75) + noise() * (active ? 5 : 2) + on("heartRate", 40) + on("fever", 14)),
    sys: round((active ? 140 : 118) + noise() * 3 + on("bloodPressure", 36)),
    dia: round((active ? 80 : 76) + noise() * 2 + on("bloodPressure", 18)),
    spo2: Math.min(100, round(98 + noise() * 0.4 - on("lowOxygen", 7), 1)),
    tempC: round((active ? 37.1 : 36.7) + noise() * 0.1 + on("fever", 2.2), 1),
    rr: round((active ? 26 : 15) + noise() * 1 + on("fastBreathing", 12) + on("lowOxygen", 5)),
  };
}

export default function WearablePage() {
  const { user, ready } = useRequireRole(["patient"]);
  const { state } = useTwinState(ready && user ? user.uid : null);

  const [running, setRunning] = useState(false);
  const [context, setContext] = useState<Context>("resting");
  const [scenario, setScenario] = useState<Scenario>("steady");
  const [sent, setSent] = useState(0);
  const [last, setLast] = useState("Nothing sent yet.");
  const [lastReading, setLastReading] = useState<ReturnType<typeof makeReading> | null>(null);

  // The form for typing in a reading by hand.
  const [manual, setManual] = useState({ hr: "72", sys: "118", dia: "76", spo2: "98", tempC: "36.7", rr: "15" });
  const [manualNote, setManualNote] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  // Refs hold the latest settings so the timer always reads current values.
  const contextRef = useRef(context);
  const scenarioRef = useRef(scenario);
  const stepRef = useRef(0);
  const streamedRef = useRef(0);
  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  function chooseScenario(next: Scenario) {
    setScenario(next);
    scenarioRef.current = next;
    stepRef.current = 0; // every scenario starts from normal values
  }

  async function post(reading: object) {
    if (!user) return null;
    const token = await user.getIdToken();
    const response = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(reading),
    });
    return { response, result: await response.json() };
  }

  async function sendOne() {
    stepRef.current += 1;
    const reading = makeReading(contextRef.current, scenarioRef.current, stepRef.current);
    try {
      const answer = await post(reading);
      if (!answer) return;
      const { response, result } = answer;
      if (!response.ok) {
        setLast(`Rejected (${response.status}): ${result.error} ${(result.details ?? []).join("; ")}`);
        if (response.status === 429) setRunning(false); // daily limit reached
        return;
      }
      setSent((n) => n + 1);
      setLastReading(reading);
      setLast(
        `Heart: ${result.regions.heart}. Lungs: ${result.regions.lungs}. Whole body: ${result.regions.body}.` +
          (result.baselineUpdated ? " Personal baseline updated." : "") +
          (result.alerts ? " An alert was raised." : "")
      );
    } catch {
      setLast("Could not reach the server.");
    }
  }

  // Sends the values typed into the form as one reading marked "manual".
  async function sendManual(e: FormEvent) {
    e.preventDefault();
    setManualBusy(true);
    setManualNote("");
    try {
      const answer = await post({
        context: contextRef.current,
        source: "manual",
        hr: Number(manual.hr),
        sys: Number(manual.sys),
        dia: Number(manual.dia),
        spo2: Number(manual.spo2),
        tempC: Number(manual.tempC),
        rr: Number(manual.rr),
      });
      if (answer) {
        setManualNote(answer.response.ok ? "Reading saved. Open Overview to see your twin respond." : `Not saved: ${answer.result.error} ${(answer.result.details ?? []).join("; ")}`);
      }
    } catch {
      setManualNote("Could not reach the server.");
    }
    setManualBusy(false);
  }

  // While running, send one reading straight away and then one every few seconds.
  useEffect(() => {
    if (!running || !user) return;
    streamedRef.current = 0;
    const tick = () => {
      streamedRef.current += 1;
      if (streamedRef.current > MAX_STREAM) {
        setRunning(false);
        setLast(`Streaming stopped by itself after ${MAX_STREAM} readings. Press Start streaming to continue.`);
        return;
      }
      sendOne();
    };
    const first = setTimeout(tick, 300);
    const timer = setInterval(tick, INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
    // sendOne reads its settings from refs, so it is safe to leave out here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, user]);

  if (!ready || !user) return <HudLoading />;

  const chip = (on: boolean) => (on ? "hud-chip hud-chip-on" : "hud-chip");

  return (
    <HudShell active="wearable" state={state}>
      <div className="hud-quad">
        <HudPanel index="01" title="Virtual wearable" sub="Simulated device / All readings are synthetic" right={<StatusTag status={running ? "within" : "no_data"} label={running ? "Streaming" : "Idle"} />}>
          {/* One row per choice: the name on the left, its buttons on the right. */}
          <div className="hud-options">
            <span className="hud-label">Activity</span>
            <div className="hud-chips">
              <button className={chip(context === "resting")} onClick={() => setContext("resting")}>
                Resting
              </button>
              <button className={chip(context === "active")} onClick={() => setContext("active")}>
                Active
              </button>
            </div>

            {SCENARIOS.map((group) => (
              <Fragment key={group.organ}>
                <span className="hud-label">{group.organ}</span>
                <div className="hud-chips">
                  {group.items.map((item) => (
                    <button key={item.id} className={chip(scenario === item.id)} onClick={() => chooseScenario(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>

          <div className="hud-actions">
            <button onClick={() => setRunning((r) => !r)} className={running ? "hud-btn hud-btn-large hud-btn-danger" : "hud-btn hud-btn-large hud-btn-solid"}>
              {running ? "Stop streaming" : "Start streaming"}
            </button>
            <button onClick={sendOne} disabled={running} className="hud-btn hud-btn-large">
              Send one reading
            </button>
          </div>
        </HudPanel>

        <HudPanel index="02" title="Enter a reading by hand" sub="Saved as a manual reading">
          <form onSubmit={sendManual}>
            <div className="hud-form-grid">
              {METRICS.map((m) => (
                <label key={m} className="hud-field">
                  <span className="hud-label">
                    {METRIC_INFO[m].label} ({METRIC_INFO[m].unit})
                  </span>
                  <input
                    className="hud-input"
                    type="number"
                    inputMode="decimal"
                    step={METRIC_INFO[m].decimals ? "0.1" : "1"}
                    value={manual[m]}
                    onChange={(e) => setManual({ ...manual, [m]: e.target.value })}
                    required
                  />
                </label>
              ))}
            </div>
            {manualNote && <p className="hud-success">{manualNote}</p>}
            <div className="hud-actions">
              <button type="submit" disabled={manualBusy || running} className="hud-btn hud-btn-large">
                {manualBusy ? "Saving" : "Save reading"}
              </button>
            </div>
          </form>
        </HudPanel>

        <HudPanel index="03" title="Transmission" sub={running ? `One reading every ${INTERVAL_MS / 1000} seconds / Stops after 10 minutes` : "Not streaming"}>
          <span className="hud-label">Readings sent this session</span>
          <p className="hud-big">{sent}</p>
          <p className="hud-text hud-plain">{last}</p>
        </HudPanel>

        <HudPanel index="04" title="Last reading sent" sub="As received by the server">
          {lastReading ? (
            <div className="hud-cards">
              {METRICS.map((m) => (
                <div key={m} className="hud-metric" style={{ marginTop: 0 }}>
                  <span className="hud-label">{METRIC_INFO[m].label}</span>
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
    </HudShell>
  );
}
