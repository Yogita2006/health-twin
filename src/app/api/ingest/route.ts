// POST /api/ingest
// The only way a reading enters the system. A browser (or, later, a real device)
// sends one reading; this route checks who sent it, validates it, runs the twin
// engine, and saves the reading, the new twin state, the day's summary and any
// alert together.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest } from "@/lib/api/auth";
import { readingInput } from "@/lib/validation/reading";
import { computeBaseline } from "@/lib/engine/baseline";
import { addToDaily, dayKey, DailySummary } from "@/lib/engine/daily";
import { updateTwin } from "@/lib/engine/twin";
import { BASELINE_MIN_READINGS, BASELINE_WINDOW } from "@/lib/engine/config";
import { Baseline, Reading, TwinState } from "@/lib/engine/types";

function fail(status: number, error: string, details?: string[]) {
  return NextResponse.json({ ok: false, error, details }, { status });
}

export async function POST(request: Request) {
  // 1. Who is calling? The browser sends its Firebase ID token.
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);
  const uid = caller.uid;

  // 2. Is the reading well formed?
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "The request body is not valid JSON.");
  }
  const parsed = readingInput.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return fail(400, "The reading failed validation.", details);
  }

  try {
    const db = adminDb();
    const patientRef = db.collection("patients").doc(uid);

    // 3. A caller can only add readings to their own patient record.
    const patientSnap = await patientRef.get();
    if (!patientSnap.exists) return fail(403, "This account has no patient record.");

    // The server sets the time, so a client cannot backdate a reading.
    const reading: Reading = { ...parsed.data, ts: Date.now() };

    const stateRef = patientRef.collection("twin").doc("state");
    const baselineRef = patientRef.collection("baseline").doc("current");
    const readingRef = patientRef.collection("readings").doc();
    const dailyRef = patientRef.collection("daily").doc(dayKey(reading.ts));

    // 4. Run the engine and save everything in one transaction, so the reading,
    //    the twin state, the day's summary and the alert can never disagree.
    const result = await db.runTransaction(async (tx) => {
      const [stateSnap, baselineSnap, dailySnap] = await Promise.all([tx.get(stateRef), tx.get(baselineRef), tx.get(dailyRef)]);
      const previous = stateSnap.exists ? (stateSnap.data() as TwinState) : null;
      const baseline = baselineSnap.exists ? (baselineSnap.data() as Baseline) : null;
      const daily = dailySnap.exists ? (dailySnap.data() as DailySummary) : null;

      const update = updateTwin(previous, reading, baseline);

      tx.set(readingRef, reading);
      tx.set(stateRef, update.state);
      tx.set(dailyRef, addToDaily(daily, reading, update.state));
      for (const alert of update.alerts) {
        tx.set(patientRef.collection("alerts").doc(), alert);
      }
      return update;
    });

    // 5. Establish or refresh the personal baseline at 20, 30, 40, 50 resting
    //    readings, and every 50 after that.
    const count = result.state.restingCount;
    const due =
      reading.context === "resting" &&
      count >= BASELINE_MIN_READINGS &&
      (count <= BASELINE_WINDOW ? count % 10 === 0 : count % BASELINE_WINDOW === 0);

    let baselineUpdated = false;
    if (due) {
      const recent = await patientRef.collection("readings").orderBy("ts", "desc").limit(150).get();
      const baseline = computeBaseline(recent.docs.map((d) => d.data() as Reading), Date.now());
      if (baseline) {
        await baselineRef.set(baseline);
        baselineUpdated = true;
      }
    }

    return NextResponse.json({
      ok: true,
      regions: result.state.regions,
      alerts: result.alerts.length,
      restingCount: count,
      baselineUpdated,
    });
  } catch (err) {
    console.error("ingest failed:", err);
    return fail(500, "The server could not save the reading. Check the server log.");
  }
}
