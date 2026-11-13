"use client";

// Virtual wearable: stands in for a real device. It makes up plausible readings
// and sends them to the ingest API, exactly as a real wearable would later.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Context } from "@/lib/engine/types";

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

  if (loading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading...</main>;
  }

  const chip = (on: boolean) =>
    `rounded-lg border px-4 py-2 text-sm ${on ? "border-cyan-400 bg-cyan-400/15 text-cyan-200" : "border-slate-700 text-slate-300 hover:border-slate-500"}`;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-cyan-300">Virtual wearable</h1>
          <Link href="/dashboard" className="text-sm text-cyan-200 underline">
            Back to dashboard
          </Link>
        </header>

        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Simulated device. Every reading sent from this page is synthetic and is labelled as simulated.
        </p>

        <section className="space-y-5 rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-6">
          <div>
            <p className="mb-2 text-sm text-slate-400">Activity context</p>
            <div className="flex gap-2">
              <button className={chip(context === "resting")} onClick={() => setContext("resting")}>Resting</button>
              <button className={chip(context === "active")} onClick={() => setContext("active")}>Active</button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-slate-400">Scenario</p>
            <div className="flex gap-2">
              <button className={chip(!rising)} onClick={() => setRising(false)}>Steady</button>
              <button className={chip(rising)} onClick={() => setRising(true)}>Rising heart rate</button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => setRunning((r) => !r)}
              className={`rounded-lg px-5 py-3 font-semibold ${running ? "bg-red-500 text-white hover:bg-red-400" : "bg-cyan-500 text-slate-950 hover:bg-cyan-400"}`}
            >
              {running ? "Stop streaming" : "Start streaming"}
            </button>
            <button onClick={sendOne} disabled={running} className="rounded-lg border border-cyan-500/40 px-5 py-3 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-40">
              Send one reading
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-sm">
          <p className="text-slate-400">
            Readings sent this session: <span className="font-semibold text-slate-100">{sent}</span>
            {running && <span className="ml-3 text-cyan-300">streaming every {INTERVAL_MS / 1000} seconds</span>}
          </p>
          <p className="mt-3 text-slate-300">{last}</p>
        </section>

        <p className="text-xs text-slate-500">
          Stop streaming when you are not demonstrating. Each reading uses part of the free daily database quota.
        </p>
      </div>
    </main>
  );
}
