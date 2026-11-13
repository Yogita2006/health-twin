"use client";

// Keeps track of who is signed in and what their role is,
// and makes that available to every page through useAuth().
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

export type Role = "patient" | "doctor" | "admin";

type AuthState = {
  user: User | null;
  role: Role | null;
  loading: boolean;
};

const AuthContext = createContext<AuthState>({ user: null, role: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, role: null, loading: true });

  useEffect(() => {
    let stopProfile = () => {};

    // Fires when someone signs in, signs out, or the page reloads.
    const stopAuth = onAuthStateChanged(auth, (user) => {
      stopProfile();

      if (!user) {
        setState({ user: null, role: null, loading: false });
        return;
      }

      // Listen to this account's role document. Because it is a live
      // listener, a role change made by an admin applies immediately.
      stopProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snap) => {
          const role = snap.exists() ? (snap.data().role as Role) : null;
          setState({ user, role, loading: false });
        },
        () => setState({ user, role: null, loading: false })
      );
    });

    return () => {
      stopProfile();
      stopAuth();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
