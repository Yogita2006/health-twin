// POST   /api/care-team   { doctorId }  share my twin with this doctor
// DELETE /api/care-team   { doctorId }  stop sharing with this doctor
//
// Only the patient can do either. The list of doctors on a patient record is
// what the security rules check before letting a doctor read anything, so it
// is changed here on the server and nowhere else.
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest, fail, jsonBody } from "@/lib/api/auth";
import { doctorInput } from "@/lib/validation/profile";
import { PatientRecord } from "@/lib/patient";

const MAX_DOCTORS = 5;

export async function POST(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  const parsed = doctorInput.safeParse(await jsonBody(request));
  if (!parsed.success) return fail(400, "Choose a doctor to share with.");
  const doctorId = parsed.data.doctorId;

  try {
    const db = adminDb();
    const patientRef = db.collection("patients").doc(caller.uid);
    const patientSnap = await patientRef.get();
    if (!patientSnap.exists) return fail(403, "Only patients can share a twin with a doctor.");
    const patient = patientSnap.data() as PatientRecord;

    // The account chosen must really be a doctor. This is checked here on the
    // server, so access can never be handed to a non-doctor account.
    const doctorSnap = await db.collection("users").doc(doctorId).get();
    if (!doctorSnap.exists || doctorSnap.data()?.role !== "doctor") return fail(404, "That doctor could not be found.");

    if (patient.assignedDoctorIds.includes(doctorId)) return fail(409, "You are already sharing with this doctor.");
    if (patient.assignedDoctorIds.length >= MAX_DOCTORS) return fail(409, `You can share with at most ${MAX_DOCTORS} doctors.`);

    const name = (doctorSnap.data()?.displayName as string | undefined) || "Doctor";
    await patientRef.update({
      assignedDoctorIds: FieldValue.arrayUnion(doctorId),
      [`careTeam.${doctorId}`]: { name, since: Date.now() },
    });
    return NextResponse.json({ ok: true, message: `You are now sharing your twin with ${name}.` });
  } catch (err) {
    console.error("care team add failed:", err);
    return fail(500, "The server could not add the doctor. Check the server log.");
  }
}

export async function DELETE(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  const parsed = doctorInput.safeParse(await jsonBody(request));
  if (!parsed.success) return fail(400, "Say which doctor to remove.");

  try {
    const patientRef = adminDb().collection("patients").doc(caller.uid);
    if (!(await patientRef.get()).exists) return fail(403, "This account has no patient record.");

    await patientRef.update({
      assignedDoctorIds: FieldValue.arrayRemove(parsed.data.doctorId),
      [`careTeam.${parsed.data.doctorId}`]: FieldValue.delete(),
    });
    return NextResponse.json({ ok: true, message: "Sharing stopped. That doctor can no longer see your twin." });
  } catch (err) {
    console.error("care team remove failed:", err);
    return fail(500, "The server could not remove the doctor. Check the server log.");
  }
}
