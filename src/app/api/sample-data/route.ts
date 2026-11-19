// POST /api/sample-data
// Fills a patient's own record with synthetic sample data so that a new user
// has something to look at straight away:
//   - two weeks of daily summaries (only for days that have none), and
//   - if the twin has no readings yet: recent readings, a baseline and a twin state.
// It never overwrites real history. Everything written is labelled "simulated".
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest, fail } from "@/lib/api/auth";
import { computeBaseline } from "@/lib/engine/baseline";
import { addToDaily, dayKey, DailySummary } from "@/lib/engine/daily";
import { makeSampleHistory } from "@/lib/engine/sample";
import { updateTwin } from "@/lib/engine/twin";
import { TwinState } from "@/lib/engine/types";

export async function POST(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  try {
    const db = adminDb();
    const patientRef = db.collection("patients").doc(caller.uid);
    if (!(await patientRef.get()).exists) return fail(403, "Only patients can load sample data.");

    const now = Date.now();
    const { readings, dailies } = makeSampleHistory(now, caller.uid);
    const dailyCol = patientRef.collection("daily");
    const stateRef = patientRef.collection("twin").doc("state");
    const todayRef = dailyCol.doc(dayKey(now));

    const [stateSnap, todaySnap, ...dailySnaps] = await db.getAll(stateRef, todayRef, ...dailies.map((d) => dailyCol.doc(d.day)));

    const batch = db.batch();
    let daysAdded = 0;
    dailies.forEach((daily, i) => {
      if (dailySnaps[i].exists) return; // keep whatever is already there
      batch.set(dailyCol.doc(daily.day), daily);
      daysAdded += 1;
    });

    let readingsAdded = 0;
    if (!stateSnap.exists) {
      // A brand-new twin: run the sample readings through the same engine that
      // real readings go through, so the result is a genuine twin state.
      const baseline = computeBaseline(readings, now);
      let state: TwinState | null = null;
      let today = todaySnap.exists ? (todaySnap.data() as DailySummary) : null;
      for (const reading of readings) {
        state = updateTwin(state, reading, baseline).state;
        today = addToDaily(today, reading, state);
        batch.set(patientRef.collection("readings").doc(), reading);
        readingsAdded += 1;
      }
      if (state) batch.set(stateRef, state);
      if (today) batch.set(todayRef, today);
      if (baseline) batch.set(patientRef.collection("baseline").doc("current"), baseline);
    }

    if (daysAdded === 0 && readingsAdded === 0) {
      return NextResponse.json({ ok: true, message: "Your twin already has data, so nothing was added." });
    }
    await batch.commit();
    return NextResponse.json({
      ok: true,
      message: `Sample data loaded: ${daysAdded} days of history${readingsAdded ? ` and ${readingsAdded} recent readings` : ""}. All of it is synthetic.`,
    });
  } catch (err) {
    console.error("sample data failed:", err);
    return fail(500, "The server could not load the sample data. Check the server log.");
  }
}
