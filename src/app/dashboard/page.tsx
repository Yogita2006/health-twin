"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useAlerts, useTwinState } from "@/hooks/useTwin";
import { useRecentReadings } from "@/hooks/useReadings";
import Waveform from "@/components/panels/Waveform";
import TrendChart from "@/components/panels/TrendChart";
import TwinBody from "@/components/twin3d/TwinBody";
import RegionPanel from "@/components/panels/RegionPanel";
import { BASELINE_MIN_READINGS } from "@/lib/engine/config";
import { METRICS, METRIC_INFO, Region, Status } from "@/lib/engine/types";

const STATUS_STYLE: Record<Status, { label: string; box: string; text: string }> = {
  within: { label: "Within range", box: "border-emerald-500/40 bg-emerald-500/10", text: "text-emerald-300" },
  watch: { label: "Watch", box: "border-amber-500/50 bg-amber-500/10", text: "text-amber-300" },
  outside: { label: "Outside range", box: "border-red-500/60 bg-red-500/10", text: "text-red-300" },
  no_data: { label: "No data", box: "border-slate-700 bg-slate-900/40", text: "text-slate-400" },
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();
  const { state, ready } = useTwinState(user ? user.uid : null);
  const alerts = useAlerts(user ? user.uid : null);
  const readings = useRecentReadings(user ? user.uid : null);
  const [region, setRegion] = useState<Region>("heart");

  // Nobody reaches this page without signing in.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">Loading...</main>;
  }

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-cyan-300">Healthcare Digital Twin</h1>
            <p className="text-sm text-slate-400">
              {user.displayName || user.email} · <span className="uppercase tracking-wide text-cyan-200">{role ?? "no role"}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/wearable" className="rounded-lg border border-cyan-500/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10">
              Virtual wearable
            </Link>
            <button onClick={handleSignOut} className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500">
              Sign out
            </button>
          </div>
        </header>

        {!ready && <p className="text-slate-400">Loading your twin...</p>}

        {ready && !state && (
          <section className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-6">
            <p className="text-lg">Your twin has no data yet.</p>
            <p className="mt-2 text-slate-400">Open the virtual wearable and send a reading. This page will update by itself.</p>
          </section>
        )}

        {state && (
          <>
            <section className="flex flex-wrap items-center gap-3 text-sm">
              {state.source === "simulated" && (
                <span className="rounded-full border border-amber-500/50 bg-amber-500/10 px-3 py-1 text-amber-200">Simulated data</span>
              )}
              <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">Context: {state.context}</span>
              <span className="rounded-full border border-slate-700 px-3 py-1 text-slate-300">
                Updated {new Date(state.updatedAt).toLocaleTimeString()}
              </span>
              <span className="text-slate-400">
                {state.baselineEstablished
                  ? "Compared with your personal baseline."
                  : `Personal baseline not yet established (${Math.min(state.restingCount, BASELINE_MIN_READINGS)} of ${BASELINE_MIN_READINGS} resting readings). Using default reference ranges.`}
              </span>
            </section>

            <section>
              <h2 className="mb-3 text-sm uppercase tracking-wide text-slate-400">Digital twin</h2>
              <div className="grid gap-3 lg:grid-cols-5">
                <div className="rounded-xl border border-cyan-500/20 bg-slate-900/60 lg:col-span-3">
                  <TwinBody state={state} selected={region} onSelect={setRegion} />
                </div>
                <div className="lg:col-span-2">
                  <RegionPanel state={state} selected={region} onSelect={setRegion} />
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm uppercase tracking-wide text-slate-400">Live physiology</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {METRICS.map((m) => {
                  const info = METRIC_INFO[m];
                  const metric = state.metrics[m];
                  const style = STATUS_STYLE[metric.status];
                  return (
                    <div key={m} className={`rounded-xl border p-4 ${style.box}`}>
                      <p className="text-sm text-slate-300">{info.label}</p>
                      <p className="mt-1 text-3xl font-semibold">
                        {metric.value.toFixed(info.decimals)} <span className="text-base font-normal text-slate-400">{info.unit}</span>
                      </p>
                      <p className={`mt-2 text-sm font-medium ${style.text}`}>{style.label}</p>
                      <p className="text-xs text-slate-400">
                        {metric.basis === "personal" ? "Your usual range" : "Reference range"}: {metric.low.toFixed(info.decimals)} to{" "}
                        {metric.high.toFixed(info.decimals)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2">
              <Waveform bpm={state.metrics.hr.value} />
              <TrendChart readings={readings} state={state} />
            </section>

          </>
        )}

        <section>
          <h2 className="mb-3 text-sm uppercase tracking-wide text-slate-400">Recent alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">No alerts.</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((alert) => (
                <li key={alert.id} className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm">
                  <span className="text-slate-400">{new Date(alert.ts).toLocaleString()}</span>
                  <p className="mt-1 text-slate-200">{alert.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-xs text-slate-500">Educational prototype using synthetic data. Not a medical device and not for diagnosis.</p>
      </div>
    </main>
  );
}
