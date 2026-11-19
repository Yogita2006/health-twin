"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { HudAuth } from "@/components/hud/Hud";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push("/"); // the front door sends each role to its own home
    } catch (err) {
      setError(authErrorMessage(err));
    }
    setBusy(false);
  }

  async function handleReset() {
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Type your email address above first, then choose Forgot password.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      // An unknown address is not reported, so nobody can use this to find out who has an account.
      const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
      if (code !== "auth/user-not-found") {
        setError(authErrorMessage(err));
        return;
      }
    }
    setNotice("If an account exists for that address, a password reset email is on its way. Check your spam folder too.");
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
        {notice && <p className="hud-success">{notice}</p>}

        <button type="submit" disabled={busy} className="hud-btn hud-btn-solid hud-btn-block">
          {busy ? "Signing in" : "Sign in"}
        </button>

        <p className="hud-text hud-note" style={{ textAlign: "center" }}>
          <button type="button" onClick={handleReset} className="hud-linkbtn">
            Forgot password?
          </button>
        </p>
        <p className="hud-text hud-plain" style={{ textAlign: "center" }}>
          New here?{" "}
          <Link href="/register" className="hud-link">
            Create an account
          </Link>
        </p>
      </form>
    </HudAuth>
  );
}
