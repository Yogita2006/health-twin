"use client";

// The shared frame for every screen: top bar, tabs, footer and the numbered
// panels. The look itself lives in hud.css.
import "./hud.css";
import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { BASELINE_MIN_READINGS } from "@/lib/engine/config";
import { Metric, Status, TwinState } from "@/lib/engine/types";

// Chart libraries need plain colour values, so the theme colours are repeated here.
export const HUD = {
  accent: "#36e3d6",
  ink: "#d9f6f4",
  muted: "#8ab4bc",
  line: "#12404c",
  grid: "rgba(54, 227, 214, 0.1)",
  band: "rgba(54, 227, 214, 0.14)",
  tooltip: "#05161e",
};

export const STATUS_LABEL: Record<Status, string> = {
  within: "Within range",
  watch: "Watch",
  outside: "Outside range",
  no_data: "No data",
};

// Short names for buttons and small tiles.
export const SHORT_LABEL: Record<Metric, string> = {
  hr: "Heart rate",
  sys: "Systolic",
  dia: "Diastolic",
  spo2: "SpO2",
  tempC: "Temperature",
  rr: "Resp. rate",
};

// A coloured dot with the status written next to it, so colour is never the only clue.
export function StatusTag({ status, label }: { status: Status; label?: string }) {
  return <span className={`hud-status hud-${status}`}>{label ?? STATUS_LABEL[status]}</span>;
}

export function HudPanel({ index, title, sub, right, grow, children }: { index: string; title: string; sub?: string; right?: ReactNode; grow?: boolean; children: ReactNode }) {
  return (
    <section className={grow ? "hud-panel hud-panel-grow" : "hud-panel"}>
      <div className="hud-panel-head">
        <span className="hud-index">{index}</span>
        <h2 className="hud-panel-title">{title}</h2>
        {right && <span className="hud-panel-right">{right}</span>}
      </div>
      <p className="hud-label hud-panel-sub">{sub ?? " "}</p>
      {children}
    </section>
  );
}

// Shown while the sign-in state is being checked.
export function HudLoading({ text = "Loading" }: { text?: string }) {
  return (
    <main className="hud hud-centre">
      <span className="hud-label">{text}</span>
    </main>
  );
}

const TABS = [
  { id: "overview", label: "01 Overview", href: "/dashboard" },
  { id: "analytics", label: "02 Analytics", href: "/analytics" },
  { id: "wearable", label: "03 Wearable", href: "/wearable" },
];

const TICKS = Array.from({ length: BASELINE_MIN_READINGS }, (_, i) => i);

export function HudShell({ active, state, children }: { active: "overview" | "analytics" | "wearable"; state: TwinState | null; children: ReactNode }) {
  const router = useRouter();
  const { user, role } = useAuth();

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  const resting = state ? Math.min(state.restingCount, BASELINE_MIN_READINGS) : 0;
  const simulated = state ? state.source === "simulated" : false;

  return (
    <main className="hud">
      <div className="hud-wrap">
        <header className="hud-top">
          <div className="hud-brand">
            <div className="hud-logo" aria-hidden="true" />
            <div>
              <p className="hud-label hud-label-accent hud-plain">Connected health / Digital twin platform</p>
              <h1 className="hud-title">Full-Body Digital Twin</h1>
              <p className="hud-label hud-plain">Physiology / Baseline / Trends / Alerts</p>
            </div>
          </div>

          <div className="hud-stats">
            <div className="hud-stat">
              <p className="hud-label hud-plain">Subject</p>
              <p className="hud-stat-value">{user ? user.displayName || user.email : "Signed out"}</p>
              <p className="hud-label hud-plain">Role: {role ?? "none"}</p>
            </div>
            <div className="hud-stat hud-stat-accent">
              <p className="hud-label hud-label-accent hud-plain">Data link</p>
              <p className="hud-stat-value">{state ? "Real-time" : "Waiting"}</p>
              <p className="hud-label hud-plain">{state ? `Updated ${new Date(state.updatedAt).toLocaleTimeString()}` : "No readings yet"}</p>
            </div>
            <div className={simulated ? "hud-stat hud-stat-warn" : "hud-stat"}>
              <p className="hud-label hud-plain">Source</p>
              <p className="hud-stat-value">{state ? state.source : "No data"}</p>
              <p className="hud-label hud-plain">{state ? `Context: ${state.context}` : "Synthetic data only"}</p>
            </div>
          </div>
        </header>

        <nav className="hud-tabs" aria-label="Sections">
          {TABS.map((tab) => (
            <Link key={tab.id} href={tab.href} className={tab.id === active ? "hud-tab hud-tab-active" : "hud-tab"}>
              {tab.label}
            </Link>
          ))}
          <div className="hud-tabs-end">
            <span className="hud-label">Baseline</span>
            <span className="hud-ticks" aria-hidden="true">
              {TICKS.map((i) => (
                <i key={i} className={i < resting ? "on" : undefined} />
              ))}
            </span>
            <span className="hud-label hud-label-accent">
              {resting} / {BASELINE_MIN_READINGS}
            </span>
            <button onClick={handleSignOut} className="hud-btn hud-btn-quiet">
              Sign out
            </button>
          </div>
        </nav>

        {children}

        <footer className="hud-foot">
          <span className="hud-label hud-live">Live Firestore sync</span>
          <span className="hud-label">Educational prototype / Synthetic data / Not for clinical use</span>
          <span className="hud-label">Healthcare digital twin</span>
        </footer>
      </div>
    </main>
  );
}
