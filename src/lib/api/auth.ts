// Shared by every API route: works out who is calling from their Firebase ID
// token, and what role that account has.
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export type Caller = { uid: string } | { error: string };

export async function callerFromRequest(request: Request): Promise<Caller> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return { error: "Sign in first." };

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return { error: "Your session is not valid. Sign in again." };
  }
}

// The role is read from the database on every request, never taken from the browser.
export async function roleOf(uid: string): Promise<string | null> {
  const snap = await adminDb().collection("users").doc(uid).get();
  return snap.exists ? ((snap.data()?.role as string | undefined) ?? null) : null;
}

export function fail(status: number, error: string, details?: string[]) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

// Reads a JSON body without throwing when it is missing or malformed.
export async function jsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
