"use client";

// The shared frame for every screen: top bar, tabs, footer and the numbered
// panels. The look itself lives in hud.css.
import "./hud.css";
import { ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, sendEmailVerification, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { Role, useAuth } from "@/lib/auth/AuthProvider";
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

// The frame for the sign-in and register pages: brand on top, one panel below.
export function HudAuth({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <main className="hud hud-centre">
      <div className="hud-auth">
        <div className="hud-brand">
          <div className="hud-logo" aria-hidden="true" />
          <div>
            <p className="hud-label hud-label-accent hud-plain">Connected health / Digital twin platform</p>
            <h1 className="hud-title">Full-Body Digital Twin</h1>
            <p className="hud-label hud-plain">Physiology / Baseline / Trends / Alerts</p>
          </div>
        </div>
        <HudPanel index="00" title={title} sub={sub}>
          {children}
        </HudPanel>
        <p className="hud-label hud-note" style={{ textAlign: "center" }}>
          Educational prototype / Synthetic data / Not for clinical use
        </p>
      </div>
    </main>
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

// Shown at the top of every screen until the person has confirmed their email
// address by clicking the link Firebase sent them.
function VerifyEmailBanner({ user }: { user: User }) {
  const [verified, setVerified] = useState(user.emailVerified);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (verified) return null;

  async function resend() {
    setBusy(true);
    try {
      await sendEmailVerification(user);
      setNote(`Email sent to ${user.email}. Check your spam folder too.`);
    } catch {
      setNote("Could not send the email just now. Wait a minute and try again.");
    }
    setBusy(false);
  }

  async function check() {
    setBusy(true);
    try {
      await user.reload(); // asks Firebase whether the link has been clicked
      if (user.emailVerified) {
        await user.getIdToken(true); // a fresh token that says "email verified"
        setVerified(true);
      } else setNote("Not confirmed yet. Click the link in the email, then press this again.");
    } catch {
      setNote("Could not check just now. Try again in a moment.");
    }
    setBusy(false);
  }

  return (
    <div className="hud-notice hud-split" style={{ marginBottom: 12 }}>
      <span>{note || `Confirm your email: we sent a link to ${user.email}.`}</span>
      <span className="hud-chips">
        <button onClick={check} disabled={busy} className="hud-btn">
          I have confirmed
        </button>
        <button onClick={resend} disabled={busy} className="hud-btn hud-btn-quiet">
          Resend email
        </button>
      </span>
    </div>
  );
}

// The tabs each role sees. A role only ever sees links to screens it may use.
type Tab = { id: string; label: string; href: string };
const TABS: Record<Role, Tab[]> = {
  patient: [
    { id: "overview", label: "Overview", href: "/dashboard" },
    { id: "analytics", label: "Analytics", href: "/analytics" },
    { id: "history", label: "History", href: "/history" },
    { id: "wearable", label: "Wearable", href: "/wearable" },
    { id: "profile", label: "Profile", href: "/profile" },
  ],
  doctor: [
    { id: "patients", label: "My patients", href: "/doctor" },
    { id: "profile", label: "Profile", href: "/profile" },
  ],
  admin: [
    { id: "users", label: "Users", href: "/admin" },
    { id: "patients", label: "All patients", href: "/doctor" },
    { id: "profile", label: "Profile", href: "/profile" },
  ],
};

const TICKS = Array.from({ length: BASELINE_MIN_READINGS }, (_, i) => i);

interface ShellProps {
  active: string; // the id of the tab to highlight
  // The twin being shown, if this screen shows one. Leave it out on screens
  // that are not about one patient's live data.
  state?: TwinState | null;
  // Set when a doctor or admin is looking at someone else's twin.
  viewing?: string;
  children: ReactNode;
}

export function HudShell({ active, state, viewing, children }: ShellProps) {
  const router = useRouter();
  const { user, role, name } = useAuth();

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  const showsTwin = state !== undefined;
  const resting = state ? Math.min(state.restingCount, BASELINE_MIN_READINGS) : 0;
  const simulated = state ? state.source === "simulated" : false;
  const tabs = role ? TABS[role] : [];
  const myName = name || (user ? user.displayName || user.email : null) || "Signed out";

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
              <p className="hud-label hud-plain">Signed in</p>
              <p className="hud-stat-value">{myName}</p>
              <p className="hud-label hud-plain">Role: {role ?? "none"}</p>
            </div>
            {viewing && (
              <div className="hud-stat hud-stat-accent">
                <p className="hud-label hud-label-accent hud-plain">Viewing patient</p>
                <p className="hud-stat-value">{viewing}</p>
                <p className="hud-label hud-plain">Read only</p>
              </div>
            )}
            {showsTwin && (
              <div className={viewing ? "hud-stat" : "hud-stat hud-stat-accent"}>
                <p className={viewing ? "hud-label hud-plain" : "hud-label hud-label-accent hud-plain"}>Data link</p>
                <p className="hud-stat-value">{state ? "Real-time" : "Waiting"}</p>
                <p className="hud-label hud-plain">{state ? `Updated ${new Date(state.updatedAt).toLocaleTimeString()}` : "No readings yet"}</p>
              </div>
            )}
            {showsTwin && (
              <div className={simulated ? "hud-stat hud-stat-warn" : "hud-stat"}>
                <p className="hud-label hud-plain">Source</p>
                <p className="hud-stat-value">{state ? state.source : "No data"}</p>
                <p className="hud-label hud-plain">{state ? `Context: ${state.context}` : "Synthetic data only"}</p>
              </div>
            )}
          </div>
        </header>

        <nav className="hud-tabs" aria-label="Sections">
          {tabs.map((tab, i) => (
            <Link key={tab.id} href={tab.href} className={tab.id === active ? "hud-tab hud-tab-active" : "hud-tab"}>
              0{i + 1} {tab.label}
            </Link>
          ))}
          <div className="hud-tabs-end">
            {showsTwin && (
              <>
                <span className="hud-label">Baseline</span>
                <span className="hud-ticks" aria-hidden="true">
                  {TICKS.map((i) => (
                    <i key={i} className={i < resting ? "on" : undefined} />
                  ))}
                </span>
                <span className="hud-label hud-label-accent">
                  {resting} / {BASELINE_MIN_READINGS}
                </span>
              </>
            )}
            <button onClick={handleSignOut} className="hud-btn hud-btn-quiet">
              Sign out
            </button>
          </div>
        </nav>

        {user && <VerifyEmailBanner key={user.uid} user={user} />}

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
