// POST /api/doctors
// Returns the list of doctors (name and ID only) so that a patient can pick
// one to share their twin with. Any signed-in user may ask. Email addresses
// and everything else about the doctors stay private.
// (It is a POST so that the answer is never cached or prerendered.)
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest, fail } from "@/lib/api/auth";

export async function POST(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  try {
    const snap = await adminDb().collection("users").where("role", "==", "doctor").limit(200).get();
    const doctors = snap.docs
      .map((d) => ({ id: d.id, name: (d.data().displayName as string | undefined) || "Doctor" }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ ok: true, doctors });
  } catch (err) {
    console.error("doctor list failed:", err);
    return fail(500, "The server could not load the list of doctors. Check the server log.");
  }
}
