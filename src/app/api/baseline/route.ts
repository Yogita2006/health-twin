// POST /api/baseline
// Recalculates the caller's personal baseline from their most recent resting
// readings. The ingest route does this automatically from time to time; this
// route lets the patient ask for it on demand.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest } from "@/lib/api/auth";
import { computeBaseline } from "@/lib/engine/baseline";
import { BASELINE_MIN_READINGS } from "@/lib/engine/config";
import { Reading } from "@/lib/engine/types";

function fail(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  try {
    const patientRef = adminDb().collection("patients").doc(caller.uid);
    const patientSnap = await patientRef.get();
    if (!patientSnap.exists) return fail(403, "This account has no patient record.");

    const recent = await patientRef.collection("readings").orderBy("ts", "desc").limit(150).get();
    const readings = recent.docs.map((d) => d.data() as Reading);
    const baseline = computeBaseline(readings, Date.now());

    if (!baseline) {
      const resting = readings.filter((r) => r.context === "resting").length;
      return NextResponse.json({
        ok: true,
        established: false,
        message: `A baseline needs ${BASELINE_MIN_READINGS} resting readings. Found ${resting} in the most recent ${readings.length}.`,
      });
    }

    await patientRef.collection("baseline").doc("current").set(baseline);
    return NextResponse.json({
      ok: true,
      established: true,
      message: `Baseline recalculated from ${baseline.n} resting readings. It applies from the next reading.`,
    });
  } catch (err) {
    console.error("baseline recompute failed:", err);
    return fail(500, "The server could not recalculate the baseline. Check the server log.");
  }
}
