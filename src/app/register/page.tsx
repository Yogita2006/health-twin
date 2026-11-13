"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, deleteUser, updateProfile, User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { HudAuth } from "@/components/hud/Hud";

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
    <HudAuth title="Create your account" sub="Educational prototype / Use made-up details only">
      <form onSubmit={handleSubmit}>
        <label className="hud-field">
          <span className="hud-label">Full name</span>
          <input className="hud-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </label>

        <label className="hud-field">
          <span className="hud-label">Email</span>
          <input className="hud-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>

        <label className="hud-field">
          <span className="hud-label">Password (at least 6 characters)</span>
          <input className="hud-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete="new-password" required />
        </label>

        {error && <p className="hud-error">{error}</p>}

        <button type="submit" disabled={busy} className="hud-btn hud-btn-solid hud-btn-block">
          {busy ? "Creating account" : "Create account"}
        </button>

        <p className="hud-text hud-note" style={{ textAlign: "center" }}>
          Already registered?{" "}
          <Link href="/login" className="hud-link">
            Sign in
          </Link>
        </p>
      </form>
    </HudAuth>
  );
}
