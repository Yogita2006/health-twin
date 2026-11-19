// POST /api/admin/role   { uid, role }
// Lets an admin change another account's role. The caller's own role is read
// from the database on the server, so the request cannot simply claim to be an admin.
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest, fail, jsonBody, roleOf } from "@/lib/api/auth";
import { roleInput } from "@/lib/validation/profile";

export async function POST(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  try {
    if ((await roleOf(caller.uid)) !== "admin") return fail(403, "Only an admin can change roles.");

    const parsed = roleInput.safeParse(await jsonBody(request));
    if (!parsed.success) return fail(400, "The request is not valid.");
    const { uid, role } = parsed.data;

    // Stops an admin locking themselves out by mistake.
    if (uid === caller.uid) return fail(409, "You cannot change your own role.");

    const db = adminDb();
    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return fail(404, "That account does not exist.");

    await userRef.update({ role });

    // Anyone who becomes a patient needs a patient record for their twin.
    if (role === "patient") {
      const patientRef = db.collection("patients").doc(uid);
      if (!(await patientRef.get()).exists) {
        await patientRef.set({
          displayName: (userSnap.data()?.displayName as string | undefined) || "Patient",
          assignedDoctorIds: [],
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    return NextResponse.json({ ok: true, message: `Role changed to ${role}.` });
  } catch (err) {
    console.error("role change failed:", err);
    return fail(500, "The server could not change the role. Check the server log.");
  }
}
