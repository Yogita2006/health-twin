"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";

const inputClass =
  "w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400";

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
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-8">
        <div>
          <h1 className="text-2xl font-semibold text-cyan-300">Sign in</h1>
          <p className="mt-1 text-sm text-slate-400">Healthcare Digital Twin</p>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="text-slate-300">Email</span>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="text-slate-300">Password</span>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

        <button type="submit" disabled={busy} className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
          {busy ? "Signing in..." : "Sign in"}
        </button>

        <p className="text-center text-sm text-slate-400">
          New here?{" "}
          <Link href="/register" className="text-cyan-300 underline">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  );
}
