"use client";

// The site's front door. Visitors who are not signed in see what the product
// is and how to start. Anyone signed in is sent to their own home:
// patient -> their twin, doctor -> their patients, admin -> the user list.
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { HudAuth, HudLoading, HudPanel } from "@/components/hud/Hud";
import TwinBody from "@/components/twin3d/TwinBody";

const HOME = { patient: "/dashboard", doctor: "/doctor", admin: "/admin" };

const FEATURES = [
  { title: "Live 3D twin", text: "Organs change colour as readings arrive." },
  { title: "Personal baseline", text: "Compared with your own usual range." },
  { title: "You control access", text: "Doctors see only what you share." },
];

export default function Home() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && role) router.replace(HOME[role]);
  }, [loading, user, role, router]);

  if (loading || (user && role)) return <HudLoading />;

  // Signed in, but the account has no role record. This only happens if
  // registration was interrupted half way.
  if (user) {
    return (
      <HudAuth title="Account not set up" sub="This sign-in has no role record">
        <p className="hud-text hud-plain">Registration did not finish for this account. Sign out and register again.</p>
        <button onClick={() => signOut(auth)} className="hud-btn hud-btn-block">
          Sign out
        </button>
      </HudAuth>
    );
  }

  return (
    <main className="hud">
      <div className="hud-wrap">
        <header className="hud-top">
          <div className="hud-brand">
            <div className="hud-logo" aria-hidden="true" />
            <div>
              <p className="hud-label hud-label-accent hud-plain">Connected health / Digital twin platform</p>
              <h1 className="hud-title">Full-Body Digital Twin</h1>
            </div>
          </div>
          <div className="hud-chips">
            <Link href="/login" className="hud-btn hud-btn-large">
              Sign in
            </Link>
            <Link href="/register" className="hud-btn hud-btn-large hud-btn-solid">
              Create account
            </Link>
          </div>
        </header>

        <div className="hud-hero">
          <div className="hud-hero-text">
            <p className="hud-label hud-label-accent hud-plain">Patients / Doctors / Administrators</p>
            <h2 className="hud-hero-title">A living 3D model of your health</h2>
            <p className="hud-text">Send readings, watch your twin respond in real time, and share it with a doctor you choose.</p>
            <div className="hud-actions">
              <Link href="/register" className="hud-btn hud-btn-large hud-btn-solid">
                Get started
              </Link>
              <Link href="/login" className="hud-btn hud-btn-large">
                I have an account
              </Link>
            </div>
            <div className="hud-cards" style={{ marginTop: 22 }}>
              {FEATURES.map((feature) => (
                <div key={feature.title} className="hud-metric" style={{ marginTop: 0 }}>
                  <p className="hud-item-name">{feature.title}</p>
                  <span className="hud-text">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          <HudPanel index="3D" title="Interactive preview" sub="Drag to rotate / Colours appear once a twin has data" grow>
            <div className="hud-twin">
              <TwinBody state={null} selected="skeleton" onSelect={() => {}} />
            </div>
          </HudPanel>
        </div>

        <footer className="hud-foot">
          <span className="hud-label">Educational prototype / Synthetic data / Not for clinical use</span>
          <span className="hud-label">Healthcare digital twin</span>
        </footer>
      </div>
    </main>
  );
}
