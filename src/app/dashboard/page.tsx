"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

const roleText = {
  patient: "You will see your own digital twin and health history here.",
  doctor: "You will see the patients assigned to you here.",
  admin: "You will manage users, roles and doctor assignments here.",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, loading } = useAuth();

  // Nobody reaches this page without signing in.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        Loading...
      </main>
    );
  }

  async function handleSignOut() {
    await signOut(auth);
    router.replace("/login");
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-cyan-300">Healthcare Digital Twin</h1>
          <button onClick={handleSignOut} className="rounded-lg border border-cyan-500/40 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10">
            Sign out
          </button>
        </header>

        <section className="rounded-2xl border border-cyan-500/20 bg-slate-900/60 p-6">
          <p className="text-sm text-slate-400">Signed in as</p>
          <p className="mt-1 text-xl font-medium">{user.displayName || user.email}</p>
          <p className="text-sm text-slate-400">{user.email}</p>

          <p className="mt-5 text-sm text-slate-400">Role</p>
          <p className="mt-1 inline-block rounded-full border border-cyan-400/50 bg-cyan-400/10 px-3 py-1 text-sm font-medium uppercase tracking-wide text-cyan-200">
            {role ?? "no role yet"}
          </p>

          <p className="mt-5 text-slate-300">
            {role ? roleText[role] : "Your account has no role document yet. Check the Firestore rules are published."}
          </p>
        </section>

        <p className="text-xs text-slate-500">
          Educational prototype using synthetic data. Not a medical device and not for diagnosis.
        </p>
      </div>
    </main>
  );
}
