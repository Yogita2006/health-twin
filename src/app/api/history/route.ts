// POST   /api/history   { record }       add a record to my medical history
// PUT    /api/history   { id, record }   change one of my records
// DELETE /api/history   { id }           delete one of my records
//
// Only the patient can change their own history. Doctors the patient shares
// with can read it (the security rules allow that) but not change it.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest, fail, jsonBody } from "@/lib/api/auth";
import { historyId, historyInput } from "@/lib/validation/history";

const MAX_RECORDS = 300;

// Tidies a valid record before it is stored, so stored data is always consistent.
function clean(record: ReturnType<typeof historyInput.parse>) {
  const medication = record.type === "medication";
  return {
    ...record,
    endDate: record.ongoing ? "" : record.endDate,
    dosage: medication ? record.dosage : "",
    frequency: medication ? record.frequency : "",
  };
}

async function patientHistory(uid: string) {
  const patientRef = adminDb().collection("patients").doc(uid);
  return (await patientRef.get()).exists ? patientRef.collection("history") : null;
}

const part = (body: unknown, key: string): unknown => (typeof body === "object" && body !== null ? (body as Record<string, unknown>)[key] : undefined);

export async function POST(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);
  const parsed = historyInput.safeParse(part(await jsonBody(request), "record"));
  if (!parsed.success) return fail(400, "Check the form.", parsed.error.issues.map((issue) => issue.message));

  try {
    const history = await patientHistory(caller.uid);
    if (!history) return fail(403, "Only patients keep a medical history.");
    const total = (await history.count().get()).data().count;
    if (total >= MAX_RECORDS) return fail(409, `A history can hold at most ${MAX_RECORDS} records.`);

    const now = Date.now();
    await history.add({ ...clean(parsed.data), createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, message: "Record added." });
  } catch (err) {
    console.error("history add failed:", err);
    return fail(500, "The server could not save the record. Check the server log.");
  }
}

export async function PUT(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);
  const body = await jsonBody(request);
  const id = historyId.safeParse(body);
  const parsed = historyInput.safeParse(part(body, "record"));
  if (!id.success) return fail(400, "Say which record to change.");
  if (!parsed.success) return fail(400, "Check the form.", parsed.error.issues.map((issue) => issue.message));

  try {
    const history = await patientHistory(caller.uid);
    if (!history) return fail(403, "Only patients keep a medical history.");
    const ref = history.doc(id.data.id);
    if (!(await ref.get()).exists) return fail(404, "That record no longer exists.");

    await ref.update({ ...clean(parsed.data), updatedAt: Date.now() });
    return NextResponse.json({ ok: true, message: "Record updated." });
  } catch (err) {
    console.error("history update failed:", err);
    return fail(500, "The server could not save the record. Check the server log.");
  }
}

export async function DELETE(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);
  const id = historyId.safeParse(await jsonBody(request));
  if (!id.success) return fail(400, "Say which record to delete.");

  try {
    const history = await patientHistory(caller.uid);
    if (!history) return fail(403, "Only patients keep a medical history.");
    await history.doc(id.data.id).delete();
    return NextResponse.json({ ok: true, message: "Record deleted." });
  } catch (err) {
    console.error("history delete failed:", err);
    return fail(500, "The server could not delete the record. Check the server log.");
  }
}
