"use client";

// Guards a page. Call it at the top of any page that needs a signed-in user
// with one of the given roles. It sends everyone else away:
//   not signed in        -> the sign-in page
//   signed in, wrong role -> the front door, which sends them to their own home
// "ready" is true only when the page is allowed to show its content.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Role, useAuth } from "./AuthProvider";

export function useRequireRole(allowed: Role[]) {
  const router = useRouter();
  const { user, role, name, loading } = useAuth();
  const permitted = !!user && !!role && allowed.includes(role);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (!permitted) router.replace("/");
  }, [loading, user, permitted, router]);

  return { user, role, name, ready: !loading && permitted };
}
