// POST /api/cardiac   { action, patientId, ... }
//
//   action "assess"    run the prediction model and the suggestion rules
//   action "simulate"  run the what-if comparison for the doctor's assumptions
//   action "save"      store the reviewed session under the patient
//   action "list"      the patient's saved sessions, newest first
//
// Every action first checks that the caller is a doctor and that this patient
// is sharing their twin with that doctor. The models run here on the server.
// "save" recalculates every result from the inputs, so numbers sent by a
// browser are never stored as results.
//
// Sessions live at patients/{patientId}/cardiac/{id}. The security rules do
// not open that path to any browser, so it is reachable only through this route.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest, fail, jsonBody, roleOf } from "@/lib/api/auth";
import { CLEVELAND_CARD, assess } from "@/lib/ml/cardiacModel";
import { FRAMINGHAM_CARD } from "@/lib/ml/heartRisk";
import { suggestionsFor } from "@/lib/cardiac/suggestions";
import { simulate } from "@/lib/cardiac/simulation";
import { CardiacSession, Review } from "@/lib/cardiac/types";
import { cardiacRequest } from "@/lib/validation/cardiac";
import { PatientRecord } from "@/lib/patient";

const MAX_SESSIONS = 100; // per patient
const LISTED = 20;

export async function POST(request: Request) {
  // 1. Who is calling?
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  const parsed = cardiacRequest.safeParse(await jsonBody(request));
  if (!parsed.success) return fail(400, "Check the form.", [...new Set<string>(parsed.error.issues.map((issue) => issue.message))]);
  const body = parsed.data;

  try {
    // 2. Is the caller a doctor, and has this patient shared with them?
    if ((await roleOf(caller.uid)) !== "doctor") return fail(403, "Only doctors can use the cardiac advisor.");

    const patientRef = adminDb().collection("patients").doc(body.patientId);
    const patientSnap = await patientRef.get();
    const patient = patientSnap.exists ? (patientSnap.data() as PatientRecord) : null;
    if (!patient || !patient.assignedDoctorIds.includes(caller.uid)) {
      return fail(403, "This patient is not sharing their twin with you.");
    }
    const sessions = patientRef.collection("cardiac");

    if (body.action === "list") {
      const snap = await sessions.orderBy("createdAt", "desc").limit(LISTED).get();
      return NextResponse.json({
        ok: true,
        sessions: snap.docs.map((doc) => ({ ...doc.data(), id: doc.id })),
        models: { prediction: CLEVELAND_CARD, whatIf: FRAMINGHAM_CARD },
      });
    }

    // 3. Run the trained model and the rules on the server.
    const assessment = assess(body.inputs);
    const suggestions = suggestionsFor(body.inputs, assessment);

    if (body.action === "assess") {
      return NextResponse.json({ ok: true, assessment, suggestions });
    }

    const simulation = simulate(body.inputs, body.assumptions);

    if (body.action === "simulate") {
      return NextResponse.json({ ok: true, simulation });
    }

    // 4. Save. Keep reviews only for suggestions that really exist for these inputs.
    const total = (await sessions.count().get()).data().count;
    if (total >= MAX_SESSIONS) return fail(409, `A patient can have at most ${MAX_SESSIONS} saved sessions.`);

    const reviews: Record<string, Review> = {};
    for (const suggestion of suggestions) {
      const review = body.reviews[suggestion.id];
      if (review) reviews[suggestion.id] = review;
    }
    const doctorSnap = await adminDb().collection("users").doc(caller.uid).get();
    const session: Omit<CardiacSession, "id"> = {
      createdAt: Date.now(),
      doctorId: caller.uid,
      doctorName: (doctorSnap.data()?.displayName as string | undefined) ?? "",
      exampleValues: body.exampleValues,
      inputs: body.inputs,
      assessment,
      suggestions,
      reviews,
      intervention: body.intervention,
      assumptions: body.assumptions,
      simulation,
      notes: body.notes.trim(),
    };
    const saved = await sessions.add(session);
    return NextResponse.json({ ok: true, id: saved.id, message: "Session saved." });
  } catch (err) {
    console.error("cardiac advisor failed:", err);
    return fail(500, "The server could not complete the request. Check the server log.");
  }
}
