"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, updateProfile, User } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { apiError, callApi } from "@/lib/api/client";
import { HudAuth } from "@/components/hud/Hud";

type AccountType = "patient" | "doctor" | "admin";

// "hint" is the one short line shown under the buttons for the chosen type.
const ACCOUNT_TYPES: { id: AccountType; title: string; hint: string }[] = [
  { id: "patient", title: "Patient", hint: "Your own digital twin" },
  { id: "doctor", title: "Doctor", hint: "Demo role / No licence check" },
  { id: "admin", title: "Admin", hint: "Needs the admin key" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("patient");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    let created: User | null = null;
    let message = "";
    try {
      // 1. Create the login. Firebase stores the password; we never do.
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      created = cred.user;
      await updateProfile(cred.user, { displayName: name.trim() });

      if (accountType === "admin") {
        // 2a. An admin account is finished by the server, which checks the admin key.
        //     The browser is never allowed to write the "admin" role itself.
        const result = await callApi(cred.user, "POST", "/api/account/admin", { displayName: name, key: adminKey });
        if (!result.ok) {
          message = apiError(result);
          throw new Error(message);
        }
      } else {
        // 2b. Record the role. The security rules accept "patient" or "doctor" here and nothing else.
        await setDoc(doc(db, "users", cred.user.uid), {
          email: email.trim(),
          displayName: name.trim(),
          role: accountType,
          createdAt: serverTimestamp(),
        });

        // 3. A patient also gets the record that their digital twin hangs from.
        if (accountType === "patient") {
          await setDoc(doc(db, "patients", cred.user.uid), {
            displayName: name.trim(),
            assignedDoctorIds: [],
            createdAt: serverTimestamp(),
          });
        }
      }

      // 4. Send the confirmation email. If sending fails, the account still
      //    works and the email can be sent again from the banner inside the app.
      await sendEmailVerification(cred.user).catch(() => {});

      router.push("/");
    } catch (err) {
      // If the login was created but the rest failed, remove the half-made
      // account so the same email can be used to try again.
      if (created) {
        try {
          await deleteUser(created);
        } catch (cleanupErr) {
          console.error(cleanupErr);
        }
      }
      setError(message || authErrorMessage(err));
    }
    setBusy(false);
  }

  return (
    <HudAuth title="Create your account" sub="Educational prototype / Use made-up details only">
      <form onSubmit={handleSubmit}>
        <span className="hud-label">I am registering as</span>
        <div className="hud-choice" role="radiogroup" aria-label="Account type">
          {ACCOUNT_TYPES.map((type) => (
            <button
              key={type.id}
              type="button"
              role="radio"
              aria-checked={accountType === type.id}
              onClick={() => setAccountType(type.id)}
              className={accountType === type.id ? "hud-choice-item hud-choice-on" : "hud-choice-item"}
            >
              <b>{type.title}</b>
            </button>
          ))}
        </div>
        <p className="hud-label hud-note">{ACCOUNT_TYPES.find((type) => type.id === accountType)?.hint}</p>

        <label className="hud-field">
          <span className="hud-label">Full name</span>
          <input className="hud-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required />
        </label>

        <label className="hud-field">
          <span className="hud-label">Email</span>
          <input className="hud-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>

        <label className="hud-field">
          <span className="hud-label">Password (at least 6 characters)</span>
          <input className="hud-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} autoComplete="new-password" required />
        </label>

        {accountType === "admin" && (
          <label className="hud-field">
            <span className="hud-label">Admin key (set by the site owner)</span>
            <input className="hud-input" type="password" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} autoComplete="off" required />
          </label>
        )}

        {error && <p className="hud-error">{error}</p>}

        <button type="submit" disabled={busy} className="hud-btn hud-btn-solid hud-btn-block">
          {busy ? "Creating account" : `Create ${accountType} account`}
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
