"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, deleteUser, updateProfile, User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";

const inputClass =
  "w-full rounded-lg border border-cyan-500/30 bg-slate-900 px-4 py-3 text-slate-100 outline-none focus:border-cyan-400";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    let created: User | null = null;
    try {
      // 1. Create the login. Firebase stores the password; we never do.
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      created = cred.user;
      await updateProfile(cred.user, { displayName: name.trim() });

      // 2. Record the role. Every new account starts as a patient.
      //    The security rules reject any other role here.
      await setDoc(doc(db, "users", cred.user.uid), {
        email: email.trim(),
        displayName: name.trim(),
        role: "patient",
        createdAt: serverTimestamp(),
      });

      // 3. Create the patient record that the digital twin will hang from.
      await setDoc(doc(db, "patients", cred.user.uid), {
        displayName: name.trim(),
        assignedDoctorIds: [],
        createdAt: serverTimestamp(),
      });

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      // If the login was created but saving the profile failed, remove the
      // half-made account so the same email can be used to try again.
      if (created) {
        try {
          await deleteUser(created);
        } catch (cleanupErr) {
          console.error(cleanupErr);
        }
      }
      setError(authErrorMessage(err));
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-5 rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-8">
        <div>
          <h1 className="text-2xl font-semibold text-cyan-300">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">Educational prototype. Use made-up details only.</p>
        </div>

        <label className="block space-y-2 text-sm">
          <span className="text-slate-300">Full name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="text-slate-300">Email</span>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className="block space-y-2 text-sm">
          <span className="text-slate-300">Password (at least 6 characters)</span>
          <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </label>

        {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

        <button type="submit" disabled={busy} className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
          {busy ? "Creating account..." : "Create account"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Already registered?{" "}
          <Link href="/login" className="text-cyan-300 underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
