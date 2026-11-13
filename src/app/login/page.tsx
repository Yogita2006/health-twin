"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { HudAuth } from "@/components/hud/Hud";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError(authErrorMessage(err));
    }
    setBusy(false);
  }

  return (
    <HudAuth title="Sign in" sub="Secure session / Firebase Authentication">
      <form onSubmit={handleSubmit}>
        <label className="hud-field">
          <span className="hud-label">Email</span>
          <input className="hud-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>

        <label className="hud-field">
          <span className="hud-label">Password</span>
          <input className="hud-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>

        {error && <p className="hud-error">{error}</p>}

        <button type="submit" disabled={busy} className="hud-btn hud-btn-solid hud-btn-block">
          {busy ? "Signing in" : "Sign in"}
        </button>

        <p className="hud-text hud-note" style={{ textAlign: "center" }}>
          New here?{" "}
          <Link href="/register" className="hud-link">
            Create an account
          </Link>
        </p>
      </form>
    </HudAuth>
  );
}
