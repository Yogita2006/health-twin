// PUT /api/profile
// Saves the caller's own profile. Patients save their personal details;
// doctors and admins only have a name to save.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callerFromRequest, fail, jsonBody, roleOf } from "@/lib/api/auth";
import { nameInput, profileInput } from "@/lib/validation/profile";

export async function PUT(request: Request) {
  const caller = await callerFromRequest(request);
  if ("error" in caller) return fail(401, caller.error);

  try {
    const role = await roleOf(caller.uid);
    if (!role) return fail(403, "This account has no role.");
    const body = await jsonBody(request);
    const db = adminDb();
    const userRef = db.collection("users").doc(caller.uid);

    if (role !== "patient") {
      const parsed = nameInput.safeParse(body);
      if (!parsed.success) return fail(400, "Check the form.", parsed.error.issues.map((issue) => issue.message));
      await userRef.update({ displayName: parsed.data.displayName });
      return NextResponse.json({ ok: true });
    }

    const parsed = profileInput.safeParse(body);
    if (!parsed.success) return fail(400, "Check the form.", parsed.error.issues.map((issue) => issue.message));
    const { displayName, ...profile } = parsed.data;

    const patientRef = db.collection("patients").doc(caller.uid);
    if (!(await patientRef.get()).exists) return fail(403, "This account has no patient record.");

    // Both documents change together, so the name can never differ between them.
    const batch = db.batch();
    batch.update(userRef, { displayName });
    batch.update(patientRef, { displayName, profile });
    await batch.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("profile save failed:", err);
    return fail(500, "The server could not save the profile. Check the server log.");
  }
}
